import { Router } from 'express';
import { getTrafficSummary } from '../sys/trafficMonitor.js';

const router = Router();

// GET /api/traffic/summary - full summary, domain breakdowns, history, recent logs
router.get('/summary', (req, res) => {
  try {
    const summary = getTrafficSummary();
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Trafik verileri alınamadı' });
  }
});

// GET /api/traffic/logs - recent logs stream
router.get('/logs', (req, res) => {
  try {
    const summary = getTrafficSummary();
    const project = req.query.project as string;
    if (project && project !== 'all') {
      const filtered = summary.recentLogs.filter((l) => l.project === project);
      return res.json(filtered);
    }
    res.json(summary.recentLogs);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Loglar alınamadı' });
  }
});

export default router;
