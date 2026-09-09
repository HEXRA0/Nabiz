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
  status: 'online' | 'stopped' | 'errored';
  memoryBytes: number;
  memoryMb: number;
  memoryPercent: number; // percentage of total server RAM
  cpuPercent: number;
  uptimeSeconds: number;
  restarts?: number;
  command?: string;
  logPath?: string;
  directory?: string;
  startCommand?: string;
  restartCommand?: string;
  stopCommand?: string;
  isCustom?: boolean;
}

// Database table for tracked user projects
export function initProjectTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracked_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'port', -- 'port', 'pm2', 'docker', 'process'
      target TEXT NOT NULL, -- e.g. '5173', 'odak', 'container_name'
      directory TEXT,
      start_command TEXT,
      restart_command TEXT,
      stop_command TEXT,
      log_file_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// 1. Discover PM2 apps
async function getPm2Projects(): Promise<ProjectProcess[]> {
  try {
    const isWin = os.platform() === 'win32';
    const pm2Cmd = isWin
      ? 'pm2 jlist 2>nul || npx pm2 jlist 2>nul || powershell -Command "pm2 jlist"'
      : 'pm2 jlist 2>/dev/null || npx pm2 jlist 2>/dev/null';

    const { stdout } = await execAsync(pm2Cmd);
    if (!stdout.trim() || !stdout.includes('[')) return [];

    // Extract json array in case of pm2 banners
    const jsonStart = stdout.indexOf('[');
    const jsonEnd = stdout.lastIndexOf(']');
    if (jsonStart === -1 || jsonEnd === -1) return [];

    const list = JSON.parse(stdout.substring(jsonStart, jsonEnd + 1));
    const totalMem = os.totalmem();

    return list.map((app: any) => {
      const memoryBytes = app.monit?.memory || 0;
      const memoryMb = Math.round((memoryBytes / (1024 * 1024)) * 10) / 10;
      const memoryPercent = totalMem > 0 ? parseFloat(((memoryBytes / totalMem) * 100).toFixed(1)) : 0;
      const cpuPercent = Math.round((app.monit?.cpu || 0) * 10) / 10;
      const status = app.pm2_env?.status === 'online' ? 'online' : 'stopped';
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

// 2. Discover Docker containers
async function getDockerProjects(): Promise<ProjectProcess[]> {
  try {
    const { stdout } = await execAsync('docker stats --no-stream --format "{{.ID}}|{{.Name}}|{{.MemUsage}}|{{.CPUPerc}}|{{.PIDs}}" 2>/dev/null || docker stats --no-stream --format "{{.ID}}|{{.Name}}|{{.MemUsage}}|{{.CPUPerc}}|{{.PIDs}}" 2>nul');
    if (!stdout.trim()) return [];

    const totalMem = os.totalmem();
    const lines = stdout.trim().split('\n');

    return lines.map((line) => {
      const [id, name, memUsage, cpuPerc, pids] = line.split('|');
      let memoryBytes = 0;
      if (memUsage) {
        const memPart = memUsage.split('/')[0].trim();
        if (memPart.includes('GiB') || memPart.includes('GB')) {
          memoryBytes = parseFloat(memPart) * 1024 * 1024 * 1024;
        } else if (memPart.includes('MiB') || memPart.includes('MB')) {
          memoryBytes = parseFloat(memPart) * 1024 * 1024;
        } else if (memPart.includes('kB') || memPart.includes('KB')) {
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
      };
    });
  } catch (e) {
    return [];
  }
}

// 3. Discover processes listening on network ports (Windows + Linux + macOS)
async function getListeningPortProjects(): Promise<ProjectProcess[]> {
  const isWin = os.platform() === 'win32';
  const totalMem = os.totalmem();

  if (isWin) {
    try {
      // Windows implementation: netstat + tasklist
      const { stdout: netOut } = await execAsync('netstat -ano -p tcp');
      const lines = netOut.split('\n');
      const portMap = new Map<number, number>(); // pid -> port

      for (const line of lines) {
        if (line.includes('LISTENING')) {
          const parts = line.trim().replace(/\s+/g, ' ').split(' ');
          if (parts.length >= 5) {
            const localAddr = parts[1];
            const port = parseInt(localAddr.split(':').pop() || '0', 10);
            const pid = parseInt(parts[4], 10);
            if (pid && port > 0 && !portMap.has(pid)) {
              portMap.set(pid, port);
            }
          }
        }
      }

      if (portMap.size === 0) return [];

      const { stdout: taskOut } = await execAsync('tasklist /FO CSV /NH');
      const taskLines = taskOut.split('\n');
      const result: ProjectProcess[] = [];

      for (const taskLine of taskLines) {
        if (!taskLine.trim()) continue;
        const csvParts = taskLine.trim().split('","').map((s) => s.replace(/"/g, ''));
        if (csvParts.length >= 5) {
          const procName = csvParts[0];
          const pid = parseInt(csvParts[1], 10);
          const memStr = csvParts[4].replace(/[^\d]/g, ''); // "9.637 K" -> 9637
          const memKb = parseInt(memStr, 10) || 0;

          if (portMap.has(pid)) {
            const port = portMap.get(pid)!;
            const memoryBytes = memKb * 1024;
            const memoryMb = Math.round((memoryBytes / (1024 * 1024)) * 10) / 10;
            const memoryPercent = totalMem > 0 ? parseFloat(((memoryBytes / totalMem) * 100).toFixed(1)) : 0;

            let cleanName = procName;
            if (procName.toLowerCase().includes('node')) {
              cleanName = `Node Uygulaması (Port ${port})`;
            } else if (procName.toLowerCase().includes('caddy')) {
              cleanName = `Caddy Web Sunucusu (Port ${port})`;
            } else {
              cleanName = `${procName.replace('.exe', '')} (Port ${port})`;
            }

            result.push({
              id: `win-port-${port}-${pid}`,
              name: cleanName,
              type: 'port',
              pid,
              port,
              status: 'online',
              memoryBytes,
              memoryMb,
              memoryPercent,
              cpuPercent: 0,
              uptimeSeconds: 0,
              command: procName,
            });
          }
        }
      }

      return result;
    } catch (e) {
      return [];
    }
  }

  // macOS / Linux implementation
  try {
    const { stdout } = await execAsync('lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null || ss -tulpn 2>/dev/null');
    if (!stdout.trim()) return [];

    const lines = stdout.trim().split('\n');
    const portMap = new Map<number, { port: number; commandName: string }>();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.replace(/\s+/g, ' ').split(' ');
      if (parts.length >= 9) {
        const commandName = parts[0];
        const pid = parseInt(parts[1], 10);
        const namePart = parts[8];
        const port = parseInt(namePart.split(':').pop() || '0', 10);

        if (pid && port > 0 && !portMap.has(pid)) {
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

      let projectName = portInfo.commandName;
      if (command.includes('node') || command.includes('tsx') || command.includes('vite') || command.includes('pnpm')) {
        const matchProj = command.match(/([\w-]+)\/(node_modules|src|server|dist|package\.json)/);
        if (matchProj && matchProj[1]) {
          projectName = `${matchProj[1]} (Port ${portInfo.port})`;
        } else {
          projectName = `Node Service (Port ${portInfo.port})`;
        }
      } else if (command.includes('python')) {
        projectName = `Python App (Port ${portInfo.port})`;
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
  let days = 0;
  let timeStr = etime;
  if (etime.includes('-')) {
    const parts = etime.split('-');
    days = parseInt(parts[0], 10) || 0;
    timeStr = parts[1] || '';
  }

  const tParts = timeStr.split(':').map((v) => parseInt(v, 10) || 0);
  if (tParts.length === 2) return days * 86400 + tParts[0] * 60 + tParts[1];
  if (tParts.length === 3) return days * 86400 + tParts[0] * 3600 + tParts[1] * 60 + tParts[2];
  return 0;
}

// 4. Combined Projects list
export async function getAllProjects(): Promise<ProjectProcess[]> {
  initProjectTables();

  const [pm2List, dockerList, portList] = await Promise.all([
    getPm2Projects(),
    getDockerProjects(),
    getListeningPortProjects(),
  ]);

  const allMap = new Map<string, ProjectProcess>();

  pm2List.forEach((p) => allMap.set(p.name.toLowerCase(), p));
  dockerList.forEach((d) => allMap.set(d.name.toLowerCase(), d));

  portList.forEach((pr) => {
    const isCovered = Array.from(allMap.values()).some((existing) => existing.pid && existing.pid === pr.pid);
    if (!isCovered) {
      allMap.set(pr.id, pr);
    }
  });

  // User tracked custom projects from SQLite
  const tracked = db.prepare('SELECT * FROM tracked_projects').all() as any[];
  for (const tr of tracked) {
    const portNum = parseInt(tr.target, 10);
    const matched = Array.from(allMap.values()).find((p) => {
      if (portNum && p.port === portNum) return true;
      if (p.name.toLowerCase().includes(tr.name.toLowerCase())) return true;
      return false;
    });

    if (matched) {
      matched.name = tr.name;
      matched.directory = tr.directory || matched.directory;
      matched.startCommand = tr.start_command;
      matched.restartCommand = tr.restart_command;
      matched.stopCommand = tr.stop_command;
      matched.isCustom = true;
    } else {
      // Stopped custom project
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
        startCommand: tr.start_command,
        restartCommand: tr.restart_command,
        stopCommand: tr.stop_command,
        isCustom: true,
      });
    }
  }

  return Array.from(allMap.values()).sort((a, b) => b.memoryBytes - a.memoryBytes);
}

// Actions: Start, Stop, Restart
export async function executeProjectAction(project: ProjectProcess, action: 'start' | 'stop' | 'restart'): Promise<{ success: boolean; message: string }> {
  try {
    const isWin = os.platform() === 'win32';

    // 1. PM2 action
    if (project.type === 'pm2') {
      const pmId = project.id.replace('pm2-', '');
      const pm2Cmd = isWin ? `pm2 ${action} ${pmId}` : `pm2 ${action} ${pmId} || npx pm2 ${action} ${pmId}`;
      await execAsync(pm2Cmd);
      return { success: true, message: `PM2 projesi (${project.name}) ${action} işlemi tamamlandı.` };
    }

    // 2. Docker action
    if (project.type === 'docker') {
      const containerName = project.name;
      await execAsync(`docker ${action} ${containerName}`);
      return { success: true, message: `Docker konteyneri (${containerName}) ${action} işlemi tamamlandı.` };
    }

    // 3. Custom Commands
    if (action === 'start' && project.startCommand) {
      const cwd = project.directory || process.cwd();
      exec(project.startCommand, { cwd });
      return { success: true, message: `Başlatma komutu çalıştırıldı: ${project.startCommand}` };
    }
    if (action === 'restart' && project.restartCommand) {
      const cwd = project.directory || process.cwd();
      await execAsync(project.restartCommand, { cwd });
      return { success: true, message: `Yeniden başlatma komutu çalıştırıldı.` };
    }
    if (action === 'stop' && project.stopCommand) {
      const cwd = project.directory || process.cwd();
      await execAsync(project.stopCommand, { cwd });
      return { success: true, message: `Durdurma komutu çalıştırıldı.` };
    }

    // 4. PID Direct Signal Stop / Restart
    if (project.pid && action === 'stop') {
      const killCmd = isWin ? `taskkill /F /PID ${project.pid}` : `kill -15 ${project.pid} 2>/dev/null || kill -9 ${project.pid}`;
      await execAsync(killCmd);
      return { success: true, message: `PID ${project.pid} durduruldu.` };
    }
    if (project.pid && action === 'restart') {
      const restartCmd = isWin ? `taskkill /F /PID ${project.pid}` : `kill -HUP ${project.pid} 2>/dev/null || kill -15 ${project.pid}`;
      await execAsync(restartCmd);
      return { success: true, message: `PID ${project.pid} yeniden başlatıldı.` };
    }

    return { success: false, message: 'Bu proje için başlatma/durdurma komutu tanımlı değil.' };
  } catch (e: any) {
    return { success: false, message: 'İşlem başarısız: ' + e.message };
  }
}

// Log Fetcher
export async function getProjectLogs(project: ProjectProcess, linesCount: number = 80): Promise<string> {
  try {
    const isWin = os.platform() === 'win32';
    if (project.type === 'pm2') {
      const pmId = project.id.replace('pm2-', '');
      const pm2Cmd = isWin ? `pm2 logs ${pmId} --lines ${linesCount} --nostream` : `pm2 logs ${pmId} --lines ${linesCount} --nostream 2>/dev/null || npx pm2 logs ${pmId} --lines ${linesCount} --nostream`;
      const { stdout } = await execAsync(pm2Cmd);
      return stdout || 'Log kaydı bulunamadı.';
    } else if (project.type === 'docker') {
      const containerName = project.name;
      const { stdout, stderr } = await execAsync(`docker logs --tail ${linesCount} ${containerName}`);
      return stdout || stderr || 'Log kaydı bulunamadı.';
    } else if (project.logPath && fs.existsSync(project.logPath)) {
      const logCmd = isWin ? `powershell -Command "Get-Content -Path '${project.logPath}' -Tail ${linesCount}"` : `tail -n ${linesCount} "${project.logPath}"`;
      const { stdout } = await execAsync(logCmd);
      return stdout || 'Log dosyası boş.';
    }

    return 'Bu proje için log dosyası tanımlı değil.';
  } catch (e: any) {
    return 'Loglar okunurken hata: ' + e.message;
  }
}
