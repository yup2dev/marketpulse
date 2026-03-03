/**
 * Ownership Insider Widget - Insider trading activity
 */
import { useState, useEffect, useCallback } from 'react';
import { UserCheck } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import CommonTable from '../../common/CommonTable';
import { API_BASE } from '../../../config/api';

const formatCurrency = (value) => {
  if (value == null) return '-';
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
};

const formatNumber = (value) => {
  if (value == null) return '-';
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toLocaleString();
};

const COLUMNS = [
  {
    key: 'transaction_date',
    header: 'Date',
    formatter: 'date',
    width: 90,
  },
  {
    key: 'insider_name',
    header: 'Name',
    renderFn: (value) => <span className="text-white">{value}</span>,
  },
  {
    key: 'acquisition_or_disposition',
    header: 'Type',
    align: 'center',
    width: 60,
    renderFn: (value) => (
      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
        value === 'A' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
      }`}>
        {value === 'A' ? 'Buy' : 'Sell'}
      </span>
    ),
  },
  {
    key: 'shares_traded',
    header: 'Shares',
    align: 'right',
    sortable: true,
    formatter: 'number',
  },
  {
    key: 'transaction_value',
    header: 'Value',
    align: 'right',
    sortable: true,
    formatter: 'magnitude',
  },
];

export default function OwnershipInsiderWidget({ symbol: initialSymbol = 'AAPL', onRemove }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [insiderTransactions, setInsiderTransactions] = useState([]);
  const [insiderSummary, setInsiderSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('table');

  useEffect(() => { setSymbol(initialSymbol); }, [initialSymbol]);

  const loadData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/insider-trading/${symbol}`);
      if (res.ok) {
        const data = await res.json();
        setInsiderTransactions(data.transactions || []);
        setInsiderSummary(data.summary || null);
      }
    } catch (error) {
      console.error('Error loading insider activity:', error);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { loadData(); }, [loadData]);

  const renderChart = () => {
    if (!insiderSummary && insiderTransactions.length === 0) {
      return <div className="flex items-center justify-center h-full text-gray-500 text-xs">No data</div>;
    }
    const buyTotal = Math.abs(insiderSummary?.buy_value || 0);
    const sellTotal = Math.abs(insiderSummary?.sell_value || 0);
    const maxSummary = Math.max(buyTotal, sellTotal, 1);
    const topTx = insiderTransactions.slice(0, 6);
    const maxTxVal = Math.max(...topTx.map(t => Math.abs(t.transaction_value || 0)), 1);
    return (
      <div className="overflow-auto h-full p-3 space-y-4">
        {insiderSummary && (
          <div className="space-y-2.5">
            <p className="text-[10px] text-gray-600 uppercase tracking-wide">Activity Summary</p>
            {[
              { label: 'Total Buys', value: buyTotal, color: '#22c55e', textClass: 'text-green-400' },
              { label: 'Total Sells', value: sellTotal, color: '#ef4444', textClass: 'text-red-400' },
            ].map(b => (
              <div key={b.label}>
                <div className="flex items-center justify-between mb-0.5 text-xs">
                  <span className="text-gray-300">{b.label}</span>
                  <span className={`font-medium tabular-nums ml-2 flex-shrink-0 ${b.textClass}`}>{formatCurrency(b.value)}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div className="h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${(b.value / maxSummary) * 100}%`, backgroundColor: b.color }} />
                </div>
              </div>
            ))}
          </div>
        )}
        {topTx.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-[10px] text-gray-600 uppercase tracking-wide">Recent Transactions</p>
            {topTx.map((tx, i) => {
              const isBuy = tx.acquisition_or_disposition === 'A';
              const val = Math.abs(tx.transaction_value || 0);
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-0.5 text-xs">
                    <span className="text-gray-300 truncate max-w-[70%]">{tx.insider_name || 'Unknown'}</span>
                    <span className={`font-medium tabular-nums ml-2 flex-shrink-0 ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
                      {isBuy ? '+' : '-'}{formatCurrency(val)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div className="h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${(val / maxTxVal) * 100}%`, backgroundColor: isBuy ? '#22c55e' : '#ef4444' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <BaseWidget
      title="Insider Activity"
      icon={UserCheck}
      iconColor="text-green-400"
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
          data={insiderTransactions}
          searchable
          exportable
          compact
          pageSize={10}
        />
      )}
    </BaseWidget>
  );
}
