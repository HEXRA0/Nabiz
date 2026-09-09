import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  HeartHandshake,
  AlertTriangle,
  Globe,
  Bell,
  Settings,
  Plus
} from 'lucide-react';

interface SidebarProps {
  onOpenCreateModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenCreateModal }) => {
  const navItems = [
    { to: '/', label: 'Gösterge Paneli', icon: LayoutDashboard },
    { to: '/monitors', label: 'Monitörler', icon: Activity },
    { to: '/heartbeats', label: 'Kalp Atışları (Cron)', icon: HeartHandshake },
    { to: '/incidents', label: 'Olay Yönetimi', icon: AlertTriangle },
    { to: '/status-page', label: 'Durum Sayfası', icon: Globe },
    { to: '/notifications', label: 'Bildirim Kanalları', icon: Bell },
    { to: '/settings', label: 'Ayarlar & Sistem', icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-[#090d16] flex flex-col justify-between shrink-0 min-h-[calc(100vh-4rem)] p-4">
      <div className="space-y-6">
        {/* Quick Add Button */}
        <button
          onClick={onOpenCreateModal}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-sm py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-900/30 transition duration-150 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>Yeni Monitör Ekle</span>
        </button>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* System Pulse Indicator */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-slate-400 font-medium">İzleme Motoru</span>
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Aktif
          </span>
        </div>
        <p className="text-slate-500 text-[11px]">
          Otomatik periyodik tarama ve anlık bildirim servisi çalışıyor.
        </p>
      </div>
    </aside>
  );
};
