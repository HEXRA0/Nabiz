import React from 'react';
import {
  Cpu,
  HardDrive,
  Server,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  ShieldCheck,
  Activity,
  Layers
} from 'lucide-react';
import { SystemStats } from '../lib/api.js';

interface SystemModuleProps {
  system: SystemStats | null;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} gün ${hours} saat ${mins} dakika`;
  return `${hours} saat ${mins} dakika`;
}

export const SystemModule: React.FC<SystemModuleProps> = ({ system }) => {
  if (!system) {
    return (
      <div className="glass-panel p-12 rounded-3xl text-center text-slate-500 text-xs">
        Sistem metrikleri yükleniyor...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Sunucu Sistem & Donanım İzleyici</h2>
        <p className="text-xs text-slate-400">
          Sunucunuzun işlemci, bellek, disk ve anlık ağ trafiğini anlık takip edin
        </p>
      </div>

      {/* Main Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. CPU Card */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">İşlemci (CPU)</h3>
                <p className="text-[11px] text-slate-400 font-mono">{system.cpu.model}</p>
              </div>
            </div>

            <span className="text-xs font-bold font-mono text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-xl border border-teal-500/20">
              {system.cpu.cores} Çekirdek
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400 font-medium">Anlık İşlemci Tüketimi</span>
              <span className="text-2xl font-bold text-white font-mono">%{system.cpu.usagePercent}</span>
            </div>

            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(3, system.cpu.usagePercent))}%` }}
              />
            </div>
          </div>

          <div className="p-3 bg-slate-900/60 rounded-2xl border border-slate-800 text-xs flex items-center justify-between text-slate-400">
            <span>Sistem Yük Ortalaması (Load Average):</span>
            <span className="font-mono font-bold text-slate-200">
              {system.cpu.loadAvg.join(' • ')} (1dk, 5dk, 15dk)
            </span>
          </div>
        </div>

        {/* 2. Memory (RAM) Card */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <HardDrive className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Sistem Belleği (RAM)</h3>
                <p className="text-[11px] text-slate-400 font-mono">Fiziksel Bellek Tüketimi</p>
              </div>
            </div>

            <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
              %{system.memory.usedPercent} Dolu
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400 font-medium">Kullanılan / Toplam</span>
              <span className="text-2xl font-bold text-white font-mono">
                {system.memory.usedFormatted} <span className="text-xs text-slate-400 font-normal">/ {system.memory.totalFormatted}</span>
              </span>
            </div>

            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  system.memory.usedPercent > 85 ? 'bg-rose-500' : system.memory.usedPercent > 65 ? 'bg-amber-400' : 'bg-emerald-500'
                }`}
                style={{ width: `${system.memory.usedPercent}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Kullanılan RAM:</span>
              <span className="font-mono font-bold text-emerald-400">{system.memory.usedFormatted}</span>
            </div>
            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Boşta Kalan RAM:</span>
              <span className="font-mono font-bold text-slate-300">{system.memory.freeFormatted}</span>
            </div>
          </div>
        </div>

        {/* 3. Disk Storage */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                <Server className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Disk / Depolama Alanı</h3>
                <p className="text-[11px] text-slate-400 font-mono">Kök Bölüm (/)</p>
              </div>
            </div>

            <span className="text-xs font-bold font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-xl border border-indigo-500/20">
              %{system.disk.usedPercent} Dolu
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400 font-medium">Kullanılan Alan</span>
              <span className="text-2xl font-bold text-white font-mono">
                {system.disk.usedFormatted} <span className="text-xs text-slate-400 font-normal">/ {system.disk.totalFormatted}</span>
              </span>
            </div>

            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${system.disk.usedPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* 4. Real-time Network Traffic */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Anlık Ağ Trafiği (I/O)</h3>
                <p className="text-[11px] text-slate-400">Sunucu bant genişliği transfer hızı</p>
              </div>
            </div>

            <span className="text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-md uppercase">
              Gerçek Zamanlı
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            {/* Download */}
            <div className="p-3.5 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <ArrowDownLeft className="h-4 w-4 text-emerald-400" />
                <span>İndirme (Giriş)</span>
              </div>
              <p className="text-lg font-bold font-mono text-white">{system.network.inFormatted}</p>
            </div>

            {/* Upload */}
            <div className="p-3.5 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <ArrowUpRight className="h-4 w-4 text-sky-400" />
                <span>Yükleme (Çıkış)</span>
              </div>
              <p className="text-lg font-bold font-mono text-white">{system.network.outFormatted}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Server Info Details */}
      <div className="glass-panel p-5 rounded-3xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
            <Server className="h-4 w-4" />
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Sunucu Adı:</span>
            <span className="font-bold text-white font-mono">{system.hostname}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">İşletim Sistemi:</span>
            <span className="font-bold text-white font-mono">{system.platform} ({system.arch})</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Kesintisiz Çalışma (Uptime):</span>
            <span className="font-bold text-emerald-400 font-mono">{formatUptime(system.uptimeSeconds)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
