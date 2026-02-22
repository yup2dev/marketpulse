/**
 * Portfolio Stats Widget
 * Shows real portfolio stats: total value, cost basis, total return, today's P&L
 */
import { BarChart2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';

function StatCard({ label, value, subValue, colorClass = 'text-white', isUp, isDown }) {
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const iconColor = isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-gray-500';

  return (
    <div className="bg-[#0d0d12] rounded-lg p-3 border border-gray-800/60">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-gray-500">{label}</span>
        {(isUp != null || isDown != null) && (
          <Icon size={12} className={iconColor} />
        )}
      </div>
      <div className={`text-sm font-bold tabular-nums ${colorClass}`}>{value}</div>
      {subValue && (
        <div className={`text-[11px] tabular-nums mt-0.5 ${colorClass} opacity-70`}>{subValue}</div>
      )}
    </div>
  );
}

export default function PortfolioStatsWidget({
  stats,
  formatCurrency,
  formatPercent,
  lastRefreshed,
  onRemove,
}) {
  const totalValue = stats.totalEquity || 0;
  const costBasis  = stats.totalCost || 0;
  const totalPnl   = stats.pnl || 0;
  const returnPct  = stats.returnPct || 0;
  const todayPnl   = stats.todayPnl || 0;
  const count      = stats.holdingsCount || 0;

  // Weighted avg daily change % (todayPnl / totalValue)
  const todayReturnPct = totalValue > 0 ? (todayPnl / totalValue) * 100 : 0;

  return (
    <BaseWidget
      title="Portfolio Overview"
      icon={BarChart2}
      iconColor="text-cyan-400"
      showViewToggle={false}
      showPeriodSelector={false}
      onRemove={onRemove}
    >
      <div className="p-3 space-y-2 overflow-auto h-[calc(100%-40px)]">

        {/* Total Portfolio Value */}
        <div className="bg-[#0a0a0f] rounded-lg p-3 border border-gray-800">
          <div className="text-[11px] text-gray-500 mb-0.5">Total Portfolio Value</div>
          <div className="text-xl font-bold text-white tabular-nums">{formatCurrency(totalValue)}</div>
          <div className="text-[11px] text-gray-600 mt-0.5">
            Cost Basis: <span className="text-gray-400">{formatCurrency(costBasis)}</span>
          </div>
        </div>

        {/* Today's P&L */}
        <StatCard
          label="오늘 손익 (Today's P&L)"
          value={`${todayPnl >= 0 ? '+' : ''}${formatCurrency(todayPnl)}`}
          subValue={todayReturnPct !== 0 ? `${todayReturnPct >= 0 ? '+' : ''}${todayReturnPct.toFixed(2)}%` : null}
          colorClass={todayPnl >= 0 ? 'text-green-400' : 'text-red-400'}
          isUp={todayPnl > 0 ? true : null}
          isDown={todayPnl < 0 ? true : null}
        />

        {/* Total Return */}
        <StatCard
          label="총 수익 (Total Return)"
          value={`${totalPnl >= 0 ? '+' : ''}${formatCurrency(totalPnl)}`}
          subValue={formatPercent(returnPct)}
          colorClass={totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}
          isUp={totalPnl > 0 ? true : null}
          isDown={totalPnl < 0 ? true : null}
        />

        {/* Holdings count */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#0d0d12] rounded-lg border border-gray-800/60">
          <span className="text-[11px] text-gray-500">보유 종목 수</span>
          <span className="text-[13px] font-medium text-white">{count} stocks</span>
        </div>

        {/* Last updated */}
        {lastRefreshed && (
          <div className="text-center text-[10px] text-gray-700 pt-1">
            Price updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        )}
        {!lastRefreshed && (
          <div className="text-center text-[10px] text-yellow-700 pt-1">
            가격이 로드 중입니다...
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
