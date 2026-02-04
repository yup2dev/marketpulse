/**
 * EarningsWidget - Displays quarterly earnings data using BaseWidget
 */
import { useState, useEffect, useCallback } from 'react';
import { Calendar, TrendingUp, TrendingDown, BarChart2, Table } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import BaseWidget from './common/BaseWidget';
import { formatNumber, formatPrice, API_BASE } from './common';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1f] border border-gray-700 rounded px-3 py-2 shadow-lg">
        <p className="text-gray-400 text-xs mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: ${entry.value?.toFixed(2)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const EarningsWidget = ({ symbol, onRemove }) => {
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('table');

  const loadData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/earnings/${symbol}`);
      if (res.ok) setEarnings(await res.json());
    } catch (error) {
      console.error('Error loading earnings:', error);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getSurpriseBadge = (surprise) => {
    if (surprise === null || surprise === undefined) return null;
    const isPositive = surprise > 0;
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
        isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
      }`}>
        {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        {isPositive ? '+' : ''}{surprise?.toFixed(2)}%
      </span>
    );
  };

  const getChartData = () => {
    if (!earnings?.earnings) return [];
    return earnings.earnings.slice(0, 8).reverse().map(item => ({
      period: item.fiscal_period || `Q${item.fiscal_quarter} ${item.fiscal_year}`,
      actual: item.eps_actual,
      estimated: item.eps_estimated,
    }));
  };

  const renderChart = () => {
    const chartData = getChartData();
    if (chartData.length === 0) return <div className="flex items-center justify-center h-full text-gray-500">No data</div>;

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="period" tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={{ stroke: '#374151' }} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={{ stroke: '#374151' }} tickFormatter={(v) => `$${v}`} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '10px' }} />
          <ReferenceLine y={0} stroke="#4b5563" />
          <Bar dataKey="estimated" fill="#6b7280" name="Estimated" />
          <Bar dataKey="actual" fill="#22c55e" name="Actual" />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderTable = () => {
    if (!earnings?.earnings?.length) return <div className="flex items-center justify-center h-full text-gray-500">No data</div>;

    return (
      <div className="overflow-auto h-full">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0d0d12]">
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 px-2 text-gray-400 font-medium">Period</th>
              <th className="text-right py-2 px-2 text-gray-400 font-medium">Actual</th>
              <th className="text-right py-2 px-2 text-gray-400 font-medium">Est.</th>
              <th className="text-right py-2 px-2 text-gray-400 font-medium">Surprise</th>
            </tr>
          </thead>
          <tbody>
            {earnings.earnings.slice(0, 8).map((item, idx) => (
              <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-2 px-2">
                  <div className="text-white text-xs font-medium">{item.fiscal_period || `Q${item.fiscal_quarter}`}</div>
                  <div className="text-[10px] text-gray-500">{item.fiscal_year}</div>
                </td>
                <td className="text-right py-2 px-2 text-white font-medium">
                  {item.eps_actual !== null ? formatPrice(item.eps_actual) : 'N/A'}
                </td>
                <td className="text-right py-2 px-2 text-gray-400">
                  {item.eps_estimated !== null ? formatPrice(item.eps_estimated) : 'N/A'}
                </td>
                <td className="text-right py-2 px-2">{getSurpriseBadge(item.eps_surprise_percent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <BaseWidget
      title={`${symbol} - Earnings`}
      icon={Calendar}
      iconColor="text-amber-400"
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showPeriodSelector={false}
    >
      <div className="h-full p-3">
        {viewMode === 'chart' ? renderChart() : renderTable()}
      </div>
    </BaseWidget>
  );
};

export default EarningsWidget;
