const API_BASE = '/api';

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

export const api = {
  projects: {
    list: (): Promise<Project[]> => request('/projects'),
    add: (data: { name: string; type?: string; target: string; directory?: string; restart_command?: string }) =>
      request('/projects', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/projects/${id}`, { method: 'DELETE' }),
    action: (id: string, action: 'start' | 'stop' | 'restart'): Promise<{ success: boolean; message: string }> =>
      request(`/projects/${id}/action`, { method: 'POST', body: JSON.stringify({ action }) }),
    logs: (id: string): Promise<{ logs: string }> => request(`/projects/${id}/logs`),
  },
  system: {
    stats: (): Promise<SystemStats> => request('/system/stats'),
  },
};
