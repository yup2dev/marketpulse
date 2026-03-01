/**
 * MacroChartWidget - Reusable chart widget for macro data
 * Supports multiple chart types: GDP, Inflation, Claims, Jobs
 * Chart display type (line/area/bar) is user-switchable via CommonChart's selector.
 */
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, X, GripVertical } from 'lucide-react';
import CommonChart from '../../common/CommonChart';
import { API_BASE } from '../../../config/api';

const CHART_CONFIGS = {
  'gdp-forecast': {
    endpoint: '/macro/overview/gdp-forecast',
    defaultPeriod: '1y',
    title: 'Evolution of Latest GDP Forecast',
    defaultDisplayType: 'area',
    series: [{ key: 'value', name: 'GDP Growth', color: '#3b82f6' }],
  },
  'inflation-momentum': {
    endpoint: '/macro/overview/inflation-momentum',
    defaultPeriod: '3y',
    title: 'Inflation Momentum',
    defaultDisplayType: 'line',
    series: [
      { key: 'yoy_12m', name: '12M',  color: '#3b82f6' },
      { key: 'yoy_6m',  name: '6M',   color: '#f97316' },
      { key: 'yoy_3m',  name: '3M',   color: '#22c55e' },
    ],
  },
  'initial-claims': {
    endpoint: '/macro/overview/initial-claims',
    defaultPeriod: '2y',
    title: 'Initial Claims',
    defaultDisplayType: 'area',
    series: [
      { key: 'claims', name: 'Initial Claims', color: '#3b82f6' },
      { key: 'ma_4w',  name: '4 Week MA',      color: '#ef4444' },
    ],
  },
  'jobs-breakdown': {
    endpoint: '/macro/overview/jobs-breakdown',
    defaultPeriod: '5y',
    title: 'Jobs: Private vs Government',
    defaultDisplayType: 'bar',
    series: [
      { key: 'government', name: 'Government',   color: '#f97316' },
      { key: 'private',    name: 'Total Private', color: '#22c55e' },
    ],
  },
};

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: '2-digit', month: 'short' });
};

export default function MacroChartWidget({ chartType = 'gdp-forecast', onRemove }) {
  const config = CHART_CONFIGS[chartType] || CHART_CONFIGS['gdp-forecast'];

  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [period,      setPeriod]      = useState(config.defaultPeriod);
  const [displayType, setDisplayType] = useState(config.defaultDisplayType);
  const [startDate,   setStartDate]   = useState('2020-03-01');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}${config.endpoint}?period=${period}`);
      if (res.ok) setData(await res.json());
    } catch (error) {
      console.error(`Error loading ${chartType}:`, error);
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, period, chartType]);

  useEffect(() => { loadData(); }, [loadData]);

  const getChartData = () => {
    if (!data?.history) return [];
    if (chartType === 'jobs-breakdown') {
      return data.history.filter(d => d.date >= startDate);
    }
    return data.history;
  };

  const renderChart = () => {
    const chartData = getChartData();

    if (chartType === 'jobs-breakdown') {
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="text-xs text-gray-500">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white"
            />
          </div>
          <div className="flex-1 min-h-0">
            <CommonChart
              data={chartData}
              series={config.series}
              xKey="date"
              type={displayType}
              onTypeChange={setDisplayType}
              fillContainer={true}
              showTypeSelector={true}
              allowedTypes={['line', 'area', 'bar', 'stackedBar']}
              xFormatter={formatDate}
            />
          </div>
        </div>
      );
    }

    return (
      <CommonChart
        data={chartData}
        series={config.series}
        xKey="date"
        type={displayType}
        onTypeChange={setDisplayType}
        fillContainer={true}
        showTypeSelector={true}
        allowedTypes={['line', 'area', 'bar']}
        xFormatter={formatDate}
        yFormatter={
          chartType === 'initial-claims'
            ? (v) => `${v}K`
            : chartType === 'inflation-momentum'
            ? (v) => `${v.toFixed(0)}%`
            : undefined
        }
      />
    );
  };

  return (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-[#0d0d12]">
        <div className="flex items-center gap-2 cursor-move drag-handle flex-1">
          <GripVertical size={14} className="text-gray-600" />
          <div>
            <span className="text-sm font-medium text-white">{data?.title || config.title}</span>
            {data?.subtitle && <span className="text-xs text-gray-500 ml-2">{data.subtitle}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={loadData}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {onRemove && (
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-3 min-h-0">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          renderChart()
        )}
      </div>

      {/* Footer */}
      {data?.source && (
        <div className="px-3 py-1.5 border-t border-gray-800">
          <p className="text-[10px] text-gray-600">Source: {data.source}</p>
        </div>
      )}
    </div>
  );
}
