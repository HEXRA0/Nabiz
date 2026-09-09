import axios from 'axios';
import { db } from '../db/index.js';

export interface AlertPayload {
  event: 'down' | 'up' | 'ssl_expiry' | 'heartbeat_down' | 'heartbeat_up';
  title: string;
  name: string;
  url?: string;
  message: string;
  statusCode?: number;
  latencyMs?: number;
  timestamp: string;
}

export async function sendNotificationToChannel(channel: any, payload: AlertPayload): Promise<boolean> {
  let config: any = {};
  try {
    config = JSON.parse(channel.config_json || '{}');
  } catch (e) {
    console.error('Invalid config_json for channel', channel.id);
    return false;
  }

  let events: string[] = ['down', 'up', 'ssl_expiry', 'heartbeat_down', 'heartbeat_up'];
  try {
    events = JSON.parse(channel.events_json || '[]');
  } catch (e) {}

  if (events.length > 0 && !events.includes(payload.event)) {
    return false; // Channel does not subscribe to this event
  }

  try {
    if (channel.type === 'discord') {
      const color = payload.event === 'up' || payload.event === 'heartbeat_up' ? 3066993 : 15158332; // Green or Red
      const embed = {
        title: `${payload.event === 'up' || payload.event === 'heartbeat_up' ? '🟢 DÜZELDİ' : '🔴 KESİNTİ'}: ${payload.name}`,
        description: payload.message,
        color,
        fields: [
          ...(payload.url ? [{ name: 'URL / Hedef', value: payload.url, inline: true }] : []),
          ...(payload.latencyMs !== undefined ? [{ name: 'Yanıt Süresi', value: `${payload.latencyMs} ms`, inline: true }] : []),
          ...(payload.statusCode ? [{ name: 'Durum Kodu', value: `${payload.statusCode}`, inline: true }] : []),
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'Nabız Monitoring • nabiz.thedemir.com' }
      };

      await axios.post(config.webhookUrl, {
        username: 'Nabız Uptime',
        embeds: [embed]
      }, { timeout: 8000 });

    } else if (channel.type === 'telegram') {
      const icon = payload.event === 'up' || payload.event === 'heartbeat_up' ? '🟢' : '🔴';
      const text = `${icon} *${payload.event === 'up' || payload.event === 'heartbeat_up' ? 'DÜZELDİ' : 'KESİNTİ TESPİT EDİLDİ'}*\n\n` +
        `*Servis:* ${payload.name}\n` +
        (payload.url ? `*Hedef:* \`${payload.url}\`\n` : '') +
        `*Detay:* ${payload.message}\n` +
        (payload.latencyMs ? `*Gecikme:* ${payload.latencyMs} ms\n` : '') +
        `*Zaman:* ${payload.timestamp}\n\n` +
        `_nabiz.thedemir.com_`;

      const botToken = config.botToken;
      const chatId = config.chatId;

      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }, { timeout: 8000 });

    } else if (channel.type === 'webhook') {
      await axios.post(config.url, {
        event: payload.event,
        monitor: payload.name,
        target: payload.url,
        message: payload.message,
        statusCode: payload.statusCode,
        latencyMs: payload.latencyMs,
        timestamp: payload.timestamp,
      }, {
        headers: config.headers ? (typeof config.headers === 'string' ? JSON.parse(config.headers) : config.headers) : {},
        timeout: 8000,
      });
    }

    // Log notification
    db.prepare(`
      INSERT INTO notification_logs (channel_id, event_type, target_name, status, message)
      VALUES (?, ?, ?, 'sent', ?)
    `).run(channel.id, payload.event, payload.name, payload.message);

    return true;
  } catch (error: any) {
    console.error(`Failed to send notification via ${channel.name} (${channel.type}):`, error.message);
    db.prepare(`
      INSERT INTO notification_logs (channel_id, event_type, target_name, status, message)
      VALUES (?, ?, ?, 'failed', ?)
    `).run(channel.id, payload.event, payload.name, error.message);
    return false;
  }
}

export async function broadcastAlert(payload: AlertPayload) {
  try {
    const channels = db.prepare('SELECT * FROM notification_channels WHERE is_active = 1').all() as any[];
    for (const ch of channels) {
      await sendNotificationToChannel(ch, payload);
    }
  } catch (e) {
    console.error('Error broadcasting alerts:', e);
  }
}
