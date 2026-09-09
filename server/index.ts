import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { CONFIG } from './config.js';
import { initDatabase, db } from './db/index.js';
import { startScheduler, setSchedulerBroadcaster } from './engine/scheduler.js';

import servicesRoutes from './routes/services.js';
import alertsRoutes from './routes/alerts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB schema
initDatabase();

const app = express();
const server = http.createServer(app);

// WebSocket server for real-time live metrics
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'connected', time: new Date().toISOString() }));

  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

const broadcastToWs = (event: string, data: any) => {
  const message = JSON.stringify({ event, data });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
};

setSchedulerBroadcaster(broadcastToWs);

// Express Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/services', servicesRoutes);
app.use('/api/alerts', alertsRoutes);

// Public Status Endpoint
app.get('/api/public/status', (req, res) => {
  const monitors = db.prepare('SELECT id, name, url, current_status, last_checked_at, last_latency_ms FROM monitors WHERE is_paused = 0').all() as any[];

  const services = monitors.map((m) => {
    const dailyHistory = db.prepare(`
      SELECT
        date(created_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count
      FROM checks
      WHERE monitor_id = ? AND created_at >= datetime('now', '-30 days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `).all(m.id) as any[];

    const total = dailyHistory.reduce((acc, d) => acc + d.total, 0);
    const up = dailyHistory.reduce((acc, d) => acc + d.up_count, 0);
    const uptime = total > 0 ? ((up / total) * 100).toFixed(1) : '100.0';

    return {
      id: m.id,
      name: m.name,
      status: m.current_status,
      latency: m.last_latency_ms,
      uptime: parseFloat(uptime),
      dailyHistory,
    };
  });

  const hasDown = services.some((s) => s.status === 'down');
  const hasPending = services.some((s) => s.status === 'pending');

  res.json({
    overallStatus: hasDown ? 'down' : hasPending ? 'degraded' : 'up',
    services,
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    service: 'nabiz.thedemir.com',
  });
});

// Production: Serve static client files
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start server
server.listen(CONFIG.PORT, CONFIG.HOST, () => {
  console.log(`[Nabız] Server running on http://${CONFIG.HOST}:${CONFIG.PORT}`);
  startScheduler();
});

const shutdown = () => {
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
