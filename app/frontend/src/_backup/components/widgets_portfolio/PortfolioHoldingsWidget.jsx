import { Layers } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import CommonTable from '../../common/CommonTable';
import { fmtUSD, fmtKRW, fmtPercent } from '../../../utils/formatUtils';

function _buildHoldingsColumns(displayCurrency, exchangeRate, formatKRWProp) {
  const fmtKRWFn = formatKRWProp || fmtKRW;
  const isKRW = displayCurrency === 'KRW' && exchangeRate && fmtKRWFn;
  const fmt = isKRW ? (v) => fmtKRWFn((v ?? 0) * exchangeRate) : fmtUSD;

  return [
    {
      key: 'symbol',
      header: 'Asset',
      renderFn: (value, row) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-[10px] font-bold flex-shrink-0 border border-gray-700">
            {value.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-white">{value}</div>
            <div className="text-[10px] text-gray-500 truncate max-w-[80px]">{row.quantity} sh</div>
          </div>
        </div>
      ),
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
              {fmtUSD(value)}
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
      renderFn: (value, row) => (
        <div className={value >= 0 ? 'text-green-400' : 'text-red-400'}>
          <div className="tabular-nums text-[11px]">{fmt(value)}</div>
          <div className="tabular-nums text-[10px] opacity-80">{fmtPercent(row.pnlPct)}</div>
          {isKRW && <div className="tabular-nums text-[10px] opacity-50">{fmtUSD(value)}</div>}
        </div>
      ),
    },
  ];
}

export default function PortfolioHoldingsWidget({
  holdings,
  onViewAll,
  onRemove,
  displayCurrency = 'USD',
  exchangeRate = null,
  formatKRW: formatKRWProp,
}) {
  const COLUMNS = _buildHoldingsColumns(displayCurrency, exchangeRate, formatKRWProp);

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
      <CommonTable
        columns={COLUMNS}
        data={holdings.slice(0, 5)}
        searchable={false}
        exportable={false}
        compact
        pageSize={10}
      />
    </BaseWidget>
  );
}
