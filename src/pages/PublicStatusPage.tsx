import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Clock,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { api } from '../lib/api.js';
import { UptimeBar } from '../components/UptimeBar.js';

export const PublicStatusPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = async () => {
    try {
      const res = await api.statusPages.getPublic('default');
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-slate-400 text-sm">
        <Activity className="h-6 w-6 text-emerald-500 animate-spin mr-2" />
        Sistem durumu yükleniyor...
      </div>
    );
  }

  const overallStatus = data?.overallStatus || 'operational';
  const monitors = data?.monitors || [];
  const incidents = data?.incidents || [];

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between selection:bg-emerald-500/30">
      <div className="max-w-4xl w-full mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white">
                {data?.page?.title || 'Nabız Sistem Durumu'}
              </h1>
              <p className="text-xs text-slate-400">nabiz.thedemir.com</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            <span>Otomatik güncellenir (30s)</span>
          </div>
        </div>

        {/* Big Overall Status Card */}
        <div
          className={`p-6 rounded-2xl border flex items-center gap-4 shadow-xl ${
            overallStatus === 'operational'
              ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
              : overallStatus === 'degraded'
              ? 'bg-amber-950/20 border-amber-500/40 text-amber-300'
              : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="h-12 w-12 rounded-2xl bg-black/20 flex items-center justify-center shrink-0">
            {overallStatus === 'operational' ? (
              <CheckCircle2 className="h-7 w-7 text-emerald-400" />
            ) : overallStatus === 'degraded' ? (
              <AlertTriangle className="h-7 w-7 text-amber-400" />
            ) : (
              <AlertTriangle className="h-7 w-7 text-rose-400" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold">
              {overallStatus === 'operational'
                ? 'Tüm Servisler Kesintisiz Çalışıyor'
                : overallStatus === 'degraded'
                ? 'Bazı Servislerde Performans Düşüşü Var'
                : 'Servislerde Kesinti Yaşanıyor'}
            </h2>
            <p className="text-xs opacity-80 mt-0.5">
              {data?.page?.description || 'Tüm altyapı bileşenleri 7/24 otomatik olarak denetlenmektedir.'}
            </p>
          </div>
        </div>

        {/* Active Incidents */}
        {incidents.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
              Mevcut Olaylar & Duyurular
            </h3>

            <div className="space-y-3">
              {incidents.map((inc: any) => (
                <div
                  key={inc.id}
                  className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm text-white">{inc.title}</h4>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      {inc.status}
                    </span>
                  </div>

                  <div className="space-y-3 pl-4 border-l border-slate-800">
                    {inc.updates.map((u: any) => (
                      <div key={u.id} className="text-xs space-y-1">
                        <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
                          <span className="font-semibold text-slate-300 uppercase">{u.status}</span>
                          <span>•</span>
                          <span>{new Date(u.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-200">{u.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* System Components (Monitors) */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
            Sistem Bileşenleri & Servisler
          </h3>

          <div className="glass-panel rounded-2xl divide-y divide-slate-800/80 overflow-hidden">
            {monitors.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Görüntülenecek aktif bileşen bulunamadı.
              </div>
            ) : (
              monitors.map((m: any) => (
                <div key={m.id} className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${
                          m.status === 'up' ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      <span className="text-sm font-semibold text-slate-100">{m.name}</span>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-mono text-slate-400">%{m.uptime} Uptime</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          m.status === 'up'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {m.status === 'up' ? 'Operasyonel' : 'Kesinti'}
                      </span>
                    </div>
                  </div>

                  {/* 90-day status bar */}
                  <UptimeBar dailyHistory={m.dailyHistory} daysCount={90} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} nabiz.thedemir.com • Güçlü ve Kesintisiz Uptime İzleme Altyapısı</p>
      </footer>
    </div>
  );
};
