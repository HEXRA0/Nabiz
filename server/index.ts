import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { CONFIG } from './config.js';
import { initDatabase } from './db/index.js';
import { initProjectTables, getAllProjects } from './sys/processManager.js';
import { getSystemStats } from './sys/systemStats.js';

import projectsRoutes from './routes/projects.js';
import systemRoutes from './routes/system.js';
import trafficRoutes from './routes/traffic.js';
import { startTrafficMonitoring, getTrafficSummary } from './sys/trafficMonitor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB schema & tables
initDatabase();
initProjectTables();
startTrafficMonitoring();

const app = express();
const server = http.createServer(app);

// WebSocket server for streaming real-time RAM/CPU & Traffic updates to the UI
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set<WebSocket>();

wss.on('connection', async (ws) => {
  clients.add(ws);

  // Send initial data immediately
  try {
    const [system, projects] = await Promise.all([getSystemStats(), getAllProjects()]);
    const traffic = getTrafficSummary();
    ws.send(JSON.stringify({ event: 'system_metrics', data: { system, projects, traffic } }));
  } catch (e) {}

  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

// Periodic broadcaster: every 2 seconds pushes fresh RAM, CPU & Traffic stats
setInterval(async () => {
  if (clients.size === 0) return;
  try {
    const [system, projects] = await Promise.all([getSystemStats(), getAllProjects()]);
    const traffic = getTrafficSummary();
    const message = JSON.stringify({ event: 'system_metrics', data: { system, projects, traffic } });
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  } catch (e) {}
}, 2000);

// Express Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/projects', projectsRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/traffic', trafficRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'nabiz.thedemir.com',
    uptime: Math.floor(process.uptime()),
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
  console.log(`[Nabız Server Manager] Running on http://${CONFIG.HOST}:${CONFIG.PORT}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
