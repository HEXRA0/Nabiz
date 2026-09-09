import React, { useState } from 'react';
import {
  RotateCcw,
  Square,
  Play,
  Terminal,
  Trash2,
  Cpu,
  HardDrive,
  Clock,
  Layers,
  Radio,
  Server
} from 'lucide-react';
import { Project } from '../lib/api.js';

interface ProjectCardProps {
  project: Project;
  onAction: (id: string, action: 'restart' | 'stop' | 'start') => Promise<void>;
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

  const handleAction = async (action: 'restart' | 'stop' | 'start') => {
    setLoadingAction(action);
    try {
      await onAction(project.id, action);
    } finally {
      setLoadingAction(null);
    }
  };

  const isOnline = project.status === 'online';
  const isStopped = project.status === 'stopped';

  // Memory badge color
  let memColorClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  let memBarColor = 'bg-emerald-500';
  if (project.memoryMb > 500) {
    memColorClass = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    memBarColor = 'bg-rose-500';
  } else if (project.memoryMb > 250) {
    memColorClass = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    memBarColor = 'bg-amber-400';
  }

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/80 hover:border-slate-700/90 transition-all duration-200 overflow-hidden shadow-lg shadow-black/20 flex flex-col justify-between">
      {/* Top Details */}
      <div className="p-5 space-y-4">
        {/* Header: Status, Name, Type */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <div
                className={`h-3 w-3 rounded-full shrink-0 ${
                  isOnline
                    ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)] animate-pulse-subtle'
                    : isStopped
                    ? 'bg-slate-500'
                    : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.7)]'
                }`}
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight leading-tight">
                  {project.name}
                </h3>
                <span className="text-[10px] uppercase font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-300 border border-slate-700">
                  {project.type}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                {project.port && (
                  <span className="flex items-center gap-1 font-mono text-emerald-400 font-semibold">
                    <Radio className="h-3 w-3" />
                    <span>Port :{project.port}</span>
                  </span>
                )}
                {project.pid && (
                  <span className="font-mono text-slate-400">PID: {project.pid}</span>
                )}
                {project.uptimeSeconds > 0 && (
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="h-3 w-3 text-slate-500" />
                    <span>{formatUptime(project.uptimeSeconds)}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <span
            className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${
              isOnline
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {project.status === 'online' ? 'Çalışıyor' : 'Durdu'}
          </span>
        </div>

        {/* Resources Metrics: RAM & CPU */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* RAM Box */}
          <div className="p-3 bg-slate-900/80 border border-slate-800/80 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span className="flex items-center gap-1">
                <HardDrive className="h-3 w-3 text-slate-500" />
                <span>RAM Tüketimi</span>
              </span>
              <span className="font-mono text-slate-400">%{project.memoryPercent}</span>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-white font-mono">
                {project.memoryMb}
              </span>
              <span className="text-xs text-slate-400 font-mono">MB</span>
            </div>

            {/* Mini Progress Bar */}
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${memBarColor}`}
                style={{ width: `${Math.min(100, Math.max(3, project.memoryPercent * 2))}%` }}
              />
            </div>
          </div>

          {/* CPU Box */}
          <div className="p-3 bg-slate-900/80 border border-slate-800/80 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span className="flex items-center gap-1">
                <Cpu className="h-3 w-3 text-slate-500" />
                <span>İşlemci (CPU)</span>
              </span>
              {project.restarts !== undefined && (
                <span className="text-[10px] text-slate-500 font-mono">{project.restarts} restart</span>
              )}
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-white font-mono">
                %{project.cpuPercent}
              </span>
            </div>

            {/* Mini CPU Bar */}
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-400 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(3, project.cpuPercent))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Controls: Restart, Stop, Start, Logs */}
      <div className="px-5 py-3 bg-[#070b12]/80 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <button
          onClick={() => onOpenLogs(project)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-700/80 transition"
        >
          <Terminal className="h-3.5 w-3.5 text-slate-400" />
          <span>Canlı Loglar</span>
        </button>

        <div className="flex items-center gap-1.5">
          {/* Restart */}
          <button
            onClick={() => handleAction('restart')}
            disabled={!!loadingAction}
            title="Projeyi Yeniden Başlat"
            className="p-2 text-slate-300 hover:text-emerald-400 bg-slate-800/80 hover:bg-slate-700 rounded-xl border border-slate-700/80 transition disabled:opacity-50"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${loadingAction === 'restart' ? 'animate-spin' : ''}`} />
          </button>

          {/* Stop / Start */}
          {isOnline ? (
            <button
              onClick={() => handleAction('stop')}
              disabled={!!loadingAction}
              title="Durdur"
              className="p-2 text-slate-300 hover:text-rose-400 bg-slate-800/80 hover:bg-rose-500/10 rounded-xl border border-slate-700/80 transition disabled:opacity-50"
            >
              <Square className={`h-3.5 w-3.5 ${loadingAction === 'stop' ? 'animate-spin' : ''}`} />
            </button>
          ) : (
            <button
              onClick={() => handleAction('start')}
              disabled={!!loadingAction}
              title="Başlat"
              className="p-2 text-slate-300 hover:text-emerald-400 bg-slate-800/80 hover:bg-emerald-500/10 rounded-xl border border-slate-700/80 transition disabled:opacity-50"
            >
              <Play className={`h-3.5 w-3.5 ${loadingAction === 'start' ? 'animate-spin' : ''}`} />
            </button>
          )}

          {/* Delete if custom */}
          {project.isCustom && onDelete && (
            <button
              onClick={() => onDelete(project.id)}
              title="Listeden Kaldır"
              className="p-2 text-slate-500 hover:text-rose-400 rounded-xl hover:bg-slate-800 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
