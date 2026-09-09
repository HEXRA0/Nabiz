import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Plus,
  Clock,
  CheckCircle2,
  Trash2,
  MessageSquare,
  Send,
  AlertCircle
} from 'lucide-react';
import { api, Incident, Monitor } from '../lib/api.js';

interface IncidentsPageProps {
  onOpenCreateModal: () => void;
  monitors: Monitor[];
}

export const IncidentsPage: React.FC<IncidentsPageProps> = ({ onOpenCreateModal }) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [updateMessage, setUpdateMessage] = useState('');
  const [updateStatus, setUpdateStatus] = useState('investigating');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadIncidents = useCallback(async () => {
    try {
      const data = await api.incidents.list();
      setIncidents(data);
      if (selectedIncident) {
        const refreshed = data.find((i) => i.id === selectedIncident.id);
        if (refreshed) setSelectedIncident(refreshed);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedIncident?.id]);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident || !updateMessage.trim()) return;

    setSubmitting(true);
    try {
      await api.incidents.addUpdate(selectedIncident.id, {
        status: updateStatus,
        message: updateMessage.trim(),
      });
      setUpdateMessage('');
      await loadIncidents();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Bu olayı silmek istediğinize emin misiniz?')) return;
    try {
      await api.incidents.delete(id);
      if (selectedIncident?.id === id) setSelectedIncident(null);
      await loadIncidents();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Olay & Kesinti Yönetimi</h2>
          <p className="text-xs text-slate-400">
            Sistem kesintilerini, araştırma süreçlerini ve bakım duyurularını yönetin
          </p>
        </div>

        <button
          onClick={onOpenCreateModal}
          className="text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 px-4 py-2.5 rounded-xl shadow-lg shadow-amber-950/40 transition"
        >
          + Yeni Olay Bildir
        </button>
      </div>

      {incidents.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-slate-200">Kayıtlı Olay Bulunmuyor</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Tüm sistemler sorunsuz çalışıyor. Planlı bir bakım veya kesinti bildirimi oluşturmak için düğmeyi kullanabilirsiniz.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List */}
          <div className="lg:col-span-1 space-y-3">
            {incidents.map((inc) => {
              const isSelected = selectedIncident?.id === inc.id;
              const isResolved = inc.status === 'resolved';

              return (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncident(inc)}
                  className={`p-4 rounded-xl border cursor-pointer transition ${
                    isSelected
                      ? 'border-amber-500/60 bg-amber-950/20 shadow-md'
                      : 'border-slate-800/80 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h4 className="text-sm font-semibold text-white">{inc.title}</h4>
                    <button
                      onClick={(e) => handleDelete(inc.id, e)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      isResolved
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}>
                      {inc.status}
                    </span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {inc.severity}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2">
                    {inc.updates[0]?.message || 'Açıklama girilmedi'}
                  </p>

                  <div className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                    <span>{new Date(inc.created_at).toLocaleDateString()}</span>
                    <span>{inc.updates.length} Güncelleme</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Timeline Detail */}
          <div className="lg:col-span-2 glass-panel rounded-2xl p-6 space-y-6">
            {selectedIncident ? (
              <>
                <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{selectedIncident.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400">
                        Başlangıç: {new Date(selectedIncident.created_at).toLocaleString()}
                      </span>
                      {selectedIncident.monitor_name && (
                        <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {selectedIncident.monitor_name}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold uppercase ${
                    selectedIncident.status === 'resolved'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  }`}>
                    {selectedIncident.status}
                  </span>
                </div>

                {/* Timeline */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Olay Süreç Günlüğü (Timeline)
                  </h4>

                  <div className="relative pl-6 border-l-2 border-slate-800 space-y-6">
                    {selectedIncident.updates.map((upd) => (
                      <div key={upd.id} className="relative">
                        <div className="absolute -left-[31px] top-0 h-3.5 w-3.5 rounded-full bg-slate-900 border-2 border-amber-400" />
                        <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-amber-300 uppercase text-[11px]">
                              {upd.status}
                            </span>
                            <span className="text-slate-500 font-mono text-[10px]">
                              {new Date(upd.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-200 leading-relaxed">{upd.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add Update Form */}
                <form onSubmit={handleAddUpdate} className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
                  <h5 className="text-xs font-semibold text-slate-300">Yeni Güncelleme Mesajı Ekle</h5>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={updateStatus}
                      onChange={(e) => setUpdateStatus(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100"
                    >
                      <option value="investigating">Araştırılıyor (Investigating)</option>
                      <option value="identified">Tespit Edildi (Identified)</option>
                      <option value="monitoring">İzleniyor (Monitoring)</option>
                      <option value="resolved">Çözüldü (Resolved)</option>
                    </select>
                  </div>
                  <textarea
                    rows={2}
                    required
                    placeholder="Mevcut durum hakkında yeni açıklama yazın..."
                    value={updateMessage}
                    onChange={(e) => setUpdateMessage(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 resize-none focus:outline-none focus:border-amber-500"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex items-center gap-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 px-4 py-2 rounded-xl transition disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>{submitting ? 'Gönderiliyor...' : 'Güncellemeyi Yayınla'}</span>
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="py-16 text-center text-slate-500 text-xs">
                Süreç günlüğünü ve detaylarını görmek için soldaki listeden bir olay seçin.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
