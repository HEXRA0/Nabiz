import React, { useEffect, useState } from 'react';
import { History, X, CheckCircle2, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import { api, ProjectActivity } from '../lib/api.js';

interface ActivityLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActivityLogsModal: React.FC<ActivityLogsModalProps> = ({ isOpen, onClose }) => {
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const data = await api.projects.activities();
      setActivities(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchActivities();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="glass-panel w-full max-w-2xl rounded-3xl border border-slate-800 bg-[#0c121e] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">İşlem ve Olay Geçmişi</h3>
              <p className="text-xs text-slate-400">
                Sunucuda gerçekleştirilen tüm başlatma, durdurma ve yeniden başlatma işlemleri.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchActivities}
              disabled={loading}
              title="Yenile"
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {loading && activities.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Kayıtlar yükleniyor...
            </div>
          ) : activities.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Henüz kaydedilmiş bir işlem geçmişi bulunmuyor.
            </div>
          ) : (
            activities.map((act) => (
              <div
                key={act.id}
                className="p-3.5 bg-slate-900/80 border border-slate-800/80 rounded-2xl flex items-start justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {act.status === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-400" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white uppercase font-mono tracking-tight">
                        {act.project_name}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          act.action === 'start'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : act.action === 'stop'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                        }`}
                      >
                        {act.action === 'start' ? 'BAŞLATILDI' : act.action === 'stop' ? 'DURDURULDU' : 'YENİDEN BAŞLATILDI'}
                      </span>
                    </div>

                    <p className="text-slate-300 leading-snug">
                      {act.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono shrink-0">
                  <Clock className="h-3 w-3" />
                  <span>{act.created_at}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
