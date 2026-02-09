/**
 * Stock Splits Widget - Uses common WidgetTable & BaseWidget
 */
import { useState, useEffect, useCallback } from 'react';
import { Scissors } from 'lucide-react';
import WidgetTable from './common/WidgetTable';
import BaseWidget from './common/BaseWidget';
import { API_BASE } from '../../config/api';

export default function StockSplitsWidget({ symbol: initialSymbol = 'AAPL', onClose }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSymbol(initialSymbol);
  }, [initialSymbol]);

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
    {
      key: 'date',
      header: 'Date',
      width: '100px',
      render: (row) => <span className="text-gray-300">{row.date}</span>
    },
    {
      key: 'description',
      header: 'Split',
      render: (row) => <span className="text-cyan-400">{row.description}</span>
    },
    {
      key: 'ratio',
      header: 'Ratio',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.ratio,
      render: (row) => <span className="text-white font-medium">{row.ratio}:1</span>
    },
  ];

  return (
    <BaseWidget
      title="Splits"
      icon={Scissors}
      iconColor="text-purple-400"
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
        emptyMessage="No stock splits"
      />
    </BaseWidget>
  );
}
