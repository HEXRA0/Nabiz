import React, { useState } from 'react';
import { X, HeartHandshake, AlertCircle, Copy, Check } from 'lucide-react';
import { api, Heartbeat } from '../lib/api.js';

interface CreateHeartbeatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editHeartbeat?: Heartbeat | null;
}

export const CreateHeartbeatModal: React.FC<CreateHeartbeatModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editHeartbeat,
}) => {
  const [name, setName] = useState('');
  const [intervalSeconds, setIntervalSeconds] = useState(300);
  const [gracePeriodSeconds, setGracePeriodSeconds] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (editHeartbeat) {
      setName(editHeartbeat.name);
      setIntervalSeconds(editHeartbeat.interval_seconds);
      setGracePeriodSeconds(editHeartbeat.grace_period_seconds);
    } else {
      setName('');
      setIntervalSeconds(300);
      setGracePeriodSeconds(60);
    }
    setError(null);
  }, [editHeartbeat, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Lütfen bir kalp atışı / görev adı girin.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (editHeartbeat) {
        await api.heartbeats.update(editHeartbeat.id, {
          name: name.trim(),
          interval_seconds: Number(intervalSeconds),
          grace_period_seconds: Number(gracePeriodSeconds),
        });
      } else {
        await api.heartbeats.create({
          name: name.trim(),
          interval_seconds: Number(intervalSeconds),
          grace_period_seconds: Number(gracePeriodSeconds),
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Kayıt başarısız oldu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <HeartHandshake className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-slate-100">
              {editHeartbeat ? 'Kalp Atışını Düzenle' : 'Yeni Kalp Atışı (Cron) İzleyici'}
            </h3>
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
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Görev / Cron Adı</label>
            <input
              type="text"
              required
              placeholder="Örn: Günlük DB Yedeği, SSL Yenileme Betiği"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Beklenen Aralık</label>
              <select
                value={intervalSeconds}
                onChange={(e) => setIntervalSeconds(parseInt(e.target.value, 10))}
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value={60}>1 dakika</option>
                <option value={300}>5 dakika</option>
                <option value={900}>15 dakika</option>
                <option value={3600}>1 saat</option>
                <option value={86400}>24 saat (1 gün)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Tolerans Süresi (Grace)</label>
              <select
                value={gracePeriodSeconds}
                onChange={(e) => setGracePeriodSeconds(parseInt(e.target.value, 10))}
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value={30}>30 saniye</option>
                <option value={60}>1 dakika</option>
                <option value={300}>5 dakika</option>
                <option value={600}>10 dakika</option>
              </select>
            </div>
          </div>

          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-400">
            💡 <strong>Nasıl Çalışır:</strong> Sunucunuzdaki cron betiğiniz tamamlandığında oluşturulan URL'ye GET veya POST isteği atar. Belirtilen sürede sinyal gelmezse anında uyarı verilir.
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold text-sm rounded-xl transition disabled:opacity-50"
            >
              {loading ? 'Kaydediliyor...' : editHeartbeat ? 'Güncelle' : 'Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
