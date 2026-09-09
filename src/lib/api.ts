const API_BASE = '/api';

export interface ProjectActivity {
  id: number;
  project_name: string;
  action: 'start' | 'stop' | 'restart';
  status: 'success' | 'error';
  message: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  type: 'pm2' | 'docker' | 'port' | 'process';
  pid?: number;
  port?: number | string;
  status: 'online' | 'stopped' | 'errored';
  memoryBytes: number;
  memoryMb: number;
  memoryPercent: number; // % of total server RAM
  cpuPercent: number;
  uptimeSeconds: number;
  restarts?: number;
  command?: string;
  logPath?: string;
  directory?: string;
  isCustom?: boolean;
  isSelf?: boolean;
  lastActivity?: {
    action: 'start' | 'stop' | 'restart';
    status: 'success' | 'error';
    message: string;
    createdAt: string;
  };
}

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

async function request(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'İşlem başarısız');
  }
  return data;
}

export type TrafficCategory = 'page' | 'api' | 'asset' | 'internal';

export interface TrafficLogEntry {
  id: string;
  timestamp: number;
  timeFormatted: string;
  project: string;
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
  visitorRequests: number;
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
  visitorRequests: number;
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

export interface HistoricalTrafficReport {
  range: string;
  rangeLabel: string;
  project: string;
  totalRequests: number;
  visitorRequests: number;
  uniqueIps: number;
  totalBytes: number;
  totalBytesFormatted: string;
  avgDurationMs: number;
  statusCodes: {
    '2xx': number;
    '3xx': number;
    '4xx': number;
    '5xx': number;
  };
  chartSeries: { label: string; visitorRequests: number; totalRequests: number; errors: number; avgLatency: number }[];
  topPaths: { path: string; count: number; avgDurationMs: number; category: TrafficCategory }[];
  topCountries: { code: string; count: number }[];
  recentLogs: TrafficLogEntry[];
}

export const api = {
  projects: {
    list: (): Promise<Project[]> => request('/projects'),
    add: (data: { name: string; type?: string; target: string; directory?: string; restart_command?: string }) =>
      request('/projects', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/projects/${id}`, { method: 'DELETE' }),
    action: (id: string, action: 'start' | 'stop' | 'restart'): Promise<{ success: boolean; message: string }> =>
      request(`/projects/${id}/action`, { method: 'POST', body: JSON.stringify({ action }) }),
    logs: (id: string): Promise<{ logs: string }> => request(`/projects/${id}/logs`),
    activities: (): Promise<ProjectActivity[]> => request('/projects/activities'),
  },
  system: {
    stats: (): Promise<SystemStats> => request('/system/stats'),
  },
  traffic: {
    summary: (): Promise<TrafficSummary> => request('/traffic/summary'),
    history: (range: string = 'today', project: string = 'all'): Promise<HistoricalTrafficReport> =>
      request(`/traffic/history?range=${range}&project=${project}`),
    logs: (project?: string): Promise<TrafficLogEntry[]> => request(`/traffic/logs${project ? `?project=${project}` : ''}`),
  },
};

