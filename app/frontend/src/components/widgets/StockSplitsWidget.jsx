/**
 * Stock Splits Widget
 */
import { useState, useEffect, useCallback } from 'react';
import CompactWidget, { CompactTable } from './CompactWidget';
import { API_BASE } from '../../config/api';

export default function StockSplitsWidget({ symbol: initialSymbol = 'AAPL', onClose }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/splits/${symbol}`);
      if (res.ok) {
        const result = await res.json();
        setData(result.splits || []);
      } else {
        setData([]);
      }
    } catch (e) {
      console.error('Failed to fetch splits:', e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = [
    { key: 'date', header: 'Date', width: '100px', className: 'text-gray-300' },
    { key: 'ratio', header: 'Ratio', align: 'right', className: 'text-white' },
  ];

  return (
    <CompactWidget
      title="Stock Splits"
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
