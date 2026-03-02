/**
 * InsiderWidget - Displays insider trading activity using BaseWidget
 */
import { useState, useEffect, useCallback } from 'react';
import { UserCheck } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import WidgetTable from './common/WidgetTable';
import { formatNumber, formatPrice, API_BASE } from './constants';

const getTransactionLabel = (type) => {
  if (type === 'A') return 'Buy';
  if (type === 'D') return 'Sell';
  return type;
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
};

const COLUMNS = [
  {
    key: 'transaction_date',
    header: 'Date',
    sortable: true,
    sortValue: (row) => row.transaction_date,
    render: (row) => <span className="text-gray-400">{formatDate(row.transaction_date)}</span>,
    exportValue: (row) => row.transaction_date ?? '',
  },
  {
    key: 'insider_name',
    header: 'Name',
    filterable: true,
    render: (row) => <span className="text-white">{row.insider_name || 'Unknown'}</span>,
    exportValue: (row) => row.insider_name ?? '',
  },
  {
    key: 'insider_title',
    header: 'Title',
    render: (row) => <span className="text-gray-400 text-[10px]">{row.insider_title || '—'}</span>,
    exportValue: (row) => row.insider_title ?? '',
  },
  {
    key: 'type',
    header: 'Type',
    align: 'center',
    render: (row) => (
      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
        row.acquisition_or_disposition === 'A' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
      }`}>
        {getTransactionLabel(row.acquisition_or_disposition)}
      </span>
    ),
    exportValue: (row) => getTransactionLabel(row.acquisition_or_disposition),
  },
  {
    key: 'shares_traded',
    header: 'Shares',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.shares_traded,
    render: (row) => <span className="text-gray-300">{formatNumber(row.shares_traded)}</span>,
    exportValue: (row) => row.shares_traded ?? '',
  },
  {
    key: 'price_per_share',
    header: 'Price',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.price_per_share,
    render: (row) => <span className="text-gray-300">{formatPrice(row.price_per_share)}</span>,
    exportValue: (row) => row.price_per_share ?? '',
  },
  {
    key: 'transaction_value',
    header: 'Value',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.transaction_value,
    render: (row) => <span className="text-white font-medium">{formatNumber(row.transaction_value)}</span>,
    exportValue: (row) => row.transaction_value ?? '',
  },
];

const InsiderWidget = ({ symbol, onRemove }) => {
  const [insider, setInsider] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('table');

  const loadData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/insider-trading/${symbol}`);
      if (res.ok) setInsider(await res.json());
    } catch (error) {
      console.error('Error loading insider data:', error);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { loadData(); }, [loadData]);

  const renderChart = () => {
    if (!insider) return <div className="flex items-center justify-center h-full text-gray-500 text-xs">No data</div>;

    const buyTotal = Math.abs(insider.summary?.buy_value || 0);
    const sellTotal = Math.abs(insider.summary?.sell_value || 0);
    const maxSummary = Math.max(buyTotal, sellTotal, 1);

    const topTx = (insider.transactions || []).slice(0, 6);
    const maxTxVal = Math.max(...topTx.map(t => Math.abs(t.transaction_value || 0)), 1);

    return (
      <div className="overflow-auto h-full p-3 space-y-4">
        {insider.summary && (
          <div className="space-y-2.5">
            <p className="text-[10px] text-gray-600 uppercase tracking-wide">Activity Summary</p>
            {[
              { label: 'Total Buys', value: buyTotal, color: '#22c55e', textClass: 'text-green-400' },
              { label: 'Total Sells', value: sellTotal, color: '#ef4444', textClass: 'text-red-400' },
            ].map(b => (
              <div key={b.label}>
                <div className="flex items-center justify-between mb-0.5 text-xs">
                  <span className="text-gray-300">{b.label}</span>
                  <span className={`font-medium tabular-nums ml-2 flex-shrink-0 ${b.textClass}`}>{formatNumber(b.value)}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${(b.value / maxSummary) * 100}%`, backgroundColor: b.color }} />
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
                      {isBuy ? '+' : '-'}{formatNumber(val)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${(val / maxTxVal) * 100}%`, backgroundColor: isBuy ? '#22c55e' : '#ef4444' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderTable = () => (
    <div className="h-full px-3 pb-3 pt-1">
      <WidgetTable
        columns={COLUMNS}
        data={insider?.transactions || []}
        loading={loading}
        size="compact"
        showFilters
        pageSize={10}
        emptyMessage="No insider transactions found"
        exportFilename={`insider-trading_${symbol}`}
        defaultSortKey="transaction_date"
        defaultSortDirection="desc"
      />
    </div>
  );

  const getExportData = () => ({
    columns: COLUMNS.filter(c => c.exportValue),
    rows: insider?.transactions || [],
  });

  return (
    <BaseWidget
      title={`${symbol} - Insider`}
      icon={UserCheck}
      iconColor="text-purple-400"
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showPeriodSelector={false}
      symbol={symbol}
      exportData={insider ? getExportData : undefined}
    >
      {viewMode === 'chart' ? renderChart() : renderTable()}
    </BaseWidget>
  );
};

export default InsiderWidget;
