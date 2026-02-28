/**
 * Yield Trends Widget - Historical yield trends with maturity multi-select
 * ComparisonAnalysis-style: maturity chips + sub-tabs (Yield Trends / Spreads)
 * Uses BaseWidget for common functionality
 */
import { useState, useEffect, useCallback } from 'react';
import { Activity, X } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import BaseWidget from '../common/BaseWidget';
import { API_BASE } from '../../../config/api';

const MATURITIES = [
  { key: '3m', label: '3M', color: '#ef4444' },
  { key: '6m', label: '6M', color: '#f97316' },
  { key: '1y', label: '1Y', color: '#eab308' },
  { key: '2y', label: '2Y', color: '#22c55e' },
  { key: '5y', label: '5Y', color: '#3b82f6' },
  { key: '10y', label: '10Y', color: '#8b5cf6' },
  { key: '30y', label: '30Y', color: '#ec4899' },
];

const DEFAULT_SELECTED = ['2y', '5y', '10y'];

const SPREAD_COLORS = { '2y10y': '#3b82f6', '3m10y': '#f97316' };

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1f] border border-gray-700 rounded px-3 py-2 shadow-lg">
        <p className="text-gray-400 text-xs mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}%
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function YieldTrendsWidget({ onRemove }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('chart');
  const [period, setPeriod] = useState('2y');
  const [selected, setSelected] = useState(DEFAULT_SELECTED);
  const [subTab, setSubTab] = useState('yields'); // 'yields' | 'spreads'

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/yield-curve/history?period=${period}`);
      if (res.ok) setData(await res.json());
    } catch (error) {
      console.error('Error loading yield curve history:', error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleMaturity = (key) => {
    setSelected(prev => {
      if (prev.includes(key)) {
        if (prev.length <= 1) return prev; // keep at least one
        return prev.filter(k => k !== key);
      }
      return [...prev, key];
    });
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: '2-digit', month: 'short' });
  };

  // Maturity chips for headerExtra
  const maturityChips = (
    <div className="flex items-center gap-1 flex-wrap" onMouseDown={(e) => e.stopPropagation()}>
      {MATURITIES.map(m => {
        const isActive = selected.includes(m.key);
        return (
          <button
            key={m.key}
            onClick={() => toggleMaturity(m.key)}
            className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${
              isActive
                ? 'text-white border'
                : 'text-gray-500 bg-gray-800/50 hover:text-gray-300'
            }`}
            style={isActive ? { backgroundColor: `${m.color}20`, borderColor: `${m.color}50`, color: m.color } : {}}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );

  const renderYieldsChart = () => {
    if (!data?.yields_history) return null;
    // Sample data for performance (max ~200 points)
    const history = data.yields_history;
    const step = Math.max(1, Math.floor(history.length / 200));
    const sampled = history.filter((_, i) => i % step === 0 || i === history.length - 1);

    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={sampled} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} tickFormatter={(v) => `${v}%`} />
          <Tooltip content={<CustomTooltip />} />
          {selected.map(key => {
            const m = MATURITIES.find(mat => mat.key === key);
            if (!m) return null;
            return (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={m.color}
                strokeWidth={1.5}
                dot={false}
                name={m.label}
                connectNulls
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderSpreadsChart = () => {
    if (!data?.spreads_history) return null;
    const history = data.spreads_history;
    const step = Math.max(1, Math.floor(history.length / 200));
    const sampled = history.filter((_, i) => i % step === 0 || i === history.length - 1);

    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={sampled} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} tickFormatter={(v) => `${v}%`} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#4b5563" strokeDasharray="3 3" />
          <Line type="monotone" dataKey="2y10y" stroke={SPREAD_COLORS['2y10y']} strokeWidth={1.5} dot={false} name="2Y-10Y" connectNulls />
          <Line type="monotone" dataKey="3m10y" stroke={SPREAD_COLORS['3m10y']} strokeWidth={1.5} dot={false} name="3M-10Y" connectNulls />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderYieldsTable = () => {
    if (!data?.yields_history) return null;
    const recentData = [...data.yields_history].reverse().slice(0, 30);
    return (
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-[#0d0d12]">
          <tr className="border-b border-gray-800">
            <th className="text-left py-2 px-3 text-gray-400 font-medium">Date</th>
            {selected.map(key => {
              const m = MATURITIES.find(mat => mat.key === key);
              return <th key={key} className="text-right py-2 px-3 font-medium" style={{ color: m?.color || '#6b7280' }}>{m?.label || key}</th>;
            })}
          </tr>
        </thead>
        <tbody>
          {recentData.map((row, idx) => (
            <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
              <td className="py-2 px-3 text-gray-300">{row.date}</td>
              {selected.map(key => (
                <td key={key} className="py-2 px-3 text-right text-white tabular-nums">
                  {row[key] != null ? `${row[key].toFixed(2)}%` : '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderSpreadsTable = () => {
    if (!data?.spreads_history) return null;
    const recentData = [...data.spreads_history].reverse().slice(0, 30);
    return (
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-[#0d0d12]">
          <tr className="border-b border-gray-800">
            <th className="text-left py-2 px-3 text-gray-400 font-medium">Date</th>
            <th className="text-right py-2 px-3 font-medium" style={{ color: SPREAD_COLORS['2y10y'] }}>2Y-10Y</th>
            <th className="text-right py-2 px-3 font-medium" style={{ color: SPREAD_COLORS['3m10y'] }}>3M-10Y</th>
          </tr>
        </thead>
        <tbody>
          {recentData.map((row, idx) => (
            <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
              <td className="py-2 px-3 text-gray-300">{row.date}</td>
              <td className={`py-2 px-3 text-right tabular-nums ${(row['2y10y'] || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {row['2y10y'] != null ? `${row['2y10y'].toFixed(2)}%` : '-'}
              </td>
              <td className={`py-2 px-3 text-right tabular-nums ${(row['3m10y'] || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {row['3m10y'] != null ? `${row['3m10y'].toFixed(2)}%` : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderContent = () => {
    const isYields = subTab === 'yields';
    if (viewMode === 'chart') {
      return isYields ? renderYieldsChart() : renderSpreadsChart();
    }
    return isYields ? renderYieldsTable() : renderSpreadsTable();
  };

  // Export data builder
  const getExportData = () => {
    const isYields = subTab === 'yields';
    if (isYields && data?.yields_history) {
      const history = data.yields_history;
      const activeMaturities = MATURITIES.filter(m => selected.includes(m.key));
      return {
        columns: [
          { key: 'date', header: 'Date' },
          ...activeMaturities.map(m => ({ key: m.key, header: `${m.label} Yield (%)`, exportValue: r => r[m.key]?.toFixed(3) ?? '' })),
        ],
        rows: history,
      };
    }
    if (!isYields && data?.spreads_history) {
      return {
        columns: [
          { key: 'date',    header: 'Date' },
          { key: '2y10y',   header: '2Y-10Y Spread (%)', exportValue: r => r['2y10y']?.toFixed(3) ?? '' },
          { key: '3m10y',   header: '3M-10Y Spread (%)', exportValue: r => r['3m10y']?.toFixed(3) ?? '' },
        ],
        rows: data.spreads_history,
      };
    }
    return { columns: [], rows: [] };
  };

  return (
    <BaseWidget
      title="Yield Trends"
      icon={Activity}
      iconColor="text-purple-400"
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      period={period}
      onPeriodChange={setPeriod}
      periodType="macro"
      headerExtra={subTab === 'yields' ? maturityChips : null}
      source="FRED / U.S. Treasury"
      exportData={data ? getExportData : undefined}
    >
      <div className="h-full flex flex-col">
        {/* Sub-tabs */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-800 flex-shrink-0">
          {[
            { id: 'yields', label: 'Yield Trends' },
            { id: 'spreads', label: 'Spreads' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded transition-colors ${
                subTab === tab.id
                  ? 'text-cyan-400 bg-cyan-400/10'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {/* Content area */}
        <div className="flex-1 min-h-0 p-3">
          {viewMode === 'chart' ? (
            <div className="h-full">{renderContent()}</div>
          ) : (
            <div className="overflow-auto h-full">{renderContent()}</div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
