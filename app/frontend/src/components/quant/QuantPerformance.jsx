import React from 'react';
import { TrendingUp, TrendingDown, Activity, BarChart2, Target, DollarSign } from 'lucide-react';

// ── Metric Card ───────────────────────────────────────────────────────────────
const MetricCard = ({ label, value, sub, positive, negative, icon: Icon }) => {
  const color = positive ? 'text-green-400' : negative ? 'text-red-400' : 'text-cyan-300';
  return (
    <div className="bg-[#0d0d12] border border-gray-800 rounded-lg p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-wider">
        {Icon && <Icon size={11} />}
        {label}
      </div>
      <div className={`text-lg font-bold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-500">{sub}</div>}
    </div>
  );
};

// ── Trades Table ──────────────────────────────────────────────────────────────
const TradesTable = ({ trades }) => {
  if (!trades?.length) return null;
  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-[#0d0d12]">
              {['Entry', 'Exit', 'Entry $', 'Exit $', 'P&L', 'P&L %', 'Reason'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-gray-400 font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.map((t, i) => {
              const win = t.pnl >= 0;
              return (
                <tr
                  key={i}
                  className="border-t border-gray-800/50 hover:bg-gray-800/20 transition-colors"
                >
                  <td className="px-3 py-1.5 text-gray-300 tabular-nums whitespace-nowrap">{t.entry_date}</td>
                  <td className="px-3 py-1.5 text-gray-300 tabular-nums whitespace-nowrap">{t.exit_date}</td>
                  <td className="px-3 py-1.5 text-gray-200 tabular-nums">${t.entry_price.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-gray-200 tabular-nums">${t.exit_price.toFixed(2)}</td>
                  <td className={`px-3 py-1.5 tabular-nums font-medium ${win ? 'text-green-400' : 'text-red-400'}`}>
                    {win ? '+' : ''}{t.pnl.toFixed(0)}
                  </td>
                  <td className={`px-3 py-1.5 tabular-nums font-medium ${win ? 'text-green-400' : 'text-red-400'}`}>
                    {win ? '+' : ''}{t.pnl_pct.toFixed(2)}%
                  </td>
                  <td className="px-3 py-1.5 text-gray-400 whitespace-nowrap max-w-[180px] truncate">{t.reason}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const QuantPerformance = ({ performance, ticker }) => {
  if (!performance) return null;

  const {
    total_return, annualized_return, max_drawdown,
    sharpe, win_rate, trade_count,
    initial_capital, final_capital, trades,
  } = performance;

  const totalPos = total_return >= 0;
  const mddPos = max_drawdown >= 0;

  return (
    <div className="space-y-4">
      {/* Ticker header */}
      {ticker && (
        <div className="text-xs text-gray-400">
          Strategy results for <span className="text-cyan-300 font-semibold">{ticker}</span>
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <MetricCard
          label="Total Return"
          value={`${totalPos ? '+' : ''}${total_return?.toFixed(2)}%`}
          positive={totalPos}
          negative={!totalPos}
          icon={totalPos ? TrendingUp : TrendingDown}
        />
        <MetricCard
          label="Ann. Return"
          value={`${annualized_return >= 0 ? '+' : ''}${annualized_return?.toFixed(2)}%`}
          positive={annualized_return >= 0}
          negative={annualized_return < 0}
          icon={Activity}
        />
        <MetricCard
          label="Max Drawdown"
          value={`${max_drawdown?.toFixed(2)}%`}
          positive={mddPos}
          negative={!mddPos}
          icon={TrendingDown}
        />
        <MetricCard
          label="Sharpe Ratio"
          value={sharpe?.toFixed(2)}
          positive={sharpe >= 1}
          negative={sharpe < 0}
          icon={BarChart2}
        />
        <MetricCard
          label="Win Rate"
          value={`${win_rate?.toFixed(1)}%`}
          positive={win_rate >= 50}
          negative={win_rate < 40}
          icon={Target}
        />
        <MetricCard
          label="Final Capital"
          value={`$${final_capital?.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          sub={`${trade_count} trades`}
          positive={final_capital >= initial_capital}
          negative={final_capital < initial_capital}
          icon={DollarSign}
        />
      </div>

      {/* Trades table */}
      {trades?.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Trade History ({trades.length})
          </div>
          <TradesTable trades={trades} />
        </div>
      )}
    </div>
  );
};

export default QuantPerformance;
