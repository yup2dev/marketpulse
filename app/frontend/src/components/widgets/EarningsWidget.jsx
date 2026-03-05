/**
 * EarningsWidget - Displays quarterly earnings data using BaseWidget
 */
import { useState, useEffect, useCallback } from 'react';
import { Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import CommonChart from '../common/CommonChart';
import CommonTable from '../common/CommonTable';
import { formatPrice, API_BASE } from './constants';

const getSurpriseBadge = (surprise) => {
  if (surprise == null) return null;
  const pos = surprise > 0;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
      pos ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
    }`}>
      {pos ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {pos ? '+' : ''}{surprise.toFixed(2)}%
    </span>
  );
};

const COLUMNS = [
  {
    key: 'period',
    header: 'Period',
    sortable: true,
    renderFn: (value, row) => (
      <div>
        <div className="text-white font-medium">{row.period}</div>
        <div className="text-[10px] text-gray-500">{row.fiscal_year}</div>
      </div>
    ),
  },
  {
    key: 'eps_actual',
    header: 'Actual',
    align: 'right',
    sortable: true,
    renderFn: (value, row) => (
      <span className="text-white font-medium">
        {row.eps_actual != null ? formatPrice(row.eps_actual) : 'N/A'}
      </span>
    ),
  },
  {
    key: 'eps_estimated',
    header: 'Est.',
    align: 'right',
    sortable: true,
    renderFn: (value, row) => (
      <span className="text-gray-400">
        {row.eps_estimated != null ? formatPrice(row.eps_estimated) : 'N/A'}
      </span>
    ),
  },
  {
    key: 'eps_surprise_percent',
    header: 'Surprise',
    align: 'right',
    sortable: true,
    renderFn: (value, row) => getSurpriseBadge(row.eps_surprise_percent),
  },
];

const CHART_SERIES = [
  { key: 'estimated', name: 'Estimated', color: '#6b7280' },
  { key: 'actual',    name: 'Actual',    color: '#22c55e' },
];

const EarningsWidget = ({ symbol, onRemove }) => {
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('table');

  const loadData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/earnings/${symbol}`);
      if (res.ok) setEarnings(await res.json());
    } catch (error) {
      console.error('Error loading earnings:', error);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { loadData(); }, [loadData]);

  const rawItems = (earnings?.earnings || []).slice(0, 8);

  const tableData = rawItems.map((item, i) => ({
    ...item,
    _key: i,
    period: item.fiscal_period || `Q${item.fiscal_quarter}`,
    _sortKey: `${item.fiscal_year}-${String(item.fiscal_quarter || 0).padStart(2, '0')}`,
  }));

  const chartData = [...rawItems].reverse().map(item => ({
    period: item.fiscal_period || `Q${item.fiscal_quarter} ${item.fiscal_year}`,
    actual: item.eps_actual,
    estimated: item.eps_estimated,
  }));

  return (
    <BaseWidget
      title={`${symbol} - Earnings`}
      icon={Calendar}
      iconColor="text-amber-400"
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showPeriodSelector={false}
      symbol={symbol}
    >
      <div className="h-full">
        {viewMode === 'chart' ? (
          <div className="p-3 h-full">
            <CommonChart
              data={chartData}
              series={CHART_SERIES}
              xKey="period"
              type="bar"
              fillContainer={true}
              showTypeSelector={false}
              yFormatter={(v) => `$${v}`}
            />
          </div>
        ) : (
          <CommonTable
            columns={COLUMNS}
            data={tableData}
            compact={true}
            searchable={false}
            exportable={true}
            pageSize={20}
          />
        )}
      </div>
    </BaseWidget>
  );
};

export default EarningsWidget;
