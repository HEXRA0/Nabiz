import React, { useState, useEffect } from 'react';
import { Activity, Lock, User, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { api, setToken } from '../lib/api.js';

interface LoginPageProps {
  onLoginSuccess: (user: any) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [needsSetup, setNeedsSetup] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await api.auth.getStatus();
      setNeedsSetup(res.needsSetup);
      if (res.needsSetup) {
        setUsername('admin');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (needsSetup) {
        const res = await api.auth.setup({ username, email, password });
        setToken(res.token);
        onLoginSuccess(res.user);
      } else {
        const res = await api.auth.login({ usernameOrEmail: username, password });
        setToken(res.token);
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Giriş yapılamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4 selection:bg-emerald-500/30">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
            <Activity className="h-7 w-7 text-white animate-pulse-subtle" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">NABIZ</h1>
          <p className="text-xs text-slate-400">nabiz.thedemir.com Uptime & İzleme Platformu</p>
        </div>

        {/* Card */}
        <div className="glass-panel p-8 rounded-3xl shadow-2xl space-y-6 border border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white">
              {needsSetup ? 'İlk Kurulum & Yönetici Tanımlama' : 'Yönetici Girişi'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {needsSetup
                ? 'Sisteminizi kullanmaya başlamak için ilk yönetici hesabını oluşturun.'
                : 'Kontrol paneline erişmek için oturum açın.'}
            </p>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-xs flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                {needsSetup ? 'Kullanıcı Adı' : 'Kullanıcı Adı veya E-posta'}
              </label>
              <div className="relative">
                <User className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder={needsSetup ? 'admin' : 'admin / email@thedemir.com'}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {needsSetup && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">E-posta Adresi</label>
                <div className="relative">
                  <Mail className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="ornek@thedemir.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Parola</label>
              <div className="relative">
                <Lock className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-sm py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-950/50 transition duration-150 active:scale-[0.98] disabled:opacity-50 mt-2"
            >
              <span>{loading ? 'İşleniyor...' : needsSetup ? 'Kurulumu Tamamla' : 'Giriş Yap'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>

        <div className="text-center">
          <a
            href="/status"
            className="text-xs text-slate-500 hover:text-emerald-400 transition"
          >
            ← Herkese Açık Durum Sayfasını Görüntüle
          </a>
        </div>
      </div>
    </div>
  );
};
