import React, { useState, useEffect } from 'react';
import { X, Globe, Shield, Server, Activity, AlertCircle } from 'lucide-react';
import { api, Monitor } from '../lib/api.js';

interface CreateMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editMonitor?: Monitor | null;
}

export const CreateMonitorModal: React.FC<CreateMonitorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editMonitor,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'http' | 'ssl' | 'tcp' | 'ping'>('http');
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [expectedStatusCode, setExpectedStatusCode] = useState(200);
  const [intervalSeconds, setIntervalSeconds] = useState(60);
  const [retriesBeforeDown, setRetriesBeforeDown] = useState(2);
  const [bodySearch, setBodySearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editMonitor) {
      setName(editMonitor.name);
      setType(editMonitor.type);
      setUrl(editMonitor.url);
      setMethod(editMonitor.method || 'GET');
      setExpectedStatusCode(editMonitor.expected_status_code || 200);
      setIntervalSeconds(editMonitor.interval_seconds || 60);
      setRetriesBeforeDown(editMonitor.retries_before_down || 2);
      setBodySearch(editMonitor.body_search || '');
    } else {
      setName('');
      setType('http');
      setUrl('');
      setMethod('GET');
      setExpectedStatusCode(200);
      setIntervalSeconds(60);
      setRetriesBeforeDown(2);
      setBodySearch('');
    }
    setError(null);
  }, [editMonitor, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) {
      setError('Lütfen monitör adı ve URL alanlarını doldurun.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        type,
        url: url.trim(),
        method,
        expected_status_code: Number(expectedStatusCode),
        interval_seconds: Number(intervalSeconds),
        retries_before_down: Number(retriesBeforeDown),
        body_search: bodySearch.trim() || undefined,
      };

      if (editMonitor) {
        await api.monitors.update(editMonitor.id, payload);
      } else {
        await api.monitors.create(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Monitör kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Activity className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-slate-100">
              {editMonitor ? 'Monitörü Düzenle' : 'Yeni Monitör Ekle'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">Monitör Türü</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'http', label: 'HTTP(s)', icon: Globe },
                { id: 'ssl', label: 'SSL Kontrol', icon: Shield },
                { id: 'tcp', label: 'TCP Port', icon: Server },
                { id: 'ping', label: 'Ping', icon: Activity },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = type === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setType(item.id as any)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 shadow-sm'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Monitör Adı</label>
            <input
              type="text"
              required
              placeholder="Örn: Ana Web Sitesi, Kimlik API Servisi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
            />
          </div>

          {/* Target URL / Host */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              {type === 'tcp' ? 'Host ve Port (Örn: db.example.com:5432)' : 'Hedef URL / Adres'}
            </label>
            <input
              type="text"
              required
              placeholder={type === 'tcp' ? '1.2.3.4:3306' : 'https://api.example.com/health'}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono text-xs transition"
            />
          </div>

          {/* HTTP Specific Settings */}
          {(type === 'http' || type === 'ssl') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">HTTP Metodu</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="GET">GET</option>
                  <option value="HEAD">HEAD</option>
                  <option value="POST">POST</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Beklenen HTTP Kodu</label>
                <input
                  type="number"
                  value={expectedStatusCode}
                  onChange={(e) => setExpectedStatusCode(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Interval & Retries */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Kontrol Aralığı</label>
              <select
                value={intervalSeconds}
                onChange={(e) => setIntervalSeconds(parseInt(e.target.value, 10))}
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value={15}>15 saniye</option>
                <option value={30}>30 saniye</option>
                <option value={60}>60 saniye (1 dk)</option>
                <option value={300}>300 saniye (5 dk)</option>
                <option value={600}>600 saniye (10 dk)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Hata Eşiği (Retries)</label>
              <select
                value={retriesBeforeDown}
                onChange={(e) => setRetriesBeforeDown(parseInt(e.target.value, 10))}
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value={1}>1 başarısızlıkta (Anında)</option>
                <option value={2}>2 arka arkaya başarısızlık</option>
                <option value={3}>3 arka arkaya başarısızlık</option>
              </select>
            </div>
          </div>

          {/* Optional Body Search */}
          {type === 'http' && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Yanıt Gövdesi Arama Metni (İsteğe Bağlı)
              </label>
              <input
                type="text"
                placeholder='Örn: "status": "ok" veya {"healthy": true}'
                value={bodySearch}
                onChange={(e) => setBodySearch(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* Submit Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-900/30 transition disabled:opacity-50"
            >
              {loading ? 'Kaydediliyor...' : editMonitor ? 'Güncelle' : 'Monitörü Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
