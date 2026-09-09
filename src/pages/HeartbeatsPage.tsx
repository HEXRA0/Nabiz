import React, { useState, useEffect, useCallback } from 'react';
import {
  HeartHandshake,
  Copy,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  Clock,
  Terminal,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { api, Heartbeat } from '../lib/api.js';

interface HeartbeatsPageProps {
  onOpenCreateModal: () => void;
}

export const HeartbeatsPage: React.FC<HeartbeatsPageProps> = ({ onOpenCreateModal }) => {
  const [heartbeats, setHeartbeats] = useState<Heartbeat[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadHeartbeats = useCallback(async () => {
    try {
      const data = await api.heartbeats.list();
      setHeartbeats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHeartbeats();
    const timer = setInterval(loadHeartbeats, 15000);
    return () => clearInterval(timer);
  }, [loadHeartbeats]);

  const copyCurl = (hb: Heartbeat) => {
    const origin = window.location.origin;
    const command = `curl -fsS -m 10 --retry 3 "${origin}/api/push/${hb.token}"`;
    navigator.clipboard.writeText(command);
    setCopiedId(hb.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bu kalp atışı izleyicisini silmek istediğinize emin misiniz?')) return;
    try {
      await api.heartbeats.delete(id);
      await loadHeartbeats();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Kalp Atışı (Heartbeat / Cron) İzleyicileri</h2>
          <p className="text-xs text-slate-400">
            Yedekleme betikleri, arka plan işçileri ve cron görevlerinizin periyodik çalışmasını takip edin
          </p>
        </div>

        <button
          onClick={onOpenCreateModal}
          className="text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 px-4 py-2.5 rounded-xl shadow-lg shadow-teal-950/40 transition"
        >
          + Yeni Kalp Atışı Ekle
        </button>
      </div>

      {heartbeats.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center mx-auto">
            <HeartHandshake className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-slate-200">Henüz Kalp Atışı Eklenmedi</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Periyodik çalışan sunucu betikleriniz tamamlandığında Nabız'a sinyal gönderir. Sinyal gelmezse anında bildirim alırsınız.
            </p>
          </div>
          <button
            onClick={onOpenCreateModal}
            className="text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 px-4 py-2 rounded-xl transition"
          >
            İlk Kalp Atışını Ekle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {heartbeats.map((hb) => {
            const isUp = hb.current_status === 'up';
            const isDown = hb.current_status === 'down';

            return (
              <div
                key={hb.id}
                className="glass-panel p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full shrink-0 ${
                      isUp ? 'bg-teal-400 animate-pulse' : isDown ? 'bg-rose-500' : 'bg-amber-400'
                    }`} />
                    <div>
                      <h4 className="text-sm font-semibold text-white">{hb.name}</h4>
                      <span className="text-[11px] text-slate-400">
                        Aralık: {Math.round(hb.interval_seconds / 60)} dk (+{hb.grace_period_seconds}s tolerans)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      isUp
                        ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                        : isDown
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}>
                      {hb.current_status}
                    </span>
                    <button
                      onClick={() => handleDelete(hb.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Last Signal */}
                <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs flex items-center justify-between text-slate-400">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    <span>Son Sinyal:</span>
                  </div>
                  <span className="font-mono text-slate-200">
                    {hb.last_ping_at ? new Date(hb.last_ping_at).toLocaleString() : 'Henüz sinyal alınmadı'}
                  </span>
                </div>

                {/* Curl Snippet */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Terminal className="h-3 w-3 text-slate-500" />
                      <span>Cron Görevi Entegrasyon Komutu:</span>
                    </div>
                    <button
                      onClick={() => copyCurl(hb)}
                      className="flex items-center gap-1 text-teal-400 hover:text-teal-300 font-medium transition"
                    >
                      {copiedId === hb.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedId === hb.id ? 'Kopyalandı' : 'Kopyala'}</span>
                    </button>
                  </div>
                  <div className="p-2.5 bg-[#070b12] rounded-xl border border-slate-800/80 font-mono text-[11px] text-slate-300 truncate select-all">
                    curl -fsS -m 10 "{window.location.origin}/api/push/{hb.token}"
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
