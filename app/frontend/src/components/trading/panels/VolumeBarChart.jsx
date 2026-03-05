/**
 * VolumeBarChart – Intraday volume delta bar chart for stocks.
 * Each bar represents one 1-minute candle.
 * Green = net buy pressure (close > open), Red = net sell pressure.
 * Delta = volume × (close − open) / (high − low)  [body-weighted approximation]
 */
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, CartesianGrid,
} from 'recharts';
import { useMemo } from 'react';

function fmtTime(ts) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function fmtVol(v) {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div className="bg-[#0d0d12] border border-gray-700 rounded px-2 py-1 text-[10px]">
      <div className="text-gray-500">{fmtTime(label)}</div>
      <div className={val >= 0 ? 'text-green-400' : 'text-red-400'}>
        Δ Vol: {val >= 0 ? '+' : ''}{fmtVol(val)}
      </div>
    </div>
  );
};

export default function VolumeBarChart({ bars }) {
  const data = useMemo(() => {
    return bars.slice(-60).map(bar => {
      const range = bar.high - bar.low;
      const delta = range > 0
        ? bar.volume * (bar.close - bar.open) / range
        : (bar.close >= bar.open ? bar.volume : -bar.volume);
      return { time: new Date(bar.date).getTime(), delta: +delta.toFixed(0) };
    });
  }, [bars]);

  if (data.length === 0) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="text-[10px] text-gray-600 px-1 mb-0.5">Volume Delta · Intraday</div>
        <div className="flex-1 flex items-center justify-center text-[10px] text-gray-800">
          Loading…
        </div>
      </div>
    );
  }

  const lastDelta = data[data.length - 1]?.delta ?? 0;

  return (
    <div className="w-full h-full flex flex-col">
      <div className="text-[10px] text-gray-600 px-1 mb-0.5 shrink-0 flex items-center gap-2">
        <span>Volume Delta</span>
        <span className="text-gray-800">·</span>
        <span>Buy vs Sell Pressure</span>
        <span className={`ml-auto tabular-nums ${lastDelta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {lastDelta >= 0 ? '+' : ''}{fmtVol(lastDelta)}
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 44, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" vertical={false} />
            <XAxis
              dataKey="time"
              tickFormatter={fmtTime}
              tick={{ fontSize: 8, fill: '#4b5563', fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 8, fill: '#4b5563', fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
              width={42}
              tickFormatter={fmtVol}
            />
            <ReferenceLine y={0} stroke="#374151" strokeWidth={0.8} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="delta" isAnimationActive={false} maxBarSize={10}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.delta >= 0 ? '#22c55e' : '#ef4444'}
                  fillOpacity={0.75}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
