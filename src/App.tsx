import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  HardDrive,
  Cpu,
  Server,
  Layers,
  Search,
  Plus,
  Bell,
  RefreshCw,
  Send,
  Save,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Clock,
  Terminal,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import { api, Project, SystemStats, AlertSettings } from './lib/api.js';
import { useWebSocket } from './lib/ws.js';
import { ProjectCard } from './components/ProjectCard.js';
import { SystemModule } from './components/SystemModule.js';
import { LogTerminalModal } from './components/LogTerminalModal.js';
import { AddProjectModal } from './components/AddProjectModal.js';

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}g ${hours}s ${mins}d`;
  return `${hours}s ${mins}d`;
}

export function App() {
  const [activeTab, setActiveTab] = useState<'projects' | 'system' | 'alerts'>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [system, setSystem] = useState<SystemStats | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [selectedLogProject, setSelectedLogProject] = useState<Project | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Alerts
  const [alerts, setAlerts] = useState<AlertSettings>({
    telegram: { botToken: '', chatId: '', enabled: false },
    discord: { webhookUrl: '', enabled: false },
  });
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [alertSuccess, setAlertSuccess] = useState(false);
  const [testingType, setTestingType] = useState<'telegram' | 'discord' | null>(null);
  const [testResult, setTestResult] = useState<{ msg: string; ok: boolean } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [sysData, projData] = await Promise.all([
        api.system.stats(),
        api.projects.list(),
      ]);
      setSystem(sysData);
      setProjects(projData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await api.alerts.get();
      setAlerts(data);
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchData();
    fetchAlerts();
    const timer = setInterval(fetchData, 4000);
    return () => clearInterval(timer);
  }, [fetchData, fetchAlerts]);

  // Real-time WebSocket listener (streams metrics every 2.5s)
  useWebSocket(
    useCallback((event: string, data: any) => {
      if (event === 'system_metrics' && data) {
        if (data.system) setSystem(data.system);
        if (data.projects) setProjects(data.projects);
      }
    }, [])
  );

  const handleAction = async (id: string, action: 'start' | 'stop' | 'restart') => {
    await api.projects.action(id, action);
    await fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu projeyi listeden kaldırmak istediğinize emin misiniz?')) return;
    await api.projects.delete(id);
    await fetchData();
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

  // Filtered projects
  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.port && String(p.port).includes(search)) ||
    (p.pid && String(p.pid).includes(search))
  );

  const totalProjectsRamMb = Math.round(
    projects.reduce((acc, p) => acc + (p.memoryMb || 0), 0) * 10
  ) / 10;

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
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-base sm:text-lg bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                NABIZ
              </span>
              <span className="text-[10px] uppercase font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                Yönetim Paneli
              </span>
            </div>
            {system && (
              <p className="text-[11px] text-slate-400 leading-none">
                {system.hostname} • Uptime: {formatUptime(system.uptimeSeconds)}
              </p>
            )}
          </div>
        </div>

        {/* Modular Tabs Switcher */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Canlı Akış</span>
          </div>

          <div className="flex p-1 bg-slate-900/80 border border-slate-800 rounded-2xl">
            {/* Module 1: Projects & Control */}
            <button
              onClick={() => setActiveTab('projects')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'projects'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Projeler & Kontrol</span>
            </button>

            {/* Module 2: System & Hardware */}
            <button
              onClick={() => setActiveTab('system')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'system'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Server className="h-3.5 w-3.5" />
              <span>Sistem & Donanım</span>
            </button>

            {/* Module 3: Alerts */}
            <button
              onClick={() => setActiveTab('alerts')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'alerts'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bell className="h-3.5 w-3.5" />
              <span>Alarmlar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Module 1: Projects & Process Control */}
        {activeTab === 'projects' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Top Quick Status Bar */}
            <div className="glass-panel p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">Sunucuda Çalışan Projeler</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Projelerinizi doğrudan açıp kapatabilir, anlık RAM ve CPU tüketimlerini takip edebilirsiniz.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <span className="text-[11px] text-slate-400 block">Projelerin Toplam RAM'i</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">{totalProjectsRamMb} MB</span>
                </div>

                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-xs py-2.5 px-4 rounded-2xl shadow-lg shadow-emerald-950/40 transition active:scale-95 shrink-0"
                >
                  <Plus className="h-4 w-4 stroke-[2.5]" />
                  <span>+ Özel Proje Ekle</span>
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-md">
              <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Proje adı, port veya PID ile ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl pl-9 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Projects Grid */}
            {filteredProjects.length === 0 ? (
              <div className="glass-panel p-12 rounded-3xl text-center space-y-4 border border-slate-800">
                <div className="h-12 w-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                  <Layers className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-200">Çalışan Proje Bulunamadı</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Sunucudaki PM2, Docker ve ağ portları otomatik olarak taranır. Dilerseniz yukarıdan özel bir proje veya port ekleyebilirsiniz.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onAction={handleAction}
                    onOpenLogs={(p) => setSelectedLogProject(p)}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Module 2: System & Hardware Observability */}
        {activeTab === 'system' && (
          <SystemModule system={system} />
        )}

        {/* Module 3: Alerts & Notification Settings */}
        {activeTab === 'alerts' && (
          <div className="space-y-6 animate-in fade-in duration-150 max-w-2xl">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Yüksek RAM & Çökme Alarmları</h2>
              <p className="text-xs text-slate-400">
                Projelerinizden biri çöktüğünde veya aşırı RAM tüketmeye başladığında anında Telegram veya Discord bildirimi alın
              </p>
            </div>

            {testResult && (
              <div
                className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2.5 ${
                  testResult.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
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
                      <p className="text-[11px] text-slate-400">Telegram botu aracılığıyla anlık çökme uyarıları</p>
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
                      <p className="text-[11px] text-slate-400">Kanal webhook adresinize anlık uyarı kartları</p>
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
                  <span>{savingAlerts ? 'Kaydediliyor...' : 'Alarmları Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Log Terminal Modal */}
      <LogTerminalModal
        project={selectedLogProject}
        onClose={() => setSelectedLogProject(null)}
      />

      {/* Add Custom Project Modal */}
      <AddProjectModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => fetchData()}
      />
    </div>
  );
}

export default App;
