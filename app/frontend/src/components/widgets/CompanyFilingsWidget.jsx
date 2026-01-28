/**
 * Company Filings Widget - SEC filings display
 */
import { useState, useEffect, useCallback } from 'react';
import CompactWidget, { CompactTable } from './CompactWidget';
import { API_BASE } from '../../config/api';

export default function CompanyFilingsWidget({ symbol: initialSymbol = 'AAPL', onClose }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/filings/${symbol}`);
      if (res.ok) {
        const result = await res.json();
        setData(result.filings || []);
      } else {
        // Mock data
        setData([
          { date: '2025-11-05', cik: '0001973239', type: '6-K', source: 'SEC' },
          { date: '2025-09-18', cik: '0001973239', type: '6-K', source: 'SEC' },
          { date: '2025-08-11', cik: '0001973239', type: '6-K', source: 'SEC' },
          { date: '2025-07-30', cik: '0001973239', type: '6-K', source: 'SEC' },
          { date: '2025-05-28', cik: '0001973239', type: 'S-8', source: 'SEC' },
          { date: '2025-05-28', cik: '0001973239', type: '20-F', source: 'SEC' },
        ]);
      }
    } catch (e) {
      console.error('Failed to fetch filings:', e);
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
    { key: 'cik', header: 'CIK', className: 'text-gray-400' },
    { key: 'type', header: 'Type', className: 'text-white' },
    {
      key: 'source',
      header: 'Source',
      align: 'right',
      render: () => <a href="#" className="text-cyan-500 hover:text-cyan-400">Link</a>
    },
  ];

  return (
    <CompactWidget
      title="Company Filings"
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
