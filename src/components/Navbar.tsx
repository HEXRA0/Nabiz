import React from 'react';
import { Activity, Bell, ExternalLink, LogOut, ShieldCheck, User } from 'lucide-react';
import { removeToken } from '../lib/api.js';

interface NavbarProps {
  user?: any;
  onOpenNewMonitor?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onOpenNewMonitor }) => {
  const handleLogout = () => {
    removeToken();
    window.location.href = '/login';
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#0c121e]/90 backdrop-blur-md sticky top-0 z-30 px-6 flex items-center justify-between">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Activity className="h-5 w-5 text-white animate-pulse-subtle" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold tracking-tight text-lg bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              NABIZ
            </span>
            <span className="text-[10px] uppercase font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
              v1.0
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-none">nabiz.thedemir.com</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Public Status Page Button */}
        <a
          href="/status"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition"
        >
          <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
          <span>Genel Durum Sayfası</span>
        </a>

        {/* User Info & Logout */}
        {user && (
          <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-emerald-400">
                {user.username ? user.username[0].toUpperCase() : 'U'}
              </div>
              <span className="text-xs font-medium text-slate-300 hidden md:inline">
                {user.username}
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Çıkış Yap"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
