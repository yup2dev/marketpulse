/**
 * Ownership Institutional Widget - Top institutional holders
 */
import { useState, useEffect, useCallback } from 'react';
import { Building2 } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import CommonTable from '../../common/CommonTable';
import { API_BASE } from '../../../config/api';

const COLUMNS = [
  {
    key: 'name',
    header: 'Institution',
    renderFn: (value) => <span className="text-white">{value}</span>,
  },
  {
    key: 'shares',
    header: 'Shares',
    align: 'right',
    sortable: true,
    formatter: 'magnitude',
  },
  {
    key: 'value',
    header: 'Value',
    align: 'right',
    sortable: true,
    formatter: 'magnitude',
    renderFn: (value) => {
      if (value == null) return '-';
      if (Math.abs(value) >= 1e9) return <span className="text-white">${(value / 1e9).toFixed(2)}B</span>;
      if (Math.abs(value) >= 1e6) return <span className="text-white">${(value / 1e6).toFixed(2)}M</span>;
      return <span className="text-white">${value.toLocaleString()}</span>;
    },
  },
  {
    key: 'pct_held',
    header: '% Held',
    align: 'right',
    sortable: true,
    renderFn: (value) => (
      <span className="text-blue-400 font-medium">{value?.toFixed(2)}%</span>
    ),
  },
];

export default function OwnershipInstitutionalWidget({ symbol: initialSymbol = 'AAPL', onRemove }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [institutionalHolders, setInstitutionalHolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('table');

  useEffect(() => { setSymbol(initialSymbol); }, [initialSymbol]);

  const loadData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/holders/${symbol}`);
      if (res.ok) {
        const data = await res.json();
        setInstitutionalHolders(data.institutional || []);
      }
    } catch (error) {
      console.error('Error loading institutional holders:', error);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { loadData(); }, [loadData]);

  const topHolders = institutionalHolders.slice(0, 10);
  const maxPct = topHolders.length > 0 ? Math.max(...topHolders.map(h => h.pct_held || 0)) : 1;

  const renderChart = () => {
    if (topHolders.length === 0) {
      return <div className="flex items-center justify-center h-full text-gray-500 text-xs">No data</div>;
    }
    return (
      <div className="p-3 space-y-2.5">
        <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-3">Top 10 Institutional Holders</p>
        {topHolders.map((h, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-0.5 text-xs">
              <span className="text-gray-300 truncate max-w-[70%]">{h.name}</span>
              <span className="text-blue-400 font-medium tabular-nums ml-2 flex-shrink-0">
                {(h.pct_held || 0).toFixed(2)}%
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-1.5 rounded-full bg-blue-400 transition-all duration-500"
                style={{ width: `${maxPct > 0 ? ((h.pct_held || 0) / maxPct) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <BaseWidget
      title="Institutional Holders"
      icon={Building2}
      iconColor="text-blue-400"
      symbol={symbol}
      onSymbolChange={setSymbol}
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showPeriodSelector={false}
      syncable
    >
      {viewMode === 'chart' ? renderChart() : (
        <CommonTable
          columns={COLUMNS}
          data={institutionalHolders}
          searchable
          exportable
          compact
          pageSize={10}
        />
      )}
    </BaseWidget>
  );
}
