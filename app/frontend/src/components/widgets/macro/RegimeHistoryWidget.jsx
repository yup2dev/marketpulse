/**
 * Regime History Widget - Score history chart with table view
 */
import { useState, useEffect, useCallback } from 'react';
import { History } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import BaseWidget from '../common/BaseWidget';
import { API_BASE } from '../../../config/api';

const REGIME_COLORS = {
  goldilocks: '#22c55e',
  reflation: '#facc15',
  stagflation: '#ef4444',
  deflation: '#3b82f6'
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1f] border border-gray-700 rounded px-3 py-2 shadow-lg">
        <p className="text-gray-400 text-xs mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value?.toFixed(1)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function RegimeHistoryWidget({ onRemove }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('chart');
  const [period, setPeriod] = useState('3y');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/regime/history?period=${period}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error('Error loading regime history:', error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: '2-digit', month: 'short' });
  };

  const renderChart = () => {
    if (!data?.history?.length) {
      return (
        <div className="h-full flex items-center justify-center text-gray-500 text-sm">
          No history data
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={{ stroke: '#374151' }}
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={{ stroke: '#374151' }}
            domain={[-50, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '10px' }} />
          <ReferenceLine y={0} stroke="#4b5563" strokeDasharray="3 3" />
          <ReferenceLine y={50} stroke="#4b5563" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="growth_score"
            name="Growth"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="inflation_score"
            name="Inflation"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderTable = () => {
    if (!data?.history?.length) {
      return (
        <div className="h-full flex items-center justify-center text-gray-500 text-sm">
          No history data
        </div>
      );
    }

    const recentData = [...data.history].reverse().slice(0, 20);

    return (
      <div className="overflow-auto h-full">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0d0d12]">
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 px-3 text-gray-400 font-medium">Date</th>
              <th className="text-center py-2 px-3 text-gray-400 font-medium">Regime</th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">Growth</th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">Inflation</th>
            </tr>
          </thead>
          <tbody>
            {recentData.map((row, idx) => (
              <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-2 px-3 text-gray-300">{formatDate(row.date)}</td>
                <td className="py-2 px-3 text-center">
                  <span
                    className="px-2 py-0.5 rounded text-xs capitalize"
                    style={{
                      backgroundColor: `${REGIME_COLORS[row.regime]}20`,
                      color: REGIME_COLORS[row.regime]
                    }}
                  >
                    {row.regime}
                  </span>
                </td>
                <td className={`py-2 px-3 text-right ${row.growth_score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {row.growth_score?.toFixed(1)}
                </td>
                <td className={`py-2 px-3 text-right ${row.inflation_score >= 50 ? 'text-red-400' : 'text-green-400'}`}>
                  {row.inflation_score?.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <BaseWidget
      title="Score History"
      icon={History}
      iconColor="text-blue-400"
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      period={period}
      onPeriodChange={setPeriod}
      periodType="macro"
      source="FRED"
    >
      <div className="h-full p-3">
        {viewMode === 'chart' ? renderChart() : renderTable()}
      </div>
    </BaseWidget>
  );
}
