import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { sendNotificationToChannel } from '../notifications/index.js';

const router = Router();

// List all notification channels
router.get('/', requireAuth, (req, res) => {
  const channels = db.prepare('SELECT * FROM notification_channels ORDER BY created_at DESC').all() as any[];
  const logs = db.prepare('SELECT * FROM notification_logs ORDER BY created_at DESC LIMIT 50').all();
  res.json({ channels, logs });
});

// Create notification channel
router.post('/', requireAuth, (req, res) => {
  const { name, type, config_json, is_active = 1, events_json } = req.body;
  if (!name || !type || !config_json) {
    return res.status(400).json({ error: 'Kanal adı, türü ve yapılandırma bilgisi zorunludur.' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO notification_channels (name, type, config_json, is_active, events_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      type,
      typeof config_json === 'string' ? config_json : JSON.stringify(config_json),
      is_active,
      typeof events_json === 'string' ? events_json : JSON.stringify(events_json || ['down', 'up'])
    );

    const created = db.prepare('SELECT * FROM notification_channels WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, channel: created });
  } catch (e: any) {
    res.status(500).json({ error: 'Kanal eklenemedi: ' + e.message });
  }
});

// Update notification channel
router.put('/:id', requireAuth, (req, res) => {
  const channelId = parseInt(req.params.id, 10);
  const { name, type, config_json, is_active, events_json } = req.body;

  try {
    db.prepare(`
      UPDATE notification_channels
      SET name = COALESCE(?, name),
          type = COALESCE(?, type),
          config_json = COALESCE(?, config_json),
          is_active = COALESCE(?, is_active),
          events_json = COALESCE(?, events_json)
      WHERE id = ?
    `).run(
      name?.trim(),
      type,
      config_json ? (typeof config_json === 'string' ? config_json : JSON.stringify(config_json)) : undefined,
      is_active,
      events_json ? (typeof events_json === 'string' ? events_json : JSON.stringify(events_json)) : undefined,
      channelId
    );

    const updated = db.prepare('SELECT * FROM notification_channels WHERE id = ?').get(channelId);
    res.json({ success: true, channel: updated });
  } catch (e: any) {
    res.status(500).json({ error: 'Kanal güncellenemedi: ' + e.message });
  }
});

// Delete channel
router.delete('/:id', requireAuth, (req, res) => {
  const channelId = parseInt(req.params.id, 10);
  db.prepare('DELETE FROM notification_channels WHERE id = ?').run(channelId);
  res.json({ success: true });
});

// Test channel
router.post('/:id/test', requireAuth, async (req, res) => {
  const channelId = parseInt(req.params.id, 10);
  const channel = db.prepare('SELECT * FROM notification_channels WHERE id = ?').get(channelId) as any;
  if (!channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });

  const testPayload = {
    event: 'up' as const,
    title: 'Nabız Bildirim Testi',
    name: 'Örnek Servis Testi',
    url: 'https://nabiz.thedemir.com',
    message: 'Bu mesaj Nabız Bildirim Motoru tarafından test amacıyla gönderilmiştir.',
    statusCode: 200,
    latencyMs: 42,
    timestamp: new Date().toISOString(),
  };

  const success = await sendNotificationToChannel(channel, testPayload);
  if (success) {
    res.json({ success: true, message: 'Test bildirimi başarıyla gönderildi!' });
  } else {
    res.status(500).json({ error: 'Bildirim gönderilemedi. Lütfen token / webhook adresinizi kontrol edin.' });
  }
});

export default router;
