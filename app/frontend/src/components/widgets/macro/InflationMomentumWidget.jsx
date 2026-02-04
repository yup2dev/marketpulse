/**
 * Inflation Momentum Widget - Shows 12M, 6M, 3M inflation momentum
 * Uses BaseWidget for common functionality
 */
import { useState, useEffect, useCallback } from 'react';
import { Activity } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import BaseWidget from '../common/BaseWidget';
import { API_BASE } from '../../../config/api';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1f] border border-gray-700 rounded px-3 py-2 shadow-lg">
        <p className="text-gray-400 text-xs mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}%
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function InflationMomentumWidget({ onRemove }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('chart');
  const [period, setPeriod] = useState('3y');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/overview/inflation-momentum?period=${period}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error('Error loading inflation momentum:', error);
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
    if (!data?.history) return null;
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
  };

  const renderTable = () => {
    if (!data?.history) return null;
    const recentData = [...data.history].reverse().slice(0, 20);
    return (
      <div className="overflow-auto h-full">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0d0d12]">
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 px-3 text-gray-400 font-medium">Date</th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">12M</th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">6M</th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">3M</th>
            </tr>
          </thead>
          <tbody>
            {recentData.map((row, idx) => (
              <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-2 px-3 text-gray-300">{row.date}</td>
                <td className="py-2 px-3 text-right text-blue-400">{row.yoy_12m?.toFixed(2)}%</td>
                <td className="py-2 px-3 text-right text-orange-400">{row.yoy_6m?.toFixed(2)}%</td>
                <td className="py-2 px-3 text-right text-green-400">{row.yoy_3m?.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <BaseWidget
      title={data?.title || "Inflation Momentum"}
      subtitle={data?.subtitle}
      icon={Activity}
      iconColor="text-orange-400"
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
      <div className="h-full p-3">
        {viewMode === 'chart' ? renderChart() : renderTable()}
      </div>
    </BaseWidget>
  );
}
