/**
 * Jobs Breakdown Widget - Shows Private vs Government employment
 * Uses BaseWidget for common functionality
 */
import { useState, useEffect, useCallback } from 'react';
import { Briefcase } from 'lucide-react';
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
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
            {entry.name}: {typeof entry.value === 'number' ? (entry.value > 0 ? '+' : '') + (entry.value / 1000).toFixed(1) : entry.value}M
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function JobsBreakdownWidget({ onRemove }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('chart');
  const [period, setPeriod] = useState('5y');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/overview/jobs-breakdown?period=${period}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error('Error loading jobs breakdown:', error);
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
          <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} tickFormatter={(v) => `${v > 0 ? '+' : ''}${(v/1000).toFixed(0)}M`} />
          <Tooltip content={<CustomTooltip />} />
          <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: '10px' }} />
          <ReferenceLine y={0} stroke="#4b5563" strokeDasharray="3 3" />
          <Bar dataKey="government" fill="#f97316" name="Government" stackId="a" />
          <Bar dataKey="private" fill="#22c55e" name="Total Private" stackId="a" />
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
              <th className="text-right py-2 px-3 text-gray-400 font-medium">Private</th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">Government</th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {recentData.map((row, idx) => {
              const total = (row.private || 0) + (row.government || 0);
              return (
                <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 px-3 text-gray-300">{row.date}</td>
                  <td className={`py-2 px-3 text-right ${row.private >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {row.private > 0 ? '+' : ''}{(row.private / 1000).toFixed(1)}M
                  </td>
                  <td className={`py-2 px-3 text-right ${row.government >= 0 ? 'text-orange-400' : 'text-red-400'}`}>
                    {row.government > 0 ? '+' : ''}{(row.government / 1000).toFixed(1)}M
                  </td>
                  <td className={`py-2 px-3 text-right ${total >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                    {total > 0 ? '+' : ''}{(total / 1000).toFixed(1)}M
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <BaseWidget
      title={data?.title || "Jobs: Private vs Government"}
      subtitle={data?.subtitle}
      icon={Briefcase}
      iconColor="text-green-400"
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
