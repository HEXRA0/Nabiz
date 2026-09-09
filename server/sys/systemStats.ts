import os from 'os';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export interface SystemStats {
  hostname: string;
  platform: string;
  arch: string;
  uptimeSeconds: number;
  cpu: {
    cores: number;
    model: string;
    usagePercent: number;
    loadAvg: number[];
  };
  memory: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usedPercent: number;
    totalFormatted: string;
    usedFormatted: string;
    freeFormatted: string;
  };
  disk: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usedPercent: number;
    totalFormatted: string;
    usedFormatted: string;
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

let lastCpuInfo: { idle: number; total: number } | null = null;

function getCpuUsage(): Promise<number> {
  return new Promise((resolve) => {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        total += (cpu.times as any)[type];
      }
      idle += cpu.times.idle;
    }

    if (!lastCpuInfo) {
      lastCpuInfo = { idle, total };
      resolve(Math.min(100, Math.max(0, Math.round(os.loadavg()[0] * 10))));
      return;
    }

    const idleDiff = idle - lastCpuInfo.idle;
    const totalDiff = total - lastCpuInfo.total;
    lastCpuInfo = { idle, total };

    if (totalDiff <= 0) {
      resolve(0);
      return;
    }

    const usage = 100 - (100 * idleDiff) / totalDiff;
    resolve(Math.round(Math.min(100, Math.max(0, usage))));
  });
}

async function getDiskUsage(): Promise<{ totalBytes: number; usedBytes: number; freeBytes: number; usedPercent: number }> {
  try {
    const { stdout } = await execAsync('df -k /');
    const lines = stdout.trim().split('\n');
    if (lines.length >= 2) {
      // Columns: Filesystem 1024-blocks Used Available Capacity ...
      const parts = lines[1].replace(/\s+/g, ' ').split(' ');
      const totalK = parseInt(parts[1], 10) || 0;
      const usedK = parseInt(parts[2], 10) || 0;
      const freeK = parseInt(parts[3], 10) || 0;

      const totalBytes = totalK * 1024;
      const usedBytes = usedK * 1024;
      const freeBytes = freeK * 1024;
      const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

      return { totalBytes, usedBytes, freeBytes, usedPercent };
    }
  } catch (e) {}

  return { totalBytes: 0, usedBytes: 0, freeBytes: 0, usedPercent: 0 };
}

export async function getSystemStats(): Promise<SystemStats> {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsedPercent = Math.round((usedMem / totalMem) * 100);

  const cpuUsagePercent = await getCpuUsage();
  const disk = await getDiskUsage();

  return {
    hostname: os.hostname(),
    platform: os.platform() === 'darwin' ? 'macOS' : os.platform() === 'linux' ? 'Linux' : os.platform(),
    arch: os.arch(),
    uptimeSeconds: Math.floor(os.uptime()),
    cpu: {
      cores: os.cpus().length,
      model: os.cpus()[0]?.model || 'Unknown CPU',
      usagePercent: cpuUsagePercent,
      loadAvg: os.loadavg().map((v) => parseFloat(v.toFixed(2))),
    },
    memory: {
      totalBytes: totalMem,
      freeBytes: freeMem,
      usedBytes: usedMem,
      usedPercent: memUsedPercent,
      totalFormatted: formatBytes(totalMem),
      usedFormatted: formatBytes(usedMem),
      freeFormatted: formatBytes(freeMem),
    },
    disk: {
      ...disk,
      totalFormatted: formatBytes(disk.totalBytes),
      usedFormatted: formatBytes(disk.usedBytes),
    },
  };
}
