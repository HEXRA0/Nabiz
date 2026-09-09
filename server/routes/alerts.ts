import { Router } from 'express';
import axios from 'axios';
import { db } from '../db/index.js';

const router = Router();

// Get notification config
router.get('/', (req, res) => {
  const telegramRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('alert_telegram') as any;
  const discordRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('alert_discord') as any;

  let telegram = { botToken: '', chatId: '', enabled: false };
  let discord = { webhookUrl: '', enabled: false };

  try {
    if (telegramRow) telegram = JSON.parse(telegramRow.value);
  } catch (e) {}

  try {
    if (discordRow) discord = JSON.parse(discordRow.value);
  } catch (e) {}

  res.json({ telegram, discord });
});

// Save notification config
router.post('/', (req, res) => {
  const { telegram, discord } = req.body;

  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  if (telegram) {
    upsert.run('alert_telegram', JSON.stringify(telegram));
  }
  if (discord) {
    upsert.run('alert_discord', JSON.stringify(discord));
  }

  res.json({ success: true, message: 'Bildirim ayarları kaydedildi.' });
});

// Test alert
router.post('/test', async (req, res) => {
  const { type, config } = req.body;

  try {
    if (type === 'telegram') {
      const { botToken, chatId } = config || {};
      if (!botToken || !chatId) {
        return res.status(400).json({ error: 'Bot Token ve Chat ID gereklidir.' });
      }

      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text: `🟢 *NABIZ BİLDİRİM TESTİ*\n\nTelegram bildirim entegrasyonunuz başarıyla çalışıyor!\n_nabiz.thedemir.com_`,
        parse_mode: 'Markdown',
      }, { timeout: 8000 });

      return res.json({ success: true, message: 'Telegram test mesajı iletildi!' });
    } else if (type === 'discord') {
      const { webhookUrl } = config || {};
      if (!webhookUrl) {
        return res.status(400).json({ error: 'Webhook URL gereklidir.' });
      }

      await axios.post(webhookUrl, {
        username: 'Nabız',
        embeds: [{
          title: '🟢 NABIZ BİLDİRİM TESTİ',
          description: 'Discord Webhook bildirim entegrasyonunuz başarıyla çalışıyor!',
          color: 3066993,
          timestamp: new Date().toISOString(),
          footer: { text: 'nabiz.thedemir.com' }
        }]
      }, { timeout: 8000 });

      return res.json({ success: true, message: 'Discord test mesajı iletildi!' });
    }

    res.status(400).json({ error: 'Geçersiz bildirim türü.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Test mesajı gönderilemedi: ' + (error.response?.data?.description || error.message) });
  }
});

export default router;
