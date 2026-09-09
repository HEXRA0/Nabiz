import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// List all heartbeats
router.get('/', requireAuth, (req, res) => {
  const heartbeats = db.prepare(`
    SELECT * FROM heartbeats ORDER BY created_at DESC
  `).all() as any[];

  res.json(heartbeats);
});

// Single heartbeat with logs
router.get('/:id', requireAuth, (req, res) => {
  const hbId = parseInt(req.params.id, 10);
  const hb = db.prepare('SELECT * FROM heartbeats WHERE id = ?').get(hbId) as any;
  if (!hb) return res.status(404).json({ error: 'Kalp atışı tanımı bulunamadı.' });

  const logs = db.prepare(`
    SELECT * FROM heartbeat_logs WHERE heartbeat_id = ? ORDER BY created_at DESC LIMIT 50
  `).all(hbId);

  res.json({ ...hb, logs });
});

// Create heartbeat
router.post('/', requireAuth, (req, res) => {
  const { name, interval_seconds = 300, grace_period_seconds = 60 } = req.body;
  if (!name) return res.status(400).json({ error: 'Kalp atışı adı zorunludur.' });

  const token = crypto.randomBytes(16).toString('hex');

  try {
    const result = db.prepare(`
      INSERT INTO heartbeats (name, token, interval_seconds, grace_period_seconds, current_status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(name.trim(), token, interval_seconds, grace_period_seconds);

    const created = db.prepare('SELECT * FROM heartbeats WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, heartbeat: created });
  } catch (e: any) {
    res.status(500).json({ error: 'Kalp atışı oluşturulamadı: ' + e.message });
  }
});

// Update heartbeat
router.put('/:id', requireAuth, (req, res) => {
  const hbId = parseInt(req.params.id, 10);
  const { name, interval_seconds, grace_period_seconds } = req.body;

  try {
    db.prepare(`
      UPDATE heartbeats
      SET name = COALESCE(?, name),
          interval_seconds = COALESCE(?, interval_seconds),
          grace_period_seconds = COALESCE(?, grace_period_seconds),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name?.trim(), interval_seconds, grace_period_seconds, hbId);

    const updated = db.prepare('SELECT * FROM heartbeats WHERE id = ?').get(hbId);
    res.json({ success: true, heartbeat: updated });
  } catch (e: any) {
    res.status(500).json({ error: 'Güncelleme hatası: ' + e.message });
  }
});

// Delete heartbeat
router.delete('/:id', requireAuth, (req, res) => {
  const hbId = parseInt(req.params.id, 10);
  db.prepare('DELETE FROM heartbeat_logs WHERE heartbeat_id = ?').run(hbId);
  db.prepare('DELETE FROM heartbeats WHERE id = ?').run(hbId);
  res.json({ success: true });
});

// Regenerate token
router.post('/:id/regenerate-token', requireAuth, (req, res) => {
  const hbId = parseInt(req.params.id, 10);
  const newToken = crypto.randomBytes(16).toString('hex');
  db.prepare('UPDATE heartbeats SET token = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newToken, hbId);
  res.json({ success: true, token: newToken });
});

export default router;
