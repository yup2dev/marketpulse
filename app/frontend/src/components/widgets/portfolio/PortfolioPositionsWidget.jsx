import { Activity } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import WidgetTable from '../common/WidgetTable';

const fmtUSD = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val ?? 0);
const fmtUSDCompact = (val) => {
  if (val == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
};

function buildColumns(displayCurrency, exchangeRate, formatKRW) {
  const isKRW = displayCurrency === 'KRW' && exchangeRate && formatKRW;
  const fmt = isKRW ? (v) => formatKRW((v ?? 0) * exchangeRate) : fmtUSD;

  return [
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
      render: (row) => <span className="tabular-nums text-[11px] text-gray-400">{fmtUSDCompact(row.avgCost)}</span>,
      sortable: true,
      sortValue: (row) => row.avgCost,
    },
    {
      key: 'openPrice',
      header: '시가',
      align: 'right',
      render: (row) => (
        row.openPrice != null
          ? <span className="tabular-nums text-[11px] text-gray-300">{fmtUSDCompact(row.openPrice)}</span>
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
              {fmtUSDCompact(row.currentPrice)}
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
          <div className={`tabular-nums text-[11px] font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
            <div>{isUp ? '+' : ''}{fmt(row.todayPnl)}</div>
            {isKRW && <div className="text-[10px] opacity-60">{isUp ? '+' : ''}{fmtUSD(row.todayPnl)}</div>}
          </div>
        );
      },
      sortable: true,
      sortValue: (row) => row.todayPnl ?? 0,
    },
    {
      key: 'value',
      header: `평가금액${isKRW ? ' (₩)' : ''}`,
      align: 'right',
      render: (row) => (
        <div>
          <div className="tabular-nums text-[11px] text-white">{fmt(row.value)}</div>
          {isKRW && <div className="tabular-nums text-[10px] text-gray-500">{fmtUSD(row.value)}</div>}
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.value,
    },
    {
      key: 'pnl',
      header: `총 손익${isKRW ? ' (₩)' : ''}`,
      align: 'right',
      render: (row) => {
        if (row._noPrices) return <span className="text-gray-600 text-[11px]" title="No live price">—</span>;
        return (
          <div className={row.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
            <div className="tabular-nums text-[11px]">{row.pnl >= 0 ? '+' : ''}{fmt(row.pnl)}</div>
            <div className="tabular-nums text-[10px] opacity-80">{row.pnlPct >= 0 ? '+' : ''}{row.pnlPct.toFixed(2)}%</div>
            {isKRW && <div className="tabular-nums text-[10px] opacity-50">{row.pnl >= 0 ? '+' : ''}{fmtUSD(row.pnl)}</div>}
          </div>
        );
      },
      sortable: true,
      sortValue: (row) => row.pnl,
    },
  ];
}

export default function PortfolioPositionsWidget({
  holdings,
  onRemove,
  displayCurrency = 'USD',
  exchangeRate = null,
  formatKRW,
}) {
  const data = holdings.map((h) => ({ ...h, _key: h.symbol }));
  const COLUMNS = buildColumns(displayCurrency, exchangeRate, formatKRW);

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
