/**
 * Earnings History Widget - Uses common WidgetTable & BaseWidget
 */
import { useState, useEffect, useCallback } from 'react';
import { Calendar } from 'lucide-react';
import WidgetTable from './common/WidgetTable';
import BaseWidget from './common/BaseWidget';
import { API_BASE } from '../../config/api';

export default function EarningsHistoryWidget({ symbol: initialSymbol = 'AAPL', onClose }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSymbol(initialSymbol);
  }, [initialSymbol]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/earnings/${symbol}`);
      if (res.ok) {
        const result = await res.json();
        const mapped = (result.earnings || []).map(item => ({
          period: item.fiscal_period,
          year: item.fiscal_year,
          date: item.report_date || item.period_end_date,
          eps: item.eps_actual,
          epsEst: item.eps_estimated,
          revenue: item.revenue_actual,
        }));
        setData(mapped);
      } else {
        setData([]);
      }
    } catch (e) {
      console.error('Failed to fetch earnings:', e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build a shared EPS series across all rows for sparkline reference
  const epsSeries = data.filter(r => r.eps != null).map(r => r.eps);

  const columns = [
    {
      key: 'period',
      header: 'Period',
      width: '90px',
      filterable: true,
      sortValue: (row) => row.period,
      render: (row) => (
        <div>
          <span className="text-white font-medium">{row.period}</span>
          {row.year && <span className="text-gray-500 ml-1">{row.year}</span>}
        </div>
      ),
      exportValue: (row) => `${row.period} ${row.year ?? ''}`.trim(),
    },
    {
      key: 'eps',
      header: 'EPS',
      align: 'center',
      sortable: true,
      filterable: false,
      sortValue: (row) => row.eps,
      render: (row) => {
        if (row.eps === null || row.eps === undefined) return <span className="text-gray-500">-</span>;
        const beat = row.epsEst && row.eps > row.epsEst;
        const miss = row.epsEst && row.eps < row.epsEst;
        return <span className={beat ? 'text-green-500' : miss ? 'text-red-500' : 'text-white'}>{row.eps.toFixed(2)}</span>;
      },
      exportValue: (row) => row.eps?.toFixed(2) ?? '',
    },
    {
      key: 'epsEst',
      header: 'Est.',
      align: 'right',
      filterable: false,
      render: (row) => <span className="text-gray-400">{row.epsEst?.toFixed(2) || '-'}</span>,
      exportValue: (row) => row.epsEst?.toFixed(2) ?? '',
    },
    {
      key: 'revenue',
      header: 'Revenue',
      align: 'right',
      sortable: true,
      filterable: false,
      sortValue: (row) => row.revenue,
      render: (row) => {
        if (!row.revenue) return <span className="text-gray-500">-</span>;
        const val = row.revenue;
        if (val >= 1e9) return <span className="text-white">{(val / 1e9).toFixed(2)}B</span>;
        if (val >= 1e6) return <span className="text-white">{(val / 1e6).toFixed(2)}M</span>;
        return <span className="text-white">{val.toFixed(2)}</span>;
      },
      exportValue: (row) => row.revenue ?? '',
    },
    // Sparkline: shows overall EPS trend (same series for all rows, highlights where this row falls)
    ...(epsSeries.length >= 3 ? [{
      key: 'trend',
      header: 'Trend',
      align: 'center',
      filterable: false,
      type: 'sparkline',
      sparkKey: '_epsSeries',   // injected below
      sparkColor: '#22c55e',
      sparkNegColor: '#ef4444',
      sparkWidth: 52,
      sparkHeight: 18,
    }] : []),
  ];

  // Inject shared EPS series into each row so sparkline can render it
  const tableData = epsSeries.length >= 3
    ? data.map(row => ({ ...row, _epsSeries: epsSeries }))
    : data;

  return (
    <BaseWidget
      title="Earnings"
      icon={Calendar}
      iconColor="text-amber-400"
      symbol={symbol}
      onSymbolChange={setSymbol}
      loading={loading}
      onRefresh={fetchData}
      onRemove={onClose}
      showViewToggle={false}
      showPeriodSelector={false}
      exportData={data.length ? () => ({
        columns: columns.filter(c => c.type !== 'sparkline'),
        rows: data,
      }) : undefined}
    >
      <WidgetTable
        columns={columns}
        data={tableData}
        loading={loading}
        size="compact"
        showFilters={true}
        pageSize={8}
        emptyMessage="No earnings data"
        exportFilename={`earnings_${symbol}`}
      />
    </BaseWidget>
  );
}
