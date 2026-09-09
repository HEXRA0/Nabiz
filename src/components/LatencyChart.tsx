import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

interface LatencyChartProps {
  data: Array<{
    created_at: string;
    latency_ms: number;
    status: string;
    status_code?: number;
  }>;
}

export const LatencyChart: React.FC<LatencyChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-slate-500 text-sm border border-slate-800/80 rounded-xl bg-slate-900/40">
        Henüz yeterli yanıt süresi verisi toplanmadı.
      </div>
    );
  }

  const chartData = data.map((item) => {
    const time = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return {
      time,
      latency: item.latency_ms,
      status: item.status,
      code: item.status_code,
    };
  });

  return (
    <div className="h-48 w-full bg-slate-900/40 p-3 rounded-xl border border-slate-800/80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            stroke="#64748b"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: '#1e293b' }}
          />
          <YAxis
            stroke="#64748b"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: '#1e293b' }}
            tickFormatter={(v) => `${v}ms`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs">
                    <p className="text-slate-400 mb-1">{data.time}</p>
                    <p className="font-semibold text-emerald-400">
                      Gecikme: <span className="text-white">{data.latency} ms</span>
                    </p>
                    {data.code && (
                      <p className="text-slate-400 mt-0.5">
                        HTTP Kod: <span className="text-slate-200">{data.code}</span>
                      </p>
                    )}
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="latency"
            stroke="#10b981"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#latencyGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
