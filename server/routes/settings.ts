import { Router } from 'express';
import os from 'os';
import { db } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Get settings and system stats
router.get('/', requireAuth, (req, res) => {
  const settingsRows = db.prepare('SELECT * FROM settings').all() as any[];
  const settings: Record<string, string> = {};
  for (const s of settingsRows) {
    settings[s.key] = s.value;
  }

  const monitorCount = db.prepare('SELECT COUNT(*) as count FROM monitors').get() as any;
  const heartbeatCount = db.prepare('SELECT COUNT(*) as count FROM heartbeats').get() as any;
  const checksCount = db.prepare('SELECT COUNT(*) as count FROM checks').get() as any;

  const systemInfo = {
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsageMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    cpuCount: os.cpus().length,
    dbStats: {
      totalMonitors: monitorCount.count,
      totalHeartbeats: heartbeatCount.count,
      totalChecksRecorded: checksCount.count,
    }
  };

  res.json({ settings, systemInfo });
});

// Update settings
router.post('/', requireAuth, (req, res) => {
  const newSettings = req.body;
  if (!newSettings || typeof newSettings !== 'object') {
    return res.status(400).json({ error: 'Geçersiz ayar verisi.' });
  }

  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  const tx = db.transaction((entries: [string, any][]) => {
    for (const [k, v] of entries) {
      upsert.run(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
  });

  tx(Object.entries(newSettings));

  res.json({ success: true, message: 'Ayarlar kaydedildi.' });
});

export default router;
