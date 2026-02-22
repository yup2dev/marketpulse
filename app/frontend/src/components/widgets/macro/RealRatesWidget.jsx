/**
 * Real Rates Widget - TIPS Yields vs Nominal vs Breakeven Inflation
 * Real rates are the most important price in markets:
 *  Rising real rates → headwind for gold, equities, crypto
 *  Falling real rates → tailwind for risk assets
 */
import { useState, useEffect, useCallback } from 'react';
import { TrendingUp } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import BaseWidget from '../common/BaseWidget';
import { API_BASE } from '../../../config/api';

const SERIES_CONFIG = [
  { key: 'nominal_10y', name: '10Y Nominal', color: '#60a5fa', dashed: false },
  { key: 'real_10y',    name: '10Y Real (TIPS)', color: '#f59e0b', dashed: false },
  { key: 'breakeven_10y', name: '10Y Breakeven', color: '#a78bfa', dashed: true },
  { key: 'nominal_5y', name: '5Y Nominal', color: '#34d399', dashed: true },
  { key: 'real_5y',    name: '5Y Real (TIPS)', color: '#fb923c', dashed: true },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-[#1a1a1f] border border-gray-700 rounded px-3 py-2 shadow-lg text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {entry.value?.toFixed(3)}%
        </p>
      ))}
    </div>
  );
};

export default function RealRatesWidget({ onRemove }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('chart');
  const [period, setPeriod] = useState('5y');
  const [visibleSeries, setVisibleSeries] = useState(['nominal_10y', 'real_10y', 'breakeven_10y']);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/real-rates?period=${period}`);
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('Real rates fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { loadData(); }, [loadData]);

  const formatDate = (s) => {
    const d = new Date(s);
    return d.toLocaleDateString('en-US', { year: '2-digit', month: 'short' });
  };

  const latest = data?.latest || {};
  const real10y = latest.real_10y;
  const isPositive = real10y !== undefined && real10y > 0;

  const toggleSeries = (key) => {
    setVisibleSeries(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const renderChart = () => {
    const history = data?.history || [];
    return (
      <div className="h-full flex flex-col">
        {/* Series toggles */}
        <div className="flex flex-wrap gap-1.5 px-1 pb-2">
          {SERIES_CONFIG.map(s => (
            <button
              key={s.key}
              onClick={() => toggleSeries(s.key)}
              className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-opacity"
              style={{
                borderColor: s.color + '80',
                color: visibleSeries.includes(s.key) ? s.color : '#4b5563',
                backgroundColor: visibleSeries.includes(s.key) ? s.color + '15' : 'transparent',
                opacity: visibleSeries.includes(s.key) ? 1 : 0.5,
              }}
            >
              <span style={{ background: s.color, width: 6, height: 6, borderRadius: '50%', display: 'inline-block' }} />
              {s.name}
            </button>
          ))}
        </div>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: '#6b7280', fontSize: 10 }}
                axisLine={{ stroke: '#374151' }}
                tickFormatter={v => `${v.toFixed(1)}%`}
                width={38}
              />
              <Tooltip content={<CustomTooltip />} />
              {/* 0% reference line - key threshold */}
              <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 4" label={{ value: '0%', fill: '#6b7280', fontSize: 9, position: 'insideTopLeft' }} />
              {SERIES_CONFIG.filter(s => visibleSeries.includes(s.key)).map(s => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={1.5}
                  strokeDasharray={s.dashed ? '4 4' : undefined}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderTable = () => {
    const rows = [...(data?.history || [])].reverse().slice(0, 60);
    return (
      <div className="overflow-auto h-full">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0d0d12]">
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 px-3 text-gray-400 font-medium">Date</th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">10Y Nom.</th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">10Y Real</th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">10Y BEI</th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">5Y Real</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-1.5 px-3 text-gray-300">{r.date}</td>
                <td className="py-1.5 px-3 text-right text-blue-400 tabular-nums">{r.nominal_10y?.toFixed(3) ?? '-'}%</td>
                <td className={`py-1.5 px-3 text-right tabular-nums font-medium ${r.real_10y >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                  {r.real_10y?.toFixed(3) ?? '-'}%
                </td>
                <td className="py-1.5 px-3 text-right text-violet-400 tabular-nums">{r.breakeven_10y?.toFixed(3) ?? '-'}%</td>
                <td className={`py-1.5 px-3 text-right tabular-nums ${r.real_5y >= 0 ? 'text-amber-300' : 'text-red-300'}`}>
                  {r.real_5y?.toFixed(3) ?? '-'}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const subtitleParts = [];
  if (real10y !== undefined) {
    subtitleParts.push(`10Y Real: ${real10y >= 0 ? '+' : ''}${real10y.toFixed(3)}%`);
    subtitleParts.push(isPositive ? 'Restrictive' : 'Accommodative');
  }
  if (data?.['52w_high'] !== null && data?.['52w_high'] !== undefined) {
    subtitleParts.push(`52w: ${data['52w_low']?.toFixed(2)}% – ${data['52w_high']?.toFixed(2)}%`);
  }

  return (
    <BaseWidget
      title="Real Rates — TIPS / Breakeven Inflation"
      subtitle={subtitleParts.join(' · ')}
      icon={TrendingUp}
      iconColor={isPositive ? 'text-amber-400' : 'text-blue-400'}
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      period={period}
      onPeriodChange={setPeriod}
      periodType="macro"
      source={data?.source}
    >
      <div className="h-full p-3 flex flex-col">
        {/* Quick metrics bar */}
        {Object.keys(latest).length > 0 && (
          <div className="flex gap-4 mb-2 text-[10px] flex-wrap">
            {[
              { label: '10Y Nominal', val: latest.nominal_10y, color: '#60a5fa' },
              { label: '10Y Real', val: latest.real_10y, color: '#f59e0b' },
              { label: '10Y Breakeven', val: latest.breakeven_10y, color: '#a78bfa' },
              { label: '5Y Real', val: latest.real_5y, color: '#fb923c' },
            ].filter(m => m.val !== undefined).map((m, i) => (
              <div key={i} className="flex flex-col">
                <span className="text-gray-500">{m.label}</span>
                <span className="font-medium tabular-nums" style={{ color: m.color }}>
                  {m.val >= 0 ? '+' : ''}{m.val?.toFixed(3)}%
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="flex-1">
          {viewMode === 'chart' ? renderChart() : renderTable()}
        </div>
      </div>
    </BaseWidget>
  );
}
