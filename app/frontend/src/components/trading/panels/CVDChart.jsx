/**
 * CVDChart – Cumulative Volume Delta line chart.
 * Shows the running difference between buy-initiated and sell-initiated volume.
 */
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts';

function fmtTime(ts) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function fmtVol(v) {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toFixed(1);
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div className="bg-[#0d0d12] border border-gray-700 rounded px-2 py-1 text-[10px]">
      <div className="text-gray-500">{fmtTime(label)}</div>
      <div className={val >= 0 ? 'text-green-400' : 'text-red-400'}>
        CVD: {val >= 0 ? '+' : ''}{val?.toFixed(2)}
      </div>
    </div>
  );
};

export default function CVDChart({ cvdPoints }) {
  const data = cvdPoints.slice(-60);
  if (data.length === 0) return (
    <div className="w-full h-full flex flex-col">
      <div className="text-[10px] text-gray-600 px-1 mb-0.5">CVD · Cumulative Volume Delta</div>
      <div className="flex-1 flex items-center justify-center text-[10px] text-gray-800">
        Loading…
      </div>
    </div>
  );

  const values = data.map(d => d.cvd);
  const minV   = Math.min(...values);
  const maxV   = Math.max(...values);
  const margin = Math.max(Math.abs(maxV - minV) * 0.1, 1);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="text-[10px] text-gray-600 px-1 mb-0.5 shrink-0 flex items-center gap-2">
        <span>CVD</span>
        <span className="text-gray-800">·</span>
        <span>Cumulative Volume Delta</span>
        {data.length > 0 && (
          <span className={`ml-auto tabular-nums ${values[values.length-1] >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {values[values.length-1] >= 0 ? '+' : ''}{fmtVol(values[values.length-1])}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 44, bottom: 4, left: 0 }}>
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
              domain={[minV - margin, maxV + margin]}
              tick={{ fontSize: 8, fill: '#4b5563', fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
              width={42}
              tickFormatter={fmtVol}
            />
            <ReferenceLine y={0} stroke="#374151" strokeWidth={0.8} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="cvd"
              stroke="#06b6d4"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
