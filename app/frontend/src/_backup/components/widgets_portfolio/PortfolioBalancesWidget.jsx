import { Wallet } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import CommonTable from '../../common/CommonTable';
import { fmtUSD, fmtKRW } from '../../../utils/formatUtils';

function _buildBalancesColumns(displayCurrency, exchangeRate, formatKRWProp) {
  const fmtKRWFn = formatKRWProp || fmtKRW;
  const isKRW = displayCurrency === 'KRW' && exchangeRate && fmtKRWFn;
  const fmt = isKRW ? (v) => fmtKRWFn((v ?? 0) * exchangeRate) : fmtUSD;

  function DayChangeCell({ row }) {
    if (row.dailyChange == null || row.openPrice == null) {
      return <span className="text-gray-600 text-[11px]">—</span>;
    }
    const isUp = row.dailyChange >= 0;
    return (
      <div className={isUp ? 'text-green-400' : 'text-red-400'}>
        <div className="tabular-nums text-[11px]">
          {isUp ? '+' : ''}{fmtUSD(row.dailyChange)}
        </div>
        <div className="tabular-nums text-[10px] opacity-80">
          {isUp ? '+' : ''}{row.dailyChangePct?.toFixed(2)}%
        </div>
      </div>
    );
  }

  function TodayPnlCell({ row }) {
    if (row.todayPnl == null) return <span className="text-gray-600 text-[11px]">—</span>;
    const isUp = row.todayPnl >= 0;
    return (
      <div className={isUp ? 'text-green-400' : 'text-red-400'}>
        <div className="tabular-nums text-[11px]">{isUp ? '+' : ''}{fmt(row.todayPnl)}</div>
        {isKRW && (
          <div className="tabular-nums text-[10px] text-gray-500">{isUp ? '+' : ''}{fmtUSD(row.todayPnl)}</div>
        )}
      </div>
    );
  }

  return [
    {
      key: 'symbol',
      header: 'Asset',
      renderFn: (value, row) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-[10px] font-bold flex-shrink-0 border border-gray-700">
            {row.symbol.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-white">{row.symbol}</div>
            <div className="text-[10px] text-gray-500">{row.quantity} shares</div>
          </div>
        </div>
      ),
    },
    {
      key: 'avgCost',
      header: 'Avg Cost',
      align: 'right',
      sortable: true,
      renderFn: (value, row) => <span className="tabular-nums text-[11px] text-gray-400">{fmtUSD(row.avgCost)}</span>,
    },
    {
      key: 'openPrice',
      header: '시가',
      align: 'right',
      sortable: true,
      renderFn: (value, row) => (
        row.openPrice != null
          ? <span className="tabular-nums text-[11px] text-gray-300">{fmtUSD(row.openPrice)}</span>
          : <span className="text-gray-600 text-[11px]">—</span>
      ),
    },
    {
      key: 'currentPrice',
      header: '현재가',
      align: 'right',
      sortable: true,
      renderFn: (value, row) => {
        const isUp = row.openPrice != null && row.currentPrice >= row.openPrice;
        const isDown = row.openPrice != null && row.currentPrice < row.openPrice;
        return (
          <span className={`tabular-nums text-[11px] font-medium ${isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-white'}`}>
            {fmtUSD(row.currentPrice)}
          </span>
        );
      },
    },
    {
      key: 'dayChange',
      header: '당일 변동',
      align: 'right',
      sortable: true,
      accessorFn: (row) => row.dailyChange ?? 0,
      renderFn: (value, row) => <DayChangeCell row={row} />,
    },
    {
      key: 'todayPnl',
      header: '오늘 손익',
      align: 'right',
      sortable: true,
      renderFn: (value, row) => <TodayPnlCell row={row} />,
    },
    {
      key: 'value',
      header: `평가금액${isKRW ? ' (₩)' : ''}`,
      align: 'right',
      sortable: true,
      renderFn: (value, row) => (
        <div>
          <div className="tabular-nums text-[11px] text-white font-medium">{fmt(row.value)}</div>
          {isKRW && <div className="tabular-nums text-[10px] text-gray-500">{fmtUSD(row.value)}</div>}
        </div>
      ),
    },
    {
      key: 'pnl',
      header: `총 손익${isKRW ? ' (₩)' : ''}`,
      align: 'right',
      sortable: true,
      renderFn: (value, row) => {
        if (row._noPrices) return <span className="text-gray-600 text-[11px]">—</span>;
        return (
          <div className={row.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
            <div className="tabular-nums text-[11px]">{row.pnl >= 0 ? '+' : ''}{fmt(row.pnl)}</div>
            <div className="tabular-nums text-[10px] opacity-80">{row.pnlPct >= 0 ? '+' : ''}{row.pnlPct.toFixed(2)}%</div>
            {isKRW && <div className="tabular-nums text-[10px] opacity-50">{row.pnl >= 0 ? '+' : ''}{fmtUSD(row.pnl)}</div>}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      sortable: false,
      renderFn: () => (
        <button className="text-cyan-400 hover:text-cyan-300 text-[11px] px-1.5 py-0.5 rounded hover:bg-cyan-900/20 transition-colors">
          Trade
        </button>
      ),
    },
  ];
}

export default function PortfolioBalancesWidget({
  holdings,
  hideSmallBalances,
  setHideSmallBalances,
  onRemove,
  displayCurrency = 'USD',
  exchangeRate = null,
  formatKRW: formatKRWProp,
}) {
  const data = holdings.map((h) => ({ ...h, _key: h.symbol }));
  const hasPriceData = holdings.some(h => h.openPrice != null);
  const COLUMNS = _buildBalancesColumns(displayCurrency, exchangeRate, formatKRWProp);

  return (
    <BaseWidget
      title="Balances"
      icon={Wallet}
      iconColor="text-cyan-400"
      showViewToggle={false}
      showPeriodSelector={false}
      onRemove={onRemove}
      headerExtra={
        <div className="flex items-center gap-3">
          {!hasPriceData && (
            <span className="text-[10px] text-yellow-600">시가/현재가: 새로고침 필요</span>
          )}
          <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideSmallBalances}
              onChange={(e) => setHideSmallBalances(e.target.checked)}
              className="w-3 h-3 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-0 focus:ring-offset-0"
            />
            Hide small
          </label>
        </div>
      }
    >
      <div className="overflow-auto h-full">
        <CommonTable
          columns={COLUMNS}
          data={data}
          compact={true}
          searchable={false}
          exportable={false}
          pageSize={50}
        />
      </div>
    </BaseWidget>
  );
}
