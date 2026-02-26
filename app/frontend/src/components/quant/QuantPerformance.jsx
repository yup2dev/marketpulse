import React from 'react';
import { TrendingUp, TrendingDown, Activity, BarChart2, Target, DollarSign } from 'lucide-react';
import WidgetTable from '../widgets/common/WidgetTable';

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

// ── Trades columns for WidgetTable ────────────────────────────────────────────
const TRADE_COLUMNS = [
  {
    key: 'entry_date',
    header: 'Entry',
    sortable: true,
    sortValue: r => r.entry_date,
    render: r => <span className="text-gray-300 tabular-nums whitespace-nowrap">{r.entry_date}</span>,
  },
  {
    key: 'exit_date',
    header: 'Exit',
    sortable: true,
    sortValue: r => r.exit_date,
    render: r => <span className="text-gray-300 tabular-nums whitespace-nowrap">{r.exit_date}</span>,
  },
  {
    key: 'entry_price',
    header: 'Entry $',
    align: 'right',
    sortable: true,
    sortValue: r => r.entry_price,
    render: r => <span className="text-gray-200 tabular-nums">${r.entry_price?.toFixed(2)}</span>,
  },
  {
    key: 'exit_price',
    header: 'Exit $',
    align: 'right',
    sortable: true,
    sortValue: r => r.exit_price,
    render: r => <span className="text-gray-200 tabular-nums">${r.exit_price?.toFixed(2)}</span>,
  },
  {
    key: 'pnl',
    header: 'P&L',
    align: 'right',
    sortable: true,
    sortValue: r => r.pnl,
    render: r => {
      const win = r.pnl >= 0;
      return (
        <span className={`tabular-nums font-medium ${win ? 'text-green-400' : 'text-red-400'}`}>
          {win ? '+' : ''}{r.pnl?.toFixed(0)}
        </span>
      );
    },
  },
  {
    key: 'pnl_pct',
    header: 'P&L %',
    align: 'right',
    sortable: true,
    sortValue: r => r.pnl_pct,
    render: r => {
      const win = r.pnl_pct >= 0;
      return (
        <span className={`tabular-nums font-medium ${win ? 'text-green-400' : 'text-red-400'}`}>
          {win ? '+' : ''}{r.pnl_pct?.toFixed(2)}%
        </span>
      );
    },
  },
  {
    key: 'reason',
    header: 'Reason',
    render: r => (
      <span className="text-gray-400 truncate max-w-[200px] block" title={r.reason}>{r.reason}</span>
    ),
  },
];

// ── Main Component ────────────────────────────────────────────────────────────
// section: 'all' | 'metrics' | 'trades'  (default: 'all')
const QuantPerformance = ({ performance, ticker, section = 'all' }) => {
  if (!performance) return null;

  const {
    total_return, annualized_return, max_drawdown,
    sharpe, win_rate, trade_count,
    initial_capital, final_capital, trades,
  } = performance;

  const totalPos = total_return >= 0;
  const mddPos = max_drawdown >= 0;

  const showMetrics = section === 'all' || section === 'metrics';
  const showTrades  = section === 'all' || section === 'trades';

  return (
    <div className="space-y-4">
      {/* Ticker header */}
      {ticker && (
        <div className="text-xs text-gray-400">
          Strategy results for <span className="text-cyan-300 font-semibold">{ticker}</span>
        </div>
      )}

      {/* Metrics grid */}
      {showMetrics && (
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
      )}

      {/* Trades table */}
      {showTrades && trades?.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Trade History ({trades.length})
          </div>
          <div className="border border-gray-800 rounded-lg overflow-hidden">
            <WidgetTable
              columns={TRADE_COLUMNS}
              data={trades.map((t, i) => ({ ...t, _key: i }))}
              size="compact"
              defaultSortKey="entry_date"
              defaultSortDirection="desc"
              emptyMessage="거래 내역이 없습니다"
            />
          </div>
        </div>
      )}

      {/* Trades-only: empty state if no trades */}
      {showTrades && !showMetrics && (!trades || trades.length === 0) && (
        <div className="text-[11px] text-gray-600 text-center py-8">거래 내역이 없습니다</div>
      )}
    </div>
  );
};

export default QuantPerformance;
