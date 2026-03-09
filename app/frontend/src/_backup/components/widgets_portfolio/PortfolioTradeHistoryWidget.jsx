import { useState } from 'react';
import { History, Plus, Pencil, Trash2 } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import CommonTable from '../../common/CommonTable';
import { fmtUSD, fmtKRW } from '../../../utils/formatUtils';

const TYPE_BADGE = {
  buy:      { label: 'BUY',  cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  sell:     { label: 'SELL', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  dividend: { label: 'DIV',  cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
};

function CurrentPnlCell({ row, exchangeRate, fmtKRWFn }) {
  if (row.transaction_type !== 'buy') {
    if (row.transaction_type === 'sell') return <span className="text-[11px] text-gray-600 italic">realized</span>;
    return <span className="text-gray-700 text-[11px]">—</span>;
  }
  if (row.currentPnl == null) return <span className="text-gray-600 text-[11px]">—</span>;
  const isUp = row.currentPnl >= 0;
  return (
    <div className={isUp ? 'text-green-400' : 'text-red-400'}>
      <div className="tabular-nums text-[11px] font-medium">{isUp ? '+' : ''}{fmtUSD(row.currentPnl)}</div>
      <div className="tabular-nums text-[10px] opacity-75">{row.currentPnlPct >= 0 ? '+' : ''}{row.currentPnlPct?.toFixed(2)}%</div>
      {exchangeRate && fmtKRWFn && (
        <div className="tabular-nums text-[10px] text-gray-500">
          {isUp ? '+' : ''}{fmtKRWFn(row.currentPnl * exchangeRate)}
        </div>
      )}
    </div>
  );
}

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

const _buildTxnColumns = (hasPriceData, onEdit, onDelete, deletingId, exchangeRate, fmtKRWFn) => [
  {
    key: 'transaction_date',
    header: 'Date',
    sortable: true,
    renderFn: (value, row) => (
      <span className="tabular-nums text-[11px] text-gray-300">
        {row.transaction_date ? row.transaction_date.slice(0, 10) : '-'}
      </span>
    ),
  },
  {
    key: 'ticker_cd',
    header: 'Symbol',
    sortable: true,
    renderFn: (value, row) => (
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-gray-800 flex items-center justify-center text-[10px] font-bold border border-gray-700 flex-shrink-0">
          {(row.ticker_cd || '??').slice(0, 2)}
        </div>
        <span className="text-[11px] font-medium text-white">{row.ticker_cd}</span>
      </div>
    ),
  },
  {
    key: 'transaction_type',
    header: 'Type',
    sortable: true,
    renderFn: (value, row) => {
      const badge = TYPE_BADGE[row.transaction_type] || { label: row.transaction_type?.toUpperCase(), cls: 'bg-gray-700 text-gray-300 border-gray-600' };
      return <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${badge.cls}`}>{badge.label}</span>;
    },
  },
  {
    key: 'quantity',
    header: 'Qty',
    align: 'right',
    sortable: true,
    renderFn: (value, row) => <span className="tabular-nums text-[11px]">{row.quantity?.toLocaleString()}</span>,
  },
  {
    key: 'price',
    header: '거래가',
    align: 'right',
    sortable: true,
    renderFn: (value, row) => (
      <div>
        <div className="tabular-nums text-[11px]">{fmtUSD(row.price)}</div>
        {exchangeRate && fmtKRWFn && (
          <div className="tabular-nums text-[10px] text-gray-500">{fmtKRWFn(row.price * exchangeRate)}</div>
        )}
      </div>
    ),
  },
  ...(hasPriceData ? [{
    key: 'currentPrice',
    header: '현재가',
    align: 'right',
    renderFn: (value, row) => {
      if (row.transaction_type !== 'buy' || row.currentPrice == null) return <span className="text-gray-700 text-[11px]">—</span>;
      const isUp = row.currentPrice >= row.price;
      return (
        <div>
          <div className={`tabular-nums text-[11px] font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>{fmtUSD(row.currentPrice)}</div>
          {exchangeRate && fmtKRWFn && (
            <div className="tabular-nums text-[10px] text-gray-500">{fmtKRWFn(row.currentPrice * exchangeRate)}</div>
          )}
        </div>
      );
    },
  }] : []),
  {
    key: 'currentPnl',
    header: '현재 손익',
    align: 'right',
    sortable: hasPriceData,
    renderFn: (value, row) => <CurrentPnlCell row={row} exchangeRate={exchangeRate} fmtKRWFn={fmtKRWFn} />,
  },
  {
    key: 'total_amount',
    header: '거래금액',
    align: 'right',
    sortable: true,
    renderFn: (value, row) => {
      const isNeg = row.transaction_type === 'buy';
      return (
        <div>
          <div className={`tabular-nums text-[11px] font-medium ${isNeg ? 'text-red-400' : 'text-green-400'}`}>
            {isNeg ? '-' : '+'}{fmtUSD(row.total_amount)}
          </div>
          {exchangeRate && fmtKRWFn && (
            <div className="tabular-nums text-[10px] text-gray-500">
              {isNeg ? '-' : '+'}{fmtKRWFn(row.total_amount * exchangeRate)}
            </div>
          )}
        </div>
      );
    },
  },
  {
    key: 'commission',
    header: 'Fee',
    align: 'right',
    renderFn: (value, row) => (
      <div>
        <div className="tabular-nums text-[11px] text-gray-500">{row.commission ? fmtUSD(row.commission) : '-'}</div>
        {exchangeRate && fmtKRWFn && row.commission ? (
          <div className="tabular-nums text-[10px] text-gray-600">{fmtKRWFn(row.commission * exchangeRate)}</div>
        ) : null}
      </div>
    ),
  },
  {
    key: 'notes',
    header: 'Notes',
    renderFn: (value, row) => <span className="text-[11px] text-gray-500 truncate max-w-[100px] inline-block">{row.notes || '-'}</span>,
  },
  {
    key: '_actions',
    header: '',
    align: 'right',
    sortable: false,
    renderFn: (value, row) => <ActionCell row={row} onEdit={onEdit} onDelete={onDelete} deletingId={deletingId} />,
  },
];

export default function PortfolioTradeHistoryWidget({
  transactions,
  loading,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  priceQuotes = {},
  onRemove,
  exchangeRate = null,
  formatKRW: formatKRWProp,
}) {
  const [deletingId, setDeletingId] = useState(null);
  const fmtKRWFn = formatKRWProp || fmtKRW;
  const hasPriceData = Object.keys(priceQuotes).length > 0;

  const handleDeleteClick = async (row) => {
    if (!window.confirm(`${row.ticker_cd} 거래를 삭제하시겠습니까?\n거래가: ${fmtUSD(row.price)} × ${row.quantity}주`)) return;
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

  const COLUMNS = _buildTxnColumns(hasPriceData, onEditTransaction, handleDeleteClick, deletingId, exchangeRate, fmtKRWFn);

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
        <CommonTable
          columns={COLUMNS}
          data={data}
          compact={true}
          searchable={false}
          exportable={true}
          pageSize={50}
        />
      </div>
    </BaseWidget>
  );
}
