import React, { useState } from 'react';
import { X, AlertTriangle, AlertCircle } from 'lucide-react';
import { api, Monitor } from '../lib/api.js';

interface CreateIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  monitors: Monitor[];
}

export const CreateIncidentModal: React.FC<CreateIncidentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  monitors,
}) => {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('investigating');
  const [severity, setSeverity] = useState('major');
  const [monitorId, setMonitorId] = useState<number | undefined>(undefined);
  const [initialMessage, setInitialMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !initialMessage.trim()) {
      setError('Lütfen olay başlığı ve ilk açıklama mesajını doldurun.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.incidents.create({
        title: title.trim(),
        status,
        severity,
        monitor_id: monitorId ? Number(monitorId) : undefined,
        initial_message: initialMessage.trim(),
      });

      setTitle('');
      setInitialMessage('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Olay oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-slate-100">Yeni Olay / Kesinti Bildirimi</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Olay Başlığı</label>
            <input
              type="text"
              required
              placeholder="Örn: Veritabanı gecikme sorunu, Planlı sunucu bakımı"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Aşama</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="investigating">Araştırılıyor (Investigating)</option>
                <option value="identified">Tespit Edildi (Identified)</option>
                <option value="monitoring">İzleniyor (Monitoring)</option>
                <option value="resolved">Çözüldü (Resolved)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Kritiklik Seviyesi</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="minor">Düşük (Minor)</option>
                <option value="major">Önemli (Major)</option>
                <option value="critical">Kritik Kesinti (Critical)</option>
                <option value="maintenance">Planlı Bakım (Maintenance)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">İlgili Monitör / Servis</label>
            <select
              value={monitorId || ''}
              onChange={(e) => setMonitorId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
            >
              <option value="">Genel Sistem / Bağımsız</option>
              {monitors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.url})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">İlk Açıklama & Durum Mesajı</label>
            <textarea
              rows={3}
              required
              placeholder="Örn: API servislerinde yüksek gecikme tespit edildi. Mühendislik ekibimiz sorunu araştırıyor."
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm rounded-xl transition disabled:opacity-50"
            >
              {loading ? 'Yayınlanıyor...' : 'Olayı Yayınla'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
