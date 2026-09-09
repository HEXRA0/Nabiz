import React, { useState } from 'react';
import {
  ExternalLink,
  Play,
  Pause,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Clock,
  Zap,
  AlertCircle
} from 'lucide-react';
import { Service } from '../lib/api.js';
import { UptimeBar } from './UptimeBar.js';
import { LatencyChart } from './LatencyChart.js';

interface ServiceCardProps {
  service: Service;
  onTest: (id: number) => Promise<void>;
  onToggle: (id: number) => Promise<void>;
  onEdit: (service: Service) => void;
  onDelete: (id: number) => Promise<void>;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  onTest,
  onToggle,
  onEdit,
  onDelete,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleTest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setTesting(true);
    try {
      await onTest(service.id);
    } finally {
      setTesting(false);
    }
  };

  const isUp = service.current_status === 'up';
  const isDown = service.current_status === 'down';
  const isPaused = service.is_paused === 1;

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/80 hover:border-slate-700/80 transition-all duration-200 overflow-hidden shadow-lg shadow-black/20">
      {/* Main Card Row */}
      <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Indicator, Title & Link */}
        <div className="flex items-start gap-3.5">
          <div className="mt-1">
            <div
              className={`h-3 w-3 rounded-full shrink-0 ${
                isPaused
                  ? 'bg-slate-500'
                  : isUp
                  ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)] animate-pulse-subtle'
                  : isDown
                  ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]'
                  : 'bg-amber-400'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">{service.name}</h3>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                  isPaused
                    ? 'bg-slate-800 text-slate-400'
                    : isUp
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : isDown
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {isPaused ? 'Duraklatıldı' : isUp ? 'Açık' : isDown ? 'Kapalı' : 'Bekliyor'}
              </span>
            </div>

            <a
              href={service.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-slate-400 hover:text-emerald-400 font-mono mt-0.5 inline-flex items-center gap-1 transition"
            >
              <span>{service.url}</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>

            {isDown && service.last_error && (
              <p className="text-xs text-rose-400 mt-1 flex items-center gap-1.5 font-medium">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{service.last_error}</span>
              </p>
            )}
          </div>
        </div>

        {/* Right: Metrics & Action Buttons */}
        <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800/60">
          {/* Metrics */}
          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-[11px] text-slate-400 font-medium block">Yanıt Süresi</span>
              <span className="text-sm font-bold text-slate-100 font-mono">
                {service.last_latency_ms} ms
              </span>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-400 font-medium block">24s Uptime</span>
              <span
                className={`text-sm font-bold font-mono ${
                  (service.stats?.uptime24h || 100) >= 99 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                %{service.stats?.uptime24h ?? '100.0'}
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-1.5">
            {/* Test Now Button */}
            <button
              onClick={handleTest}
              disabled={testing}
              title="Şimdi Kontrol Et"
              className="p-2 text-slate-300 hover:text-emerald-400 bg-slate-800/70 hover:bg-slate-700/80 rounded-xl border border-slate-700/70 transition disabled:opacity-50"
            >
              <Play className={`h-3.5 w-3.5 ${testing ? 'animate-spin' : ''}`} />
            </button>

            {/* Toggle Pause Button */}
            <button
              onClick={() => onToggle(service.id)}
              title={isPaused ? 'Devam Ettir' : 'Duraklat'}
              className="p-2 text-slate-300 hover:text-amber-400 bg-slate-800/70 hover:bg-slate-700/80 rounded-xl border border-slate-700/70 transition"
            >
              {isPaused ? <Play className="h-3.5 w-3.5 text-emerald-400" /> : <Pause className="h-3.5 w-3.5" />}
            </button>

            {/* Edit Button */}
            <button
              onClick={() => onEdit(service)}
              title="Düzenle"
              className="p-2 text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-700/80 rounded-xl border border-slate-700/70 transition"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>

            {/* Delete Button */}
            <button
              onClick={() => onDelete(service.id)}
              title="Sil"
              className="p-2 text-slate-400 hover:text-rose-400 bg-slate-800/70 hover:bg-rose-500/10 rounded-xl border border-slate-700/70 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>

            {/* Expand Details Button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              title="Geçmiş ve Detaylar"
              className="p-2 text-slate-400 hover:text-white bg-slate-800/70 hover:bg-slate-700/80 rounded-xl border border-slate-700/70 transition ml-1"
            >
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 30-Day Status Bar */}
      <div className="px-5 pb-4 pt-1 border-t border-slate-800/40">
        <UptimeBar dailyHistory={service.stats?.dailyHistory} daysCount={30} />
      </div>

      {/* Expanded Details: Latency Chart & Recent Logs */}
      {isExpanded && (
        <div className="p-5 bg-[#070b12]/80 border-t border-slate-800/80 space-y-4 animate-in fade-in duration-150">
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Son Yanıt Süreleri (Gecikme Grafiği)
            </h4>
            <LatencyChart data={service.recentChecks || []} />
          </div>

          {/* Quick Logs */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Son Kontrol Kayıtları
            </h4>
            <div className="overflow-hidden rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 text-[11px]">
                  <tr>
                    <th className="py-2 px-3">Durum</th>
                    <th className="py-2 px-3">Kod</th>
                    <th className="py-2 px-3">Süre</th>
                    <th className="py-2 px-3">Detay</th>
                    <th className="py-2 px-3 text-right">Zaman</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 bg-slate-900/30 text-[11px] font-mono">
                  {(service.recentChecks || []).slice(0, 5).map((c) => (
                    <tr key={c.id}>
                      <td className="py-1.5 px-3">
                        <span className={`px-1.5 py-0.5 rounded font-sans font-semibold text-[10px] ${
                          c.status === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-slate-300">{c.status_code || '-'}</td>
                      <td className="py-1.5 px-3 text-slate-300">{c.latency_ms} ms</td>
                      <td className="py-1.5 px-3 text-slate-400 truncate max-w-xs font-sans">{c.message || '-'}</td>
                      <td className="py-1.5 px-3 text-right text-slate-500">
                        {new Date(c.created_at).toLocaleTimeString()}
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
  );
};
