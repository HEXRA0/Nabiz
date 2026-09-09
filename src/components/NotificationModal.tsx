import React, { useState } from 'react';
import { X, Bell, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api, NotificationChannel } from '../lib/api.js';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editChannel?: NotificationChannel | null;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editChannel,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'telegram' | 'discord' | 'webhook'>('telegram');
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (editChannel) {
      setName(editChannel.name);
      setType(editChannel.type as any);
      try {
        const config = JSON.parse(editChannel.config_json);
        if (editChannel.type === 'telegram') {
          setBotToken(config.botToken || '');
          setChatId(config.chatId || '');
        } else if (editChannel.type === 'discord') {
          setWebhookUrl(config.webhookUrl || '');
        } else if (editChannel.type === 'webhook') {
          setWebhookUrl(config.url || '');
        }
      } catch (e) {}
    } else {
      setName('');
      setType('telegram');
      setBotToken('');
      setChatId('');
      setWebhookUrl('');
    }
    setTestResult(null);
    setError(null);
  }, [editChannel, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Lütfen bir kanal adı girin.');
      return;
    }

    let config: any = {};
    if (type === 'telegram') {
      if (!botToken.trim() || !chatId.trim()) {
        setError('Telegram Bot Token ve Chat ID gereklidir.');
        return;
      }
      config = { botToken: botToken.trim(), chatId: chatId.trim() };
    } else if (type === 'discord') {
      if (!webhookUrl.trim()) {
        setError('Discord Webhook URL gereklidir.');
        return;
      }
      config = { webhookUrl: webhookUrl.trim() };
    } else if (type === 'webhook') {
      if (!webhookUrl.trim()) {
        setError('Webhook URL adresi gereklidir.');
        return;
      }
      config = { url: webhookUrl.trim() };
    }

    setLoading(true);
    setError(null);

    try {
      if (editChannel) {
        await api.notificationChannels.update(editChannel.id, {
          name: name.trim(),
          type,
          config_json: config,
        });
      } else {
        await api.notificationChannels.create({
          name: name.trim(),
          type,
          config_json: config,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Kanal kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Bell className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-slate-100">
              {editChannel ? 'Bildirim Kanalını Düzenle' : 'Yeni Bildirim Kanalı'}
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

          {/* Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">Platform</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'telegram', label: 'Telegram' },
                { id: 'discord', label: 'Discord' },
                { id: 'webhook', label: 'Webhook' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setType(item.id as any)}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium transition ${
                    type === item.id
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Kanal Adı</label>
            <input
              type="text"
              required
              placeholder="Örn: DevOps Telegram Grubu, Ana Discord Kanalı"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {type === 'telegram' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Telegram Bot Token</label>
                <input
                  type="password"
                  required
                  placeholder="123456789:AAHk..."
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Chat ID / Grup ID</label>
                <input
                  type="text"
                  required
                  placeholder="-100123456789"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </>
          )}

          {(type === 'discord' || type === 'webhook') && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                {type === 'discord' ? 'Discord Webhook URL' : 'Hedef Webhook URL'}
              </label>
              <input
                type="url"
                required
                placeholder={type === 'discord' ? 'https://discord.com/api/webhooks/...' : 'https://api.mycompany.com/webhook'}
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {testResult && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              testResult.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}>
              {testResult.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl transition disabled:opacity-50"
            >
              {loading ? 'Kaydediliyor...' : editChannel ? 'Güncelle' : 'Kanalı Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
