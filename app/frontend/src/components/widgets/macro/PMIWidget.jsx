/**
 * Business Cycle Widget
 * - Chicago Fed National Activity Index (CFNAI): >0 = expansion (85-indicator composite)
 * - OECD Composite Leading Indicator: >100 = above-trend
 * - Sahm Rule: >0.5 = recession signal
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Activity } from 'lucide-react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import BaseWidget from '../common/BaseWidget';
import WidgetTable from '../common/WidgetTable';
import { API_BASE } from '../../../config/api';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-[#1a1a1f] border border-gray-700 rounded px-3 py-2 shadow-lg text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {entry.value?.toFixed(3)}
        </p>
      ))}
    </div>
  );
};

const VIEWS       = ['cfnai', 'diff', 'sahm'];
const VIEW_LABELS = { cfnai: 'CFNAI', diff: 'Breadth', sahm: 'Sahm Rule' };

export default function PMIWidget({ onRemove }) {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [viewMode,   setViewMode]   = useState('chart');
  const [period,     setPeriod]     = useState('5y');
  const [activeView, setActiveView] = useState('cfnai');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/business-cycle/pmi?period=${period}`);
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('Business cycle fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { loadData(); }, [loadData]);

  const formatDate = (s) => {
    const d = new Date(s);
    return d.toLocaleDateString('en-US', { year: '2-digit', month: 'short' });
  };

  const chartConfig = {
    cfnai: {
      series: data?.cfnai?.series || [],
      ma3: data?.cfnai?.ma3 || [],
      threshold: 0,
      thresholdLabel: '0 (Expansion)',
      mainName: 'CFNAI',
      mainColor: '#f59e0b',
      gradientId: 'cfnaiGrad',
      gradientColor: '#f59e0b',
    },
    diff: {
      series: data?.diff?.series || [],
      ma3: [],
      threshold: 0,
      thresholdLabel: '0 (Majority Expanding)',
      mainName: 'CFNAI Breadth',
      mainColor: '#60a5fa',
      gradientId: 'diffGrad',
      gradientColor: '#60a5fa',
    },
    sahm: {
      series: data?.sahm?.series || [],
      ma3: [],
      threshold: 0.5,
      thresholdLabel: '0.5 (Recession)',
      mainName: 'Sahm Rule',
      mainColor: '#f87171',
      gradientId: 'sahmGrad',
      gradientColor: '#f87171',
    },
  };

  const cfg = chartConfig[activeView];

  const mergedSeries = useMemo(() => {
    if (activeView !== 'cfnai' || !cfg.ma3?.length) return cfg.series;
    const ma3Map = Object.fromEntries(cfg.ma3.map(d => [d.date, d.value]));
    return cfg.series.map(d => ({ ...d, ma3: ma3Map[d.date] ?? null }));
  }, [activeView, cfg.series, cfg.ma3]);

  const tableData = useMemo(() =>
    [...cfg.series].reverse().slice(0, 36).map((r, i) => ({ ...r, _key: i })),
    [cfg.series]
  );

  const tableColumns = useMemo(() => [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      sortValue: (row) => row.date,
      render: (row) => <span className="text-gray-300">{row.date}</span>,
    },
    {
      key: 'value',
      header: VIEW_LABELS[activeView],
      align: 'right',
      sortable: true,
      sortValue: (row) => row.value ?? -Infinity,
      exportValue: (row) => row.value?.toFixed(3) ?? '',
      render: (row) => {
        const expanding = activeView === 'sahm' ? row.value < 0.5 : row.value >= 0;
        return (
          <span className={`font-medium ${expanding ? 'text-green-400' : 'text-red-400'}`}>
            {row.value?.toFixed(3)}
          </span>
        );
      },
    },
    {
      key: '_signal',
      header: 'Signal',
      align: 'right',
      sortable: false,
      render: (row) => {
        const expanding = activeView === 'sahm' ? row.value < 0.5 : row.value >= 0;
        return (
          <span className={`text-[10px] ${expanding ? 'text-green-500' : 'text-red-500'}`}>
            {activeView === 'sahm'
              ? row.value >= 0.5 ? '⚠ Recession' : 'Normal'
              : expanding ? 'Expansion' : 'Contraction'}
          </span>
        );
      },
    },
  ], [activeView]);

  const renderChart = () => (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={mergedSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={cfg.gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={cfg.gradientColor} stopOpacity={0.2} />
            <stop offset="95%" stopColor={cfg.gradientColor} stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} />
        <YAxis
          domain={['auto', 'auto']}
          tick={{ fill: '#6b7280', fontSize: 10 }}
          axisLine={{ stroke: '#374151' }}
          tickFormatter={v => v.toFixed(2)}
          width={38}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine
          y={cfg.threshold}
          stroke="#6b7280"
          strokeDasharray="4 4"
          label={{ value: cfg.thresholdLabel, fill: '#6b7280', fontSize: 9, position: 'insideTopLeft' }}
        />
        {activeView === 'sahm' && (
          <ReferenceLine y={0.5} stroke="#ef4444" strokeDasharray="3 3" />
        )}
        <Area
          type="monotone"
          dataKey="value"
          name={cfg.mainName}
          stroke={cfg.mainColor}
          fill={`url(#${cfg.gradientId})`}
          strokeWidth={1.5}
          dot={false}
        />
        {activeView === 'cfnai' && (
          <Line
            type="monotone"
            dataKey="ma3"
            name="3M MA"
            stroke="#a78bfa"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );

  const latestCfnai = data?.cfnai?.latest;
  const isExpanding = latestCfnai ? latestCfnai.value >= 0 : null;
  const sahmSignal  = data?.sahm?.recession_signal;

  return (
    <BaseWidget
      title="Business Cycle Indicators"
      subtitle={
        latestCfnai
          ? `CFNAI ${latestCfnai.value.toFixed(3)} · ${isExpanding ? 'Expanding' : 'Contracting'}${sahmSignal ? ' · ⚠ Sahm Recession Signal' : ''}`
          : undefined
      }
      icon={Activity}
      iconColor={isExpanding ? 'text-green-400' : isExpanding === false ? 'text-red-400' : 'text-gray-400'}
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
      <div className="h-full flex flex-col">
        {/* Indicator selector */}
        <div className="flex gap-1 px-3 pt-1 pb-1">
          {VIEWS.map(v => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                activeView === v
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                  : 'border-gray-700 text-gray-500 hover:text-gray-300'
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
          <div className="ml-auto flex gap-3 text-[10px] items-center">
            {latestCfnai && (
              <span className={latestCfnai.value >= 0 ? 'text-green-400' : 'text-red-400'}>
                CFNAI {latestCfnai.value.toFixed(3)}
              </span>
            )}
            {data?.diff?.latest && (
              <span className={data.diff.latest.value >= 0 ? 'text-blue-400' : 'text-orange-400'}>
                Breadth {data.diff.latest.value.toFixed(2)}
              </span>
            )}
            {data?.sahm?.latest && (
              <span className={data.sahm.latest.value >= 0.5 ? 'text-red-400 font-medium' : 'text-gray-400'}>
                Sahm {data.sahm.latest.value.toFixed(2)}
              </span>
            )}
          </div>
        </div>
        <div className="px-3 pb-1">
          <p className="text-[9px] text-gray-600">{data?.[activeView === 'diff' ? 'diff' : activeView]?.description}</p>
        </div>
        <div className="flex-1 px-1 pb-2 min-h-0">
          {viewMode === 'chart' ? renderChart() : (
            <div className="h-full overflow-auto">
              <WidgetTable
                columns={tableColumns}
                data={tableData}
                resizable={true}
                size="compact"
                showExport={true}
                exportFilename="business-cycle"
                defaultSortKey="date"
                defaultSortDirection="desc"
              />
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
