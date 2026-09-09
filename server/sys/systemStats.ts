import os from 'os';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';

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
  network: {
    inBytesPerSec: number;
    outBytesPerSec: number;
    inFormatted: string;
    outFormatted: string;
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes.toFixed(0) + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
}

// Background steady 1-second CPU sampler with Exponential Moving Average (EMA) smoothing
let currentCpuUsage = 0;
let lastCpuTimes: { idle: number; total: number } | null = null;
let cpuHistory: number[] = [];

function sampleCpuUsage() {
  try {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        total += (cpu.times as any)[type];
      }
      idle += cpu.times.idle;
    }

    if (lastCpuTimes) {
      const idleDiff = idle - lastCpuTimes.idle;
      const totalDiff = total - lastCpuTimes.total;

      if (totalDiff > 0) {
        const instantUsage = 100 - (100 * idleDiff) / totalDiff;
        const clampedInstant = Math.min(100, Math.max(0, instantUsage));

        // Exponential smoothing (70% instant + 30% smoothed) to eliminate erratic jitter
        currentCpuUsage = currentCpuUsage === 0
          ? Math.round(clampedInstant)
          : Math.round(0.7 * clampedInstant + 0.3 * currentCpuUsage);

        cpuHistory.push(currentCpuUsage);
        if (cpuHistory.length > 60) cpuHistory.shift();
      }
    }

    lastCpuTimes = { idle, total };
  } catch (e) {}
}

// Run CPU sampler every 1000ms consistently
setInterval(sampleCpuUsage, 1000);
sampleCpuUsage();

// Disk Usage using native cross-platform fs.promises.statfs
async function getDiskUsage() {
  try {
    const rootPath = os.platform() === 'win32' ? 'C:/' : '/';
    if (fs.promises && typeof fs.promises.statfs === 'function') {
      const stats = await fs.promises.statfs(rootPath);
      const totalBytes = stats.bsize * stats.blocks;
      const freeBytes = stats.bsize * stats.bavail;
      const usedBytes = Math.max(0, totalBytes - freeBytes);
      const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;
      return { totalBytes, usedBytes, freeBytes, usedPercent };
    }
  } catch (e) {}

  // Fallback to df for Linux/macOS
  try {
    const { stdout } = await execAsync('df -k /');
    const lines = stdout.trim().split('\n');
    if (lines.length >= 2) {
      const parts = lines[1].replace(/\s+/g, ' ').split(' ');
      const totalBytes = (parseInt(parts[1], 10) || 0) * 1024;
      const usedBytes = (parseInt(parts[2], 10) || 0) * 1024;
      const freeBytes = (parseInt(parts[3], 10) || 0) * 1024;
      const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;
      return { totalBytes, usedBytes, freeBytes, usedPercent };
    }
  } catch (e) {}

  return { totalBytes: 0, usedBytes: 0, freeBytes: 0, usedPercent: 0 };
}

// Network Traffic Speed Tracking
let lastNetSample: { inBytes: number; outBytes: number; time: number } | null = null;
let currentNetSpeed = { inBytesPerSec: 0, outBytesPerSec: 0 };

async function sampleNetworkSpeed() {
  try {
    if (os.platform() === 'darwin') {
      const { stdout } = await execAsync('netstat -ibn | grep -e "<Link#" | head -n 1');
      const parts = stdout.trim().replace(/\s+/g, ' ').split(' ');
      const inBytes = parseInt(parts[6], 10) || 0;
      const outBytes = parseInt(parts[9], 10) || 0;
      const now = Date.now();

      if (lastNetSample && now > lastNetSample.time) {
        const sec = (now - lastNetSample.time) / 1000;
        const inDiff = Math.max(0, inBytes - lastNetSample.inBytes);
        const outDiff = Math.max(0, outBytes - lastNetSample.outBytes);
        currentNetSpeed = {
          inBytesPerSec: inDiff / sec,
          outBytesPerSec: outDiff / sec,
        };
      }
      lastNetSample = { inBytes, outBytes, time: now };
    } else if (os.platform() === 'linux') {
      const { stdout } = await execAsync("cat /proc/net/dev | grep -v 'lo:' | grep ':' | head -n 1");
      const parts = stdout.trim().split(':')[1].trim().replace(/\s+/g, ' ').split(' ');
      const inBytes = parseInt(parts[0], 10) || 0;
      const outBytes = parseInt(parts[8], 10) || 0;
      const now = Date.now();

      if (lastNetSample && now > lastNetSample.time) {
        const sec = (now - lastNetSample.time) / 1000;
        currentNetSpeed = {
          inBytesPerSec: Math.max(0, inBytes - lastNetSample.inBytes) / sec,
          outBytesPerSec: Math.max(0, outBytes - lastNetSample.outBytes) / sec,
        };
      }
      lastNetSample = { inBytes, outBytes, time: now };
    }
  } catch (e) {}
}

// Poll network periodically
setInterval(sampleNetworkSpeed, 2000);
sampleNetworkSpeed();

export async function getSystemStats(): Promise<SystemStats> {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsedPercent = Math.round((usedMem / totalMem) * 100);

  const disk = await getDiskUsage();

  // Load avg simulation for Windows if os.loadavg() is [0, 0, 0]
  let loadAvg = os.loadavg().map((v) => parseFloat(v.toFixed(2)));
  if (os.platform() === 'win32' && loadAvg[0] === 0 && cpuHistory.length > 0) {
    const avgRecent = cpuHistory.slice(-5).reduce((a, b) => a + b, 0) / Math.min(cpuHistory.length, 5);
    const avgMedium = cpuHistory.reduce((a, b) => a + b, 0) / cpuHistory.length;
    const numCores = os.cpus().length || 1;
    loadAvg = [
      parseFloat(((avgRecent / 100) * numCores).toFixed(2)),
      parseFloat(((avgMedium / 100) * numCores).toFixed(2)),
      parseFloat(((avgMedium / 100) * numCores * 0.95).toFixed(2)),
    ];
  }

  return {
    hostname: os.hostname(),
    platform: os.platform() === 'darwin' ? 'macOS' : os.platform() === 'linux' ? 'Linux' : os.platform() === 'win32' ? 'Windows Server' : os.platform(),
    arch: os.arch(),
    uptimeSeconds: Math.floor(os.uptime()),
    cpu: {
      cores: os.cpus().length,
      model: os.cpus()[0]?.model || 'CPU',
      usagePercent: currentCpuUsage,
      loadAvg,
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
    network: {
      inBytesPerSec: Math.round(currentNetSpeed.inBytesPerSec),
      outBytesPerSec: Math.round(currentNetSpeed.outBytesPerSec),
      inFormatted: formatSpeed(currentNetSpeed.inBytesPerSec),
      outFormatted: formatSpeed(currentNetSpeed.outBytesPerSec),
    },
  };
}
