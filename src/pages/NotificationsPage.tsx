import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Plus,
  Send,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Activity
} from 'lucide-react';
import { api, NotificationChannel } from '../lib/api.js';

interface NotificationsPageProps {
  onOpenCreateModal: () => void;
  onEditChannel: (channel: NotificationChannel) => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  onOpenCreateModal,
  onEditChannel,
}) => {
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testStatus, setTestStatus] = useState<{ id: number; message: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await api.notificationChannels.list();
      setChannels(res.channels);
      setLogs(res.logs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTest = async (id: number) => {
    setTestingId(id);
    setTestStatus(null);
    try {
      const res = await api.notificationChannels.test(id);
      setTestStatus({ id, message: res.message || 'Test bildirimi iletildi!', ok: true });
      await loadData();
    } catch (err: any) {
      setTestStatus({ id, message: err.message || 'Gönderim başarısız oldu.', ok: false });
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bu bildirim kanalını silmek istediğinize emin misiniz?')) return;
    try {
      await api.notificationChannels.delete(id);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Bildirim Kanalları & Alarmlar</h2>
          <p className="text-xs text-slate-400">
            Kesinti, düzelme veya SSL süre uyarılarında anında Telegram, Discord ve Webhook bildirimleri alın
          </p>
        </div>

        <button
          onClick={onOpenCreateModal}
          className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-950/40 transition"
        >
          + Yeni Kanal Ekle
        </button>
      </div>

      {/* Channels List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {channels.length === 0 ? (
          <div className="md:col-span-3 glass-panel p-10 rounded-2xl text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto">
              <Bell className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-slate-200">Aktif Bildirim Kanalı Yok</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Kesintilerden anında haberdar olmak için Telegram Bot veya Discord Webhook bağlayın.
              </p>
            </div>
          </div>
        ) : (
          channels.map((ch) => (
            <div
              key={ch.id}
              className="glass-panel p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                      <Bell className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{ch.name}</h4>
                      <span className="text-[11px] uppercase font-mono text-indigo-400 font-semibold">
                        {ch.type}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEditChannel(ch)}
                      className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(ch.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {testStatus && testStatus.id === ch.id && (
                  <div className={`mt-3 p-2 rounded-lg text-xs flex items-center gap-1.5 ${
                    testStatus.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                  }`}>
                    {testStatus.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                    <span>{testStatus.message}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  {ch.is_active ? '🟢 Aktif' : '⚪ Pasif'}
                </span>
                <button
                  onClick={() => handleTest(ch.id)}
                  disabled={testingId === ch.id}
                  className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg border border-indigo-500/30 transition disabled:opacity-50"
                >
                  <Send className={`h-3 w-3 ${testingId === ch.id ? 'animate-spin' : ''}`} />
                  <span>{testingId === ch.id ? 'Test ediliyor...' : 'Test Mesajı Gönder'}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Notification Delivery Logs */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold text-white tracking-tight">Son Bildirim İletim Kayıtları</h3>
        {logs.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">Henüz gönderilmiş bir bildirim kaydı bulunmuyor.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Olay</th>
                  <th className="py-2.5 px-3">Servis / Hedef</th>
                  <th className="py-2.5 px-3">Durum</th>
                  <th className="py-2.5 px-3">Detay / Yanıt</th>
                  <th className="py-2.5 px-3 text-right">Zaman</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 font-mono text-[11px]">
                {logs.slice(0, 15).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40">
                    <td className="py-2 px-3 uppercase text-indigo-400 font-semibold font-sans">{log.event_type}</td>
                    <td className="py-2 px-3 text-slate-200 font-sans">{log.target_name}</td>
                    <td className="py-2 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold ${
                        log.status === 'sent' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-400 truncate max-w-sm font-sans">{log.message || '-'}</td>
                    <td className="py-2 px-3 text-right text-slate-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
