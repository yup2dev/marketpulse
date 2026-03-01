/**
 * Jobs Breakdown Widget - Shows Private vs Government employment
 * Uses BaseWidget for common functionality
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Briefcase } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import WidgetTable from '../common/WidgetTable';
import CommonChart from '../../common/CommonChart';
import { API_BASE } from '../../../config/api';

const JOBS_CHART_SERIES = [
  { key: 'government', name: 'Government',   color: '#f97316' },
  { key: 'private',    name: 'Total Private', color: '#22c55e' },
];

const formatM = (v) => v != null ? `${v > 0 ? '+' : ''}${(v / 1000).toFixed(1)}M` : '-';

const JOBS_COLUMNS = [
  {
    key: 'date',
    header: 'Date',
    sortable: true,
    sortValue: (row) => row.date,
    render: (row) => <span className="text-gray-300">{row.date}</span>,
  },
  {
    key: 'private',
    header: 'Private',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.private ?? -Infinity,
    exportValue: (row) => formatM(row.private),
    render: (row) => <span className={(row.private ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}>{formatM(row.private)}</span>,
  },
  {
    key: 'government',
    header: 'Government',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.government ?? -Infinity,
    exportValue: (row) => formatM(row.government),
    render: (row) => <span className={(row.government ?? 0) >= 0 ? 'text-orange-400' : 'text-red-400'}>{formatM(row.government)}</span>,
  },
  {
    key: '_total',
    header: 'Total',
    align: 'right',
    sortable: true,
    sortValue: (row) => row._total ?? -Infinity,
    exportValue: (row) => formatM(row._total),
    render: (row) => <span className={(row._total ?? 0) >= 0 ? 'text-cyan-400' : 'text-red-400'}>{formatM(row._total)}</span>,
  },
];

export default function JobsBreakdownWidget({ onRemove }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('chart');
  const [period, setPeriod] = useState('5y');
  const [chartType, setChartType] = useState('stackedBar');

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
      <CommonChart
        data={data.history}
        series={JOBS_CHART_SERIES}
        xKey="date"
        type={chartType}
        onTypeChange={setChartType}
        fillContainer={true}
        showTypeSelector={true}
        allowedTypes={['stackedBar', 'bar', 'line', 'area']}
        xFormatter={formatDate}
        yFormatter={(v) => `${v > 0 ? '+' : ''}${(v / 1000).toFixed(0)}M`}
        referenceLines={[{ y: 0 }]}
      />
    );
  };

  const tableData = useMemo(() =>
    [...(data?.history || [])].reverse().slice(0, 20).map((r, i) => ({
      ...r, _key: i, _total: (r.private || 0) + (r.government || 0),
    })),
    [data]
  );

  const renderTable = () => (
    <div className="h-full overflow-auto">
      <WidgetTable
        columns={JOBS_COLUMNS}
        data={tableData}
        resizable={true}
        size="compact"
        showExport={true}
        exportFilename="jobs-breakdown"
        defaultSortKey="date"
        defaultSortDirection="desc"
      />
    </div>
  );

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
