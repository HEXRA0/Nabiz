import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Public status page details
router.get('/public/:slug', (req, res) => {
  const slug = req.params.slug || 'default';
  const page = db.prepare('SELECT * FROM status_pages WHERE slug = ?').get(slug) as any;

  if (!page) {
    return res.status(404).json({ error: 'Durum sayfası bulunamadı.' });
  }

  let monitorIds: number[] = [];
  try {
    monitorIds = JSON.parse(page.monitor_ids || '[]');
  } catch (e) {}

  // Fetch monitors
  let monitors: any[] = [];
  if (monitorIds.length > 0) {
    const placeholders = monitorIds.map(() => '?').join(',');
    monitors = db.prepare(`
      SELECT id, name, type, current_status, last_checked_at, last_latency_ms
      FROM monitors
      WHERE id IN (${placeholders}) AND is_paused = 0
    `).all(...monitorIds) as any[];
  } else {
    // If empty, show all active monitors
    monitors = db.prepare(`
      SELECT id, name, type, current_status, last_checked_at, last_latency_ms
      FROM monitors
      WHERE is_paused = 0
    `).all() as any[];
  }

  // Enrich with 90-day history bars
  const enrichedMonitors = monitors.map(m => {
    const dailyHistory = db.prepare(`
      SELECT
        date(created_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count
      FROM checks
      WHERE monitor_id = ? AND created_at >= datetime('now', '-90 days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `).all(m.id) as any[];

    // Calculate 90 days uptime %
    const totalChecks = dailyHistory.reduce((sum, d) => sum + d.total, 0);
    const upChecks = dailyHistory.reduce((sum, d) => sum + d.up_count, 0);
    const uptime = totalChecks > 0 ? ((upChecks / totalChecks) * 100).toFixed(2) : '100.00';

    return {
      id: m.id,
      name: m.name,
      type: m.type,
      status: m.current_status,
      lastCheckedAt: m.last_checked_at,
      lastLatencyMs: m.last_latency_ms,
      uptime: parseFloat(uptime),
      dailyHistory,
    };
  });

  // Fetch active incidents
  const activeIncidents = db.prepare(`
    SELECT i.*, m.name as monitor_name
    FROM incidents i
    LEFT JOIN monitors m ON i.monitor_id = m.id
    WHERE i.status != 'resolved' OR i.created_at >= datetime('now', '-7 days')
    ORDER BY i.created_at DESC
  `).all() as any[];

  const incidentsWithUpdates = activeIncidents.map(inc => {
    const updates = db.prepare(`
      SELECT * FROM incident_updates WHERE incident_id = ? ORDER BY created_at DESC
    `).all(inc.id);
    return { ...inc, updates };
  });

  // Overall system status
  let overallStatus: 'operational' | 'degraded' | 'outage' | 'maintenance' = 'operational';
  const hasDown = enrichedMonitors.some(m => m.status === 'down');
  const hasDegraded = enrichedMonitors.some(m => m.status === 'pending');
  const hasActiveIncidents = activeIncidents.some(i => i.status !== 'resolved');

  if (hasDown) {
    overallStatus = 'outage';
  } else if (hasDegraded || hasActiveIncidents) {
    overallStatus = 'degraded';
  }

  res.json({
    page: {
      title: page.title,
      slug: page.slug,
      description: page.description,
      customCss: page.custom_css,
    },
    overallStatus,
    monitors: enrichedMonitors,
    incidents: incidentsWithUpdates,
  });
});

// Admin: list status pages
router.get('/', requireAuth, (req, res) => {
  const pages = db.prepare('SELECT * FROM status_pages ORDER BY created_at DESC').all();
  res.json(pages);
});

// Admin: update status page
router.put('/:id', requireAuth, (req, res) => {
  const pageId = parseInt(req.params.id, 10);
  const { title, slug, description, is_public, monitor_ids, custom_css } = req.body;

  try {
    db.prepare(`
      UPDATE status_pages
      SET title = COALESCE(?, title),
          slug = COALESCE(?, slug),
          description = COALESCE(?, description),
          is_public = COALESCE(?, is_public),
          monitor_ids = COALESCE(?, monitor_ids),
          custom_css = COALESCE(?, custom_css),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title?.trim(),
      slug?.trim(),
      description?.trim(),
      is_public,
      typeof monitor_ids === 'string' ? monitor_ids : JSON.stringify(monitor_ids || []),
      custom_css,
      pageId
    );

    const updated = db.prepare('SELECT * FROM status_pages WHERE id = ?').get(pageId);
    res.json({ success: true, page: updated });
  } catch (e: any) {
    res.status(500).json({ error: 'Durum sayfası güncellenemedi: ' + e.message });
  }
});

export default router;
