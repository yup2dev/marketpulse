/**
 * Inflation Momentum Widget - Shows 12M, 6M, 3M inflation momentum
 * Uses BaseWidget for common functionality
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Activity } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import CommonTable from '../../common/CommonTable';
import CommonChart from '../../common/CommonChart';
import { API_BASE } from '../../../config/api';

const MOMENTUM_SERIES = [
  { key: 'yoy_12m', name: '12M', color: '#3b82f6' },
  { key: 'yoy_6m',  name: '6M',  color: '#f97316' },
  { key: 'yoy_3m',  name: '3M',  color: '#22c55e' },
];

const MOMENTUM_COLUMNS = [
  {
    key: 'date',
    header: 'Date',
    sortable: true,
    renderFn: (value, row) => <span className="text-gray-300">{row.date}</span>,
  },
  {
    key: 'yoy_12m',
    header: '12M',
    align: 'right',
    sortable: true,
    renderFn: (value, row) => <span className="text-blue-400">{row.yoy_12m?.toFixed(2)}%</span>,
  },
  {
    key: 'yoy_6m',
    header: '6M',
    align: 'right',
    sortable: true,
    renderFn: (value, row) => <span className="text-orange-400">{row.yoy_6m?.toFixed(2)}%</span>,
  },
  {
    key: 'yoy_3m',
    header: '3M',
    align: 'right',
    sortable: true,
    renderFn: (value, row) => <span className="text-green-400">{row.yoy_3m?.toFixed(2)}%</span>,
  },
];

export default function InflationMomentumWidget({ onRemove }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('chart');
  const [period, setPeriod] = useState('3y');
  const [chartType, setChartType] = useState('line');

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
      <CommonChart
        data={data.history}
        series={MOMENTUM_SERIES}
        xKey="date"
        type={chartType}
        onTypeChange={setChartType}
        fillContainer={true}
        showTypeSelector={true}
        allowedTypes={['line', 'area']}
        xFormatter={formatDate}
        yFormatter={(v) => `${v.toFixed(0)}%`}
        referenceLines={[{ y: data.fed_target || 2, label: 'FED AIT' }]}
      />
    );
  };

  const tableData = useMemo(() =>
    [...(data?.history || [])].reverse().slice(0, 20).map((r, i) => ({ ...r, _key: i })),
    [data]
  );

  const renderTable = () => (
    <div className="h-full overflow-auto">
      <CommonTable
        columns={MOMENTUM_COLUMNS}
        data={tableData}
        compact={true}
        searchable={false}
        exportable={true}
        pageSize={20}
      />
    </div>
  );

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
