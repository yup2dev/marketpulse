/**
 * Dividend Widget - Uses common WidgetTable & BaseWidget
 */
import { useState, useEffect, useCallback } from 'react';
import { DollarSign } from 'lucide-react';
import WidgetTable from './common/WidgetTable';
import BaseWidget from './common/BaseWidget';
import { API_BASE } from '../../config/api';

export default function DividendWidget({ symbol: initialSymbol = 'AAPL', onClose }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSymbol(initialSymbol);
  }, [initialSymbol]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/dividends/${symbol}`);
      if (res.ok) {
        const result = await res.json();
        const mapped = (result.history || result.dividends || []).map(item => ({
          date: item.date,
          amount: item.amount,
          yield: item.dividend_yield,
          growth: item.yoy_growth,
        }));
        setData(mapped);
      } else {
        setData([]);
      }
    } catch (e) {
      console.error('Failed to fetch dividends:', e);
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
      key: 'date',
      header: 'Date',
      width: '100px',
      render: (row) => <span className="text-gray-300">{row.date}</span>,
      exportValue: (row) => row.date ?? '',
    },
    {
      key: 'amount',
      header: 'Amount ($)',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.amount,
      render: (row) => row.amount ? <span className="text-white">${row.amount.toFixed(4)}</span> : <span className="text-gray-500">-</span>,
      exportValue: (row) => row.amount?.toFixed(4) ?? '',
    },
    {
      key: 'yield',
      header: 'Yield (%)',
      align: 'right',
      render: (row) => row.yield ? <span className="text-green-500">{(row.yield * 100).toFixed(2)}%</span> : <span className="text-gray-500">-</span>,
      exportValue: (row) => row.yield ? (row.yield * 100).toFixed(2) : '',
    },
    {
      key: 'growth',
      header: 'YoY (%)',
      align: 'right',
      render: (row) => {
        if (!row.growth) return <span className="text-gray-500">-</span>;
        const isPos = row.growth >= 0;
        return <span className={isPos ? 'text-green-500' : 'text-red-500'}>{isPos ? '+' : ''}{(row.growth * 100).toFixed(1)}%</span>;
      },
      exportValue: (row) => row.growth ? (row.growth * 100).toFixed(1) : '',
    },
  ];

  return (
    <BaseWidget
      title="Dividends"
      icon={DollarSign}
      iconColor="text-green-400"
      symbol={symbol}
      onSymbolChange={setSymbol}
      loading={loading}
      onRefresh={fetchData}
      onRemove={onClose}
      showViewToggle={false}
      showPeriodSelector={false}
      syncable={true}
    >
      <WidgetTable
        columns={columns}
        data={data}
        loading={loading}
        size="compact"
        emptyMessage="No dividend history"
        exportFilename={`dividends_${symbol}`}
      />
    </BaseWidget>
  );
}
