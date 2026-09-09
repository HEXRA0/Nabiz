import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { CONFIG } from './config.js';
import { initDatabase } from './db/index.js';
import { startScheduler, setSchedulerBroadcaster } from './engine/scheduler.js';

import authRoutes from './routes/auth.js';
import monitorRoutes from './routes/monitors.js';
import heartbeatRoutes from './routes/heartbeats.js';
import pushRoutes from './routes/push.js';
import incidentRoutes from './routes/incidents.js';
import statusPageRoutes from './routes/statusPages.js';
import notificationChannelRoutes from './routes/notificationChannels.js';
import settingsRoutes from './routes/settings.js';

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

  ws.on('close', () => {
    clients.delete(ws);
  });

  ws.on('error', () => {
    clients.delete(ws);
  });
});

const broadcastToWs = (event: string, data: any) => {
  const message = JSON.stringify({ event, data });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
};

// Connect scheduler to WS broadcaster
setSchedulerBroadcaster(broadcastToWs);

// Express Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/monitors', monitorRoutes);
app.use('/api/heartbeats', heartbeatRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/status-pages', statusPageRoutes);
app.use('/api/notification-channels', notificationChannelRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
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
  console.log(`[Nabız] Environment: ${CONFIG.NODE_ENV}`);
  console.log(`[Nabız] Data storage: ${CONFIG.DB_FILE}`);

  // Start background monitoring engine
  startScheduler();
});

// Graceful termination
const shutdown = () => {
  console.log('[Nabız] Gracefully shutting down...');
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
