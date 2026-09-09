import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  HardDrive,
  Cpu,
  Server,
  Layers,
  Search,
  Plus,
  RefreshCw,
  Clock
} from 'lucide-react';
import { api, Project, SystemStats } from './lib/api.js';
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
  const [activeTab, setActiveTab] = useState<'projects' | 'system'>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [system, setSystem] = useState<SystemStats | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [selectedLogProject, setSelectedLogProject] = useState<Project | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 4000);
    return () => clearInterval(timer);
  }, [fetchData]);

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

        {/* 2 Main Modules Switcher */}
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
