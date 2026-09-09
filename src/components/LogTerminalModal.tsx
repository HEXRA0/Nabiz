import React, { useState, useEffect } from 'react';
import { X, Terminal, RefreshCw, Copy, Check } from 'lucide-react';
import { api, Project } from '../lib/api.js';

interface LogTerminalModalProps {
  project: Project | null;
  onClose: () => void;
}

export const LogTerminalModal: React.FC<LogTerminalModalProps> = ({ project, onClose }) => {
  const [logs, setLogs] = useState<string>('Loglar yükleniyor...');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (project) {
      fetchLogs();
      const interval = setInterval(fetchLogs, 3000);
      return () => clearInterval(interval);
    }
  }, [project?.id]);

  const fetchLogs = async () => {
    if (!project) return;
    try {
      const res = await api.projects.logs(project.id);
      setLogs(res.logs);
    } catch (e: any) {
      setLogs('Loglar alınamadı: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(logs);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!project) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col h-[75vh]">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-rose-500/80" />
              <div className="h-3 w-3 rounded-full bg-amber-500/80" />
              <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
            </div>
            <div className="h-4 w-[1px] bg-slate-800" />
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-emerald-400" />
              <span className="font-bold text-sm text-white font-mono">{project.name}</span>
              <span className="text-xs text-slate-500 font-mono">-- Canlı Konsol Çıktısı</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              title="Yenile"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleCopy}
              title="Tümünü Kopyala"
              className="flex items-center gap-1 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-700 transition"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Terminal Content */}
        <div className="flex-1 p-5 overflow-y-auto font-mono text-xs text-slate-300 bg-[#050811] selection:bg-emerald-500/30 whitespace-pre-wrap leading-relaxed">
          {logs}
        </div>
      </div>
    </div>
  );
};
