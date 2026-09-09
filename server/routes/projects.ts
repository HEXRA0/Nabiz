import { Router } from 'express';
import { db } from '../db/index.js';
import {
  getAllProjects,
  executeProjectAction,
  getProjectLogs,
  ProjectProcess
} from '../sys/processManager.js';

const router = Router();

// Get all projects with live RAM and CPU metrics
router.get('/', async (req, res) => {
  try {
    const projects = await getAllProjects();
    res.json(projects);
  } catch (e: any) {
    res.status(500).json({ error: 'Projeler listelenirken hata: ' + e.message });
  }
});

// Add custom project to track
router.post('/', (req, res) => {
  const { name, type = 'port', target, directory, restart_command, log_file_path } = req.body;
  if (!name || !target) {
    return res.status(400).json({ error: 'Proje adı ve hedef (port / PM2 adı / dizin) zorunludur.' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO tracked_projects (name, type, target, directory, restart_command, log_file_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name.trim(), type, target.trim(), directory?.trim() || null, restart_command || null, log_file_path || null);

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (e: any) {
    res.status(500).json({ error: 'Proje eklenemedi: ' + e.message });
  }
});

// Delete custom tracked project
router.delete('/:id', (req, res) => {
  const idStr = req.params.id;
  const numId = parseInt(idStr.replace('custom-', ''), 10);
  if (numId) {
    db.prepare('DELETE FROM tracked_projects WHERE id = ?').run(numId);
  }
  res.json({ success: true });
});

// Project action: restart, stop, start
router.post('/:id/action', async (req, res) => {
  const { action } = req.body;
  if (!['restart', 'stop', 'start'].includes(action)) {
    return res.status(400).json({ error: 'Geçersiz eylem.' });
  }

  try {
    const projects = await getAllProjects();
    const project = projects.find((p) => p.id === req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Proje bulunamadı.' });
    }

    const result = await executeProjectAction(project, action);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'İşlem başarısız: ' + e.message });
  }
});

// Get project logs
router.get('/:id/logs', async (req, res) => {
  try {
    const projects = await getAllProjects();
    const project = projects.find((p) => p.id === req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Proje bulunamadı.' });
    }

    const logs = await getProjectLogs(project, 100);
    res.json({ logs });
  } catch (e: any) {
    res.status(500).json({ error: 'Loglar alınamadı: ' + e.message });
  }
});

export default router;
