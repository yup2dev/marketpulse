import { Activity } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import WidgetTable from '../common/WidgetTable';

const fmt = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val);

const COLUMNS = [
  {
    key: 'symbol',
    header: 'Symbol',
    render: (row) => (
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-[10px] font-bold flex-shrink-0 border border-gray-700">
          {row.symbol.slice(0, 2)}
        </div>
        <span className="text-[11px] font-medium text-white">{row.symbol}</span>
      </div>
    ),
  },
  {
    key: 'avgCost',
    header: 'Entry Price',
    align: 'right',
    render: (row) => <span className="tabular-nums text-[11px]">{fmt(row.avgCost)}</span>,
    sortable: true,
    sortValue: (row) => row.avgCost,
  },
  {
    key: 'currentPrice',
    header: 'Mark Price',
    align: 'right',
    render: (row) => <span className="tabular-nums text-[11px] text-white">{fmt(row.currentPrice)}</span>,
    sortable: true,
    sortValue: (row) => row.currentPrice,
  },
  {
    key: 'quantity',
    header: 'Qty',
    align: 'right',
    render: (row) => <span className="tabular-nums text-[11px]">{row.quantity}</span>,
    sortable: true,
    sortValue: (row) => row.quantity,
  },
  {
    key: 'value',
    header: 'Position Value',
    align: 'right',
    render: (row) => <span className="tabular-nums text-[11px] text-white">{fmt(row.value)}</span>,
    sortable: true,
    sortValue: (row) => row.value,
  },
  {
    key: 'pnl',
    header: 'Unrealized PNL',
    align: 'right',
    render: (row) => {
      if (row._noPrices) return <span className="text-gray-600 text-[11px]" title="No live price">—</span>;
      return (
        <div className={row.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
          <div className="tabular-nums text-[11px]">{row.pnl >= 0 ? '+' : ''}{fmt(row.pnl)}</div>
          <div className="tabular-nums text-[10px] opacity-80">{row.pnlPct >= 0 ? '+' : ''}{row.pnlPct.toFixed(2)}%</div>
        </div>
      );
    },
    sortable: true,
    sortValue: (row) => row.pnl,
  },
  {
    key: 'actions',
    header: '',
    align: 'right',
    render: () => (
      <button className="text-red-400 hover:text-red-300 text-[11px] px-1.5 py-0.5 rounded hover:bg-red-900/20 transition-colors">
        Close
      </button>
    ),
  },
];

export default function PortfolioPositionsWidget({ holdings, onRemove }) {
  const data = holdings.map((h) => ({ ...h, _key: h.symbol }));

  return (
    <BaseWidget
      title="Positions"
      icon={Activity}
      iconColor="text-yellow-400"
      showViewToggle={false}
      showPeriodSelector={false}
      onRemove={onRemove}
    >
      <div className="overflow-auto h-full">
        <WidgetTable
          columns={COLUMNS}
          data={data}
          size="compact"
          emptyMessage="No open positions"
          defaultSortKey="value"
          defaultSortDirection="desc"
        />
      </div>
    </BaseWidget>
  );
}
