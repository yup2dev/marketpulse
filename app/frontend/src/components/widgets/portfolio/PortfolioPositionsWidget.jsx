import { Activity } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import WidgetTable from '../common/WidgetTable';

const fmt = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val);
const fmtCompact = (val) => {
  if (val == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
};

const COLUMNS = [
  {
    key: 'symbol',
    header: 'Symbol',
    render: (row) => (
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-[10px] font-bold flex-shrink-0 border border-gray-700">
          {row.symbol.slice(0, 2)}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-white">{row.symbol}</div>
          <div className="text-[10px] text-gray-600">{row.quantity} shares</div>
        </div>
      </div>
    ),
  },
  {
    key: 'avgCost',
    header: 'Avg Cost',
    align: 'right',
    render: (row) => <span className="tabular-nums text-[11px] text-gray-400">{fmtCompact(row.avgCost)}</span>,
    sortable: true,
    sortValue: (row) => row.avgCost,
  },
  {
    key: 'openPrice',
    header: '시가',
    align: 'right',
    render: (row) => (
      row.openPrice != null
        ? <span className="tabular-nums text-[11px] text-gray-300">{fmtCompact(row.openPrice)}</span>
        : <span className="text-gray-600 text-[11px]">—</span>
    ),
    sortable: true,
    sortValue: (row) => row.openPrice ?? 0,
  },
  {
    key: 'currentPrice',
    header: '현재가',
    align: 'right',
    render: (row) => {
      const isUp = row.openPrice != null && row.currentPrice >= row.openPrice;
      const isDown = row.openPrice != null && row.currentPrice < row.openPrice;
      return (
        <div>
          <div className={`tabular-nums text-[11px] font-medium ${isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-white'}`}>
            {fmtCompact(row.currentPrice)}
          </div>
          {row.dailyChangePct != null && (
            <div className={`tabular-nums text-[10px] ${row.dailyChangePct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {row.dailyChangePct >= 0 ? '+' : ''}{row.dailyChangePct.toFixed(2)}%
            </div>
          )}
        </div>
      );
    },
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
    key: 'todayPnl',
    header: '오늘 손익',
    align: 'right',
    render: (row) => {
      if (row.todayPnl == null) return <span className="text-gray-600 text-[11px]">—</span>;
      const isUp = row.todayPnl >= 0;
      return (
        <span className={`tabular-nums text-[11px] font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
          {isUp ? '+' : ''}{fmt(row.todayPnl)}
        </span>
      );
    },
    sortable: true,
    sortValue: (row) => row.todayPnl ?? 0,
  },
  {
    key: 'value',
    header: '평가금액',
    align: 'right',
    render: (row) => <span className="tabular-nums text-[11px] text-white">{fmt(row.value)}</span>,
    sortable: true,
    sortValue: (row) => row.value,
  },
  {
    key: 'pnl',
    header: '총 손익',
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
