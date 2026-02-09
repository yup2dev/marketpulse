/**
 * Revenue Estimates Widget - Revenue forecasts
 */
import { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import BaseWidget from '../common/BaseWidget';
import { API_BASE } from '../../../config/api';

const formatCurrency = (value) => {
  if (!value) return '-';
  if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
};

export default function RevenueEstimatesWidget({ symbol: initialSymbol = 'AAPL', onRemove }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [revenueEstimates, setRevenueEstimates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('table');

  useEffect(() => {
    setSymbol(initialSymbol);
  }, [initialSymbol]);

  const loadData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/estimates/${symbol}`);
      if (res.ok) {
        const data = await res.json();
        setRevenueEstimates(data.revenue);
      }
    } catch (error) {
      console.error('Error loading revenue estimates:', error);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getChartData = () => {
    if (!revenueEstimates) return [];
    return Object.entries(revenueEstimates).slice(0, 6).map(([period, data]) => ({
      period,
      estimate: data.estimate,
      growth: data.growth ? (data.growth * 100) : 0,
    }));
  };

  const renderChart = () => {
    const chartData = getChartData();
    if (chartData.length === 0) return <div className="flex items-center justify-center h-full text-gray-500">No data</div>;

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="period" tick={{ fill: '#6b7280', fontSize: 9 }} angle={-45} textAnchor="end" height={50} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} tickFormatter={(v) => formatCurrency(v)} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1f', border: '1px solid #374151', borderRadius: '8px' }}
            formatter={(v, name) => [name === 'estimate' ? formatCurrency(v) : `${v?.toFixed(1)}%`, name === 'estimate' ? 'Revenue' : 'Growth']}
          />
          <Bar dataKey="estimate" fill="#3b82f6" name="Revenue" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderTable = () => {
    if (!revenueEstimates || Object.keys(revenueEstimates).length === 0) {
      return <div className="flex items-center justify-center h-full text-gray-500">No revenue estimates available</div>;
    }

    return (
      <div className="h-full overflow-auto">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(revenueEstimates).slice(0, 6).map(([period, data]) => (
            <div key={period} className="bg-gray-800/30 rounded p-2">
              <div className="text-gray-400 text-[10px] mb-1">{period}</div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-white">{formatCurrency(data.estimate)}</span>
                {data.growth !== undefined && data.growth !== null && (
                  <span className={`text-[10px] flex items-center gap-0.5 ${data.growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {data.growth >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {data.growth >= 0 ? '+' : ''}{(data.growth * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <BaseWidget
      title="Revenue Est."
      icon={BarChart3}
      iconColor="text-blue-400"
      symbol={symbol}
      onSymbolChange={setSymbol}
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
}
