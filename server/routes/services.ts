import { Router } from 'express';
import { db } from '../db/index.js';
import { runManualCheck } from '../engine/scheduler.js';

const router = Router();

// Helper to get stats & 30-day bars
function getServiceStats(monitorId: number) {
  const stats24h = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count,
      AVG(latency_ms) as avg_latency
    FROM checks
    WHERE monitor_id = ? AND created_at >= datetime('now', '-24 hours')
  `).get(monitorId) as any;

  const dailyHistory = db.prepare(`
    SELECT
      date(created_at) as date,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count,
      AVG(latency_ms) as avg_latency
    FROM checks
    WHERE monitor_id = ? AND created_at >= datetime('now', '-30 days')
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all(monitorId) as any[];

  const uptime24h = stats24h && stats24h.total > 0
    ? ((stats24h.up_count / stats24h.total) * 100).toFixed(1)
    : '100.0';

  const avgLatency = stats24h && stats24h.avg_latency
    ? Math.round(stats24h.avg_latency)
    : 0;

  return {
    uptime24h: parseFloat(uptime24h),
    avgLatency,
    dailyHistory,
  };
}

// List all services
router.get('/', (req, res) => {
  const monitors = db.prepare('SELECT * FROM monitors ORDER BY created_at DESC').all() as any[];
  const services = monitors.map((m) => {
    const stats = getServiceStats(m.id);
    const recentChecks = db.prepare(`
      SELECT id, status, latency_ms, status_code, message, created_at
      FROM checks
      WHERE monitor_id = ?
      ORDER BY created_at DESC
      LIMIT 30
    `).all(m.id) as any[];

    return {
      ...m,
      stats,
      recentChecks: recentChecks.reverse(),
    };
  });

  res.json(services);
});

// Add new service
router.post('/', async (req, res) => {
  const { name, url, interval_seconds = 60 } = req.body;

  if (!name || !url) {
    return res.status(400).json({ error: 'Servis adı ve adresi zorunludur.' });
  }

  let formattedUrl = url.trim();
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = 'https://' + formattedUrl;
  }

  try {
    const result = db.prepare(`
      INSERT INTO monitors (name, type, url, method, expected_status_code, interval_seconds, current_status)
      VALUES (?, 'http', ?, 'GET', 200, ?, 'pending')
    `).run(name.trim(), formattedUrl, Number(interval_seconds) || 60);

    const newId = result.lastInsertRowid as number;
    runManualCheck(newId).catch(console.error);

    const created = db.prepare('SELECT * FROM monitors WHERE id = ?').get(newId);
    res.json({ success: true, service: created });
  } catch (error: any) {
    res.status(500).json({ error: 'Servis eklenirken hata: ' + error.message });
  }
});

// Update service
router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, url, interval_seconds } = req.body;

  let formattedUrl = url?.trim();
  if (formattedUrl && !formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = 'https://' + formattedUrl;
  }

  try {
    db.prepare(`
      UPDATE monitors
      SET name = COALESCE(?, name),
          url = COALESCE(?, url),
          interval_seconds = COALESCE(?, interval_seconds),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name?.trim(), formattedUrl, interval_seconds, id);

    const updated = db.prepare('SELECT * FROM monitors WHERE id = ?').get(id);
    res.json({ success: true, service: updated });
  } catch (error: any) {
    res.status(500).json({ error: 'Güncelleme hatası: ' + error.message });
  }
});

// Delete service
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare('DELETE FROM checks WHERE monitor_id = ?').run(id);
  db.prepare('DELETE FROM monitors WHERE id = ?').run(id);
  res.json({ success: true });
});

// Toggle pause
router.post('/:id/toggle', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const monitor = db.prepare('SELECT is_paused FROM monitors WHERE id = ?').get(id) as any;
  if (!monitor) return res.status(404).json({ error: 'Servis bulunamadı.' });

  const nextState = monitor.is_paused ? 0 : 1;
  const nextStatus = nextState ? 'paused' : 'pending';

  db.prepare(`
    UPDATE monitors
    SET is_paused = ?, current_status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nextState, nextStatus, id);

  if (nextState === 0) {
    runManualCheck(id).catch(console.error);
  }

  res.json({ success: true, is_paused: nextState, current_status: nextStatus });
});

// Trigger instant test
router.post('/:id/test', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const result = await runManualCheck(id);
  if (!result) return res.status(404).json({ error: 'Servis bulunamadı.' });
  res.json({ success: true, result });
});

export default router;
