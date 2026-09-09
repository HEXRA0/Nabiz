const API_BASE = '/api';

export interface Project {
  id: string;
  name: string;
  type: 'pm2' | 'docker' | 'port' | 'process';
  pid?: number;
  port?: number | string;
  status: 'online' | 'stopped' | 'errored' | 'high_memory';
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
}

export interface AlertSettings {
  telegram: {
    botToken: string;
    chatId: string;
    enabled: boolean;
  };
  discord: {
    webhookUrl: string;
    enabled: boolean;
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
    action: (id: string, action: 'restart' | 'stop' | 'start') =>
      request(`/projects/${id}/action`, { method: 'POST', body: JSON.stringify({ action }) }),
    logs: (id: string): Promise<{ logs: string }> => request(`/projects/${id}/logs`),
  },
  system: {
    stats: (): Promise<SystemStats> => request('/system/stats'),
  },
  alerts: {
    get: (): Promise<AlertSettings> => request('/alerts'),
    save: (data: AlertSettings) => request('/alerts', { method: 'POST', body: JSON.stringify(data) }),
    test: (type: 'telegram' | 'discord', config: any) =>
      request('/alerts/test', { method: 'POST', body: JSON.stringify({ type, config }) }),
  },
};
