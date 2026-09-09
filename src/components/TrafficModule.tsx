import React, { useState, useMemo } from 'react';
import {
  Globe,
  Radio,
  Zap,
  TrendingUp,
  Activity,
  ShieldCheck,
  Clock,
  Users,
  Search,
  Play,
  Pause,
  Eye,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';
import { TrafficSummary, TrafficCategory } from '../lib/api.js';

interface TrafficModuleProps {
  traffic: TrafficSummary | null;
}

export function TrafficModule({ traffic }: TrafficModuleProps) {
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'visitors' | 'pages' | 'all'>('visitors');
  const [searchLog, setSearchLog] = useState<string>('');
  const [isLivePaused, setIsLivePaused] = useState<boolean>(false);

  if (!traffic) {
    return (
      <div className="glass-panel p-12 rounded-3xl text-center space-y-3 border border-slate-800">
        <Activity className="h-8 w-8 text-emerald-400 mx-auto animate-pulse" />
        <h3 className="text-sm font-bold text-white">Trafik Yükleniyor...</h3>
        <p className="text-xs text-slate-400">Canlı Caddy logları ve aktif soketler taranıyor.</p>
      </div>
    );
  }

  // Selected domain data
  const domainData = selectedDomain !== 'all' ? traffic.domains[selectedDomain] : null;

  const activeConnections = domainData ? domainData.activeConnections : traffic.totalActiveConnections;
  const visitorHits = domainData ? domainData.visitorRequests : traffic.visitorRequests;
  const totalHits = domainData ? domainData.totalRequests : traffic.totalRequests;
  const reqPerSec = domainData ? domainData.requestsPerSec : traffic.requestsPerSec;
  const avgDuration = domainData ? domainData.avgDurationMs : traffic.avgDurationMs;
  const statusCodes = domainData ? domainData.statusCodes : traffic.statusCodes;
  const topPaths = domainData
    ? domainData.topPaths.filter((p) => viewMode === 'all' || p.category !== 'internal')
    : Object.values(traffic.domains)
        .flatMap((d) => d.topPaths)
        .filter((p) => viewMode === 'all' || p.category !== 'internal')
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

  // Success rate calculation
  const totalStatus = statusCodes['2xx'] + statusCodes['3xx'] + statusCodes['4xx'] + statusCodes['5xx'] || 1;
  const successRate = Math.round(((statusCodes['2xx'] + statusCodes['3xx']) / totalStatus) * 100);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return traffic.recentLogs.filter((log) => {
      // Domain filter
      if (selectedDomain !== 'all' && log.project !== selectedDomain) return false;

      // View mode filter
      if (viewMode === 'visitors' && log.isInternal) return false;
      if (viewMode === 'pages' && (log.category !== 'page' || log.isInternal)) return false;

      // Search filter
      if (searchLog.trim()) {
        const q = searchLog.toLowerCase();
        return (
          log.path.toLowerCase().includes(q) ||
          log.clientIp.toLowerCase().includes(q) ||
          log.country.toLowerCase().includes(q) ||
          String(log.status).includes(q) ||
          log.method.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [traffic.recentLogs, selectedDomain, viewMode, searchLog]);

  // Max series requests for chart
  const maxReq = Math.max(
    ...traffic.historySeries.map((s) => (viewMode === 'visitors' ? s.visitorRequests : s.requests)),
    8
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Header Card */}
      <div className="glass-panel p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-tight">Kullanıcı Trafiği & Ziyaretçiler</h2>
            <span className="flex items-center gap-1.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Canlı Akış
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Gerçek kullanıcı hareketlerini, en çok gezilen sayfaları ve anlık ziyaretçileri takip edin.
          </p>
        </div>

        {/* Domain Filter Switcher */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shrink-0">
          <button
            onClick={() => setSelectedDomain('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              selectedDomain === 'all'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tüm Siteler
          </button>
          <button
            onClick={() => setSelectedDomain('odak')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              selectedDomain === 'odak'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Odak
          </button>
          <button
            onClick={() => setSelectedDomain('thedemir')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              selectedDomain === 'thedemir'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            The Demir
          </button>
          <button
            onClick={() => setSelectedDomain('nabiz')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              selectedDomain === 'nabiz'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Nabız
          </button>
        </div>
      </div>

      {/* 4 Essential Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Visitors */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Şu An Sitede</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Users className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-white font-mono">{activeConnections}</span>
            <span className="text-xs text-emerald-400 font-medium">ziyaretçi</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            Canlı soket bağlantısı
          </span>
        </div>

        {/* Card 2: Visitor Requests */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Toplam Ziyaret</span>
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-white font-mono">{visitorHits}</span>
            <span className="text-xs text-blue-400 font-medium">hit</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1">
            {traffic.totalBytesFormatted} veri aktarıldı
          </span>
        </div>

        {/* Card 3: Avg Speed / Latency */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Yanıt Hızı</span>
            <div className="h-7 w-7 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400">
              <Clock className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-white font-mono">{avgDuration}</span>
            <span className="text-xs text-teal-400 font-medium">ms</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1">
            {avgDuration < 150 ? '🟢 Süper Hızlı' : avgDuration < 500 ? '🟡 Normal' : '🔴 Yavaş'}
          </span>
        </div>

        {/* Card 4: Health / Success Rate */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Başarı Oranı</span>
            <div className="h-7 w-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-white font-mono">%{successRate}</span>
            <span className="text-xs text-purple-400 font-medium">2xx OK</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1">
            {statusCodes['4xx']} hata • {statusCodes['5xx']} sunucu
          </span>
        </div>
      </div>

      {/* Middle Row: Trend Chart & Top Pages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Traffic Timeline */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                <span>Ziyaretçi Trendi</span>
              </h3>
              <p className="text-[11px] text-slate-400">Son 30 dakikadaki ziyaretçi yoğunluğu</p>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
              {reqPerSec} istek/sn
            </span>
          </div>

          <div className="h-36 flex items-end gap-1.5 pt-4 border-b border-slate-800/80">
            {traffic.historySeries.map((item, idx) => {
              const val = viewMode === 'visitors' ? item.visitorRequests : item.requests;
              const heightPct = Math.max(Math.round((val / maxReq) * 100), val > 0 ? 10 : 3);
              return (
                <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                  <div className="absolute bottom-full mb-1.5 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                    <div className="bg-slate-900 border border-slate-700 text-[10px] rounded-lg p-1.5 shadow-xl text-center whitespace-nowrap">
                      <div className="font-bold text-white">{item.time}</div>
                      <div className="text-emerald-400">{val} Ziyaretçi</div>
                      <div className="text-slate-400">{item.avgLatency} ms</div>
                    </div>
                  </div>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-t-sm transition-all duration-300 ${
                      val > 0
                        ? 'bg-gradient-to-t from-emerald-600 to-teal-400 group-hover:from-emerald-400 group-hover:to-teal-300'
                        : 'bg-slate-800/40'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>{traffic.historySeries[0]?.time || '00:00'}</span>
            <span>Son 30 Dakika</span>
            <span>{traffic.historySeries[traffic.historySeries.length - 1]?.time || 'Şimdi'}</span>
          </div>
        </div>

        {/* Right: Top Visited Pages */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Globe className="h-4 w-4 text-purple-400" />
                <span>En Çok Ziyaret Edilen Sayfalar</span>
              </h3>
              <p className="text-[11px] text-slate-400">Kullanıcıların en sık girdiği sayfalar</p>
            </div>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {topPaths.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">Henüz sayfa ziyareti kaydedilmedi</div>
            ) : (
              topPaths.map((p, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between gap-3 text-xs hover:border-slate-700 transition"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-slate-200 truncate block text-xs" title={p.path}>
                      {p.path}
                    </span>
                    <span className="text-[10px] text-slate-400">{p.avgDurationMs} ms ortalama</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono font-bold text-xs shrink-0">
                    {p.count} hit
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom: Live Access Stream */}
      <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
        {/* Stream Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
            <h3 className="text-sm font-bold text-white">Canlı Ziyaretçi Akışı</h3>
            <span className="text-xs text-slate-400 font-normal">({filteredLogs.length} kayıt)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px]">
              <button
                onClick={() => setViewMode('visitors')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  viewMode === 'visitors'
                    ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Ziyaretçiler ({traffic.visitorRequests})
              </button>
              <button
                onClick={() => setViewMode('pages')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  viewMode === 'pages'
                    ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sayfalar
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  viewMode === 'all'
                    ? 'bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Tümü ({traffic.totalRequests})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-44">
              <Search className="h-3 w-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Filtrele..."
                value={searchLog}
                onChange={(e) => setSearchLog(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-7 pr-3 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Pause/Resume button */}
            <button
              onClick={() => setIsLivePaused(!isLivePaused)}
              className={`p-1.5 rounded-xl border transition ${
                isLivePaused
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title={isLivePaused ? 'Akışı Başlat' : 'Akışı Duraklat'}
            >
              {isLivePaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Live Stream Table */}
        <div className="overflow-x-auto max-h-80 overflow-y-auto border border-slate-800/80 rounded-2xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 text-[10px] uppercase font-semibold sticky top-0 backdrop-blur-md">
              <tr>
                <th className="py-2.5 px-3">Zaman</th>
                <th className="py-2.5 px-3">Site</th>
                <th className="py-2.5 px-3">Metod</th>
                <th className="py-2.5 px-3">Sayfa / URL</th>
                <th className="py-2.5 px-3">Durum</th>
                <th className="py-2.5 px-3">Gecikme</th>
                <th className="py-2.5 px-3">Ziyaretçi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 font-sans">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2 px-3 text-slate-400 whitespace-nowrap">{log.timeFormatted}</td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-sans">
                        {log.project}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${
                          log.method === 'GET'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}
                      >
                        {log.method}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-200 max-w-sm truncate" title={log.uri}>
                      {log.path}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${
                          log.status < 300
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : log.status < 400
                            ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                            : log.status < 500
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-400 whitespace-nowrap">{log.durationMs} ms</td>
                    <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-[10px] font-bold text-emerald-400 font-sans">{log.country}</span>
                        <span className="text-slate-300 text-[11px]">{log.clientIp}</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
