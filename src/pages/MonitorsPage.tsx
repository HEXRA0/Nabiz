import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Play,
  Pause,
  Edit2,
  Trash2,
  Search,
  ExternalLink,
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X
} from 'lucide-react';
import { api, Monitor } from '../lib/api.js';
import { UptimeBar } from '../components/UptimeBar.js';
import { LatencyChart } from '../components/LatencyChart.js';

interface MonitorsPageProps {
  onOpenCreateModal: () => void;
  onEditMonitor: (monitor: Monitor) => void;
}

export const MonitorsPage: React.FC<MonitorsPageProps> = ({
  onOpenCreateModal,
  onEditMonitor,
}) => {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [selectedMonitor, setSelectedMonitor] = useState<(Monitor & { recentChecks: any[] }) | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<number | null>(null);

  const loadMonitors = useCallback(async () => {
    try {
      const data = await api.monitors.list();
      setMonitors(data);
      if (selectedMonitor) {
        const details = await api.monitors.get(selectedMonitor.id);
        setSelectedMonitor(details);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedMonitor?.id]);

  useEffect(() => {
    loadMonitors();
    const timer = setInterval(loadMonitors, 15000);
    return () => clearInterval(timer);
  }, [loadMonitors]);

  const handleSelect = async (m: Monitor) => {
    try {
      const details = await api.monitors.get(m.id);
      setSelectedMonitor(details);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTogglePause = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.monitors.togglePause(id);
      await loadMonitors();
    } catch (e) {
      console.error(e);
    }
  };

  const handleTest = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTestingId(id);
    try {
      await api.monitors.test(id);
      await loadMonitors();
    } catch (e) {
      console.error(e);
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Bu monitörü silmek istediğinize emin misiniz? Tüm geçmiş veriler silinecektir.')) return;
    try {
      await api.monitors.delete(id);
      if (selectedMonitor?.id === id) setSelectedMonitor(null);
      await loadMonitors();
    } catch (e) {
      console.error(e);
    }
  };

  // Filter
  const filtered = monitors.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.url.toLowerCase().includes(search.toLowerCase());

    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'up') return matchesSearch && m.current_status === 'up' && m.is_paused === 0;
    if (filterStatus === 'down') return matchesSearch && m.current_status === 'down';
    if (filterStatus === 'paused') return matchesSearch && m.is_paused === 1;
    return matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Monitör Yönetimi</h2>
          <p className="text-xs text-slate-400">
            HTTP/HTTPS, SSL Sertifikası, TCP ve Ping servislerinizi yapılandırın
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCreateModal}
            className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-950/40 transition"
          >
            + Yeni Monitör Ekle
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Monitör adı veya URL ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex gap-1.5 p-1 bg-slate-900/80 border border-slate-800 rounded-xl">
          {[
            { id: 'all', label: 'Tümü' },
            { id: 'up', label: 'Açık (Up)' },
            { id: 'down', label: 'Kapalı (Down)' },
            { id: 'paused', label: 'Duraklatıldı' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                filterStatus === tab.id
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: List + Detail Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List Column */}
        <div className={`${selectedMonitor ? 'lg:col-span-1' : 'lg:col-span-3'} space-y-3`}>
          {filtered.length === 0 ? (
            <div className="glass-panel p-8 rounded-2xl text-center text-slate-500 text-xs">
              Kriterlere uygun monitör bulunamadı.
            </div>
          ) : (
            filtered.map((m) => {
              const isSelected = selectedMonitor?.id === m.id;
              const isUp = m.current_status === 'up';
              const isDown = m.current_status === 'down';
              const isPaused = m.is_paused === 1;

              return (
                <div
                  key={m.id}
                  onClick={() => handleSelect(m)}
                  className={`p-4 rounded-xl border cursor-pointer transition ${
                    isSelected
                      ? 'border-emerald-500/60 bg-emerald-950/20 shadow-md'
                      : 'border-slate-800/80 bg-slate-900/60 hover:border-slate-700/80 hover:bg-slate-900/90'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                          isPaused ? 'bg-slate-500' : isUp ? 'bg-emerald-500' : isDown ? 'bg-rose-500' : 'bg-amber-400'
                        }`}
                      />
                      <div>
                        <h4 className="text-sm font-semibold text-white leading-tight">{m.name}</h4>
                        <span className="text-[11px] text-slate-500 font-mono block truncate max-w-[200px]">
                          {m.url}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleTogglePause(m.id, e)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                        title={isPaused ? 'Devam Ettir' : 'Duraklat'}
                      >
                        {isPaused ? <Play className="h-3.5 w-3.5 text-emerald-400" /> : <Pause className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditMonitor(m);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                        title="Düzenle"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(m.id, e)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10"
                        title="Sil"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60">
                    <div className="flex items-center gap-3">
                      <span>{m.interval_seconds}s aralık</span>
                      <span>{m.last_latency_ms} ms</span>
                    </div>
                    <span className="font-mono font-semibold text-emerald-400">
                      %{m.stats?.uptime24h ?? '100.00'}
                    </span>
                  </div>

                  {!selectedMonitor && (
                    <div className="pt-2">
                      <UptimeBar dailyHistory={m.stats?.dailyHistory} daysCount={60} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Detail Panel */}
        {selectedMonitor && (
          <div className="lg:col-span-2 glass-panel rounded-2xl p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-white">{selectedMonitor.name}</h3>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                    selectedMonitor.current_status === 'up'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}>
                    {selectedMonitor.current_status}
                  </span>
                </div>
                <a
                  href={selectedMonitor.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-slate-400 hover:text-emerald-400 font-mono mt-1 flex items-center gap-1"
                >
                  <span>{selectedMonitor.url}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTest(selectedMonitor.id)}
                  disabled={testingId === selectedMonitor.id}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-700 transition"
                >
                  <Play className={`h-3.5 w-3.5 ${testingId === selectedMonitor.id ? 'animate-spin' : ''}`} />
                  <span>Şimdi Test Et</span>
                </button>
                <button
                  onClick={() => setSelectedMonitor(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Performance Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-center">
                <span className="text-[11px] text-slate-500 block">24s Uptime</span>
                <span className="text-base font-bold text-emerald-400 font-mono">
                  %{selectedMonitor.stats?.uptime24h ?? '100.00'}
                </span>
              </div>
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-center">
                <span className="text-[11px] text-slate-500 block">30 Günlük Uptime</span>
                <span className="text-base font-bold text-emerald-400 font-mono">
                  %{selectedMonitor.stats?.uptime30d ?? '100.00'}
                </span>
              </div>
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-center">
                <span className="text-[11px] text-slate-500 block">Ort. Yanıt Süresi</span>
                <span className="text-base font-bold text-white font-mono">
                  {selectedMonitor.stats?.avgLatency24h ?? 0} ms
                </span>
              </div>
            </div>

            {/* 90-Day Status Bar */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Son 90 Günlük Erişilebilirlik
              </h4>
              <UptimeBar dailyHistory={selectedMonitor.stats?.dailyHistory} daysCount={90} />
            </div>

            {/* Latency History Chart */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Son Yanıt Süreleri (Gecikme Grafiği)
              </h4>
              <LatencyChart data={selectedMonitor.recentChecks} />
            </div>

            {/* SSL Info Card if available */}
            {selectedMonitor.ssl_days_remaining !== undefined && selectedMonitor.ssl_days_remaining !== null && (
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-slate-200">SSL / TLS Sertifikası</h5>
                    <p className="text-[11px] text-slate-400">
                      Bitiş Tarihi: {selectedMonitor.ssl_expiry_date ? new Date(selectedMonitor.ssl_expiry_date).toLocaleDateString() : 'Belirsiz'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-400 font-mono">
                    {selectedMonitor.ssl_days_remaining} gün kaldı
                  </span>
                  <span className="text-[10px] text-slate-500 block">Geçerli & Güvenli</span>
                </div>
              </div>
            )}

            {/* Recent Check Logs Table */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Son Denetim Kayıtları
              </h4>
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Durum</th>
                      <th className="py-2.5 px-3">Kod</th>
                      <th className="py-2.5 px-3">Gecikme</th>
                      <th className="py-2.5 px-3">Mesaj / Detay</th>
                      <th className="py-2.5 px-3 text-right">Zaman</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 font-mono text-[11px]">
                    {selectedMonitor.recentChecks.slice(0, 10).map((chk: any) => (
                      <tr key={chk.id} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3">
                          <span className={`px-1.5 py-0.5 rounded font-sans font-semibold text-[10px] ${
                            chk.status === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {chk.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-300">{chk.status_code || '-'}</td>
                        <td className="py-2 px-3 text-slate-300">{chk.latency_ms} ms</td>
                        <td className="py-2 px-3 text-slate-400 max-w-xs truncate font-sans">{chk.message || '-'}</td>
                        <td className="py-2 px-3 text-right text-slate-500">
                          {new Date(chk.created_at).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
