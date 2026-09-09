import React, { useState } from 'react';
import { X, Plus, Radio, Server, Layers, AlertCircle } from 'lucide-react';
import { api } from '../lib/api.js';

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddProjectModal: React.FC<AddProjectModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'port' | 'pm2' | 'docker'>('port');
  const [target, setTarget] = useState('');
  const [directory, setDirectory] = useState('');
  const [restartCommand, setRestartCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !target.trim()) {
      setError('Lütfen proje adı ve port / hedef bilgisini girin.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.projects.add({
        name: name.trim(),
        type,
        target: target.trim(),
        directory: directory.trim() || undefined,
        restart_command: restartCommand.trim() || undefined,
      });

      setName('');
      setTarget('');
      setDirectory('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Proje eklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0f172a] border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Plus className="h-4 w-4" />
            </div>
            <h3 className="font-bold text-slate-100 text-sm">Sunucuya Yeni Proje / Servis Tanımla</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
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

          {/* Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">Takip Türü</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'port', label: 'Port (Ağ)', icon: Radio },
                { id: 'pm2', label: 'PM2 Süreci', icon: Layers },
                { id: 'docker', label: 'Docker', icon: Server },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setType(item.id as any)}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition ${
                      type === item.id
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Proje Adı</label>
            <input
              type="text"
              required
              placeholder="Örn: Odak Görev Paneli, API Servisi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              {type === 'port' ? 'Dinlenen Port Numarası' : type === 'pm2' ? 'PM2 Uygulama Adı' : 'Docker Konteyner Adı'}
            </label>
            <input
              type="text"
              required
              placeholder={type === 'port' ? 'Örn: 5173, 3000, 8080' : 'odak'}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Proje Dizini (Opsiyonel)</label>
            <input
              type="text"
              placeholder="/var/www/odak veya /Users/.../Projeler/odak"
              value={directory}
              onChange={(e) => setDirectory(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg transition disabled:opacity-50"
            >
              {loading ? 'Ekleniyor...' : 'Projeyi Takibe Al'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
