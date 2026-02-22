import { Layers } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import WidgetTable from '../common/WidgetTable';

const fmt = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val);
const fmtPct = (val) => `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;

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
          <div className="text-[10px] text-gray-500 truncate max-w-[80px]">{row.quantity} sh</div>
        </div>
      </div>
    ),
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
            {fmt(row.currentPrice)}
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
    render: (row) => (
      <div className={row.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
        <div className="tabular-nums text-[11px]">{fmt(row.pnl)}</div>
        <div className="tabular-nums text-[10px] opacity-80">{fmtPct(row.pnlPct)}</div>
      </div>
    ),
    sortable: true,
    sortValue: (row) => row.pnl,
  },
];

export default function PortfolioHoldingsWidget({ holdings, onViewAll, onRemove }) {
  const data = holdings.slice(0, 5).map((h) => ({ ...h, _key: h.symbol }));

  return (
    <BaseWidget
      title="Top Holdings"
      icon={Layers}
      iconColor="text-cyan-400"
      showViewToggle={false}
      showPeriodSelector={false}
      onRemove={onRemove}
      headerExtra={
        onViewAll && (
          <button
            onClick={onViewAll}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 px-2 py-0.5 rounded hover:bg-cyan-900/30 transition-colors"
          >
            View All
          </button>
        )
      }
    >
      <div className="overflow-auto h-full">
        <WidgetTable
          columns={COLUMNS}
          data={data}
          size="compact"
          emptyMessage="No holdings"
          defaultSortKey="value"
          defaultSortDirection="desc"
        />
      </div>
    </BaseWidget>
  );
}
