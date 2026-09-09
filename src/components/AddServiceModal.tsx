import React, { useState, useEffect } from 'react';
import { X, Globe, Plus, Edit2, AlertCircle } from 'lucide-react';
import { api, Service } from '../lib/api.js';

interface AddServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingService?: Service | null;
}

export const AddServiceModal: React.FC<AddServiceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingService,
}) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [intervalSeconds, setIntervalSeconds] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingService) {
      setName(editingService.name);
      setUrl(editingService.url);
      setIntervalSeconds(editingService.interval_seconds || 60);
    } else {
      setName('');
      setUrl('');
      setIntervalSeconds(60);
    }
    setError(null);
  }, [editingService, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) {
      setError('Lütfen servis adı ve web adresini girin.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (editingService) {
        await api.services.update(editingService.id, {
          name: name.trim(),
          url: url.trim(),
          interval_seconds: Number(intervalSeconds),
        });
      } else {
        await api.services.create({
          name: name.trim(),
          url: url.trim(),
          interval_seconds: Number(intervalSeconds),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0f172a] border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              {editingService ? <Edit2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </div>
            <h3 className="font-bold text-slate-100 text-sm">
              {editingService ? 'Servisi Düzenle' : 'Yeni Servis Ekle'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Servis Adı</label>
            <input
              type="text"
              required
              placeholder="Örn: Ana Web Sitesi, Kimlik API"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Web Adresi (URL)</label>
            <input
              type="text"
              required
              placeholder="https://thedemir.com veya api.thedemir.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 font-mono text-xs focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Kontrol Sıklığı</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 30, label: '30 saniye' },
                { val: 60, label: '1 dakika' },
                { val: 300, label: '5 dakika' },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setIntervalSeconds(item.val)}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium transition ${
                    intervalSeconds === item.val
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 shadow-sm'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-950/40 transition disabled:opacity-50"
            >
              {loading ? 'Kaydediliyor...' : editingService ? 'Güncelle' : 'İzlemeyi Başlat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
