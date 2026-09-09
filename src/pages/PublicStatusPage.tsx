import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, AlertTriangle, Shield, Clock } from 'lucide-react';
import { api } from '../lib/api.js';
import { UptimeBar } from '../components/UptimeBar.js';

export const PublicStatusPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = async () => {
    try {
      const res = await api.public.status();
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    const timer = setInterval(loadStatus, 20000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-slate-400 text-xs">
        <Activity className="h-5 w-5 text-emerald-500 animate-spin mr-2" />
        Sistem durumu yükleniyor...
      </div>
    );
  }

  const overallStatus = data?.overallStatus || 'up';
  const services = data?.services || [];

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between selection:bg-emerald-500/30">
      <div className="max-w-3xl w-full mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Nabız Sistem Durumu</h1>
              <p className="text-xs text-slate-400">nabiz.thedemir.com</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-800">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            <span>Otomatik Canlı Güncelleme</span>
          </div>
        </div>

        {/* Hero Overall Badge */}
        <div
          className={`p-6 rounded-3xl border flex items-center gap-4 shadow-xl ${
            overallStatus === 'up'
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="h-12 w-12 rounded-2xl bg-black/20 flex items-center justify-center shrink-0">
            {overallStatus === 'up' ? (
              <CheckCircle2 className="h-7 w-7 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-7 w-7 text-rose-400" />
            )}
          </div>
          <div>
            <h2 className="text-base font-bold">
              {overallStatus === 'up'
                ? 'Tüm Servisler Kesintisiz Çalışıyor'
                : 'Bazı Servislerde Kesinti Yaşanıyor'}
            </h2>
            <p className="text-xs opacity-80 mt-0.5">
              {overallStatus === 'up'
                ? 'Altyapımızdaki tüm web servisleri ve sunucular tamamen operasyonel.'
                : 'Mühendislik ekibimiz tespit edilen kesintiye müdahale ediyor.'}
            </p>
          </div>
        </div>

        {/* Services List */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Servis Performansı & 30 Günlük Geçmiş
          </h3>

          <div className="glass-panel rounded-2xl divide-y divide-slate-800/80 overflow-hidden">
            {services.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Görüntülenecek aktif servis bulunamadı.
              </div>
            ) : (
              services.map((s: any) => (
                <div key={s.id} className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${
                          s.status === 'up' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                        }`}
                      />
                      <span className="text-sm font-semibold text-slate-100">{s.name}</span>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-mono text-slate-400">%{s.uptime} Uptime</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          s.status === 'up'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {s.status === 'up' ? 'Operasyonel' : 'Kesinti'}
                      </span>
                    </div>
                  </div>

                  {/* 30-day status bar */}
                  <UptimeBar dailyHistory={s.dailyHistory} daysCount={30} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} nabiz.thedemir.com • Kesintisiz Uptime İzleme</p>
      </footer>
    </div>
  );
};
