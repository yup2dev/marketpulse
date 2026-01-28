/**
 * Earnings History Widget - Compact earnings data display
 */
import { useState, useEffect, useCallback } from 'react';
import CompactWidget, { CompactTable, ColoredValue } from './CompactWidget';
import { API_BASE } from '../../config/api';

export default function EarningsHistoryWidget({ symbol: initialSymbol = 'AAPL', onClose }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/earnings/${symbol}`);
      if (res.ok) {
        const result = await res.json();
        setData(result.earnings || result.history || []);
      } else {
        // Mock data for demo
        setData([
          { date: '2026-02-04', eps: null, epsEstimate: 0.41, revenue: null, revenueEstimate: 1.23e9 },
          { date: '2025-11-05', eps: 0.15, epsEstimate: 0.3574, revenue: 1.135e9, revenueEstimate: 1.12e9 },
          { date: '2025-07-30', eps: 0.35, epsEstimate: 0.34, revenue: 1.053e9, revenueEstimate: 1.06e9 },
          { date: '2025-05-07', eps: 0.55, epsEstimate: 0.52, revenue: 1.241e9, revenueEstimate: 1.06e9 },
          { date: '2025-02-05', eps: 0.40, epsEstimate: 0.34, revenue: 983e6, revenueEstimate: 1.23e9 },
        ]);
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
    { key: 'date', header: 'Date', width: '80px', className: 'text-gray-300' },
    {
      key: 'eps',
      header: 'EPS',
      align: 'right',
      render: (v, row) => {
        if (v === null || v === undefined) return <span className="text-gray-500">-</span>;
        const beat = row.epsEstimate && v > row.epsEstimate;
        const miss = row.epsEstimate && v < row.epsEstimate;
        return <span className={beat ? 'text-green-500' : miss ? 'text-red-500' : 'text-white'}>{v?.toFixed(4)}</span>;
      }
    },
    {
      key: 'epsEstimate',
      header: 'EPS Est.',
      align: 'right',
      render: (v) => <span className="text-gray-400">{v?.toFixed(4) || '-'}</span>
    },
    {
      key: 'revenue',
      header: 'Revenue',
      align: 'right',
      render: (v) => {
        if (!v) return <span className="text-gray-500">-</span>;
        return <ColoredValue value={v} format="compact" neutral />;
      }
    },
    {
      key: 'revenueEstimate',
      header: 'Rev Est.',
      align: 'right',
      render: (v) => <span className="text-gray-400">{v ? `${(v / 1e9).toFixed(2)}B` : '-'}</span>
    },
    {
      key: 'transcript',
      header: '',
      align: 'right',
      width: '70px',
      render: () => <a href="#" className="text-cyan-500 hover:text-cyan-400">View</a>
    },
  ];

  return (
    <CompactWidget
      title="Earnings History"
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
