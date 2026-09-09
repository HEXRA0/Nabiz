import React, { useState } from 'react';
import {
  Globe,
  Radio,
  Zap,
  TrendingUp,
  Activity,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  HardDrive,
  Users,
  Search,
  Filter,
  Play,
  Pause,
  Layers,
  Sparkles,
  Eye,
  FileCode,
  Cpu,
} from 'lucide-react';
import { TrafficSummary, TrafficLogEntry, DomainStats, TrafficCategory } from '../lib/api.js';

interface TrafficModuleProps {
  traffic: TrafficSummary | null;
}

export function TrafficModule({ traffic }: TrafficModuleProps) {
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [filterType, setFilterType] = useState<'visitors' | 'pages' | 'all'>('visitors');
  const [searchLog, setSearchLog] = useState<string>('');
  const [isLivePaused, setIsLivePaused] = useState<boolean>(false);

  if (!traffic) {
    return (
      <div className="glass-panel p-12 rounded-3xl text-center space-y-3 border border-slate-800">
        <Activity className="h-8 w-8 text-emerald-400 mx-auto animate-pulse" />
        <h3 className="text-sm font-bold text-white">Trafik Metrikleri Yükleniyor...</h3>
        <p className="text-xs text-slate-400">
          Caddy erişim logları ve aktif soket bağlantıları analiz ediliyor.
        </p>
      </div>
    );
  }

  // Active domain stats or all combined
  const activeDomainData: DomainStats | null =
    selectedDomain !== 'all' && traffic.domains[selectedDomain]
      ? traffic.domains[selectedDomain]
      : null;

  const displayActiveConn = activeDomainData
    ? activeDomainData.activeConnections
    : traffic.totalActiveConnections;
  const displayVisitorReq = activeDomainData
    ? activeDomainData.visitorRequests
    : traffic.visitorRequests;
  const displayTotalReq = activeDomainData
    ? activeDomainData.totalRequests
    : traffic.totalRequests;
  const displayReqPerSec = activeDomainData
    ? activeDomainData.requestsPerSec
    : traffic.requestsPerSec;
  const displayAvgDuration = activeDomainData
    ? activeDomainData.avgDurationMs
    : traffic.avgDurationMs;
  const displayStatusCodes = activeDomainData
    ? activeDomainData.statusCodes
    : traffic.statusCodes;
  const displayTopPaths = activeDomainData
    ? activeDomainData.topPaths
    : Object.values(traffic.domains).flatMap((d) => d.topPaths).slice(0, 10);
  const displayTopCountries = activeDomainData
    ? activeDomainData.topCountries
    : Object.values(traffic.domains).flatMap((d) => d.topCountries).slice(0, 6);

  // Filter recent logs based on Domain, FilterType (visitors vs pages vs all), and Search
  const filteredLogs = traffic.recentLogs.filter((log) => {
    // 1. Domain filter
    if (selectedDomain !== 'all' && log.project !== selectedDomain) return false;

    // 2. Type filter: visitors vs pages vs all
    if (filterType === 'visitors' && log.isInternal) return false;
    if (filterType === 'pages' && (log.category !== 'page' || log.isInternal)) return false;

    // 3. Search query filter
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

  const totalStatusCount =
    displayStatusCodes['2xx'] +
    displayStatusCodes['3xx'] +
    displayStatusCodes['4xx'] +
    displayStatusCodes['5xx'] || 1;

  const pct2xx = Math.round((displayStatusCodes['2xx'] / totalStatusCount) * 100);
  const pct3xx = Math.round((displayStatusCodes['3xx'] / totalStatusCount) * 100);
  const pct4xx = Math.round((displayStatusCodes['4xx'] / totalStatusCount) * 100);
  const pct5xx = Math.round((displayStatusCodes['5xx'] / totalStatusCount) * 100);

  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'POST':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'PUT':
      case 'PATCH':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'DELETE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getStatusBadgeClass = (status: number) => {
    if (status >= 200 && status < 300) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
    if (status >= 300 && status < 400) {
      return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
    }
    if (status >= 400 && status < 500) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
    return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  };

  const getCategoryBadge = (category: TrafficCategory, isInternal: boolean) => {
    if (isInternal) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
          Sistem
        </span>
      );
    }
    if (category === 'page') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Sayfa
        </span>
      );
    }
    if (category === 'api') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
          API
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
        Statik
      </span>
    );
  };

  const maxSeriesReq = Math.max(
    ...traffic.historySeries.map((s) => (filterType === 'visitors' ? s.visitorRequests : s.requests)),
    10
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Banner & Domain Selector */}
      <div className="glass-panel p-5 rounded-3xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-tight">Kullanıcı Trafiği & Canlı Ziyaretçiler</h2>
            <span className="flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Canlı Caddy Log
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Sistem yoklamaları hariç tutularak gerçek kullanıcı istekleri ve ziyaretçi coğrafyası anlık izlenir.
          </p>
        </div>

        {/* Domain Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setSelectedDomain('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              selectedDomain === 'all'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tüm Projeler ({traffic.visitorRequests})
          </button>
          <button
            onClick={() => setSelectedDomain('odak')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              selectedDomain === 'odak'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            odak.thedemir.com
          </button>
          <button
            onClick={() => setSelectedDomain('thedemir')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              selectedDomain === 'thedemir'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            thedemir.com
          </button>
          <button
            onClick={() => setSelectedDomain('nabiz')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              selectedDomain === 'nabiz'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            nabiz.thedemir.com
          </button>
        </div>
      </div>

      {/* Filter Switcher: Visitors vs Pages vs All */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-2xl border border-slate-800">
          <button
            onClick={() => setFilterType('visitors')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              filterType === 'visitors'
                ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="h-3.5 w-3.5 text-emerald-400" />
            <span>Gerçek Ziyaretçiler</span>
            <span className="text-[10px] bg-emerald-500/20 px-1.5 py-0.2 rounded-full font-mono">
              {traffic.visitorRequests}
            </span>
          </button>

          <button
            onClick={() => setFilterType('pages')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              filterType === 'pages'
                ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="h-3.5 w-3.5 text-teal-400" />
            <span>Sayfa Görüntülemeleri</span>
          </button>

          <button
            onClick={() => setFilterType('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              filterType === 'all'
                ? 'bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="h-3.5 w-3.5 text-purple-400" />
            <span>Tüm İstekler (API & Sistem Dahil)</span>
            <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded-full font-mono text-slate-400">
              {traffic.totalRequests}
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-400 hidden sm:block">
          {filterType === 'visitors' ? (
            <span className="text-emerald-400 font-medium">✓ Nabız panel yoklamaları filtrelendi</span>
          ) : filterType === 'pages' ? (
            <span>Sadece doğrudan sayfa/HTML açılışları</span>
          ) : (
            <span className="text-purple-400">Sistem iç API istekleri dahil gösteriliyor</span>
          )}
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Live Active Connections */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Aktif Ziyaretçi</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono">{displayActiveConn}</span>
            <span className="text-xs text-emerald-400 font-medium">aktif soket</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Odak & TheDemir portlarındaki canlı bağlantılar</span>
          </div>
        </div>

        {/* Metric 2: Visitor Velocity */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ziyaretçi İstek Hızı</span>
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono">{displayReqPerSec}</span>
            <span className="text-xs text-blue-400 font-medium">ziyaretçi / sn</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Son 60 saniye gerçek ziyaretçi hızı
          </div>
        </div>

        {/* Metric 3: Total Visitor Hits */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Toplam Ziyaretçi</span>
            <div className="h-8 w-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono">{displayVisitorReq}</span>
            <span className="text-xs text-purple-400 font-medium">ziyaret</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Toplam aktarılan: <span className="text-slate-300 font-mono">{traffic.totalBytesFormatted}</span>
          </div>
        </div>

        {/* Metric 4: Avg Response Time */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ortalama Yanıt</span>
            <div className="h-8 w-8 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono">{displayAvgDuration}</span>
            <span className="text-xs text-teal-400 font-medium">ms</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Caddy ters vekil gecikmesi
          </div>
        </div>
      </div>

      {/* Middle Row: Traffic Chart & Status Code Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1 & 2: Requests Over Time Chart (Last 30 Mins) */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                <span>Dakikalık Ziyaretçi Yoğunluğu</span>
              </h3>
              <p className="text-xs text-slate-400">Son 30 dakikadaki gerçek ziyaretçi akışları</p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Ziyaretçiler
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> Hatalar
              </span>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="h-40 flex items-end gap-1 sm:gap-2 pt-4 border-b border-slate-800/80">
            {traffic.historySeries.map((item, idx) => {
              const reqValue = filterType === 'visitors' ? item.visitorRequests : item.requests;
              const heightPct = Math.max(Math.round((reqValue / maxSeriesReq) * 100), reqValue > 0 ? 8 : 2);
              const hasError = item.errors > 0;
              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center justify-end h-full group relative"
                >
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                    <div className="bg-slate-900 border border-slate-700 text-[10px] rounded-lg p-2 shadow-xl text-center whitespace-nowrap">
                      <span className="font-bold text-white">{item.time}</span>
                      <div className="text-emerald-400">{reqValue} İstek</div>
                      {hasError && <div className="text-rose-400">{item.errors} Hata</div>}
                      <div className="text-slate-400">{item.avgLatency} ms ort.</div>
                    </div>
                  </div>

                  {/* The bar */}
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-t-md transition-all duration-300 ${
                      hasError
                        ? 'bg-gradient-to-t from-rose-600/80 to-amber-500/90'
                        : reqValue > 0
                        ? 'bg-gradient-to-t from-emerald-600 to-teal-400 group-hover:from-emerald-500 group-hover:to-teal-300'
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

        {/* Column 3: HTTP Status Code Health & Geo */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-teal-400" />
              <span>HTTP Durum Dağılımı</span>
            </h3>

            {/* Combined Progress Bar */}
            <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
              <div style={{ width: `${pct2xx}%` }} className="bg-emerald-500 h-full transition-all duration-500" title={`2xx: ${displayStatusCodes['2xx']}`} />
              <div style={{ width: `${pct3xx}%` }} className="bg-sky-500 h-full transition-all duration-500" title={`3xx: ${displayStatusCodes['3xx']}`} />
              <div style={{ width: `${pct4xx}%` }} className="bg-amber-500 h-full transition-all duration-500" title={`4xx: ${displayStatusCodes['4xx']}`} />
              <div style={{ width: `${pct5xx}%` }} className="bg-rose-500 h-full transition-all duration-500" title={`5xx: ${displayStatusCodes['5xx']}`} />
            </div>

            {/* Badges Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <span className="text-emerald-300 font-medium">2xx Başarılı</span>
                <span className="font-bold text-white font-mono">{displayStatusCodes['2xx']} ({pct2xx}%)</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-between">
                <span className="text-sky-300 font-medium">3xx Yönlendirme</span>
                <span className="font-bold text-white font-mono">{displayStatusCodes['3xx']}</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                <span className="text-amber-300 font-medium">4xx İstemci</span>
                <span className="font-bold text-white font-mono">{displayStatusCodes['4xx']}</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
                <span className="text-rose-300 font-medium">5xx Hata</span>
                <span className="font-bold text-white font-mono">{displayStatusCodes['5xx']}</span>
              </div>
            </div>
          </div>

          {/* Top Countries */}
          <div className="space-y-2 pt-3 border-t border-slate-800">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Ziyaretçi Ülkeleri
            </span>
            <div className="flex flex-wrap gap-1.5">
              {displayTopCountries.length === 0 ? (
                <span className="text-xs text-slate-500">Kayıtlı lokasyon verisi yok</span>
              ) : (
                displayTopCountries.map((c, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200"
                  >
                    <span className="font-bold text-emerald-400 font-mono">{c.code}</span>
                    <span className="text-slate-400 font-mono text-[11px]">({c.count})</span>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Top Endpoints & Live Log Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Top Visited Paths */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Globe className="h-4 w-4 text-purple-400" />
              <span>En Çok Ziyaret Edilenler</span>
            </h3>
            <p className="text-xs text-slate-400">Popüler sayfalar ve uç noktalar</p>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {displayTopPaths.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">Henüz istek kaydedilmedi</div>
            ) : (
              displayTopPaths.map((p, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-2xl bg-slate-900/70 border border-slate-800/80 flex items-center justify-between gap-2 text-xs hover:border-slate-700 transition"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-slate-200 truncate block text-[11px]" title={p.path}>
                      {p.path}
                    </span>
                    <span className="text-[10px] text-slate-400">{p.avgDurationMs} ms ort. yanıt</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {getCategoryBadge(p.category, false)}
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono font-bold text-xs">
                      {p.count} hit
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2 & 3: Live Access Stream Table */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
                <span>Canlı Ziyaretçi Akışı</span>
              </h3>
              <p className="text-xs text-slate-400">
                {filterType === 'visitors'
                  ? 'Gerçek kullanıcı istekleri (İç sistem yoklamaları filtrelendi)'
                  : 'Sunucuya ulaşan tüm istekler'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Search Log Input */}
              <div className="relative w-48 sm:w-56">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="IP, Path, Durum ara..."
                  value={searchLog}
                  onChange={(e) => setSearchLog(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              {/* Pause/Resume Stream button */}
              <button
                onClick={() => setIsLivePaused(!isLivePaused)}
                className={`p-1.5 rounded-xl border transition ${
                  isLivePaused
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title={isLivePaused ? 'Akışı Başlat' : 'Akışı Duraklat'}
              >
                {isLivePaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Logs Table */}
          <div className="overflow-x-auto max-h-96 overflow-y-auto border border-slate-800/80 rounded-2xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 text-[10px] uppercase font-semibold sticky top-0 backdrop-blur-md">
                <tr>
                  <th className="py-2.5 px-3">Zaman</th>
                  <th className="py-2.5 px-3">Tür</th>
                  <th className="py-2.5 px-3">Proje</th>
                  <th className="py-2.5 px-3">Metod</th>
                  <th className="py-2.5 px-3">Yol (Path)</th>
                  <th className="py-2.5 px-3">Durum</th>
                  <th className="py-2.5 px-3">Gecikme</th>
                  <th className="py-2.5 px-3">Ziyaretçi IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-500">
                      Görüntülenecek ziyaretçi kaydı bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2 px-3 text-slate-400 whitespace-nowrap">{log.timeFormatted}</td>
                      <td className="py-2 px-3">{getCategoryBadge(log.category, log.isInternal)}</td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-sans">
                          {log.project}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${getMethodBadgeClass(log.method)}`}>
                          {log.method}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-200 max-w-xs truncate" title={log.uri}>
                        {log.path}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${getStatusBadgeClass(log.status)}`}>
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

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2">
            <span>Toplam {filteredLogs.length} ziyaretçi isteği listeleniyor</span>
            {isLivePaused && (
              <span className="text-amber-400 font-medium">Akış duraklatıldı</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
