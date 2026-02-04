/**
 * MacroChartWidget - Reusable chart widget for macro data
 * Supports multiple chart types: GDP, Inflation, Claims, Jobs
 */
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, X, GripVertical } from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, ComposedChart
} from 'recharts';
import { API_BASE } from '../../../config/api';

// Custom tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1f] border border-gray-700 rounded px-3 py-2 shadow-lg">
        <p className="text-gray-400 text-xs mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Chart type configurations
const CHART_CONFIGS = {
  'gdp-forecast': {
    endpoint: '/macro/overview/gdp-forecast',
    defaultPeriod: '1y',
    title: 'Evolution of Latest GDP Forecast',
  },
  'inflation-momentum': {
    endpoint: '/macro/overview/inflation-momentum',
    defaultPeriod: '3y',
    title: 'Inflation Momentum',
  },
  'initial-claims': {
    endpoint: '/macro/overview/initial-claims',
    defaultPeriod: '2y',
    title: 'Initial Claims',
  },
  'jobs-breakdown': {
    endpoint: '/macro/overview/jobs-breakdown',
    defaultPeriod: '5y',
    title: 'Jobs: Private vs Government',
  },
};

export default function MacroChartWidget({ chartType = 'gdp-forecast', onRemove }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(CHART_CONFIGS[chartType]?.defaultPeriod || '1y');
  const [startDate, setStartDate] = useState('2020-03-01');

  const config = CHART_CONFIGS[chartType] || CHART_CONFIGS['gdp-forecast'];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}${config.endpoint}?period=${period}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error(`Error loading ${chartType}:`, error);
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, period, chartType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: '2-digit', month: 'short' });
  };

  const renderChart = () => {
    if (!data?.history) return null;

    switch (chartType) {
      case 'gdp-forecast':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gdpGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} tickFormatter={(v) => `${v.toFixed(1)}%`} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#4b5563" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="url(#gdpGradient)" strokeWidth={2} name="GDP Growth" />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'inflation-momentum':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: '10px' }} />
              <ReferenceLine y={data.fed_target || 2} stroke="#6b7280" strokeDasharray="5 5" label={{ value: 'FED AIT', position: 'left', fill: '#6b7280', fontSize: 10 }} />
              <Line type="monotone" dataKey="yoy_12m" stroke="#3b82f6" strokeWidth={2} dot={false} name="12M" />
              <Line type="monotone" dataKey="yoy_6m" stroke="#f97316" strokeWidth={2} dot={false} name="6M" />
              <Line type="monotone" dataKey="yoy_3m" stroke="#22c55e" strokeWidth={2} dot={false} name="3M" />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'initial-claims':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} tickFormatter={(v) => `${v}K`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: '10px' }} />
              <Area type="monotone" dataKey="claims" fill="#3b82f620" stroke="#3b82f6" strokeWidth={1} name="Initial Claims" />
              <Line type="monotone" dataKey="ma_4w" stroke="#ef4444" strokeWidth={2} dot={false} name="4 Week MA" />
            </ComposedChart>
          </ResponsiveContainer>
        );

      case 'jobs-breakdown':
        const filteredData = data.history?.filter(d => d.date >= startDate) || [];
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
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} tickFormatter={(v) => `${v > 0 ? '+' : ''}${(v/1000).toFixed(0)}M`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: '10px' }} />
                  <ReferenceLine y={0} stroke="#4b5563" strokeDasharray="3 3" />
                  <Bar dataKey="government" fill="#f97316" name="Government" stackId="a" />
                  <Bar dataKey="private" fill="#22c55e" name="Total Private" stackId="a" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      default:
        return <div className="text-gray-500 text-center">Unknown chart type</div>;
    }
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
