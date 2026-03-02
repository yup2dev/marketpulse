/**
 * EconomicMoatWidget - 10-year moat metrics chart + table
 */
import { useState, useEffect, useCallback } from 'react';
import { Shield } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import WidgetTable from './common/WidgetTable';
import { API_BASE } from './constants';

const MOAT_COLOR = {
  Wide:   'text-cyan-400',
  Narrow: 'text-yellow-400',
  None:   'text-gray-400',
};

const METRIC_BARS = [
  { key: 'roe',          label: 'ROE',         color: '#22d3ee', textClass: 'text-cyan-400' },
  { key: 'roic',         label: 'ROIC',        color: '#a78bfa', textClass: 'text-violet-400' },
  { key: 'gross_margin', label: 'Gross Margin', color: '#60a5fa', textClass: 'text-blue-400' },
  { key: 'op_margin',    label: 'Op Margin',   color: '#4ade80', textClass: 'text-green-400' },
  { key: 'net_margin',   label: 'Net Margin',  color: '#facc15', textClass: 'text-yellow-400' },
  { key: 'fcf_margin',   label: 'FCF Margin',  color: '#fb923c', textClass: 'text-orange-400' },
];

const TABLE_COLUMNS = [
  { key: 'year',        header: 'Year',       sortable: true },
  { key: 'roe',         header: 'ROE %',      sortable: true, render: r => r.roe != null ? `${r.roe}%` : '—', align: 'right' },
  { key: 'roic',        header: 'ROIC %',     sortable: true, render: r => r.roic != null ? `${r.roic}%` : '—', align: 'right' },
  { key: 'gross_margin',header: 'Gross %',    sortable: true, render: r => r.gross_margin != null ? `${r.gross_margin}%` : '—', align: 'right' },
  { key: 'op_margin',   header: 'Op %',       sortable: true, render: r => r.op_margin != null ? `${r.op_margin}%` : '—', align: 'right' },
  { key: 'net_margin',  header: 'Net %',      sortable: true, render: r => r.net_margin != null ? `${r.net_margin}%` : '—', align: 'right' },
  { key: 'fcf_margin',  header: 'FCF %',      sortable: true, render: r => r.fcf_margin != null ? `${r.fcf_margin}%` : '—', align: 'right' },
];

export default function EconomicMoatWidget({ symbol, onRemove }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('chart');

  const load = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/moat/${symbol}`);
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('EconomicMoatWidget error:', e);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { load(); }, [load]);

  const history = data?.history || [];
  const moatType = data?.moat_type || 'None';
  const moatScore = data?.moat_score ?? 0;

  const renderMetricBars = (rows) => {
    if (rows.length === 0) return <div className="text-center text-gray-500 text-xs py-8">No data available</div>;
    const latest = rows[rows.length - 1];
    const bars = METRIC_BARS.map(m => ({ ...m, value: latest[m.key] ?? null })).filter(m => m.value != null);
    const maxVal = Math.max(...bars.map(b => Math.abs(b.value)), 1);
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-around mb-1">
          {bars.map(b => (
            <span key={b.key} className={`text-[9px] font-medium tabular-nums flex-1 text-center ${b.textClass}`}>
              {b.value}%
            </span>
          ))}
        </div>
        <div className="flex-1 flex items-end justify-around gap-1.5 min-h-0">
          {bars.map(b => (
            <div key={b.key} className="flex-1 flex justify-center items-end h-full">
              <div
                className="w-full max-w-[32px] rounded-t transition-all duration-700"
                style={{ height: `${Math.max(0, b.value) / maxVal * 100}%`, backgroundColor: b.color, minHeight: b.value > 0 ? '3px' : 0 }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-around border-t border-gray-800 pt-1.5 mt-1">
          {bars.map(b => (
            <span key={b.key} className="text-[9px] text-gray-500 text-center flex-1 leading-tight">{b.label}</span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <BaseWidget
      title="Economic Moat"
      icon={Shield}
      iconColor="text-cyan-400"
      loading={loading}
      onRefresh={load}
      onRemove={onRemove}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showViewToggle
      showPeriodSelector={false}
      source="Yahoo Finance"
    >
      {/* Moat stats — plain text, no boxes */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800 text-xs">
        <span className={`font-semibold ${MOAT_COLOR[moatType] || MOAT_COLOR.None}`}>{moatType} Moat</span>
        <span className="text-gray-500">Score: <span className="text-white font-medium tabular-nums">{moatScore}/100</span></span>
        <span className="ml-auto text-gray-600">ROE consistency · 10 years</span>
      </div>

      <div className="flex-1 min-h-0 p-3">
        {viewMode === 'chart' ? renderMetricBars(history) : (
          history.length > 0
            ? <WidgetTable columns={TABLE_COLUMNS} rows={history} resizable />
            : <div className="text-center text-gray-500 text-xs py-8">No data available</div>
        )}
      </div>
    </BaseWidget>
  );
}
