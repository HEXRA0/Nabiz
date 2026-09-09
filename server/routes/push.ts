import { Router } from 'express';
import { db } from '../db/index.js';
import { broadcastAlert } from '../notifications/index.js';

const router = Router();

// Endpoint for cron jobs & workers: GET or POST /api/push/:token
const handlePush = async (req: any, res: any) => {
  const token = req.params.token;
  if (!token) {
    return res.status(400).json({ ok: false, error: 'Token missing' });
  }

  const hb = db.prepare('SELECT * FROM heartbeats WHERE token = ?').get(token) as any;
  if (!hb) {
    return res.status(404).json({ ok: false, error: 'Invalid heartbeat token' });
  }

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  const nowIso = new Date().toISOString();
  const prevStatus = hb.current_status;

  // Insert heartbeat log
  db.prepare(`
    INSERT INTO heartbeat_logs (heartbeat_id, status, duration_ms, message, client_ip)
    VALUES (?, 'up', ?, ?, ?)
  `).run(
    hb.id,
    req.body?.duration_ms ? parseInt(req.body.duration_ms, 10) : 0,
    req.body?.msg || req.query?.msg || 'Sinyal alındı (OK)',
    String(clientIp)
  );

  // Update heartbeat status to 'up' and reset consecutive failures
  db.prepare(`
    UPDATE heartbeats
    SET current_status = 'up',
        last_ping_at = ?,
        consecutive_failures = 0,
        updated_at = ?
    WHERE id = ?
  `).run(nowIso, nowIso, hb.id);

  if (prevStatus === 'down') {
    broadcastAlert({
      event: 'heartbeat_up',
      title: `Kalp Atışı Düzeldi: ${hb.name}`,
      name: hb.name,
      message: 'Periyodik görev yeniden sinyal göndermeye başladı.',
      timestamp: nowIso,
    }).catch(console.error);
  }

  res.json({ ok: true, status: 'up', message: `Heartbeat '${hb.name}' updated successfully.` });
};

router.get('/:token', handlePush);
router.post('/:token', handlePush);

export default router;
