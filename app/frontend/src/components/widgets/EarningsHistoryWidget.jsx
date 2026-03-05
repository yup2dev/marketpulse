/**
 * Earnings History Widget - CommonTable + BaseWidget
 */
import { useState, useEffect, useCallback } from 'react';
import { Calendar } from 'lucide-react';
import CommonTable from '../common/CommonTable';
import BaseWidget from './common/BaseWidget';
import { API_BASE } from '../../config/api';

export default function EarningsHistoryWidget({ symbol: initialSymbol = 'AAPL', onClose }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setSymbol(initialSymbol); }, [initialSymbol]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/earnings/${symbol}`);
      if (res.ok) {
        const result = await res.json();
        const mapped = (result.earnings || []).map(item => ({
          period:  item.fiscal_period,
          year:    item.fiscal_year,
          date:    item.report_date || item.period_end_date,
          eps:     item.eps_actual,
          epsEst:  item.eps_estimated,
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

  useEffect(() => { fetchData(); }, [fetchData]);

  const epsSeries = data.filter(r => r.eps != null).map(r => r.eps);
  const tableData = epsSeries.length >= 3
    ? data.map(row => ({ ...row, _epsSeries: epsSeries }))
    : data;

  const columns = [
    {
      key: 'period',
      header: 'Period',
      renderFn: (value, row) => (
        <div>
          <span className="text-white font-medium">{value}</span>
          {row.year && <span className="text-gray-500 ml-1">{row.year}</span>}
        </div>
      ),
    },
    {
      key: 'eps',
      header: 'EPS',
      align: 'center',
      renderFn: (value, row) => {
        if (value == null) return <span className="text-gray-500">-</span>;
        const beat = row.epsEst && value > row.epsEst;
        const miss = row.epsEst && value < row.epsEst;
        return (
          <span className={beat ? 'text-green-500' : miss ? 'text-red-500' : 'text-white'}>
            {Number(value).toFixed(2)}
          </span>
        );
      },
    },
    {
      key: 'epsEst',
      header: 'Est.',
      align: 'right',
      renderFn: (value) => (
        <span className="text-gray-400">{value != null ? Number(value).toFixed(2) : '-'}</span>
      ),
    },
    {
      key: 'revenue',
      header: 'Revenue',
      align: 'right',
      formatter: 'magnitude',
    },
    ...(epsSeries.length >= 3 ? [{
      key: '_epsSeries',
      header: 'Trend',
      align: 'center',
      sortable: false,
      renderFn: 'sparkline',
      sparklineField: '_epsSeries',
    }] : []),
  ];

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
    >
      <CommonTable
        columns={columns}
        data={tableData}
        searchable={false}
        exportable
        compact
        pageSize={8}
      />
    </BaseWidget>
  );
}
