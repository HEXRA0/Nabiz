import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export type TrafficCategory = 'page' | 'api' | 'asset' | 'internal';

export interface TrafficLogEntry {
  id: string;
  timestamp: number;
  timeFormatted: string;
  project: string; // 'odak' | 'thedemir' | 'nabiz' | string
  host: string;
  method: string;
  uri: string;
  path: string;
  status: number;
  durationMs: number;
  sizeBytes: number;
  clientIp: string;
  country: string;
  userAgent?: string;
  isInternal: boolean;
  category: TrafficCategory;
}

export interface DomainStats {
  project: string;
  host: string;
  activeConnections: number;
  totalRequests: number;
  visitorRequests: number; // Excludes internal system polling
  requestsLastHour: number;
  requestsPerSec: number;
  totalBytes: number;
  avgDurationMs: number;
  statusCodes: {
    '2xx': number;
    '3xx': number;
    '4xx': number;
    '5xx': number;
  };
  topPaths: { path: string; count: number; avgDurationMs: number; category: TrafficCategory }[];
  topCountries: { code: string; count: number }[];
}

export interface TrafficSummary {
  totalActiveConnections: number;
  totalRequests: number;
  visitorRequests: number; // Real user visitors count
  requestsPerSec: number;
  totalBytes: number;
  totalBytesFormatted: string;
  avgDurationMs: number;
  statusCodes: {
    '2xx': number;
    '3xx': number;
    '4xx': number;
    '5xx': number;
  };
  historySeries: { timestamp: number; time: string; requests: number; visitorRequests: number; errors: number; avgLatency: number }[];
  domains: Record<string, DomainStats>;
  recentLogs: TrafficLogEntry[];
}

// Log directories to search
const LOG_DIRS = [
  'C:\\Caddy\\logs',
  'C:/Caddy/logs',
  path.resolve(process.cwd(), 'data/logs'),
  path.resolve(process.cwd(), 'logs'),
];

// Track file read offsets so we only read new lines
const fileOffsets = new Map<string, number>();

// In-memory logs ring buffer (keep last 500 logs)
const MAX_LOGS = 500;
let recentLogs: TrafficLogEntry[] = [];

// Minute bucket time-series history (keep last 30 minutes)
interface MinuteBucket {
  minuteKey: string; // YYYY-MM-DD HH:mm
  timestamp: number;
  requests: number;
  visitorRequests: number;
  errors: number;
  totalDurationMs: number;
}
const minuteBuckets = new Map<string, MinuteBucket>();

// Project port mappings for active TCP connection tracking
const PROJECT_PORTS: Record<string, number> = {
  nabiz: 3001,
  odak: 4173,
  thedemir: 80,
};

// Active connections count cache
let activeConnections: Record<string, number> = {
  nabiz: 0,
  odak: 0,
  thedemir: 0,
  total: 0,
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getMinuteKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Detect if a path is Nabiz internal polling or static asset or real page
function classifyRequest(project: string, urlPath: string): { isInternal: boolean; category: TrafficCategory } {
  const lower = urlPath.toLowerCase();

  // Internal Nabiz dashboard polling endpoints
  if (
    (project === 'nabiz' || lower.startsWith('/api/')) &&
    (lower.startsWith('/api/system') ||
      lower.startsWith('/api/projects') ||
      lower.startsWith('/api/traffic') ||
      lower.startsWith('/api/health') ||
      lower.startsWith('/ws') ||
      lower === '/robots.txt' ||
      lower === '/favicon.ico')
  ) {
    return { isInternal: true, category: 'internal' };
  }

  // Static assets (CSS, JS, Fonts, Images)
  if (
    lower.startsWith('/assets/') ||
    lower.endsWith('.js') ||
    lower.endsWith('.css') ||
    lower.endsWith('.svg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.woff') ||
    lower.endsWith('.woff2') ||
    lower.endsWith('.map') ||
    lower.endsWith('.ico')
  ) {
    return { isInternal: false, category: 'asset' };
  }

  // Generic APIs
  if (lower.startsWith('/api/')) {
    return { isInternal: false, category: 'api' };
  }

  // Real visitor page requests
  return { isInternal: false, category: 'page' };
}

// Parse a single Caddy JSON log line
function parseCaddyLine(line: string, fallbackProject?: string): TrafficLogEntry | null {
  try {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('{')) return null;

    const data = JSON.parse(trimmed);
    const req = data.request || {};
    const headers = req.headers || {};

    const host = req.host || '';
    let project = fallbackProject || 'unknown';
    if (host.includes('odak')) project = 'odak';
    else if (host.includes('nabiz')) project = 'nabiz';
    else if (host.includes('thedemir')) project = 'thedemir';

    // Cloudflare IP & Country headers or direct client IP
    const cfIp = headers['Cf-Connecting-Ip']?.[0] || headers['X-Forwarded-For']?.[0];
    const clientIp = cfIp || req.client_ip || req.remote_ip || '127.0.0.1';
    const country = headers['Cf-Ipcountry']?.[0] || 'TR';
    const userAgent = headers['User-Agent']?.[0] || '';

    // Duration is in seconds (floating point) in Caddy
    const durationSec = typeof data.duration === 'number' ? data.duration : 0;
    const durationMs = Math.round(durationSec * 1000 * 10) / 10;

    const uri = req.uri || '/';
    const urlPath = uri.split('?')[0] || '/';
    const status = typeof data.status === 'number' ? data.status : 200;
    const sizeBytes = typeof data.size === 'number' ? data.size : (typeof data.bytes_read === 'number' ? data.bytes_read : 0);

    const tsSeconds = typeof data.ts === 'number' ? data.ts : Date.now() / 1000;
    const timestamp = Math.floor(tsSeconds * 1000);
    const date = new Date(timestamp);
    const timeFormatted = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;

    const id = `${timestamp}-${Math.random().toString(36).substring(2, 7)}`;
    const { isInternal, category } = classifyRequest(project, urlPath);

    return {
      id,
      timestamp,
      timeFormatted,
      project,
      host,
      method: req.method || 'GET',
      uri,
      path: urlPath,
      status,
      durationMs,
      sizeBytes,
      clientIp,
      country,
      userAgent,
      isInternal,
      category,
    };
  } catch {
    return null;
  }
}

// Ingest a batch of log entries into memory & aggregates
export function ingestLogs(entries: TrafficLogEntry[]) {
  if (!entries || entries.length === 0) return;

  for (const entry of entries) {
    // Add to recent logs
    recentLogs.unshift(entry);

    // Update minute bucket
    const date = new Date(entry.timestamp);
    const mKey = getMinuteKey(date);
    let bucket = minuteBuckets.get(mKey);
    if (!bucket) {
      bucket = {
        minuteKey: mKey,
        timestamp: new Date(mKey.replace(' ', 'T') + ':00').getTime(),
        requests: 0,
        visitorRequests: 0,
        errors: 0,
        totalDurationMs: 0,
      };
      minuteBuckets.set(mKey, bucket);
    }
    bucket.requests++;
    if (!entry.isInternal) {
      bucket.visitorRequests++;
    }
    if (entry.status >= 400) bucket.errors++;
    bucket.totalDurationMs += entry.durationMs;
  }

  // Trim recent logs
  if (recentLogs.length > MAX_LOGS) {
    recentLogs = recentLogs.slice(0, MAX_LOGS);
  }

  // Prune minute buckets older than 2 hours
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  for (const [key, bucket] of minuteBuckets.entries()) {
    if (bucket.timestamp < twoHoursAgo) {
      minuteBuckets.delete(key);
    }
  }
}

// Read log files
async function pollLogFiles() {
  const filesToRead: { filePath: string; project: string }[] = [];

  for (const dir of LOG_DIRS) {
    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.endsWith('.log')) {
            const project = file.replace('.log', '');
            filesToRead.push({ filePath: path.join(dir, file), project });
          }
        }
      }
    } catch {}
  }

  const newEntries: TrafficLogEntry[] = [];

  for (const { filePath, project } of filesToRead) {
    try {
      const stats = fs.statSync(filePath);
      const currentOffset = fileOffsets.get(filePath) || 0;

      if (stats.size > currentOffset) {
        const buffer = Buffer.alloc(stats.size - currentOffset);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, buffer.length, currentOffset);
        fs.closeSync(fd);

        fileOffsets.set(filePath, stats.size);

        const content = buffer.toString('utf-8');
        const lines = content.split('\n');
        for (const line of lines) {
          const parsed = parseCaddyLine(line, project);
          if (parsed) {
            newEntries.push(parsed);
          }
        }
      } else if (stats.size < currentOffset) {
        // File truncated/rotated, reset offset
        fileOffsets.set(filePath, 0);
      }
    } catch {}
  }

  if (newEntries.length > 0) {
    newEntries.sort((a, b) => a.timestamp - b.timestamp);
    ingestLogs(newEntries);
  }
}

// Poll active TCP connections per port
async function pollActiveConnections() {
  try {
    const isWindows = process.platform === 'win32';
    let output = '';

    if (isWindows) {
      const { stdout } = await execAsync('netstat -ano');
      output = stdout;
    } else {
      const { stdout } = await execAsync('netstat -an | grep ESTABLISHED || true');
      output = stdout;
    }

    const counts: Record<string, number> = {
      nabiz: 0,
      odak: 0,
      thedemir: 0,
      total: 0,
    };

    for (const [proj, port] of Object.entries(PROJECT_PORTS)) {
      const regex = new RegExp(`:${port}\\s+.*ESTABLISHED`, 'gi');
      const matches = output.match(regex);
      counts[proj] = matches ? matches.length : 0;
    }

    // Total active visitor connections on user-facing apps (odak, thedemir) + nabiz
    counts.total = counts.odak + counts.thedemir;
    activeConnections = counts;
  } catch {}
}

// Compute summary and domain-level metrics
export function getTrafficSummary(): TrafficSummary {
  const now = Date.now();
  const oneHourAgo = now - 3600 * 1000;
  const oneMinuteAgo = now - 60 * 1000;

  let totalRequests = recentLogs.length;
  let visitorRequests = 0;
  let totalBytes = 0;
  let totalDuration = 0;
  let visitorReqsInLastMinute = 0;

  const statusCodes = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };

  const domainMap: Record<string, {
    logs: TrafficLogEntry[];
    visitorLogs: TrafficLogEntry[];
    bytes: number;
    duration: number;
    statusCodes: { '2xx': number; '3xx': number; '4xx': number; '5xx': number };
    pathCounts: Map<string, { count: number; totalDuration: number; category: TrafficCategory }>;
    countryCounts: Map<string, number>;
  }> = {
    odak: { logs: [], visitorLogs: [], bytes: 0, duration: 0, statusCodes: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 }, pathCounts: new Map(), countryCounts: new Map() },
    thedemir: { logs: [], visitorLogs: [], bytes: 0, duration: 0, statusCodes: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 }, pathCounts: new Map(), countryCounts: new Map() },
    nabiz: { logs: [], visitorLogs: [], bytes: 0, duration: 0, statusCodes: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 }, pathCounts: new Map(), countryCounts: new Map() },
  };

  for (const log of recentLogs) {
    totalBytes += log.sizeBytes;
    totalDuration += log.durationMs;

    if (!log.isInternal) {
      visitorRequests++;
      if (log.timestamp >= oneMinuteAgo) {
        visitorReqsInLastMinute++;
      }
    }

    if (log.status >= 200 && log.status < 300) statusCodes['2xx']++;
    else if (log.status >= 300 && log.status < 400) statusCodes['3xx']++;
    else if (log.status >= 400 && log.status < 500) statusCodes['4xx']++;
    else if (log.status >= 500) statusCodes['5xx']++;

    const dKey = domainMap[log.project] ? log.project : 'thedemir';
    const dObj = domainMap[dKey];
    dObj.logs.push(log);
    if (!log.isInternal) dObj.visitorLogs.push(log);
    dObj.bytes += log.sizeBytes;
    dObj.duration += log.durationMs;

    if (log.status >= 200 && log.status < 300) dObj.statusCodes['2xx']++;
    else if (log.status >= 300 && log.status < 400) dObj.statusCodes['3xx']++;
    else if (log.status >= 400 && log.status < 500) dObj.statusCodes['4xx']++;
    else if (log.status >= 500) dObj.statusCodes['5xx']++;

    // Record path (skip internal polling from top paths unless no real paths exist)
    if (!log.isInternal || dObj.pathCounts.size < 3) {
      const pStat = dObj.pathCounts.get(log.path) || { count: 0, totalDuration: 0, category: log.category };
      pStat.count++;
      pStat.totalDuration += log.durationMs;
      dObj.pathCounts.set(log.path, pStat);
    }

    // Country count for visitors
    if (!log.isInternal) {
      const cCount = dObj.countryCounts.get(log.country) || 0;
      dObj.countryCounts.set(log.country, cCount + 1);
    }
  }

  // Build domain stats
  const domains: Record<string, DomainStats> = {};
  for (const [proj, dObj] of Object.entries(domainMap)) {
    const projVisitorLogs = dObj.visitorLogs;
    const projReqLastHour = projVisitorLogs.filter((l) => l.timestamp >= oneHourAgo).length;
    const projReqLastMin = projVisitorLogs.filter((l) => l.timestamp >= oneMinuteAgo).length;

    const topPaths = Array.from(dObj.pathCounts.entries())
      .map(([path, data]) => ({
        path,
        count: data.count,
        avgDurationMs: Math.round((data.totalDuration / data.count) * 10) / 10,
        category: data.category,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topCountries = Array.from(dObj.countryCounts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    domains[proj] = {
      project: proj,
      host: proj === 'odak' ? 'odak.thedemir.com' : proj === 'nabiz' ? 'nabiz.thedemir.com' : 'thedemir.com',
      activeConnections: activeConnections[proj] || 0,
      totalRequests: dObj.logs.length,
      visitorRequests: projVisitorLogs.length,
      requestsLastHour: projReqLastHour,
      requestsPerSec: Math.round((projReqLastMin / 60) * 10) / 10,
      totalBytes: dObj.bytes,
      avgDurationMs: dObj.logs.length > 0 ? Math.round((dObj.duration / dObj.logs.length) * 10) / 10 : 0,
      statusCodes: dObj.statusCodes,
      topPaths,
      topCountries,
    };
  }

  // Build last 30 minutes time-series
  const historySeries: { timestamp: number; time: string; requests: number; visitorRequests: number; errors: number; avgLatency: number }[] = [];
  const sortedBuckets = Array.from(minuteBuckets.values()).sort((a, b) => a.timestamp - b.timestamp);
  
  if (sortedBuckets.length === 0) {
    const d = new Date();
    historySeries.push({
      timestamp: d.getTime(),
      time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      requests: 0,
      visitorRequests: 0,
      errors: 0,
      avgLatency: 0,
    });
  } else {
    for (const b of sortedBuckets.slice(-30)) {
      const d = new Date(b.timestamp);
      historySeries.push({
        timestamp: b.timestamp,
        time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        requests: b.requests,
        visitorRequests: b.visitorRequests,
        errors: b.errors,
        avgLatency: b.requests > 0 ? Math.round((b.totalDurationMs / b.requests) * 10) / 10 : 0,
      });
    }
  }

  return {
    totalActiveConnections: activeConnections.total || 0,
    totalRequests,
    visitorRequests,
    requestsPerSec: Math.round((visitorReqsInLastMinute / 60) * 10) / 10,
    totalBytes,
    totalBytesFormatted: formatBytes(totalBytes),
    avgDurationMs: totalRequests > 0 ? Math.round((totalDuration / totalRequests) * 10) / 10 : 0,
    statusCodes,
    historySeries,
    domains,
    recentLogs: recentLogs.slice(0, 100),
  };
}

// Background scheduler
let monitorInterval: NodeJS.Timeout | null = null;

export function startTrafficMonitoring() {
  const localLogsDir = path.resolve(process.cwd(), 'data/logs');
  if (!fs.existsSync(localLogsDir)) {
    try {
      fs.mkdirSync(localLogsDir, { recursive: true });
    } catch {}
  }

  pollLogFiles();
  pollActiveConnections();

  if (!monitorInterval) {
    monitorInterval = setInterval(async () => {
      await Promise.all([pollLogFiles(), pollActiveConnections()]);
    }, 1500);
  }
}
