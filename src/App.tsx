import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import {
  Activity,
  Plus,
  Bell,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Send,
  Save,
  RefreshCw,
  Zap,
  Globe
} from 'lucide-react';
import { api, Service, AlertSettings } from './lib/api.js';
import { useWebSocket } from './lib/ws.js';
import { ServiceCard } from './components/ServiceCard.js';
import { AddServiceModal } from './components/AddServiceModal.js';
import { PublicStatusPage } from './pages/PublicStatusPage.js';

function Dashboard() {
  const [activeTab, setActiveTab] = useState<'services' | 'alerts'>('services');
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  // Alert Settings state
  const [alerts, setAlerts] = useState<AlertSettings>({
    telegram: { botToken: '', chatId: '', enabled: false },
    discord: { webhookUrl: '', enabled: false },
  });
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [alertSuccess, setAlertSuccess] = useState(false);
  const [testingType, setTestingType] = useState<'telegram' | 'discord' | null>(null);
  const [testResult, setTestResult] = useState<{ msg: string; ok: boolean } | null>(null);

  const loadServices = useCallback(async () => {
    try {
      const data = await api.services.list();
      setServices(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await api.alerts.get();
      setAlerts(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadServices();
    loadAlerts();
    const timer = setInterval(loadServices, 15000);
    return () => clearInterval(timer);
  }, [loadServices, loadAlerts]);

  // Real-time updates via WebSocket
  useWebSocket(
    useCallback((event: string, data: any) => {
      if (event === 'monitor_checked' || event === 'monitor_status_changed') {
        setServices((prev) =>
          prev.map((s) => {
            if (s.id === data.monitorId) {
              return {
                ...s,
                current_status: data.status || s.current_status,
                last_latency_ms: data.latencyMs ?? s.last_latency_ms,
                last_checked_at: data.timestamp,
                last_error: data.status === 'down' ? data.message : null,
              };
            }
            return s;
          })
        );
      }
    }, [])
  );

  const handleTest = async (id: number) => {
    await api.services.test(id);
    await loadServices();
  };

  const handleToggle = async (id: number) => {
    await api.services.toggle(id);
    await loadServices();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bu servisi silmek istediğinize emin misiniz?')) return;
    await api.services.delete(id);
    await loadServices();
  };

  const handleSaveAlerts = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAlerts(true);
    setAlertSuccess(false);
    setTestResult(null);

    try {
      await api.alerts.save(alerts);
      setAlertSuccess(true);
      setTimeout(() => setAlertSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingAlerts(false);
    }
  };

  const handleTestAlert = async (type: 'telegram' | 'discord') => {
    setTestingType(type);
    setTestResult(null);

    try {
      const config = type === 'telegram' ? alerts.telegram : alerts.discord;
      const res = await api.alerts.test(type, config);
      setTestResult({ msg: res.message, ok: true });
    } catch (err: any) {
      setTestResult({ msg: err.message, ok: false });
    } finally {
      setTestingType(null);
    }
  };

  // Metrics
  const totalCount = services.length;
  const downCount = services.filter((s) => s.current_status === 'down').length;
  const avgLatency = totalCount > 0
    ? Math.round(services.reduce((sum, s) => sum + (s.last_latency_ms || 0), 0) / totalCount)
    : 0;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col selection:bg-emerald-500/30">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-800/80 bg-[#0c121e]/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Activity className="h-5 w-5 text-white animate-pulse-subtle" />
          </div>
          <div>
            <span className="font-extrabold tracking-tight text-base sm:text-lg bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              NABIZ
            </span>
            <span className="text-[11px] text-slate-400 hidden sm:inline ml-2">nabiz.thedemir.com</span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-slate-900/80 border border-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab('services')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'services'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Servisler</span>
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'alerts'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bell className="h-3.5 w-3.5" />
            <span>Bildirimler</span>
          </button>
        </div>

        {/* Public Status Page Link */}
        <a
          href="/status"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-700 transition"
        >
          <span className="hidden sm:inline">Durum Sayfası</span>
          <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
        </a>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {activeTab === 'services' && (
          <>
            {/* Overall Status Banner */}
            <div
              className={`p-5 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl ${
                downCount === 0
                  ? 'bg-emerald-950/20 border-emerald-500/30'
                  : 'bg-rose-950/20 border-rose-500/30'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    downCount === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {downCount === 0 ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    {downCount === 0
                      ? 'Tüm Servisler Sorunsuz Çalışıyor'
                      : `${downCount} Serviste Kesinti Tespit Edildi`}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {totalCount} servis aktif olarak izleniyor • Ortalama yanıt süresi: <strong className="text-slate-200">{avgLatency} ms</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setEditingService(null);
                  setIsModalOpen(true);
                }}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-950/40 transition active:scale-[0.98] shrink-0"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                <span>Yeni Servis Ekle</span>
              </button>
            </div>

            {/* Services List */}
            {services.length === 0 ? (
              <div className="glass-panel p-12 rounded-3xl text-center space-y-4 border border-slate-800">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                  <Activity className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-200">Henüz Bir Servis Eklenmedi</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Web sitenizi, API'nizi veya sunucunuzu 7/24 izlemek için sadece adını ve adresini girin.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingService(null);
                    setIsModalOpen(true);
                  }}
                  className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 rounded-xl shadow-md transition"
                >
                  İlk Servisini Ekle
                </button>
              </div>
            ) : (
              <div className="space-y-3.5">
                {services.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    onTest={handleTest}
                    onToggle={handleToggle}
                    onEdit={(s) => {
                      setEditingService(s);
                      setIsModalOpen(true);
                    }}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Tab 2: Alerts & Settings */}
        {activeTab === 'alerts' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Anlık Bildirim Kanalları</h2>
              <p className="text-xs text-slate-400">
                Herhangi bir servis kapandığında veya tekrar açıldığında hemen uyarı alın
              </p>
            </div>

            {testResult && (
              <div
                className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2.5 ${
                  testResult.ok
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}
              >
                {testResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                <span>{testResult.msg}</span>
              </div>
            )}

            {alertSuccess && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Bildirim ayarlarınız başarıyla kaydedildi!</span>
              </div>
            )}

            <form onSubmit={handleSaveAlerts} className="space-y-4">
              {/* Telegram Card */}
              <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">✈️</span>
                    <div>
                      <h3 className="text-sm font-bold text-white">Telegram Bildirimleri</h3>
                      <p className="text-[11px] text-slate-400">Telegram botu ile anında bildirim gönderimi</p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alerts.telegram.enabled}
                      onChange={(e) =>
                        setAlerts({
                          ...alerts,
                          telegram: { ...alerts.telegram, enabled: e.target.checked },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Bot Token</label>
                    <input
                      type="password"
                      placeholder="123456789:AAHk..."
                      value={alerts.telegram.botToken}
                      onChange={(e) =>
                        setAlerts({
                          ...alerts,
                          telegram: { ...alerts.telegram, botToken: e.target.value },
                        })
                      }
                      className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Chat ID / Grup ID</label>
                    <input
                      type="text"
                      placeholder="-100123456789"
                      value={alerts.telegram.chatId}
                      onChange={(e) =>
                        setAlerts({
                          ...alerts,
                          telegram: { ...alerts.telegram, chatId: e.target.value },
                        })
                      }
                      className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => handleTestAlert('telegram')}
                    disabled={testingType === 'telegram'}
                    className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-500/30 transition disabled:opacity-50"
                  >
                    <Send className={`h-3 w-3 ${testingType === 'telegram' ? 'animate-spin' : ''}`} />
                    <span>{testingType === 'telegram' ? 'Gönderiliyor...' : 'Telegram Test Mesajı Gönder'}</span>
                  </button>
                </div>
              </div>

              {/* Discord Card */}
              <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">👾</span>
                    <div>
                      <h3 className="text-sm font-bold text-white">Discord Webhook Bildirimleri</h3>
                      <p className="text-[11px] text-slate-400">Kanal webhook adresinize şık kart formatında uyarılar</p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alerts.discord.enabled}
                      onChange={(e) =>
                        setAlerts({
                          ...alerts,
                          discord: { ...alerts.discord, enabled: e.target.checked },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Discord Webhook URL</label>
                  <input
                    type="url"
                    placeholder="https://discord.com/api/webhooks/..."
                    value={alerts.discord.webhookUrl}
                    onChange={(e) =>
                      setAlerts({
                        ...alerts,
                        discord: { ...alerts.discord, webhookUrl: e.target.value },
                      })
                    }
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => handleTestAlert('discord')}
                    disabled={testingType === 'discord'}
                    className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-500/30 transition disabled:opacity-50"
                  >
                    <Send className={`h-3 w-3 ${testingType === 'discord' ? 'animate-spin' : ''}`} />
                    <span>{testingType === 'discord' ? 'Gönderiliyor...' : 'Discord Test Mesajı Gönder'}</span>
                  </button>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingAlerts}
                  className="flex items-center gap-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-950/40 transition disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{savingAlerts ? 'Kaydediliyor...' : 'Bildirim Ayarlarını Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Add / Edit Service Modal */}
      <AddServiceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => loadServices()}
        editingService={editingService}
      />
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/status" element={<PublicStatusPage />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;
