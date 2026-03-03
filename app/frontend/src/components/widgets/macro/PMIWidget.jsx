/**
 * Business Cycle Widget
 * - Chicago Fed National Activity Index (CFNAI): >0 = expansion (85-indicator composite)
 * - OECD Composite Leading Indicator: >100 = above-trend
 * - Sahm Rule: >0.5 = recession signal
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Activity } from 'lucide-react';
import CommonChart from '../../common/CommonChart';
import BaseWidget from '../common/BaseWidget';
import CommonTable from '../../common/CommonTable';
import { API_BASE } from '../../../config/api';

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
      renderFn: (value, row) => <span className="text-gray-300">{row.date}</span>,
    },
    {
      key: 'value',
      header: VIEW_LABELS[activeView],
      align: 'right',
      sortable: true,
      renderFn: (value, row) => {
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
      renderFn: (value, row) => {
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

  const renderChart = () => {
    const chartSeries = [{ key: 'value', name: cfg.mainName, color: cfg.mainColor }];
    if (activeView === 'cfnai') {
      chartSeries.push({ key: 'ma3', name: '3M MA', color: '#a78bfa' });
    }
    const refLines = [{ value: cfg.threshold, color: '#6b7280', label: cfg.thresholdLabel }];
    if (activeView === 'sahm') {
      refLines.push({ value: 0.5, color: '#ef4444', label: '0.5 Recession' });
    }
    return (
      <CommonChart
        data={mergedSeries}
        series={chartSeries}
        xKey="date"
        type="area"
        fillContainer={true}
        showTypeSelector={false}
        xFormatter={formatDate}
        yFormatter={(v) => Number(v).toFixed(2)}
        tooltipFormatter={(v) => Number(v).toFixed(3)}
        referenceLines={refLines}
      />
    );
  };

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
              <CommonTable
                columns={tableColumns}
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
