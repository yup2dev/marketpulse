import { useState } from 'react';
import { History, Plus, Pencil, Trash2 } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import WidgetTable from '../common/WidgetTable';

const fmt = (val, dec = 2) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: dec }).format(val ?? 0);

const TYPE_BADGE = {
  buy:      { label: 'BUY',  cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  sell:     { label: 'SELL', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  dividend: { label: 'DIV',  cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
};

function CurrentPnlCell({ row }) {
  if (row.transaction_type !== 'buy') {
    if (row.transaction_type === 'sell') return <span className="text-[11px] text-gray-600 italic">realized</span>;
    return <span className="text-gray-700 text-[11px]">—</span>;
  }
  if (row.currentPnl == null) return <span className="text-gray-600 text-[11px]">—</span>;
  const isUp = row.currentPnl >= 0;
  return (
    <div className={isUp ? 'text-green-400' : 'text-red-400'}>
      <div className="tabular-nums text-[11px] font-medium">{isUp ? '+' : ''}{fmt(row.currentPnl)}</div>
      <div className="tabular-nums text-[10px] opacity-75">{row.currentPnlPct >= 0 ? '+' : ''}{row.currentPnlPct?.toFixed(2)}%</div>
    </div>
  );
}

// Row-level action buttons (edit / delete)
function ActionCell({ row, onEdit, onDelete, deletingId }) {
  const isDeleting = deletingId === row.transaction_id;
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(row); }}
        className="p-1 text-gray-600 hover:text-yellow-400 hover:bg-yellow-900/20 rounded transition-colors"
        title="수정"
      >
        <Pencil size={11} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(row); }}
        disabled={isDeleting}
        className="p-1 text-gray-600 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors disabled:opacity-40"
        title="삭제"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

const buildColumns = (hasPriceData, onEdit, onDelete, deletingId) => [
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
      return <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${badge.cls}`}>{badge.label}</span>;
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
    header: '거래가',
    align: 'right',
    sortable: true,
    sortValue: (r) => r.price,
    render: (r) => <span className="tabular-nums text-[11px]">{fmt(r.price)}</span>,
  },
  ...(hasPriceData ? [{
    key: 'currentPrice',
    header: '현재가',
    align: 'right',
    render: (r) => {
      if (r.transaction_type !== 'buy' || r.currentPrice == null) return <span className="text-gray-700 text-[11px]">—</span>;
      const isUp = r.currentPrice >= r.price;
      return <span className={`tabular-nums text-[11px] font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>{fmt(r.currentPrice)}</span>;
    },
  }] : []),
  {
    key: 'currentPnl',
    header: '현재 손익',
    align: 'right',
    sortable: hasPriceData,
    sortValue: (r) => r.currentPnl ?? -Infinity,
    render: (r) => <CurrentPnlCell row={r} />,
  },
  {
    key: 'total_amount',
    header: '거래금액',
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
    render: (r) => <span className="tabular-nums text-[11px] text-gray-500">{r.commission ? fmt(r.commission) : '-'}</span>,
  },
  {
    key: 'notes',
    header: 'Notes',
    render: (r) => <span className="text-[11px] text-gray-500 truncate max-w-[100px] inline-block">{r.notes || '-'}</span>,
  },
  {
    key: '_actions',
    header: '',
    align: 'right',
    render: (r) => <ActionCell row={r} onEdit={onEdit} onDelete={onDelete} deletingId={deletingId} />,
  },
];

export default function PortfolioTradeHistoryWidget({
  transactions,
  loading,
  onAddTransaction,
  onEditTransaction,    // (transaction) => void  — opens edit modal
  onDeleteTransaction,  // (transaction) => void  — shows confirm + deletes
  priceQuotes = {},
  onRemove,
}) {
  const [deletingId, setDeletingId] = useState(null);
  const hasPriceData = Object.keys(priceQuotes).length > 0;

  const handleDeleteClick = async (row) => {
    if (!window.confirm(`${row.ticker_cd} 거래를 삭제하시겠습니까?\n거래가: ${fmt(row.price)} × ${row.quantity}주`)) return;
    setDeletingId(row.transaction_id);
    try {
      await onDeleteTransaction?.(row);
    } finally {
      setDeletingId(null);
    }
  };

  const data = (transactions || []).map((t, i) => {
    const currentPrice = priceQuotes[t.ticker_cd]?.price ?? null;
    let currentPnl = null, currentPnlPct = null;
    if (t.transaction_type === 'buy' && currentPrice != null && t.price) {
      const diff = currentPrice - t.price;
      currentPnl    = diff * t.quantity;
      currentPnlPct = (diff / t.price) * 100;
    }
    return { ...t, _key: t.transaction_id || `txn-${i}`, currentPrice, currentPnl, currentPnlPct };
  });

  const COLUMNS = buildColumns(hasPriceData, onEditTransaction, handleDeleteClick, deletingId);

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
