import axios from 'axios';
import { db } from '../db/index.js';

export interface AlertPayload {
  event: 'down' | 'up';
  name: string;
  url: string;
  message: string;
  statusCode?: number;
  latencyMs?: number;
  timestamp: string;
}

export async function broadcastAlert(payload: AlertPayload) {
  const telegramRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('alert_telegram') as any;
  const discordRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('alert_discord') as any;

  // 1. Telegram
  if (telegramRow) {
    try {
      const tg = JSON.parse(telegramRow.value);
      if (tg.enabled && tg.botToken && tg.chatId) {
        const icon = payload.event === 'up' ? '🟢' : '🔴';
        const title = payload.event === 'up' ? 'DÜZELDİ (UP)' : 'KESİNTİ TESPİT EDİLDİ (DOWN)';
        const text = `${icon} *${title}*\n\n` +
          `*Servis:* ${payload.name}\n` +
          `*Adres:* \`${payload.url}\`\n` +
          `*Detay:* ${payload.message}\n` +
          (payload.latencyMs ? `*Gecikme:* ${payload.latencyMs} ms\n` : '') +
          `*Zaman:* ${payload.timestamp}\n\n` +
          `_nabiz.thedemir.com_`;

        await axios.post(`https://api.telegram.org/bot${tg.botToken}/sendMessage`, {
          chat_id: tg.chatId,
          text,
          parse_mode: 'Markdown',
        }, { timeout: 8000 });
      }
    } catch (e: any) {
      console.error('[Notification] Telegram error:', e.message);
    }
  }

  // 2. Discord
  if (discordRow) {
    try {
      const dc = JSON.parse(discordRow.value);
      if (dc.enabled && dc.webhookUrl) {
        const color = payload.event === 'up' ? 3066993 : 15158332;
        await axios.post(dc.webhookUrl, {
          username: 'Nabız Uptime',
          embeds: [{
            title: `${payload.event === 'up' ? '🟢 DÜZELDİ' : '🔴 KESİNTİ'}: ${payload.name}`,
            description: payload.message,
            color,
            fields: [
              { name: 'URL / Adres', value: payload.url, inline: true },
              ...(payload.latencyMs !== undefined ? [{ name: 'Yanıt Süresi', value: `${payload.latencyMs} ms`, inline: true }] : []),
            ],
            timestamp: new Date().toISOString(),
            footer: { text: 'Nabız • nabiz.thedemir.com' }
          }]
        }, { timeout: 8000 });
      }
    } catch (e: any) {
      console.error('[Notification] Discord error:', e.message);
    }
  }
}
