import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { db } from '../db/index.js';

const execAsync = util.promisify(exec);

export interface ProjectActivity {
  id: number;
  project_name: string;
  action: 'start' | 'stop' | 'restart';
  status: 'success' | 'error';
  message: string;
  created_at: string;
}

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
  isSelf?: boolean;
  lastActivity?: {
    action: 'start' | 'stop' | 'restart';
    status: 'success' | 'error';
    message: string;
    createdAt: string;
  };
}

// OS process blacklist (filter out internal OS noise on Windows/Linux/macOS)
const OS_PROCESS_BLACKLIST = new Set([
  'svchost.exe', 'svchost',
  'lsass.exe', 'lsass',
  'spoolsv.exe', 'spoolsv',
  'services.exe', 'services',
  'wininit.exe', 'wininit',
  'winlogon.exe', 'winlogon',
  'csrss.exe', 'csrss',
  'dwm.exe', 'dwm',
  'fontdrvhost.exe', 'fontdrvhost',
  'sihost.exe', 'sihost',
  'taskhostw.exe', 'taskhostw',
  'TextInputHost.exe', 'TextInputHost',
  'SearchApp.exe', 'SearchApp',
  'RuntimeBroker.exe', 'RuntimeBroker',
  'AggregatorHost.exe', 'AggregatorHost',
  'msdtc.exe', 'msdtc',
  'vds.exe', 'vds',
  'sppsvc.exe', 'sppsvc',
  'WmiPrvSE.exe', 'WmiPrvSE',
  'dllhost.exe', 'dllhost',
  'conhost.exe', 'conhost',
  'explorer.exe', 'explorer',
  'rdpclip.exe', 'rdpclip',
  'StartMenuExperienceHost.exe',
  'VGAuthService.exe',
  'vmtoolsd.exe',
  'vm3dservice.exe',
  'wlms.exe',
  'System',
  'sshd.exe', 'sshd',
]);

// Ignored system ports unless explicitly tracked
const IGNORED_PORTS = new Set([135, 445, 3389, 22]);

// Database table for tracked user projects and action history
export function initProjectTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracked_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'port', -- 'port', 'pm2', 'docker', 'process'
      target TEXT NOT NULL, -- e.g. '4173', 'odak', 'container_name'
      directory TEXT,
      start_command TEXT,
      restart_command TEXT,
      stop_command TEXT,
      log_file_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_proj_act_created ON project_activities(created_at DESC);
  `);
}

export function recordProjectActivity(projectName: string, action: 'start' | 'stop' | 'restart', status: 'success' | 'error', message: string) {
  try {
    db.prepare(`
      INSERT INTO project_activities (project_name, action, status, message, created_at)
      VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
    `).run(projectName, action, status, message);
  } catch (e) {}
}

export function getRecentProjectActivities(limit = 30): ProjectActivity[] {
  try {
    initProjectTables();
    return db.prepare(`
      SELECT * FROM project_activities ORDER BY id DESC LIMIT ?
    `).all(limit) as ProjectActivity[];
  } catch (e) {
    return [];
  }
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
      const name = app.name || `PM2 #${app.pm_id}`;
      const isNabiz = name.toLowerCase().includes('nabiz') || name.toLowerCase().includes('nabız');

      return {
        id: `pm2-${app.pm_id}`,
        name: isNabiz ? 'nabız' : name,
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
        isSelf: isNabiz,
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
          const memStr = csvParts[4].replace(/[^\d]/g, '');
          const memKb = parseInt(memStr, 10) || 0;

          if (portMap.has(pid)) {
            const port = portMap.get(pid)!;

            // Skip Windows OS system services and high RPC / ignored ports
            if (OS_PROCESS_BLACKLIST.has(procName) || IGNORED_PORTS.has(port) || port >= 49000) {
              continue;
            }

            const memoryBytes = memKb * 1024;
            const memoryMb = Math.round((memoryBytes / (1024 * 1024)) * 10) / 10;
            const memoryPercent = totalMem > 0 ? parseFloat(((memoryBytes / totalMem) * 100).toFixed(1)) : 0;

            let cleanName = procName.replace('.exe', '');
            let isSelf = false;
            let directory: string | undefined;

            if (port === 3001 || procName.toLowerCase().includes('nabiz')) {
              cleanName = 'nabız';
              isSelf = true;
              directory = 'C:/Projects/Nabiz';
            } else if (port === 4173 || procName.toLowerCase().includes('odak')) {
              cleanName = 'odak';
              directory = 'C:/Projects/odak';
            } else if (port === 80 || port === 443 || procName.toLowerCase().includes('caddy')) {
              cleanName = 'thedemir';
              directory = 'C:/Projects/thedemir';
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
              directory,
              isSelf,
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
          if (!IGNORED_PORTS.has(port) && !OS_PROCESS_BLACKLIST.has(commandName)) {
            portMap.set(pid, { port, commandName });
          }
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
      let isSelf = false;

      if (portInfo.port === 3001 || portInfo.port === 5173 || command.includes('nabiz')) {
        projectName = 'nabız';
        isSelf = true;
      } else if (portInfo.port === 4173 || command.includes('odak')) {
        projectName = 'odak';
      } else if (portInfo.port === 80 || command.includes('thedemir')) {
        projectName = 'thedemir';
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
        isSelf,
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

// 4. Combined Projects list (Focusing on odak, thedemir, nabız, and user tracked projects)
export async function getAllProjects(): Promise<ProjectProcess[]> {
  initProjectTables();

  const [pm2List, dockerList, portList] = await Promise.all([
    getPm2Projects(),
    getDockerProjects(),
    getListeningPortProjects(),
  ]);

  const allMap = new Map<string, ProjectProcess>();

  // Helper to add or merge project
  const registerProject = (p: ProjectProcess) => {
    const key = p.name.toLowerCase();
    allMap.set(key, p);
  };

  pm2List.forEach(registerProject);
  dockerList.forEach(registerProject);
  portList.forEach((pr) => {
    const key = pr.name.toLowerCase();
    if (!allMap.has(key)) {
      allMap.set(key, pr);
    }
  });

  // Default core projects definition (odak, thedemir, nabız)
  const coreProjects: Array<{ name: string; port: number; directory: string; isSelf?: boolean }> = [
    { name: 'odak', port: 4173, directory: 'C:/Projects/odak' },
    { name: 'thedemir', port: 8080, directory: 'C:/Projects/thedemir' },
    { name: 'nabız', port: 3001, directory: 'C:/Projects/Nabiz', isSelf: true },
  ];

  for (const core of coreProjects) {
    const key = core.name.toLowerCase();
    if (!allMap.has(key)) {
      // If it is currently not running, present it in the list as stopped so user can control it
      allMap.set(key, {
        id: `core-${core.name}`,
        name: core.name,
        type: 'port',
        port: core.port,
        status: 'stopped',
        memoryBytes: 0,
        memoryMb: 0,
        memoryPercent: 0,
        cpuPercent: 0,
        uptimeSeconds: 0,
        directory: core.directory,
        isSelf: core.isSelf,
      });
    } else {
      const existing = allMap.get(key)!;
      existing.name = core.name;
      existing.directory = existing.directory || core.directory;
      if (core.isSelf) existing.isSelf = true;
    }
  }

  // User tracked custom projects from SQLite
  const tracked = db.prepare('SELECT * FROM tracked_projects').all() as any[];
  for (const tr of tracked) {
    const portNum = parseInt(tr.target, 10);
    const matched = Array.from(allMap.values()).find((p) => {
      if (portNum && p.port === portNum) return true;
      if (p.name.toLowerCase() === tr.name.toLowerCase()) return true;
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

  // Filter so that only core projects (odak, thedemir, nabız), tracked projects, or custom user PM2/Docker projects are in the list
  const allowedNames = new Set(['odak', 'thedemir', 'nabız', 'nabiz']);
  const filtered = Array.from(allMap.values()).filter((p) => {
    if (allowedNames.has(p.name.toLowerCase())) return true;
    if (p.isCustom) return true;
    if (p.type === 'pm2' || p.type === 'docker') return true;
    return false;
  });

  // Attach latest activity from SQLite database
  try {
    const activities = db.prepare(`SELECT * FROM project_activities ORDER BY id DESC`).all() as ProjectActivity[];
    const lastActivityMap = new Map<string, ProjectActivity>();
    for (const act of activities) {
      const k = act.project_name.toLowerCase();
      if (!lastActivityMap.has(k)) {
        lastActivityMap.set(k, act);
      }
    }

    filtered.forEach((p) => {
      const act = lastActivityMap.get(p.name.toLowerCase());
      if (act) {
        p.lastActivity = {
          action: act.action,
          status: act.status,
          message: act.message,
          createdAt: act.created_at,
        };
      }
    });
  } catch (e) {}

  return filtered.sort((a, b) => {
    // Keep 'odak', 'thedemir', 'nabız' at top
    const order: Record<string, number> = { 'odak': 1, 'thedemir': 2, 'nabız': 3, 'nabiz': 3 };
    const orderA = order[a.name.toLowerCase()] || 10;
    const orderB = order[b.name.toLowerCase()] || 10;
    if (orderA !== orderB) return orderA - orderB;
    return b.memoryBytes - a.memoryBytes;
  });
}

// Actions: Start, Stop, Restart
export async function executeProjectAction(project: ProjectProcess, action: 'start' | 'stop' | 'restart'): Promise<{ success: boolean; message: string }> {
  try {
    const isWin = os.platform() === 'win32';
    const projName = project.name.toLowerCase();

    let result: { success: boolean; message: string };

    // 1. Core / Specific named projects handling
    if (projName === 'odak') {
      if (action === 'stop' || action === 'restart') {
        if (isWin) {
          await execAsync(`powershell -Command "schtasks /end /tn 'OdakService' -ErrorAction SilentlyContinue; $p = (Get-NetTCPConnection -LocalPort 4173 -ErrorAction SilentlyContinue).OwningProcess; if ($p) { Stop-Process -Id $p -Force }"`).catch(() => {});
        } else if (project.pid) {
          await execAsync(`kill -9 ${project.pid}`).catch(() => {});
        }
      }
      if (action === 'start' || action === 'restart') {
        if (isWin) {
          await execAsync('powershell -Command "schtasks /run /tn \'OdakService\'"').catch(() => {
            exec('C:\\Projects\\odak\\start.bat', { cwd: 'C:\\Projects\\odak' });
          });
        } else {
          exec('node server/index.mjs', { cwd: project.directory || '/Projects/odak', env: { ...process.env, PORT: '4173', HOST: '0.0.0.0' } });
        }
      }
      result = { success: true, message: `Odak projesi ${action === 'start' ? 'başlatıldı' : action === 'stop' ? 'durduruldu' : 'yeniden başlatıldı'}.` };
    } else if (projName === 'thedemir') {
      if (action === 'stop' || action === 'restart') {
        if (isWin) {
          await execAsync(`powershell -Command "schtasks /end /tn 'ThedemirService' -ErrorAction SilentlyContinue; $p = (Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue).OwningProcess; if ($p) { Stop-Process -Id $p -Force }"`).catch(() => {});
        } else if (project.pid) {
          await execAsync(`kill -9 ${project.pid}`).catch(() => {});
        }
      }
      if (action === 'start' || action === 'restart') {
        if (isWin) {
          await execAsync('powershell -Command "schtasks /run /tn \'ThedemirService\'"').catch(() => {
            exec('C:\\Projects\\thedemir\\start.bat', { cwd: 'C:\\Projects\\thedemir' });
          });
        } else {
          exec('node server.mjs', { cwd: project.directory || '/Projects/thedemir', env: { ...process.env, PORT: '8080', HOST: '0.0.0.0' } });
        }
      }
      result = { success: true, message: `Thedemir projesi ${action === 'start' ? 'başlatıldı' : action === 'stop' ? 'durduruldu' : 'yeniden başlatıldı'}.` };
    } else if (projName === 'nabiz' || projName === 'nabız') {
      if (action === 'stop') {
        if (isWin) {
          await execAsync(`powershell -Command "$p = (Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue).OwningProcess; if ($p) { Stop-Process -Id $p -Force }"`).catch(() => {});
        } else if (project.pid) {
          await execAsync(`kill -9 ${project.pid}`).catch(() => {});
        }
        result = { success: true, message: 'Nabız servisi durduruldu.' };
      } else {
        if (isWin) {
          await execAsync('schtasks /run /tn "NabizService"');
        }
        result = { success: true, message: 'Nabız servisi başlatıldı.' };
      }
    } else if (project.type === 'pm2') {
      const pmId = project.id.replace('pm2-', '');
      const pm2Cmd = isWin ? `pm2 ${action} ${pmId}` : `pm2 ${action} ${pmId} || npx pm2 ${action} ${pmId}`;
      await execAsync(pm2Cmd);
      result = { success: true, message: `PM2 projesi (${project.name}) ${action} işlemi tamamlandı.` };
    } else if (project.type === 'docker') {
      const containerName = project.name;
      await execAsync(`docker ${action} ${containerName}`);
      result = { success: true, message: `Docker konteyneri (${containerName}) ${action} işlemi tamamlandı.` };
    } else if (action === 'start' && project.startCommand) {
      const cwd = project.directory || process.cwd();
      exec(project.startCommand, { cwd });
      result = { success: true, message: `Başlatma komutu çalıştırıldı: ${project.startCommand}` };
    } else if (action === 'restart' && project.restartCommand) {
      const cwd = project.directory || process.cwd();
      await execAsync(project.restartCommand, { cwd });
      result = { success: true, message: `Yeniden başlatma komutu çalıştırıldı.` };
    } else if (action === 'stop' && project.stopCommand) {
      const cwd = project.directory || process.cwd();
      await execAsync(project.stopCommand, { cwd });
      result = { success: true, message: `Durdurma komutu çalıştırıldı.` };
    } else if (action === 'stop') {
      if (project.pid) {
        const killCmd = isWin ? `taskkill /F /T /PID ${project.pid}` : `kill -15 ${project.pid} 2>/dev/null || kill -9 ${project.pid}`;
        await execAsync(killCmd);
        result = { success: true, message: `PID ${project.pid} durduruldu.` };
      } else if (project.port) {
        if (isWin) {
          await execAsync(`powershell -Command "$p = (Get-NetTCPConnection -LocalPort ${project.port} -ErrorAction SilentlyContinue).OwningProcess; if ($p) { Stop-Process -Id $p -Force }"`).catch(() => {});
        }
        result = { success: true, message: `Port ${project.port} üzerindeki işlem durduruldu.` };
      } else {
        result = { success: false, message: 'Durdurulacak aktif bir işlem bulunamadı.' };
      }
    } else {
      result = { success: false, message: 'Bu proje için başlatma/durdurma komutu tanımlı değil.' };
    }

    recordProjectActivity(project.name, action, result.success ? 'success' : 'error', result.message);
    return result;
  } catch (e: any) {
    const errorResult = { success: false, message: 'İşlem başarısız: ' + e.message };
    recordProjectActivity(project.name, action, 'error', errorResult.message);
    return errorResult;
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
