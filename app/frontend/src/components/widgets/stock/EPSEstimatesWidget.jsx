/**
 * EPS Estimates Widget - Earnings per share estimates
 */
import { useState, useEffect, useCallback } from 'react';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import BaseWidget from '../common/BaseWidget';
import { API_BASE } from '../../../config/api';

export default function EPSEstimatesWidget({ symbol, onRemove }) {
  const [epsEstimates, setEpsEstimates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('table');

  const loadData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/estimates/${symbol}`);
      if (res.ok) {
        const data = await res.json();
        setEpsEstimates(data.eps);
      }
    } catch (error) {
      console.error('Error loading EPS estimates:', error);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getChartData = () => {
    if (!epsEstimates) return [];
    return Object.entries(epsEstimates).slice(0, 6).map(([period, data]) => ({
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
          <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} tickFormatter={(v) => `$${v}`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1f', border: '1px solid #374151', borderRadius: '8px' }}
            formatter={(v, name) => [name === 'estimate' ? `$${v?.toFixed(2)}` : `${v?.toFixed(1)}%`, name === 'estimate' ? 'EPS' : 'Growth']}
          />
          <Bar dataKey="estimate" fill="#22c55e" name="EPS Estimate" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderTable = () => {
    if (!epsEstimates || Object.keys(epsEstimates).length === 0) {
      return <div className="flex items-center justify-center h-full text-gray-500">No EPS estimates available</div>;
    }

    return (
      <div className="h-full overflow-auto">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(epsEstimates).slice(0, 6).map(([period, data]) => (
            <div key={period} className="bg-gray-800/30 rounded p-2">
              <div className="text-gray-400 text-[10px] mb-1">{period}</div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-white">${data.estimate?.toFixed(2) || '-'}</span>
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
      title={`${symbol} - EPS Estimates`}
      icon={DollarSign}
      iconColor="text-green-400"
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
