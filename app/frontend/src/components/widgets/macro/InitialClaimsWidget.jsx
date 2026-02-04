/**
 * Initial Claims Widget - Shows weekly initial claims with 4-week MA
 * Uses BaseWidget for common functionality
 */
import { useState, useEffect, useCallback } from 'react';
import { Users } from 'lucide-react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
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
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}K
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function InitialClaimsWidget({ onRemove }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('chart');
  const [period, setPeriod] = useState('2y');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/overview/initial-claims?period=${period}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error('Error loading initial claims:', error);
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
              <th className="text-right py-2 px-3 text-gray-400 font-medium">Initial Claims</th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">4W MA</th>
            </tr>
          </thead>
          <tbody>
            {recentData.map((row, idx) => (
              <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-2 px-3 text-gray-300">{row.date}</td>
                <td className="py-2 px-3 text-right text-blue-400">{row.claims?.toLocaleString()}K</td>
                <td className="py-2 px-3 text-right text-red-400">{row.ma_4w?.toLocaleString()}K</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <BaseWidget
      title={data?.title || "Initial Claims"}
      subtitle={data?.subtitle}
      icon={Users}
      iconColor="text-cyan-400"
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
