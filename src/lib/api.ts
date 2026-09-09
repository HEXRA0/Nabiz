const API_BASE = '/api';

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

export interface Monitor {
  id: number;
  name: string;
  type: 'http' | 'tcp' | 'ping' | 'ssl';
  url: string;
  method: string;
  expected_status_code: number;
  body_search?: string;
  headers?: string;
  timeout_ms: number;
  interval_seconds: number;
  retries_before_down: number;
  is_paused: number;
  current_status: 'up' | 'down' | 'pending' | 'paused';
  last_checked_at?: string;
  last_latency_ms: number;
  last_error?: string;
  ssl_days_remaining?: number;
  ssl_expiry_date?: string;
  consecutive_failures: number;
  created_at: string;
  stats?: {
    uptime24h: number;
    uptime30d: number;
    avgLatency24h: number;
    dailyHistory: Array<{
      date: string;
      total: number;
      up_count: number;
      avg_latency: number;
    }>;
  };
}

export interface Heartbeat {
  id: number;
  name: string;
  token: string;
  interval_seconds: number;
  grace_period_seconds: number;
  current_status: 'up' | 'down' | 'pending' | 'paused';
  last_ping_at?: string;
  consecutive_failures: number;
  is_paused: number;
  created_at: string;
}

export interface Incident {
  id: number;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'minor' | 'major' | 'critical' | 'maintenance';
  monitor_id?: number;
  monitor_name?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  updates: Array<{
    id: number;
    incident_id: number;
    status: string;
    message: string;
    created_at: string;
  }>;
}

export interface NotificationChannel {
  id: number;
  name: string;
  type: 'telegram' | 'discord' | 'webhook' | 'email';
  config_json: string;
  is_active: number;
  events_json: string;
  created_at: string;
}

function getToken(): string | null {
  return localStorage.getItem('nabiz_token');
}

export function setToken(token: string) {
  localStorage.setItem('nabiz_token', token);
}

export function removeToken() {
  localStorage.removeItem('nabiz_token');
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/status')) {
      removeToken();
      window.location.href = '/login';
    }
    throw new Error(data.error || 'İşlem sırasında bir hata oluştu');
  }

  return data;
}

export const api = {
  auth: {
    getStatus: () => fetchWithAuth('/auth/status'),
    setup: (body: any) => fetchWithAuth('/auth/setup', { method: 'POST', body: JSON.stringify(body) }),
    login: (body: any) => fetchWithAuth('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    me: () => fetchWithAuth('/auth/me'),
    changePassword: (body: any) => fetchWithAuth('/auth/change-password', { method: 'POST', body: JSON.stringify(body) }),
  },
  monitors: {
    list: (): Promise<Monitor[]> => fetchWithAuth('/monitors'),
    get: (id: number): Promise<Monitor & { recentChecks: any[] }> => fetchWithAuth(`/monitors/${id}`),
    create: (body: any) => fetchWithAuth('/monitors', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: any) => fetchWithAuth(`/monitors/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => fetchWithAuth(`/monitors/${id}`, { method: 'DELETE' }),
    togglePause: (id: number) => fetchWithAuth(`/monitors/${id}/toggle-pause`, { method: 'POST' }),
    test: (id: number) => fetchWithAuth(`/monitors/${id}/test`, { method: 'POST' }),
  },
  heartbeats: {
    list: (): Promise<Heartbeat[]> => fetchWithAuth('/heartbeats'),
    get: (id: number) => fetchWithAuth(`/heartbeats/${id}`),
    create: (body: any) => fetchWithAuth('/heartbeats', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: any) => fetchWithAuth(`/heartbeats/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => fetchWithAuth(`/heartbeats/${id}`, { method: 'DELETE' }),
    regenerateToken: (id: number) => fetchWithAuth(`/heartbeats/${id}/regenerate-token`, { method: 'POST' }),
  },
  incidents: {
    list: (): Promise<Incident[]> => fetchWithAuth('/incidents'),
    get: (id: number): Promise<Incident> => fetchWithAuth(`/incidents/${id}`),
    create: (body: any) => fetchWithAuth('/incidents', { method: 'POST', body: JSON.stringify(body) }),
    addUpdate: (id: number, body: any) => fetchWithAuth(`/incidents/${id}/updates`, { method: 'POST', body: JSON.stringify(body) }),
    delete: (id: number) => fetchWithAuth(`/incidents/${id}`, { method: 'DELETE' }),
  },
  statusPages: {
    getPublic: (slug = 'default') => fetchWithAuth(`/status-pages/public/${slug}`),
    list: () => fetchWithAuth('/status-pages'),
    update: (id: number, body: any) => fetchWithAuth(`/status-pages/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  },
  notificationChannels: {
    list: () => fetchWithAuth('/notification-channels'),
    create: (body: any) => fetchWithAuth('/notification-channels', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: any) => fetchWithAuth(`/notification-channels/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => fetchWithAuth(`/notification-channels/${id}`, { method: 'DELETE' }),
    test: (id: number) => fetchWithAuth(`/notification-channels/${id}/test`, { method: 'POST' }),
  },
  settings: {
    get: () => fetchWithAuth('/settings'),
    update: (body: any) => fetchWithAuth('/settings', { method: 'POST', body: JSON.stringify(body) }),
  },
};
