const API_BASE = '/api';

export interface Service {
  id: number;
  name: string;
  url: string;
  interval_seconds: number;
  current_status: 'up' | 'down' | 'pending' | 'paused';
  last_checked_at?: string;
  last_latency_ms: number;
  last_error?: string;
  is_paused: number;
  stats?: {
    uptime24h: number;
    avgLatency: number;
    dailyHistory: Array<{
      date: string;
      total: number;
      up_count: number;
      avg_latency: number;
    }>;
  };
  recentChecks?: Array<{
    id: number;
    status: string;
    latency_ms: number;
    status_code?: number;
    message?: string;
    created_at: string;
  }>;
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
  services: {
    list: (): Promise<Service[]> => request('/services'),
    create: (data: { name: string; url: string; interval_seconds?: number }) =>
      request('/services', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { name?: string; url?: string; interval_seconds?: number }) =>
      request(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/services/${id}`, { method: 'DELETE' }),
    toggle: (id: number) => request(`/services/${id}/toggle`, { method: 'POST' }),
    test: (id: number) => request(`/services/${id}/test`, { method: 'POST' }),
  },
  alerts: {
    get: (): Promise<AlertSettings> => request('/alerts'),
    save: (data: AlertSettings) => request('/alerts', { method: 'POST', body: JSON.stringify(data) }),
    test: (type: 'telegram' | 'discord', config: any) =>
      request('/alerts/test', { method: 'POST', body: JSON.stringify({ type, config }) }),
  },
  public: {
    status: () => request('/public/status'),
  },
};
