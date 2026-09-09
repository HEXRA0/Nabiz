import { Router } from 'express';
import { getSystemStats } from '../sys/systemStats.js';

const router = Router();

// Live system stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await getSystemStats();
    res.json(stats);
  } catch (e: any) {
    res.status(500).json({ error: 'Sistem istatistikleri alınamadı: ' + e.message });
  }
});

export default router;
