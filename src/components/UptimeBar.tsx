import React, { useState } from 'react';

interface DayData {
  date: string;
  total: number;
  up_count: number;
  avg_latency?: number;
}

interface UptimeBarProps {
  dailyHistory?: DayData[];
  daysCount?: number;
}

export const UptimeBar: React.FC<UptimeBarProps> = ({ dailyHistory = [], daysCount = 90 }) => {
  const [hoveredDay, setHoveredDay] = useState<{ date: string; uptime: string; latency?: number } | null>(null);

  // Generate date array for last N days
  const days: { date: string; status: 'up' | 'degraded' | 'down' | 'none'; uptime: string; latency?: number }[] = [];
  const historyMap = new Map<string, DayData>();

  dailyHistory.forEach((d) => {
    historyMap.set(d.date, d);
  });

  const now = new Date();
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    const record = historyMap.get(dateStr);
    if (!record || record.total === 0) {
      days.push({ date: dateStr, status: 'none', uptime: 'Veri yok' });
    } else {
      const ratio = record.up_count / record.total;
      let status: 'up' | 'degraded' | 'down' = 'up';
      if (ratio === 0) status = 'down';
      else if (ratio < 0.95) status = 'degraded';

      days.push({
        date: dateStr,
        status,
        uptime: `%${(ratio * 100).toFixed(1)}`,
        latency: record.avg_latency ? Math.round(record.avg_latency) : undefined,
      });
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-[2px] h-7 w-full py-1">
        {days.map((day, idx) => {
          let bgClass = 'bg-slate-800/80 hover:bg-slate-700';
          if (day.status === 'up') bgClass = 'bg-emerald-500 hover:bg-emerald-400';
          else if (day.status === 'degraded') bgClass = 'bg-amber-400 hover:bg-amber-300';
          else if (day.status === 'down') bgClass = 'bg-rose-500 hover:bg-rose-400';

          return (
            <div
              key={idx}
              className={`flex-1 h-full rounded-[2px] cursor-pointer transition-colors duration-150 ${bgClass}`}
              onMouseEnter={() => setHoveredDay({ date: day.date, uptime: day.uptime, latency: day.latency })}
              onMouseLeave={() => setHoveredDay(null)}
            />
          );
        })}
      </div>

      <div className="flex justify-between items-center text-xs text-slate-500 mt-1">
        <span>{daysCount} gün önce</span>
        <div className="h-4 flex items-center justify-center">
          {hoveredDay ? (
            <span className="text-slate-300 font-medium bg-slate-800/90 px-2 py-0.5 rounded border border-slate-700 text-[11px]">
              {hoveredDay.date} • {hoveredDay.uptime} {hoveredDay.latency ? `(${hoveredDay.latency}ms)` : ''}
            </span>
          ) : (
            <span className="text-slate-500">Bugün</span>
          )}
        </div>
        <span>Bugün</span>
      </div>
    </div>
  );
};
