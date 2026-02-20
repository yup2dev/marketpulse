import { History, Plus } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import WidgetTable from '../common/WidgetTable';

const fmt = (val, dec = 2) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: dec }).format(val ?? 0);

const TYPE_BADGE = {
  buy:      { label: 'BUY',  cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  sell:     { label: 'SELL', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  dividend: { label: 'DIV',  cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
};

const COLUMNS = [
  {
    key: 'transaction_date',
    header: 'Date',
    sortable: true,
    sortValue: (r) => r.transaction_date,
    render: (r) => (
      <span className="tabular-nums text-[11px] text-gray-300">
        {r.transaction_date ? r.transaction_date.slice(0, 10) : '-'}
      </span>
    ),
  },
  {
    key: 'ticker_cd',
    header: 'Symbol',
    sortable: true,
    sortValue: (r) => r.ticker_cd,
    render: (r) => (
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-gray-800 flex items-center justify-center text-[10px] font-bold border border-gray-700 flex-shrink-0">
          {(r.ticker_cd || '??').slice(0, 2)}
        </div>
        <span className="text-[11px] font-medium text-white">{r.ticker_cd}</span>
      </div>
    ),
  },
  {
    key: 'transaction_type',
    header: 'Type',
    sortable: true,
    sortValue: (r) => r.transaction_type,
    render: (r) => {
      const badge = TYPE_BADGE[r.transaction_type] || { label: r.transaction_type?.toUpperCase(), cls: 'bg-gray-700 text-gray-300 border-gray-600' };
      return (
        <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${badge.cls}`}>
          {badge.label}
        </span>
      );
    },
  },
  {
    key: 'quantity',
    header: 'Qty',
    align: 'right',
    sortable: true,
    sortValue: (r) => r.quantity,
    render: (r) => <span className="tabular-nums text-[11px]">{r.quantity?.toLocaleString()}</span>,
  },
  {
    key: 'price',
    header: 'Price',
    align: 'right',
    sortable: true,
    sortValue: (r) => r.price,
    render: (r) => <span className="tabular-nums text-[11px]">{fmt(r.price)}</span>,
  },
  {
    key: 'total_amount',
    header: 'Total',
    align: 'right',
    sortable: true,
    sortValue: (r) => r.total_amount,
    render: (r) => {
      const isNeg = r.transaction_type === 'buy';
      return (
        <span className={`tabular-nums text-[11px] font-medium ${isNeg ? 'text-red-400' : 'text-green-400'}`}>
          {isNeg ? '-' : '+'}{fmt(r.total_amount)}
        </span>
      );
    },
  },
  {
    key: 'commission',
    header: 'Fee',
    align: 'right',
    render: (r) => (
      <span className="tabular-nums text-[11px] text-gray-500">
        {r.commission ? fmt(r.commission) : '-'}
      </span>
    ),
  },
  {
    key: 'notes',
    header: 'Notes',
    render: (r) => <span className="text-[11px] text-gray-500 truncate max-w-[120px] inline-block">{r.notes || '-'}</span>,
  },
];

export default function PortfolioTradeHistoryWidget({ transactions, loading, onAddTransaction, onRemove }) {
  const data = (transactions || []).map((t, i) => ({ ...t, _key: t.transaction_id || `txn-${i}` }));

  return (
    <BaseWidget
      title="Trade History"
      icon={History}
      iconColor="text-purple-400"
      showViewToggle={false}
      showPeriodSelector={false}
      loading={loading}
      onRemove={onRemove}
      headerExtra={
        onAddTransaction && (
          <button
            onClick={onAddTransaction}
            className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 px-2 py-0.5 rounded hover:bg-cyan-900/20 transition-colors"
          >
            <Plus size={12} />
            Add
          </button>
        )
      }
    >
      <div className="overflow-auto h-full">
        <WidgetTable
          columns={COLUMNS}
          data={data}
          size="compact"
          showRowNumbers
          emptyMessage="No transactions yet — add a trade to get started"
          defaultSortKey="transaction_date"
          defaultSortDirection="desc"
        />
      </div>
    </BaseWidget>
  );
}
