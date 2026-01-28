/**
 * Dividend Payment Widget
 */
import { useState, useEffect, useCallback } from 'react';
import CompactWidget, { CompactTable, ColoredValue } from './CompactWidget';
import { API_BASE } from '../../config/api';

export default function DividendWidget({ symbol: initialSymbol = 'AAPL', onClose }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/dividends/${symbol}`);
      if (res.ok) {
        const result = await res.json();
        setData(result.dividends || []);
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
    { key: 'exDate', header: 'Ex-Date', width: '80px', className: 'text-gray-300' },
    { key: 'payDate', header: 'Pay Date', width: '80px', className: 'text-gray-400' },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (v) => <ColoredValue value={v} format="currency" neutral />
    },
    {
      key: 'yield',
      header: 'Yield',
      align: 'right',
      render: (v) => v ? <span className="text-green-500">{v.toFixed(2)}%</span> : '-'
    },
  ];

  return (
    <CompactWidget
      title="Dividend Payment"
      symbol={symbol}
      onSymbolChange={setSymbol}
      onRefresh={fetchData}
      onClose={onClose}
      loading={loading}
      noPadding
    >
      <CompactTable columns={columns} data={data} loading={loading} />
    </CompactWidget>
  );
}
