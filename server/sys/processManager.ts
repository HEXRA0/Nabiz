import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { db } from '../db/index.js';

const execAsync = util.promisify(exec);

export interface ProjectProcess {
  id: string;
  name: string;
  type: 'pm2' | 'docker' | 'port' | 'process';
  pid?: number;
  port?: number | string;
  status: 'online' | 'stopped' | 'errored' | 'high_memory';
  memoryBytes: number;
  memoryMb: number;
  memoryPercent: number; // percentage of total server RAM
  cpuPercent: number;
  uptimeSeconds: number;
  restarts?: number;
  command?: string;
  logPath?: string;
  directory?: string;
  isCustom?: boolean;
}

// Ensure database table for user configured projects
export function initProjectTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracked_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'port', -- 'port', 'pm2', 'docker', 'process'
      target TEXT NOT NULL, -- e.g. '5173', 'odak', 'container_name', 'node server.js'
      directory TEXT,
      restart_command TEXT,
      log_file_path TEXT,
      memory_alert_limit_mb INTEGER DEFAULT 500,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// 1. Get PM2 processes
async function getPm2Projects(): Promise<ProjectProcess[]> {
  try {
    const { stdout } = await execAsync('pm2 jlist 2>/dev/null || npx pm2 jlist 2>/dev/null');
    const list = JSON.parse(stdout.trim());
    const totalMem = os.totalmem();

    return list.map((app: any) => {
      const memoryBytes = app.monit?.memory || 0;
      const memoryMb = Math.round((memoryBytes / (1024 * 1024)) * 10) / 10;
      const memoryPercent = totalMem > 0 ? parseFloat(((memoryBytes / totalMem) * 100).toFixed(1)) : 0;
      const cpuPercent = Math.round((app.monit?.cpu || 0) * 10) / 10;
      const status = app.pm2_env?.status === 'online' ? 'online' : app.pm2_env?.status === 'stopped' ? 'stopped' : 'errored';
      const uptime = app.pm2_env?.pm_uptime ? Math.max(0, Math.floor((Date.now() - app.pm2_env.pm_uptime) / 1000)) : 0;

      return {
        id: `pm2-${app.pm_id}`,
        name: app.name || `PM2 #${app.pm_id}`,
        type: 'pm2',
        pid: app.pid,
        status,
        memoryBytes,
        memoryMb,
        memoryPercent,
        cpuPercent,
        uptimeSeconds: uptime,
        restarts: app.pm2_env?.restart_time || 0,
        command: app.pm2_env?.pm_exec_path,
        logPath: app.pm2_env?.pm_out_log_path,
        directory: app.pm2_env?.pm_cwd,
      };
    });
  } catch (e) {
    return [];
  }
}

// 2. Get Docker containers
async function getDockerProjects(): Promise<ProjectProcess[]> {
  try {
    const { stdout } = await execAsync('docker stats --no-stream --format "{{.ID}}|{{.Name}}|{{.MemUsage}}|{{.CPUPerc}}|{{.PIDs}}" 2>/dev/null');
    if (!stdout.trim()) return [];

    const totalMem = os.totalmem();
    const lines = stdout.trim().split('\n');

    return lines.map((line) => {
      const [id, name, memUsage, cpuPerc, pids] = line.split('|');
      // memUsage is like "124.5MiB / 7.77GiB"
      let memoryBytes = 0;
      if (memUsage) {
        const memPart = memUsage.split('/')[0].trim();
        if (memPart.includes('GiB')) {
          memoryBytes = parseFloat(memPart) * 1024 * 1024 * 1024;
        } else if (memPart.includes('MiB')) {
          memoryBytes = parseFloat(memPart) * 1024 * 1024;
        } else if (memPart.includes('kB')) {
          memoryBytes = parseFloat(memPart) * 1024;
        }
      }

      const memoryMb = Math.round((memoryBytes / (1024 * 1024)) * 10) / 10;
      const memoryPercent = totalMem > 0 ? parseFloat(((memoryBytes / totalMem) * 100).toFixed(1)) : 0;
      const cpuPercent = parseFloat((cpuPerc || '0').replace('%', '')) || 0;

      return {
        id: `docker-${id}`,
        name: name || `Docker ${id}`,
        type: 'docker',
        pid: parseInt(pids, 10) || undefined,
        status: 'online',
        memoryBytes,
        memoryMb,
        memoryPercent,
        cpuPercent,
        uptimeSeconds: 0,
        command: `docker container ${name}`,
      };
    });
  } catch (e) {
    return [];
  }
}

// 3. Get listening port processes
async function getListeningPortProjects(): Promise<ProjectProcess[]> {
  try {
    const { stdout } = await execAsync('lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null || ss -tulpn 2>/dev/null');
    if (!stdout.trim()) return [];

    const totalMem = os.totalmem();
    const lines = stdout.trim().split('\n');
    const portMap = new Map<number, { port: number; commandName: string }>();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.replace(/\s+/g, ' ').split(' ');
      if (parts.length >= 9) {
        const commandName = parts[0];
        const pid = parseInt(parts[1], 10);
        const namePart = parts[8]; // e.g. *:7000 or 127.0.0.1:5173
        const port = parseInt(namePart.split(':').pop() || '0', 10);

        if (pid && port > 0 && !portMap.has(pid)) {
          // Filter out macOS internal noise if desired, but keep dev servers like node, python, etc.
          portMap.set(pid, { port, commandName });
        }
      }
    }

    if (portMap.size === 0) return [];

    const pids = Array.from(portMap.keys());
    const { stdout: psOut } = await execAsync(`ps -o pid,rss,%cpu,etime,command -p ${pids.join(',')} 2>/dev/null`);
    const psLines = psOut.trim().split('\n');

    const result: ProjectProcess[] = [];
    for (let i = 1; i < psLines.length; i++) {
      const line = psLines[i].trim();
      const parts = line.replace(/\s+/g, ' ').split(' ');
      const pid = parseInt(parts[0], 10);
      const rssKb = parseInt(parts[1], 10) || 0;
      const cpu = parseFloat(parts[2]) || 0;
      const etime = parts[3];
      const command = parts.slice(4).join(' ');

      const portInfo = portMap.get(pid);
      if (!portInfo) continue;

      const memoryBytes = rssKb * 1024;
      const memoryMb = Math.round((memoryBytes / (1024 * 1024)) * 10) / 10;
      const memoryPercent = totalMem > 0 ? parseFloat(((memoryBytes / totalMem) * 100).toFixed(1)) : 0;

      // Extract a clean project name from command or directory
      let projectName = portInfo.commandName;
      if (command.includes('node') || command.includes('tsx') || command.includes('vite') || command.includes('pnpm') || command.includes('npm')) {
        const matchProj = command.match(/([\w-]+)\/(node_modules|src|server|dist|package\.json)/);
        if (matchProj && matchProj[1]) {
          projectName = `${matchProj[1]} (Port ${portInfo.port})`;
        } else {
          projectName = `Node App (Port ${portInfo.port})`;
        }
      } else if (command.includes('python')) {
        projectName = `Python Service (Port ${portInfo.port})`;
      } else {
        projectName = `${portInfo.commandName} (Port ${portInfo.port})`;
      }

      result.push({
        id: `port-${portInfo.port}-${pid}`,
        name: projectName,
        type: 'port',
        pid,
        port: portInfo.port,
        status: 'online',
        memoryBytes,
        memoryMb,
        memoryPercent,
        cpuPercent: cpu,
        uptimeSeconds: parseEtimeToSeconds(etime),
        command,
      });
    }

    return result;
  } catch (e) {
    return [];
  }
}

function parseEtimeToSeconds(etime: string): number {
  if (!etime) return 0;
  // etime formats: "MM:SS", "HH:MM:SS", "D-HH:MM:SS"
  let days = 0;
  let timeStr = etime;
  if (etime.includes('-')) {
    const parts = etime.split('-');
    days = parseInt(parts[0], 10) || 0;
    timeStr = parts[1] || '';
  }

  const tParts = timeStr.split(':').map((v) => parseInt(v, 10) || 0);
  if (tParts.length === 2) {
    return days * 86400 + tParts[0] * 60 + tParts[1];
  } else if (tParts.length === 3) {
    return days * 86400 + tParts[0] * 3600 + tParts[1] * 60 + tParts[2];
  }
  return 0;
}

// 4. Combined Projects list with custom tracked projects
export async function getAllProjects(): Promise<ProjectProcess[]> {
  initProjectTables();

  const [pm2List, dockerList, portList] = await Promise.all([
    getPm2Projects(),
    getDockerProjects(),
    getListeningPortProjects(),
  ]);

  // Combine and deduplicate
  const allMap = new Map<string, ProjectProcess>();

  // PM2 items
  pm2List.forEach((p) => allMap.set(p.name.toLowerCase(), p));

  // Docker items
  dockerList.forEach((d) => allMap.set(d.name.toLowerCase(), d));

  // Port items (if not already covered by PM2 with same PID)
  portList.forEach((pr) => {
    const isCovered = Array.from(allMap.values()).some((existing) => existing.pid && existing.pid === pr.pid);
    if (!isCovered) {
      allMap.set(pr.id, pr);
    }
  });

  // Tracked custom projects from database
  const tracked = db.prepare('SELECT * FROM tracked_projects').all() as any[];
  for (const tr of tracked) {
    // If user added a specific port or path
    const portNum = parseInt(tr.target, 10);
    let matched = Array.from(allMap.values()).find((p) => {
      if (portNum && p.port === portNum) return true;
      if (p.name.toLowerCase().includes(tr.name.toLowerCase())) return true;
      return false;
    });

    if (matched) {
      matched.name = tr.name; // user customized name
      matched.isCustom = true;
    } else {
      // Stopped project
      allMap.set(`custom-${tr.id}`, {
        id: `custom-${tr.id}`,
        name: tr.name,
        type: tr.type || 'port',
        port: portNum || tr.target,
        status: 'stopped',
        memoryBytes: 0,
        memoryMb: 0,
        memoryPercent: 0,
        cpuPercent: 0,
        uptimeSeconds: 0,
        directory: tr.directory,
        isCustom: true,
      });
    }
  }

  // Sort by RAM usage descending (heaviest projects first)
  return Array.from(allMap.values()).sort((a, b) => b.memoryBytes - a.memoryBytes);
}

// Actions: Restart, Stop, Start
export async function executeProjectAction(project: ProjectProcess, action: 'restart' | 'stop' | 'start'): Promise<{ success: boolean; message: string }> {
  try {
    if (project.type === 'pm2') {
      const pmId = project.id.replace('pm2-', '');
      await execAsync(`pm2 ${action} ${pmId} || npx pm2 ${action} ${pmId}`);
      return { success: true, message: `PM2 projesi (${project.name}) ${action} yapıldı.` };
    } else if (project.type === 'docker') {
      const containerName = project.name;
      await execAsync(`docker ${action} ${containerName}`);
      return { success: true, message: `Docker konteyneri (${containerName}) ${action} yapıldı.` };
    } else if (project.pid && action === 'stop') {
      await execAsync(`kill -15 ${project.pid} 2>/dev/null || kill -9 ${project.pid}`);
      return { success: true, message: `Süreç (${project.pid}) durduruldu.` };
    } else if (project.pid && action === 'restart') {
      await execAsync(`kill -HUP ${project.pid} 2>/dev/null || kill -15 ${project.pid}`);
      return { success: true, message: `Süreç (${project.pid}) yeniden başlatıldı.` };
    }

    return { success: false, message: 'Bu süreç türü için doğrudan çalıştırma komutu desteklenmiyor.' };
  } catch (e: any) {
    return { success: false, message: 'Eylem başarısız: ' + e.message };
  }
}

// Get Logs
export async function getProjectLogs(project: ProjectProcess, linesCount: number = 80): Promise<string> {
  try {
    if (project.type === 'pm2') {
      const pmId = project.id.replace('pm2-', '');
      const { stdout } = await execAsync(`pm2 logs ${pmId} --lines ${linesCount} --nostream 2>/dev/null || npx pm2 logs ${pmId} --lines ${linesCount} --nostream`);
      return stdout || 'Log kaydı bulunamadı.';
    } else if (project.type === 'docker') {
      const containerName = project.name;
      const { stdout, stderr } = await execAsync(`docker logs --tail ${linesCount} ${containerName} 2>/dev/null`);
      return stdout || stderr || 'Log kaydı bulunamadı.';
    } else if (project.logPath && fs.existsSync(project.logPath)) {
      const { stdout } = await execAsync(`tail -n ${linesCount} "${project.logPath}"`);
      return stdout || 'Log dosyası boş.';
    }

    return 'Bu proje için canlı log dosyası tanımlanmamış. PM2 veya Docker ile çalıştırıldığında loglar otomatik yakalanır.';
  } catch (e: any) {
    return 'Loglar okunurken hata: ' + e.message;
  }
}
