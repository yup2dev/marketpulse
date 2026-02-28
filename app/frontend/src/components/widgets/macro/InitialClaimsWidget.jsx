/**
 * Initial Claims Widget - Shows weekly initial claims with 4-week MA
 * Uses BaseWidget for common functionality
 */
import { useState, useEffect, useCallback } from 'react';
import { Users } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import LWChart from '../common/LWChart';
import { API_BASE } from '../../../config/api';

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

  const renderChart = () => {
    if (!data?.history) return null;
    const history = data.history.filter(d => d.date);
    const multiSeries = [
      {
        name: 'Initial Claims',
        data: history.filter(d => d.claims != null).map(d => ({ time: d.date, value: d.claims })),
        type: 'area',
        color: '#3b82f6',
        topColor: '#3b82f620',
        bottomColor: '#3b82f605',
        lineWidth: 1,
      },
      {
        name: '4 Week MA',
        data: history.filter(d => d.ma_4w != null).map(d => ({ time: d.date, value: d.ma_4w })),
        type: 'line',
        color: '#ef4444',
        lineWidth: 2,
      },
    ];
    return (
      <LWChart
        multiSeries={multiSeries}
        formatter={v => `${v.toFixed(1)}K`}
      />
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

  const getExportData = () => ({
    columns: [
      { key: 'date',   header: 'Date'                    },
      { key: 'claims', header: 'Initial Claims (K)', exportValue: r => r.claims?.toFixed(1) ?? '' },
      { key: 'ma_4w',  header: '4 Week MA (K)',      exportValue: r => r.ma_4w?.toFixed(1) ?? ''  },
    ],
    rows: data?.history || [],
  });

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
      exportData={data?.history?.length ? getExportData : undefined}
    >
      <div className="h-full p-3">
        {viewMode === 'chart' ? renderChart() : renderTable()}
      </div>
    </BaseWidget>
  );
}
