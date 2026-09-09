import { db } from '../db/index.js';
import { checkMonitor, CheckResult } from './checker.js';
import { broadcastAlert } from '../notifications/index.js';

let isRunning = false;
let intervalTimer: NodeJS.Timeout | null = null;
type EventBroadcaster = (event: string, data: any) => void;
let broadcaster: EventBroadcaster = () => {};

export function setSchedulerBroadcaster(fn: EventBroadcaster) {
  broadcaster = fn;
}

export function startScheduler() {
  if (isRunning) return;
  isRunning = true;
  console.log('[Scheduler] Uptime monitoring scheduler started.');

  intervalTimer = setInterval(async () => {
    try {
      await tickMonitors();
    } catch (e) {
      console.error('[Scheduler] Error in scheduler tick:', e);
    }
  }, 3000);

  tickMonitors().catch(console.error);
}

export function stopScheduler() {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
  isRunning = false;
  console.log('[Scheduler] Uptime monitoring scheduler stopped.');
}

export async function runManualCheck(monitorId: number): Promise<CheckResult | null> {
  const monitor = db.prepare('SELECT * FROM monitors WHERE id = ?').get(monitorId) as any;
  if (!monitor) return null;

  const result = await checkMonitor(monitor);
  await recordCheckResult(monitor, result);
  return result;
}

async function tickMonitors() {
  const monitors = db.prepare(`
    SELECT * FROM monitors
    WHERE is_paused = 0
    AND (
      last_checked_at IS NULL
      OR (strftime('%s', 'now') - strftime('%s', last_checked_at)) >= interval_seconds
    )
  `).all() as any[];

  for (const monitor of monitors) {
    try {
      const result = await checkMonitor(monitor);
      await recordCheckResult(monitor, result);
    } catch (e) {
      console.error(`[Scheduler] Check failed for monitor ${monitor.id} (${monitor.name}):`, e);
    }
  }
}

async function recordCheckResult(monitor: any, result: CheckResult) {
  const nowIso = new Date().toISOString();
  const prevStatus = monitor.current_status;
  const retriesBeforeDown = monitor.retries_before_down || 2;

  let newConsecutiveFailures = monitor.consecutive_failures || 0;
  let newStatus = prevStatus;

  if (result.status === 'down') {
    newConsecutiveFailures += 1;
    if (newConsecutiveFailures >= retriesBeforeDown) {
      newStatus = 'down';
    }
  } else {
    newConsecutiveFailures = 0;
    newStatus = 'up';
  }

  // Insert check record
  db.prepare(`
    INSERT INTO checks (monitor_id, status, latency_ms, status_code, message)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    monitor.id,
    result.status,
    result.latencyMs,
    result.statusCode || null,
    result.message || null
  );

  // Update monitor status
  db.prepare(`
    UPDATE monitors
    SET current_status = ?,
        last_checked_at = ?,
        last_latency_ms = ?,
        last_error = ?,
        ssl_days_remaining = ?,
        ssl_expiry_date = ?,
        consecutive_failures = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    newStatus,
    nowIso,
    result.latencyMs,
    result.status === 'down' ? result.message : null,
    result.sslDaysRemaining ?? monitor.ssl_days_remaining,
    result.sslExpiryDate ?? monitor.ssl_expiry_date,
    newConsecutiveFailures,
    nowIso,
    monitor.id
  );

  // Broadcast realtime event to WebSocket clients
  broadcaster('monitor_checked', {
    monitorId: monitor.id,
    name: monitor.name,
    status: newStatus,
    latencyMs: result.latencyMs,
    statusCode: result.statusCode,
    message: result.message,
    timestamp: nowIso,
  });

  // Check for status transition to trigger alert
  if (prevStatus !== 'pending' && prevStatus !== newStatus) {
    console.log(`[Alert] Monitor ${monitor.name} status changed: ${prevStatus} -> ${newStatus}`);

    broadcastAlert({
      event: newStatus === 'up' ? 'up' : 'down',
      name: monitor.name,
      url: monitor.url,
      message: result.message || (newStatus === 'up' ? 'Servis normal çalışmaya başladı' : 'Servise ulaşılamıyor'),
      statusCode: result.statusCode,
      latencyMs: result.latencyMs,
      timestamp: nowIso,
    }).catch(console.error);

    broadcaster('monitor_status_changed', {
      monitorId: monitor.id,
      name: monitor.name,
      prevStatus,
      newStatus,
      timestamp: nowIso,
    });
  }
}
