/**
 * GDP Forecast Widget - Shows evolution of GDP forecast
 * Uses BaseWidget for common functionality
 */
import { useState, useEffect, useCallback } from 'react';
import { TrendingUp } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import LWChart from '../common/LWChart';
import { API_BASE } from '../../../config/api';


export default function GDPForecastWidget({ onRemove }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('chart');
  const [period, setPeriod] = useState('3y');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/overview/gdp-forecast?period=${period}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error('Error loading GDP forecast:', error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const renderChart = () => {
    if (!data?.history) return null;
    const series = data.history
      .filter(d => d.date && d.value != null)
      .map(d => ({ time: d.date, value: d.value }));
    return (
      <LWChart
        series={series}
        type="area"
        color="#3b82f6"
        topColor="#3b82f640"
        bottomColor="#3b82f605"
        referenceLine={0}
        formatter={v => `${v.toFixed(2)}%`}
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
              <th className="text-right py-2 px-3 text-gray-400 font-medium">GDP Growth</th>
            </tr>
          </thead>
          <tbody>
            {recentData.map((row, idx) => (
              <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-2 px-3 text-gray-300">{row.date}</td>
                <td className={`py-2 px-3 text-right ${row.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {row.value?.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const getExportData = () => ({
    columns: [
      { key: 'date',  header: 'Date' },
      { key: 'value', header: 'GDP Growth (%)', exportValue: r => r.value?.toFixed(2) ?? '' },
    ],
    rows: data?.history || [],
  });

  return (
    <BaseWidget
      title={data?.title || "Evolution of Latest GDP Forecast"}
      subtitle={data?.subtitle}
      icon={TrendingUp}
      iconColor="text-blue-400"
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
