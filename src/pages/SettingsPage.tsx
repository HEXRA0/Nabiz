import React, { useState, useEffect } from 'react';
import {
  Settings,
  Server,
  Database,
  Cpu,
  Lock,
  CheckCircle2,
  AlertCircle,
  Save
} from 'lucide-react';
import { api } from '../lib/api.js';

export const SettingsPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await api.settings.get();
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    setSavingPassword(true);

    try {
      await api.auth.changePassword({ currentPassword, newPassword });
      setPasswordMsg({ ok: true, text: 'Parolanız başarıyla güncellendi.' });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setPasswordMsg({ ok: false, text: err.message || 'Parola değiştirilemedi.' });
    } finally {
      setSavingPassword(false);
    }
  };

  const sys = data?.systemInfo;

  return (
    <div className="max-w-4xl space-y-6 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Sistem & Ayarlar</h2>
        <p className="text-xs text-slate-400">
          Sunucu kaynakları, veritabanı durumu ve yönetici güvenlik ayarları
        </p>
      </div>

      {/* System Resources */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
            <span>Sunucu Ortamı</span>
            <Server className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-sm font-bold text-white font-mono">{sys?.platform} ({sys?.arch})</p>
          <p className="text-[11px] text-slate-500 font-mono">Node {sys?.nodeVersion}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
            <span>Bellek Kullanımı</span>
            <Cpu className="h-4 w-4 text-teal-400" />
          </div>
          <p className="text-sm font-bold text-white font-mono">{sys?.memoryUsageMb} MB RSS</p>
          <p className="text-[11px] text-slate-500">{sys?.cpuCount} CPU Çekirdeği</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
            <span>SQLite Kayıtları</span>
            <Database className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="text-sm font-bold text-white font-mono">
            {sys?.dbStats?.totalChecksRecorded?.toLocaleString() || 0} Denetim
          </p>
          <p className="text-[11px] text-slate-500 font-mono">WAL Modu Devrede</p>
        </div>
      </div>

      {/* Security & Password Change */}
      <div className="glass-panel p-6 rounded-2xl space-y-4 max-w-lg">
        <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
          <div className="h-8 w-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Yönetici Parolası Değiştir</h3>
            <p className="text-[11px] text-slate-400">Güvenliğiniz için güçlü bir parola belirleyin</p>
          </div>
        </div>

        {passwordMsg && (
          <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            passwordMsg.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            {passwordMsg.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{passwordMsg.text}</span>
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Mevcut Parola</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Yeni Parola (En az 6 karakter)</label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={savingPassword}
              className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl transition disabled:opacity-50"
            >
              {savingPassword ? 'Güncelleniyor...' : 'Parolayı Güncelle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
