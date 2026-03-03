import { Activity } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import CommonTable from '../../common/CommonTable';

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
      renderFn: (value, row) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-[10px] font-bold flex-shrink-0 border border-gray-700">
            {value.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-white">{value}</div>
            <div className="text-[10px] text-gray-600">{row.quantity} shares</div>
          </div>
        </div>
      ),
    },
    {
      key: 'avgCost',
      header: 'Avg Cost',
      align: 'right',
      sortable: true,
      renderFn: (value) => <span className="tabular-nums text-[11px] text-gray-400">{fmtUSDCompact(value)}</span>,
    },
    {
      key: 'openPrice',
      header: '시가',
      align: 'right',
      sortable: true,
      renderFn: (value) =>
        value != null
          ? <span className="tabular-nums text-[11px] text-gray-300">{fmtUSDCompact(value)}</span>
          : <span className="text-gray-600 text-[11px]">—</span>,
    },
    {
      key: 'currentPrice',
      header: '현재가',
      align: 'right',
      sortable: true,
      renderFn: (value, row) => {
        const isUp = row.openPrice != null && value >= row.openPrice;
        const isDown = row.openPrice != null && value < row.openPrice;
        return (
          <div>
            <div className={`tabular-nums text-[11px] font-medium ${isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-white'}`}>
              {fmtUSDCompact(value)}
            </div>
            {row.dailyChangePct != null && (
              <div className={`tabular-nums text-[10px] ${row.dailyChangePct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {row.dailyChangePct >= 0 ? '+' : ''}{row.dailyChangePct.toFixed(2)}%
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'quantity',
      header: 'Qty',
      align: 'right',
      sortable: true,
      renderFn: (value) => <span className="tabular-nums text-[11px]">{value}</span>,
    },
    {
      key: 'todayPnl',
      header: '오늘 손익',
      align: 'right',
      sortable: true,
      renderFn: (value) => {
        if (value == null) return <span className="text-gray-600 text-[11px]">—</span>;
        const isUp = value >= 0;
        return (
          <div className={`tabular-nums text-[11px] font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
            <div>{isUp ? '+' : ''}{fmt(value)}</div>
            {isKRW && <div className="text-[10px] opacity-60">{isUp ? '+' : ''}{fmtUSD(value)}</div>}
          </div>
        );
      },
    },
    {
      key: 'value',
      header: `평가금액${isKRW ? ' (₩)' : ''}`,
      align: 'right',
      sortable: true,
      renderFn: (value) => (
        <div>
          <div className="tabular-nums text-[11px] text-white">{fmt(value)}</div>
          {isKRW && <div className="tabular-nums text-[10px] text-gray-500">{fmtUSD(value)}</div>}
        </div>
      ),
    },
    {
      key: 'pnl',
      header: `총 손익${isKRW ? ' (₩)' : ''}`,
      align: 'right',
      sortable: true,
      renderFn: (value, row) => {
        if (row._noPrices) return <span className="text-gray-600 text-[11px]" title="No live price">—</span>;
        return (
          <div className={value >= 0 ? 'text-green-400' : 'text-red-400'}>
            <div className="tabular-nums text-[11px]">{value >= 0 ? '+' : ''}{fmt(value)}</div>
            <div className="tabular-nums text-[10px] opacity-80">{row.pnlPct >= 0 ? '+' : ''}{row.pnlPct.toFixed(2)}%</div>
            {isKRW && <div className="tabular-nums text-[10px] opacity-50">{value >= 0 ? '+' : ''}{fmtUSD(value)}</div>}
          </div>
        );
      },
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
      <CommonTable
        columns={COLUMNS}
        data={holdings}
        searchable={false}
        exportable={false}
        compact
        pageSize={20}
      />
    </BaseWidget>
  );
}
