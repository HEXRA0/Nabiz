import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// List all incidents (with updates)
router.get('/', (req, res) => {
  const incidents = db.prepare(`
    SELECT i.*, m.name as monitor_name
    FROM incidents i
    LEFT JOIN monitors m ON i.monitor_id = m.id
    ORDER BY i.created_at DESC
  `).all() as any[];

  const enriched = incidents.map(inc => {
    const updates = db.prepare(`
      SELECT * FROM incident_updates WHERE incident_id = ? ORDER BY created_at DESC
    `).all(inc.id);
    return { ...inc, updates };
  });

  res.json(enriched);
});

// Single incident
router.get('/:id', (req, res) => {
  const incId = parseInt(req.params.id, 10);
  const inc = db.prepare(`
    SELECT i.*, m.name as monitor_name
    FROM incidents i
    LEFT JOIN monitors m ON i.monitor_id = m.id
    WHERE i.id = ?
  `).get(incId) as any;

  if (!inc) return res.status(404).json({ error: 'Olay kaydı bulunamadı.' });

  const updates = db.prepare(`
    SELECT * FROM incident_updates WHERE incident_id = ? ORDER BY created_at DESC
  `).all(incId);

  res.json({ ...inc, updates });
});

// Create incident
router.post('/', requireAuth, (req, res) => {
  const { title, status = 'investigating', severity = 'major', monitor_id, initial_message } = req.body;
  if (!title) return res.status(400).json({ error: 'Olay başlığı zorunludur.' });

  try {
    const result = db.prepare(`
      INSERT INTO incidents (title, status, severity, monitor_id)
      VALUES (?, ?, ?, ?)
    `).run(title.trim(), status, severity, monitor_id || null);

    const incidentId = result.lastInsertRowid;

    if (initial_message) {
      db.prepare(`
        INSERT INTO incident_updates (incident_id, status, message)
        VALUES (?, ?, ?)
      `).run(incidentId, status, initial_message.trim());
    }

    const created = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId);
    res.json({ success: true, incident: created });
  } catch (e: any) {
    res.status(500).json({ error: 'Olay oluşturulamadı: ' + e.message });
  }
});

// Add update / Change status
router.post('/:id/updates', requireAuth, (req, res) => {
  const incidentId = parseInt(req.params.id, 10);
  const { status, message } = req.body;

  if (!message) return res.status(400).json({ error: 'Güncelleme mesajı giriniz.' });

  try {
    const isResolved = status === 'resolved';
    const nowIso = new Date().toISOString();

    db.prepare(`
      UPDATE incidents
      SET status = ?,
          updated_at = CURRENT_TIMESTAMP,
          resolved_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE resolved_at END
      WHERE id = ?
    `).run(status, isResolved ? 1 : 0, incidentId);

    db.prepare(`
      INSERT INTO incident_updates (incident_id, status, message)
      VALUES (?, ?, ?)
    `).run(incidentId, status, message.trim());

    res.json({ success: true, message: 'Olay güncellendi.' });
  } catch (e: any) {
    res.status(500).json({ error: 'Olay güncellenemedi: ' + e.message });
  }
});

// Delete incident
router.delete('/:id', requireAuth, (req, res) => {
  const incidentId = parseInt(req.params.id, 10);
  db.prepare('DELETE FROM incident_updates WHERE incident_id = ?').run(incidentId);
  db.prepare('DELETE FROM incidents WHERE id = ?').run(incidentId);
  res.json({ success: true });
});

export default router;
