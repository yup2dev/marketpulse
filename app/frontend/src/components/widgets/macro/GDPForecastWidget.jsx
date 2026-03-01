/**
 * GDP Forecast Widget - Shows evolution of GDP forecast
 * Uses BaseWidget for common functionality
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import WidgetTable from '../common/WidgetTable';
import LWChart from '../common/LWChart';
import { API_BASE } from '../../../config/api';

const GDP_COLUMNS = [
  {
    key: 'date',
    header: 'Date',
    sortable: true,
    sortValue: (row) => row.date,
    render: (row) => <span className="text-gray-300">{row.date}</span>,
  },
  {
    key: 'value',
    header: 'GDP Growth',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.value ?? -Infinity,
    exportValue: (row) => row.value?.toFixed(2) ?? '',
    render: (row) => (
      <span className={(row.value ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
        {row.value?.toFixed(2)}%
      </span>
    ),
  },
];


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

  const tableData = useMemo(() =>
    [...(data?.history || [])].reverse().slice(0, 20).map((r, i) => ({ ...r, _key: i })),
    [data]
  );

  const renderTable = () => (
    <div className="h-full overflow-auto">
      <WidgetTable
        columns={GDP_COLUMNS}
        data={tableData}
        resizable={true}
        size="compact"
        showExport={true}
        exportFilename="gdp-forecast"
        defaultSortKey="date"
        defaultSortDirection="desc"
      />
    </div>
  );

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
      exportData={undefined}
    >
      <div className="h-full p-3">
        {viewMode === 'chart' ? renderChart() : renderTable()}
      </div>
    </BaseWidget>
  );
}
