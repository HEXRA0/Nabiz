import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { runManualCheck } from '../engine/scheduler.js';

const router = Router();

// Helper to calculate uptime and daily stats
function getMonitorStats(monitorId: number) {
  // 24 Hours stats
  const stats24h = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count,
      AVG(latency_ms) as avg_latency
    FROM checks
    WHERE monitor_id = ? AND created_at >= datetime('now', '-24 hours')
  `).get(monitorId) as any;

  // 30 Days stats
  const stats30d = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count
    FROM checks
    WHERE monitor_id = ? AND created_at >= datetime('now', '-30 days')
  `).get(monitorId) as any;

  // 90 Days daily aggregates for heartbeat status bars
  const dailyHistory = db.prepare(`
    SELECT
      date(created_at) as date,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count,
      AVG(latency_ms) as avg_latency
    FROM checks
    WHERE monitor_id = ? AND created_at >= datetime('now', '-90 days')
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all(monitorId) as any[];

  const uptime24h = stats24h && stats24h.total > 0
    ? ((stats24h.up_count / stats24h.total) * 100).toFixed(2)
    : '100.00';

  const uptime30d = stats30d && stats30d.total > 0
    ? ((stats30d.up_count / stats30d.total) * 100).toFixed(2)
    : '100.00';

  const avgLatency24h = stats24h && stats24h.avg_latency
    ? Math.round(stats24h.avg_latency)
    : 0;

  return {
    uptime24h: parseFloat(uptime24h),
    uptime30d: parseFloat(uptime30d),
    avgLatency24h,
    dailyHistory,
  };
}

// List all monitors
router.get('/', requireAuth, (req, res) => {
  const monitors = db.prepare(`
    SELECT * FROM monitors ORDER BY created_at DESC
  `).all() as any[];

  const enriched = monitors.map((m) => {
    const stats = getMonitorStats(m.id);
    return {
      ...m,
      stats,
    };
  });

  res.json(enriched);
});

// Single monitor details with latency chart data
router.get('/:id', requireAuth, (req, res) => {
  const monitorId = parseInt(req.params.id, 10);
  const monitor = db.prepare('SELECT * FROM monitors WHERE id = ?').get(monitorId) as any;

  if (!monitor) {
    return res.status(404).json({ error: 'Monitör bulunamadı.' });
  }

  const stats = getMonitorStats(monitorId);

  // Latest 100 checks for latency chart
  const recentChecks = db.prepare(`
    SELECT id, status, latency_ms, status_code, message, created_at
    FROM checks
    WHERE monitor_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(monitorId) as any[];

  res.json({
    ...monitor,
    stats,
    recentChecks: recentChecks.reverse(), // ascending for charts
  });
});

// Create monitor
router.post('/', requireAuth, async (req, res) => {
  const {
    name,
    type = 'http',
    url,
    method = 'GET',
    expected_status_code = 200,
    body_search,
    headers,
    timeout_ms = 10000,
    interval_seconds = 60,
    retries_before_down = 2,
  } = req.body;

  if (!name || !url) {
    return res.status(400).json({ error: 'Monitör adı ve URL / adres alanı zorunludur.' });
  }

  let formattedUrl = url.trim();
  if (type === 'http' || type === 'ssl') {
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }
  }

  try {
    const result = db.prepare(`
      INSERT INTO monitors (
        name, type, url, method, expected_status_code,
        body_search, headers, timeout_ms, interval_seconds, retries_before_down,
        current_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      name.trim(),
      type,
      formattedUrl,
      method.toUpperCase(),
      expected_status_code,
      body_search ? body_search.trim() : null,
      headers ? (typeof headers === 'string' ? headers : JSON.stringify(headers)) : null,
      timeout_ms,
      interval_seconds,
      retries_before_down
    );

    const monitorId = result.lastInsertRowid as number;

    // Trigger initial check asynchronously
    runManualCheck(monitorId).catch(console.error);

    const created = db.prepare('SELECT * FROM monitors WHERE id = ?').get(monitorId);
    res.json({ success: true, monitor: created });
  } catch (error: any) {
    res.status(500).json({ error: 'Monitör eklenirken hata: ' + error.message });
  }
});

// Update monitor
router.put('/:id', requireAuth, (req, res) => {
  const monitorId = parseInt(req.params.id, 10);
  const {
    name,
    type,
    url,
    method,
    expected_status_code,
    body_search,
    headers,
    timeout_ms,
    interval_seconds,
    retries_before_down,
  } = req.body;

  let formattedUrl = url?.trim();
  if (formattedUrl && (type === 'http' || type === 'ssl')) {
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }
  }

  try {
    db.prepare(`
      UPDATE monitors
      SET name = COALESCE(?, name),
          type = COALESCE(?, type),
          url = COALESCE(?, url),
          method = COALESCE(?, method),
          expected_status_code = COALESCE(?, expected_status_code),
          body_search = ?,
          headers = ?,
          timeout_ms = COALESCE(?, timeout_ms),
          interval_seconds = COALESCE(?, interval_seconds),
          retries_before_down = COALESCE(?, retries_before_down),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name?.trim(),
      type,
      formattedUrl,
      method?.toUpperCase(),
      expected_status_code,
      body_search !== undefined ? (body_search ? body_search.trim() : null) : undefined,
      headers !== undefined ? (headers ? (typeof headers === 'string' ? headers : JSON.stringify(headers)) : null) : undefined,
      timeout_ms,
      interval_seconds,
      retries_before_down,
      monitorId
    );

    const updated = db.prepare('SELECT * FROM monitors WHERE id = ?').get(monitorId);
    res.json({ success: true, monitor: updated });
  } catch (error: any) {
    res.status(500).json({ error: 'Monitör güncellenirken hata: ' + error.message });
  }
});

// Delete monitor
router.delete('/:id', requireAuth, (req, res) => {
  const monitorId = parseInt(req.params.id, 10);
  db.prepare('DELETE FROM checks WHERE monitor_id = ?').run(monitorId);
  db.prepare('DELETE FROM monitors WHERE id = ?').run(monitorId);
  res.json({ success: true });
});

// Pause / Resume monitor
router.post('/:id/toggle-pause', requireAuth, (req, res) => {
  const monitorId = parseInt(req.params.id, 10);
  const monitor = db.prepare('SELECT is_paused FROM monitors WHERE id = ?').get(monitorId) as any;
  if (!monitor) return res.status(404).json({ error: 'Monitör bulunamadı.' });

  const nextState = monitor.is_paused ? 0 : 1;
  const nextStatus = nextState ? 'paused' : 'pending';

  db.prepare(`
    UPDATE monitors
    SET is_paused = ?, current_status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nextState, nextStatus, monitorId);

  if (nextState === 0) {
    runManualCheck(monitorId).catch(console.error);
  }

  res.json({ success: true, is_paused: nextState, current_status: nextStatus });
});

// Manual check test
router.post('/:id/test', requireAuth, async (req, res) => {
  const monitorId = parseInt(req.params.id, 10);
  const result = await runManualCheck(monitorId);
  if (!result) return res.status(404).json({ error: 'Monitör bulunamadı.' });
  res.json({ success: true, result });
});

export default router;
