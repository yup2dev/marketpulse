/**
 * Revenue Segments Widget
 * Shows revenue breakdown by product segment and geographic region.
 * Data: FMP /stable/revenue-product-segmentation + geographic-segmentation
 *
 * Views:
 *   donut   – latest period pie/donut with legend
 *   trend   – stacked bar chart over years
 *   table   – detailed table with YoY % change
 */
import { useState, useEffect, useCallback } from 'react';
import { PieChart as PieIcon } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip as PieTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import BaseWidget from './common/BaseWidget';
import { API_BASE } from '../../config/api';

// ── Segment colour palette ────────────────────────────────────────────────────
const PALETTE = [
  '#06b6d4', '#22c55e', '#f59e0b', '#a78bfa', '#f87171',
  '#34d399', '#60a5fa', '#fb923c', '#e879f9', '#facc15',
  '#4ade80', '#38bdf8', '#f472b6', '#c084fc', '#2dd4bf',
];
const segColor = (i) => PALETTE[i % PALETTE.length];

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtB  = (v) => (v == null ? '–' : `$${v.toFixed(1)}B`);
const fmtPct = (v) => (v == null ? '–' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`);
const fmtDate = (s) => s ? s.slice(0, 7) : s;

// ── Custom Pie Tooltip ────────────────────────────────────────────────────────
const PieTooltipContent = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value, payload: p } = payload[0];
  const total = p.total;
  const pct = total ? ((value / total) * 100).toFixed(1) : '?';
  return (
    <div className="bg-[#1a1a1f] border border-gray-700 rounded px-3 py-2 text-xs shadow-lg">
      <p className="text-white font-medium">{name}</p>
      <p className="text-cyan-400">{fmtB(value)}</p>
      <p className="text-gray-400">{pct}% of total</p>
    </div>
  );
};

// ── Custom Bar Tooltip ────────────────────────────────────────────────────────
const BarTooltipContent = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="bg-[#1a1a1f] border border-gray-700 rounded px-3 py-2 text-xs shadow-lg max-w-[200px]">
      <p className="text-gray-400 mb-1">{label}</p>
      <p className="text-gray-300 mb-1">Total: {fmtB(total)}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.fill }}>{p.name}: {fmtB(p.value)}</p>
      ))}
    </div>
  );
};

// ── Main Widget ───────────────────────────────────────────────────────────────
export default function RevenueSegmentsWidget({ symbol: initialSymbol, onRemove }) {
  const [symbol, setSymbol] = useState(initialSymbol || 'AAPL');
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [segType, setSegType] = useState('product'); // 'product' | 'geo'
  const [view,    setView]    = useState('donut');   // 'donut' | 'trend' | 'table'

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/stock/revenue-segments/${symbol}?limit=8`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      // Auto-pick available type
      if (!json.has_product && json.has_geo) setSegType('geo');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived data ─────────────────────────────────────────────────────────
  const seg = data?.[segType];  // {segments, history, latest, yoy}

  // Donut data for latest period
  const donutData = seg
    ? seg.segments
        .filter(s => seg.latest[s] != null && seg.latest[s] > 0)
        .map((s, i) => ({
          name: s,
          value: seg.latest[s],
          total: seg.latest.total,
          color: segColor(i),
        }))
    : [];

  // Trend: stacked bars keyed by date
  const trendData = seg?.history || [];

  // ── Renderers ─────────────────────────────────────────────────────────────
  const renderDonut = () => {
    if (!donutData.length) return <NoData />;
    const latest = seg.latest;
    return (
      <div className="flex h-full gap-2">
        {/* Donut */}
        <div className="flex-1 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius="52%"
                outerRadius="78%"
                paddingAngle={2}
                dataKey="value"
              >
                {donutData.map((d, i) => (
                  <Cell key={i} fill={d.color} stroke="none" />
                ))}
              </Pie>
              <PieTooltip content={<PieTooltipContent />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Legend + numbers */}
        <div className="w-44 flex flex-col justify-center gap-1 pr-2 overflow-y-auto">
          <p className="text-[9px] text-gray-500 mb-1">{fmtDate(latest.date)} · Total {fmtB(latest.total)}</p>
          {donutData.map((d, i) => {
            const pct = latest.total ? ((d.value / latest.total) * 100).toFixed(1) : '?';
            const yoy = seg.yoy[d.name];
            return (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-300 truncate">{d.name}</p>
                  <p className="text-[10px] tabular-nums">
                    <span className="text-white">{fmtB(d.value)}</span>
                    <span className="text-gray-500 ml-1">{pct}%</span>
                    {yoy != null && (
                      <span className={`ml-1 ${yoy >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {fmtPct(yoy)}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTrend = () => {
    if (!trendData.length) return <NoData />;
    const segments = seg.segments;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={s => s?.slice(0, 4)}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={{ stroke: '#374151' }}
          />
          <YAxis
            tickFormatter={v => `$${v.toFixed(0)}B`}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={{ stroke: '#374151' }}
            width={44}
          />
          <Tooltip content={<BarTooltipContent />} />
          <Legend
            wrapperStyle={{ fontSize: 10, color: '#9ca3af', paddingTop: 4 }}
            iconSize={8}
          />
          {segments.map((s, i) => (
            <Bar key={s} dataKey={s} stackId="a" fill={segColor(i)} maxBarSize={48} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderTable = () => {
    if (!seg?.segments?.length) return <NoData />;
    const rows = [...(seg.history || [])].reverse();
    const segments = seg.segments;
    return (
      <div className="overflow-auto h-full">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0d0d12] z-10">
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 px-3 text-gray-400 font-medium">Date</th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">Total</th>
              {segments.map(s => (
                <th key={s} className="text-right py-2 px-2 text-gray-400 font-medium whitespace-nowrap">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const prevRow = rows[ri + 1];
              return (
                <tr key={row.date} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="py-1.5 px-3 text-gray-300 tabular-nums">{row.date?.slice(0, 10)}</td>
                  <td className="py-1.5 px-3 text-right text-white tabular-nums font-medium">
                    {fmtB(row.total)}
                  </td>
                  {segments.map((s, si) => {
                    const val = row[s];
                    const prv = prevRow?.[s];
                    const yoy = (val != null && prv != null && prv !== 0)
                      ? ((val - prv) / Math.abs(prv) * 100)
                      : null;
                    const pct = row.total ? ((val / row.total) * 100) : null;
                    return (
                      <td key={s} className="py-1.5 px-2 text-right tabular-nums">
                        <span style={{ color: segColor(si) }}>{fmtB(val)}</span>
                        {pct != null && (
                          <span className="text-gray-600 text-[9px] ml-0.5">{pct.toFixed(0)}%</span>
                        )}
                        {yoy != null && (
                          <span className={`text-[9px] ml-1 ${yoy >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {fmtPct(yoy)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // ── Subtitle ───────────────────────────────────────────────────────────────
  const latestTotal = data?.[segType]?.latest?.total;
  const latestDate  = data?.[segType]?.latest?.date;
  const segCount    = data?.[segType]?.segments?.length;
  const subtitle = data
    ? latestTotal
      ? `${fmtDate(latestDate)} · ${fmtB(latestTotal)} across ${segCount} segment${segCount !== 1 ? 's' : ''}`
      : 'No segment data available'
    : undefined;

  return (
    <BaseWidget
      title={`Revenue Breakdown — ${symbol}`}
      subtitle={subtitle}
      icon={PieIcon}
      iconColor="text-cyan-400"
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      symbol={symbol}
      onSymbolChange={setSymbol}
      source="Financial Modeling Prep"
    >
      <div className="h-full flex flex-col">
        {/* Controls row */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-800/50">
          {/* Segment type toggle */}
          <div className="flex rounded overflow-hidden border border-gray-700 text-[10px]">
            {[
              { id: 'product', label: 'Product', disabled: !data?.has_product },
              { id: 'geo',     label: 'Geographic', disabled: !data?.has_geo },
            ].map(({ id, label, disabled }) => (
              <button
                key={id}
                onClick={() => !disabled && setSegType(id)}
                disabled={disabled}
                className={`px-2 py-0.5 transition-colors ${
                  segType === id
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : disabled
                      ? 'text-gray-700 cursor-not-allowed'
                      : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex rounded overflow-hidden border border-gray-700 text-[10px] ml-auto">
            {[
              { id: 'donut', label: 'Donut' },
              { id: 'trend', label: 'Trend' },
              { id: 'table', label: 'Table' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`px-2 py-0.5 transition-colors ${
                  view === id
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart / table area */}
        <div className="flex-1 overflow-hidden p-2">
          {error ? (
            <div className="flex items-center justify-center h-full text-red-400 text-xs">{error}</div>
          ) : !data || (!data.has_product && !data.has_geo) ? (
            <NoData msg="No segment data available for this symbol" />
          ) : (
            view === 'donut' ? renderDonut()
            : view === 'trend' ? renderTrend()
            : renderTable()
          )}
        </div>
      </div>
    </BaseWidget>
  );
}

function NoData({ msg = 'No data' }) {
  return (
    <div className="flex items-center justify-center h-full text-gray-600 text-xs">{msg}</div>
  );
}
