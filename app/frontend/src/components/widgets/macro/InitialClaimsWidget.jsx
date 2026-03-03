/**
 * Initial Claims Widget - Shows weekly initial claims with 4-week MA
 * Uses BaseWidget for common functionality
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Users } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import CommonTable from '../../common/CommonTable';
import LWChart from '../common/LWChart';
import { API_BASE } from '../../../config/api';

const CLAIMS_COLUMNS = [
  {
    key: 'date',
    header: 'Date',
    sortable: true,
    renderFn: (value, row) => <span className="text-gray-300">{row.date}</span>,
  },
  {
    key: 'claims',
    header: 'Initial Claims',
    align: 'right',
    sortable: true,
    renderFn: (value, row) => <span className="text-blue-400">{row.claims?.toLocaleString()}K</span>,
  },
  {
    key: 'ma_4w',
    header: '4W MA',
    align: 'right',
    sortable: true,
    renderFn: (value, row) => <span className="text-red-400">{row.ma_4w?.toLocaleString()}K</span>,
  },
];

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

  const tableData = useMemo(() =>
    [...(data?.history || [])].reverse().slice(0, 20).map((r, i) => ({ ...r, _key: i })),
    [data]
  );

  const renderTable = () => (
    <div className="h-full overflow-auto">
      <CommonTable
        columns={CLAIMS_COLUMNS}
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
      exportData={undefined}
    >
      <div className="h-full p-3">
        {viewMode === 'chart' ? renderChart() : renderTable()}
      </div>
    </BaseWidget>
  );
}
