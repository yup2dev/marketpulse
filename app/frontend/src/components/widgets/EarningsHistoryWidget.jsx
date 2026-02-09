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

  const columns = [
    {
      key: 'period',
      header: 'Period',
      width: '90px',
      sortValue: (row) => row.period,
      render: (row) => (
        <div>
          <span className="text-white font-medium">{row.period}</span>
          {row.year && <span className="text-gray-500 ml-1">{row.year}</span>}
        </div>
      )
    },
    {
      key: 'eps',
      header: 'EPS',
      align: 'center',
      sortable: true,
      sortValue: (row) => row.eps,
      render: (row) => {
        if (row.eps === null || row.eps === undefined) return <span className="text-gray-500">-</span>;
        const beat = row.epsEst && row.eps > row.epsEst;
        const miss = row.epsEst && row.eps < row.epsEst;
        return <span className={beat ? 'text-green-500' : miss ? 'text-red-500' : 'text-white'}>{row.eps.toFixed(2)}</span>;
      }
    },
    {
      key: 'epsEst',
      header: 'Est.',
      align: 'right',
      render: (row) => <span className="text-gray-400">{row.epsEst?.toFixed(2) || '-'}</span>
    },
    {
      key: 'revenue',
      header: 'Revenue',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.revenue,
      render: (row) => {
        if (!row.revenue) return <span className="text-gray-500">-</span>;
        const val = row.revenue;
        if (val >= 1e9) return <span className="text-white">{(val / 1e9).toFixed(2)}B</span>;
        if (val >= 1e6) return <span className="text-white">{(val / 1e6).toFixed(2)}M</span>;
        return <span className="text-white">{val.toFixed(2)}</span>;
      }
    },
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
      <WidgetTable
        columns={columns}
        data={data}
        loading={loading}
        size="compact"
        emptyMessage="No earnings data"
      />
    </BaseWidget>
  );
}
