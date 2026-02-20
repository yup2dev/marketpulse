import { Wallet } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import WidgetTable from '../common/WidgetTable';

const fmt = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val);

const COLUMNS = [
  {
    key: 'symbol',
    header: 'Asset',
    render: (row) => (
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-[10px] font-bold flex-shrink-0 border border-gray-700">
          {row.symbol.slice(0, 2)}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-white">{row.symbol}</div>
          <div className="text-[10px] text-gray-500 truncate max-w-[120px]">{row.name}</div>
        </div>
      </div>
    ),
  },
  {
    key: 'quantity',
    header: 'Total Balance',
    align: 'right',
    render: (row) => <span className="tabular-nums text-[11px]">{row.quantity}</span>,
    sortable: true,
    sortValue: (row) => row.quantity,
  },
  {
    key: 'availableBalance',
    header: 'Available',
    align: 'right',
    render: (row) => <span className="tabular-nums text-[11px] text-gray-400">{row.quantity}</span>,
  },
  {
    key: 'value',
    header: 'USD Value',
    align: 'right',
    render: (row) => <span className="tabular-nums text-[11px] text-white">{fmt(row.value)}</span>,
    sortable: true,
    sortValue: (row) => row.value,
  },
  {
    key: 'pnl',
    header: 'PNL (ROE %)',
    align: 'right',
    render: (row) => {
      if (row._noPrices) return <span className="text-gray-600 text-[11px]">—</span>;
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
      <button className="text-cyan-400 hover:text-cyan-300 text-[11px] px-1.5 py-0.5 rounded hover:bg-cyan-900/20 transition-colors">
        Trade
      </button>
    ),
  },
];

export default function PortfolioBalancesWidget({ holdings, hideSmallBalances, setHideSmallBalances, onRemove }) {
  const data = holdings.map((h) => ({ ...h, _key: h.symbol }));

  return (
    <BaseWidget
      title="Balances"
      icon={Wallet}
      iconColor="text-cyan-400"
      showViewToggle={false}
      showPeriodSelector={false}
      onRemove={onRemove}
      headerExtra={
        <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hideSmallBalances}
            onChange={(e) => setHideSmallBalances(e.target.checked)}
            className="w-3 h-3 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-0 focus:ring-offset-0"
          />
          Hide small
        </label>
      }
    >
      <div className="overflow-auto h-full">
        <WidgetTable
          columns={COLUMNS}
          data={data}
          size="compact"
          emptyMessage="No balances"
          defaultSortKey="value"
          defaultSortDirection="desc"
        />
      </div>
    </BaseWidget>
  );
}
