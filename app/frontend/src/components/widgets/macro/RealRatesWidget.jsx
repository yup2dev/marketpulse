/**
 * Real Rates Widget - TIPS Yields vs Nominal vs Breakeven Inflation
 * Real rates are the most important price in markets:
 *  Rising real rates → headwind for gold, equities, crypto
 *  Falling real rates → tailwind for risk assets
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import CommonChart from '../../common/CommonChart';
import BaseWidget from '../common/BaseWidget';
import CommonTable from '../../common/CommonTable';
import { API_BASE } from '../../../config/api';

const SERIES_CONFIG = [
  { key: 'nominal_10y',   name: '10Y Nominal',        color: '#60a5fa', dashed: false },
  { key: 'real_10y',      name: '10Y Real (TIPS)',     color: '#f59e0b', dashed: false },
  { key: 'breakeven_10y', name: '10Y Breakeven',       color: '#a78bfa', dashed: true  },
  { key: 'nominal_5y',    name: '5Y Nominal',          color: '#34d399', dashed: true  },
  { key: 'real_5y',       name: '5Y Real (TIPS)',      color: '#fb923c', dashed: true  },
];

const TABLE_COLUMNS = [
  {
    key: 'date',
    header: 'Date',
    sortable: true,
    renderFn: (value, row) => <span className="text-gray-300">{row.date}</span>,
  },
  {
    key: 'nominal_10y',
    header: '10Y Nom.',
    align: 'right',
    sortable: true,
    renderFn: (value, row) => (
      <span className="text-blue-400">{row.nominal_10y?.toFixed(3) ?? '-'}%</span>
    ),
  },
  {
    key: 'real_10y',
    header: '10Y Real',
    align: 'right',
    sortable: true,
    renderFn: (value, row) => (
      <span className={`font-medium ${(row.real_10y ?? 0) >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
        {row.real_10y?.toFixed(3) ?? '-'}%
      </span>
    ),
  },
  {
    key: 'breakeven_10y',
    header: '10Y BEI',
    align: 'right',
    sortable: true,
    renderFn: (value, row) => (
      <span className="text-violet-400">{row.breakeven_10y?.toFixed(3) ?? '-'}%</span>
    ),
  },
  {
    key: 'real_5y',
    header: '5Y Real',
    align: 'right',
    sortable: true,
    renderFn: (value, row) => (
      <span className={`${(row.real_5y ?? 0) >= 0 ? 'text-amber-300' : 'text-red-300'}`}>
        {row.real_5y?.toFixed(3) ?? '-'}%
      </span>
    ),
  },
];

export default function RealRatesWidget({ onRemove }) {
  const [data,          setData]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [viewMode,      setViewMode]      = useState('chart');
  const [period,        setPeriod]        = useState('5y');
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

  const latest    = data?.latest || {};
  const real10y   = latest.real_10y;
  const isPositive = real10y !== undefined && real10y > 0;

  const toggleSeries = (key) => {
    setVisibleSeries(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const tableData = useMemo(() =>
    [...(data?.history || [])].reverse().slice(0, 60).map((r, i) => ({ ...r, _key: i })),
    [data]
  );

  const renderChart = () => {
    const history = data?.history || [];
    const activeSeries = SERIES_CONFIG
      .filter(s => visibleSeries.includes(s.key))
      .map(s => ({ key: s.key, name: s.name, color: s.color }));
    return (
      <div className="h-full flex flex-col">
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
          <CommonChart
            data={history}
            series={activeSeries}
            xKey="date"
            type="line"
            fillContainer={true}
            showTypeSelector={false}
            xFormatter={formatDate}
            yFormatter={(v) => `${Number(v).toFixed(1)}%`}
            tooltipFormatter={(v) => `${Number(v).toFixed(3)}%`}
            referenceLines={[{ value: 0, color: '#6b7280', label: '0%' }]}
          />
        </div>
      </div>
    );
  };

  const subtitleParts = [];
  if (real10y !== undefined) {
    subtitleParts.push(`10Y Real: ${real10y >= 0 ? '+' : ''}${real10y.toFixed(3)}%`);
    subtitleParts.push(isPositive ? 'Restrictive' : 'Accommodative');
  }
  if (data?.['52w_high'] != null) {
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
              { label: '10Y Nominal',   val: latest.nominal_10y,   color: '#60a5fa' },
              { label: '10Y Real',      val: latest.real_10y,      color: '#f59e0b' },
              { label: '10Y Breakeven', val: latest.breakeven_10y, color: '#a78bfa' },
              { label: '5Y Real',       val: latest.real_5y,       color: '#fb923c' },
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
        <div className="flex-1 min-h-0">
          {viewMode === 'chart' ? renderChart() : (
            <div className="h-full overflow-auto">
              <CommonTable
                columns={TABLE_COLUMNS}
                data={tableData}
                compact={true}
                searchable={false}
                exportable={true}
                pageSize={20}
              />
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
