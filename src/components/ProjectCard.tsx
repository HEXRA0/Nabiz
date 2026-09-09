import React, { useState } from 'react';
import {
  RotateCcw,
  Power,
  Terminal,
  Trash2,
  Cpu,
  HardDrive,
  Clock,
  Radio,
  AlertTriangle,
  X
} from 'lucide-react';
import { Project } from '../lib/api.js';

interface ProjectCardProps {
  project: Project;
  onAction: (project: Project, action: 'start' | 'stop' | 'restart') => Promise<void>;
  onOpenLogs: (project: Project) => void;
  onDelete?: (id: string) => Promise<void>;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds} sn`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} dk`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours < 24) return `${hours} sa ${mins} dk`;
  const days = Math.floor(hours / 24);
  return `${days} gün ${hours % 24} sa`;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onAction,
  onOpenLogs,
  onDelete,
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showSelfStopWarning, setShowSelfStopWarning] = useState(false);
  const [statusHint, setStatusHint] = useState<string | null>(null);

  const isSelf = project.isSelf || project.name.toLowerCase().includes('nabız') || project.name.toLowerCase().includes('nabiz');
  const isOnline = project.status === 'online';

  const handleActionClick = async (action: 'start' | 'stop' | 'restart') => {
    if (action === 'stop' && isSelf && isOnline) {
      setShowSelfStopWarning(true);
      return;
    }
    await performAction(action);
  };

  const performAction = async (action: 'start' | 'stop' | 'restart') => {
    setLoadingAction(action);
    setStatusHint(action === 'start' ? 'Başlatma komutu gönderildi...' : action === 'stop' ? 'Durdurma komutu gönderildi...' : 'Yeniden başlatılıyor...');
    try {
      await onAction(project, action);
      setStatusHint(action === 'start' ? 'Başlatıldı, port bekleniyor...' : action === 'stop' ? 'Durduruldu.' : 'Yeniden başlatıldı.');
      setTimeout(() => setStatusHint(null), 4000);
    } catch (e: any) {
      setStatusHint('Hata: ' + (e.message || 'İşlem başarısız'));
    } finally {
      setLoadingAction(null);
      setShowSelfStopWarning(false);
    }
  };

  let memColor = 'bg-emerald-500';
  if (project.memoryMb > 500) memColor = 'bg-rose-500';
  else if (project.memoryMb > 200) memColor = 'bg-amber-400';

  return (
    <>
      <div className={`glass-panel rounded-3xl border transition-all duration-200 overflow-hidden shadow-xl ${
        loadingAction
          ? 'border-teal-500/50 shadow-teal-950/20'
          : isOnline
          ? 'border-slate-800/80 hover:border-slate-700/90'
          : 'border-slate-800/40 opacity-80'
      }`}>
        <div className="p-5 space-y-4">
          {/* Header: Status, Name, Port & Power Button */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <div
                  className={`h-3 w-3 rounded-full shrink-0 transition-all duration-300 ${
                    loadingAction
                      ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)] animate-ping'
                      : isOnline
                      ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)] animate-pulse-subtle'
                      : 'bg-rose-500/80'
                  }`}
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white tracking-tight">{project.name}</h3>
                  <span className="text-[10px] uppercase font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {project.type}
                  </span>
                  {isSelf && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/30">
                      Bu Panel
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  {project.port && (
                    <span className="flex items-center gap-1 font-mono text-emerald-400 font-semibold">
                      <Radio className="h-3 w-3" />
                      <span>Port :{project.port}</span>
                    </span>
                  )}
                  {project.pid && <span className="font-mono text-slate-400">PID: {project.pid}</span>}
                  {project.uptimeSeconds > 0 && (
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock className="h-3 w-3 text-slate-500" />
                      <span>{formatUptime(project.uptimeSeconds)}</span>
                    </span>
                  )}
                </div>

                {statusHint && (
                  <div className="mt-1.5 text-[11px] font-medium text-amber-300 flex items-center gap-1.5 animate-in fade-in">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span>{statusHint}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Power Button (Aç / Kapat) */}
            <button
              onClick={() => handleActionClick(isOnline ? 'stop' : 'start')}
              disabled={!!loadingAction}
              title={isOnline ? 'Projeyi Kapat (Durdur)' : 'Projeyi Aç (Başlat)'}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition active:scale-95 disabled:opacity-50 ${
                loadingAction
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 cursor-wait'
                  : isOnline
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/30'
              }`}
            >
              <Power className={`h-3.5 w-3.5 ${loadingAction ? 'animate-spin text-amber-400' : ''}`} />
              <span>
                {loadingAction === 'start'
                  ? 'Başlatılıyor...'
                  : loadingAction === 'stop'
                  ? 'Durduruluyor...'
                  : isOnline
                  ? 'AÇIK (Kapat)'
                  : 'KAPALI (Aç)'}
              </span>
            </button>
          </div>

          {/* Resource Gauges: RAM & CPU */}
          <div className="grid grid-cols-2 gap-3">
            {/* RAM */}
            <div className="p-3 bg-slate-900/80 border border-slate-800/80 rounded-2xl space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <span className="flex items-center gap-1">
                  <HardDrive className="h-3 w-3 text-slate-500" />
                  <span>Kullanılan RAM</span>
                </span>
                <span className="font-mono text-slate-400">%{project.memoryPercent}</span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-white font-mono">
                  {project.memoryMb}
                </span>
                <span className="text-xs text-slate-400 font-mono">MB</span>
              </div>

              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${memColor}`}
                  style={{ width: `${Math.min(100, Math.max(3, project.memoryPercent * 2))}%` }}
                />
              </div>
            </div>

            {/* CPU */}
            <div className="p-3 bg-slate-900/80 border border-slate-800/80 rounded-2xl space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <span className="flex items-center gap-1">
                  <Cpu className="h-3 w-3 text-slate-500" />
                  <span>İşlemci Yükü</span>
                </span>
                {project.restarts !== undefined && (
                  <span className="text-[10px] text-slate-500 font-mono">{project.restarts} restart</span>
                )}
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-white font-mono">
                  %{project.cpuPercent}
                </span>
              </div>

              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-400 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(3, project.cpuPercent))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Persistent Last Activity / Operation Log (Loaded from Database) */}
          {project.lastActivity && (
            <div className="flex items-center justify-between text-[11px] px-3 py-2 rounded-2xl bg-[#080d16]/90 border border-slate-800/80 text-slate-300">
              <div className="flex items-center gap-2 min-w-0 truncate">
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    project.lastActivity.status === 'success'
                      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                      : 'bg-rose-400'
                  }`}
                />
                <span className="font-semibold text-slate-200 shrink-0">
                  Son İşlem: {project.lastActivity.action === 'start' ? 'Başlatıldı' : project.lastActivity.action === 'stop' ? 'Durduruldu' : 'Yeniden Başlatıldı'}
                </span>
                <span className="text-slate-400 truncate text-[10.5px]">
                  • {project.lastActivity.message}
                </span>
              </div>
              <span className="font-mono text-[10px] text-slate-500 shrink-0 ml-2">
                {project.lastActivity.createdAt.split(' ')[1] || project.lastActivity.createdAt}
              </span>
            </div>
          )}
        </div>

        {/* Footer Controls: Restart & Console Logs */}
        <div className="px-5 py-3 bg-[#070b12]/80 border-t border-slate-800/80 flex items-center justify-between">
          <button
            onClick={() => onOpenLogs(project)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-700/80 transition"
          >
            <Terminal className="h-3.5 w-3.5 text-slate-400" />
            <span>Canlı Konsol / Loglar</span>
          </button>

          <div className="flex items-center gap-2">
            {/* Restart */}
            <button
              onClick={() => handleActionClick('restart')}
              disabled={!!loadingAction}
              className="flex items-center gap-1 text-xs font-semibold text-slate-300 hover:text-emerald-400 bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-700/80 transition disabled:opacity-50"
            >
              <RotateCcw className={`h-3 w-3 ${loadingAction === 'restart' ? 'animate-spin' : ''}`} />
              <span>Yeniden Başlat</span>
            </button>

            {project.isCustom && onDelete && (
              <button
                onClick={() => onDelete(project.id)}
                title="Listeden Kaldır"
                className="p-1.5 text-slate-500 hover:text-rose-400 rounded-xl hover:bg-slate-800 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Safety Warning Modal for Stopping Nabız (Self) */}
      {showSelfStopWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl border border-rose-500/40 bg-[#0c121e] shadow-2xl shadow-rose-950/40 space-y-5">
            <div className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0 text-rose-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  Dikkat: Nabız Yönetim Panelini Kapatıyorsunuz!
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Nabız servisini kapatırsanız bu yönetim paneline olan web erişiminiz anında kesilecektir. Paneli yeniden açabilmek için sunucunuza RDP veya SSH ile bağlanmanız gerekir.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowSelfStopWarning(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
              >
                Vazgeç / İptal
              </button>

              <button
                onClick={() => performAction('stop')}
                disabled={!!loadingAction}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg shadow-rose-950/40 transition disabled:opacity-50"
              >
                {loadingAction ? 'Durduruluyor...' : 'Evet, Yine de Kapat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
