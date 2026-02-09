/**
 * Company Filings Widget - Uses common WidgetTable & BaseWidget
 */
import { useState, useEffect, useCallback } from 'react';
import { FileText } from 'lucide-react';
import WidgetTable from './common/WidgetTable';
import BaseWidget from './common/BaseWidget';
import { API_BASE } from '../../config/api';

export default function CompanyFilingsWidget({ symbol: initialSymbol = 'AAPL', onClose }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSymbol(initialSymbol);
  }, [initialSymbol]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/filings/${symbol}`);
      if (res.ok) {
        const result = await res.json();
        setData(result.filings || []);
      } else {
        setData([]);
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
    {
      key: 'date',
      header: 'Date',
      width: '90px',
      render: (row) => <span className="text-gray-300">{row.date}</span>
    },
    {
      key: 'type',
      header: 'Type',
      width: '70px',
      render: (row) => <span className="text-cyan-400 font-medium">{row.type}</span>
    },
    {
      key: 'title',
      header: 'Description',
      className: 'text-[10px]',
      render: (row) => <span className="text-gray-400 truncate block max-w-[200px]">{row.title}</span>
    },
    {
      key: 'url',
      header: '',
      width: '50px',
      align: 'right',
      render: (row) => row.url ? (
        <a
          href={row.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-500 hover:text-cyan-400"
          onClick={(e) => e.stopPropagation()}
        >
          View
        </a>
      ) : <span className="text-gray-500">-</span>
    },
  ];

  return (
    <BaseWidget
      title="SEC Filings"
      icon={FileText}
      iconColor="text-blue-400"
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
        emptyMessage="No SEC filings"
      />
    </BaseWidget>
  );
}
