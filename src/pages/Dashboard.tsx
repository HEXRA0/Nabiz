import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  ArrowUpRight,
  RefreshCw,
  Play,
  Shield,
  Server,
  Globe
} from 'lucide-react';
import { api, Monitor, Incident } from '../lib/api.js';
import { useWebSocket } from '../lib/ws.js';
import { UptimeBar } from '../components/UptimeBar.js';

interface DashboardProps {
  onOpenCreateMonitor: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenCreateMonitor }) => {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [monitorsData, incidentsData] = await Promise.all([
        api.monitors.list(),
        api.incidents.list(),
      ]);
      setMonitors(monitorsData);
      setIncidents(incidentsData);
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Real-time updates via WebSocket
  useWebSocket(
    useCallback((event: string, data: any) => {
      if (event === 'monitor_checked' || event === 'monitor_status_changed') {
        setMonitors((prev) =>
          prev.map((m) => {
            if (m.id === data.monitorId) {
              return {
                ...m,
                current_status: data.status || m.current_status,
                last_latency_ms: data.latencyMs ?? m.last_latency_ms,
                last_checked_at: data.timestamp,
                last_error: data.status === 'down' ? data.message : null,
              };
            }
            return m;
          })
        );
      }
    }, [])
  );

  const handleTest = async (id: number) => {
    setTestingId(id);
    try {
      await api.monitors.test(id);
      await loadData();
    } catch (e) {
      console.error('Test failed:', e);
    } finally {
      setTestingId(null);
    }
  };

  // Metrics
  const totalCount = monitors.length;
  const upCount = monitors.filter((m) => m.current_status === 'up').length;
  const downCount = monitors.filter((m) => m.current_status === 'down').length;
  const pausedCount = monitors.filter((m) => m.is_paused === 1).length;

  const avgUptime = totalCount > 0
    ? (
        monitors.reduce((sum, m) => sum + (m.stats?.uptime24h || 100), 0) /
        totalCount
      ).toFixed(2)
    : '100.00';

  const avgLatency = totalCount > 0
    ? Math.round(
        monitors.reduce((sum, m) => sum + (m.stats?.avgLatency24h || 0), 0) /
        totalCount
      )
    : 0;

  const activeIncidents = incidents.filter((i) => i.status !== 'resolved');

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Active Incidents Banner */}
      {activeIncidents.length > 0 && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between shadow-lg shadow-rose-950/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <AlertTriangle className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-rose-200">
                {activeIncidents.length} Aktif Olay / Kesinti Mevcut
              </h4>
              <p className="text-xs text-rose-300/80">
                {activeIncidents[0].title} — {activeIncidents[0].updates[0]?.message || 'Müdahale ediliyor'}
              </p>
            </div>
          </div>
          <a
            href="/incidents"
            className="text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/20 hover:bg-rose-500/30 px-3.5 py-2 rounded-xl border border-rose-500/40 transition flex items-center gap-1"
          >
            <span>Olay Detayları</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall System Health */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Sistem Sağlığı (24s)
            </span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">%{avgUptime}</span>
            <span className="text-xs text-emerald-400 font-medium">Hedef %99.9</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Son 24 saatteki başarılı yanıt oranı</p>
        </div>

        {/* Total Monitors */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Monitörler
            </span>
            <div className="h-8 w-8 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-white font-mono">{totalCount}</span>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-emerald-400 font-semibold">{upCount} Açık</span>
              {downCount > 0 && <span className="text-rose-400 font-semibold">• {downCount} Kapalı</span>}
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1">İzlenen servis ve URL sayısı</p>
        </div>

        {/* Avg Latency */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Ortalama Gecikme
            </span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{avgLatency}</span>
            <span className="text-xs text-slate-400 font-mono">ms</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Tüm servislerin ortalama yanıt süresi</p>
        </div>

        {/* Active Outages */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Kesinti Durumu
            </span>
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${
              downCount > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
            }`}>
              {downCount > 0 ? <AlertTriangle className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono ${downCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {downCount === 0 ? 'Sorun Yok' : `${downCount} Kesinti`}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {downCount === 0 ? 'Tüm servisler operasyonel' : 'Müdahale gereken servisler var'}
          </p>
        </div>
      </div>

      {/* Monitors Real-Time List */}
      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Canlı Monitör Durumları</h3>
            <p className="text-xs text-slate-400">
              Gerçek zamanlı denetim verileri ve 90 günlük erişilebilirlik grafiği
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl border border-slate-700 transition"
              title="Yenile"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onOpenCreateMonitor}
              className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 rounded-xl shadow-md transition"
            >
              + Monitör Ekle
            </button>
          </div>
        </div>

        {/* List */}
        {monitors.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-slate-800/80 flex items-center justify-center mx-auto text-slate-500 border border-slate-700">
              <Activity className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-300">Henüz bir monitör eklenmedi</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Web sitenizi, API'nizi veya sunucunuzu 7/24 izlemeye başlamak için yeni bir monitör tanımlayın.
              </p>
            </div>
            <button
              onClick={onOpenCreateMonitor}
              className="mt-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl transition"
            >
              İlk Monitörünü Ekle
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {monitors.map((m) => {
              const isUp = m.current_status === 'up';
              const isDown = m.current_status === 'down';
              const isPaused = m.is_paused === 1;

              return (
                <div
                  key={m.id}
                  className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition space-y-3"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Title & Target */}
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-3 w-3 rounded-full shrink-0 ${
                          isPaused
                            ? 'bg-slate-500'
                            : isUp
                            ? 'bg-emerald-500 animate-pulse'
                            : isDown
                            ? 'bg-rose-500'
                            : 'bg-amber-400'
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-100">{m.name}</span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            {m.type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-mono truncate max-w-md">{m.url}</p>
                      </div>
                    </div>

                    {/* Stats & Actions */}
                    <div className="flex items-center gap-4 text-xs">
                      {/* Latency */}
                      <div className="text-right">
                        <span className="text-[11px] text-slate-500 block">Son Gecikme</span>
                        <span className="font-mono font-semibold text-slate-200">
                          {m.last_latency_ms} ms
                        </span>
                      </div>

                      {/* 24h Uptime */}
                      <div className="text-right">
                        <span className="text-[11px] text-slate-500 block">24s Uptime</span>
                        <span className={`font-mono font-semibold ${
                          (m.stats?.uptime24h || 100) >= 99 ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          %{m.stats?.uptime24h ?? '100.00'}
                        </span>
                      </div>

                      {/* Manual Check Button */}
                      <button
                        onClick={() => handleTest(m.id)}
                        disabled={testingId === m.id}
                        className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg border border-slate-700/80 transition"
                        title="Anlık Test Yap"
                      >
                        <Play className={`h-3.5 w-3.5 ${testingId === m.id ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* 90-day Status Bar */}
                  <UptimeBar dailyHistory={m.stats?.dailyHistory} daysCount={60} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
