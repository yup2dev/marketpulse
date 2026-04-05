import { TrendingUp, TrendingDown, Activity, BarChart2, Target, DollarSign, Zap, Award, Clock, AlertTriangle, Calendar } from 'lucide-react';
import { useMemo } from 'react';
import CommonTable from '../common/CommonTable';

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

// ── Trades columns ────────────────────────────────────────────────────────────
const TRADE_COLUMNS = [
  {
    key: 'entry_date',
    header: 'Entry',
    sortable: true,
    renderFn: (v, row) => <span className="text-gray-300 tabular-nums whitespace-nowrap">{row.entry_date}</span>,
  },
  {
    key: 'exit_date',
    header: 'Exit',
    sortable: true,
    renderFn: (v, row) => <span className="text-gray-300 tabular-nums whitespace-nowrap">{row.exit_date}</span>,
  },
  {
    key: 'entry_price',
    header: 'Entry $',
    align: 'right',
    sortable: true,
    renderFn: (v, row) => <span className="text-gray-200 tabular-nums">${row.entry_price?.toFixed(2)}</span>,
  },
  {
    key: 'exit_price',
    header: 'Exit $',
    align: 'right',
    sortable: true,
    renderFn: (v, row) => <span className="text-gray-200 tabular-nums">${row.exit_price?.toFixed(2)}</span>,
  },
  {
    key: 'pnl',
    header: 'P&L',
    align: 'right',
    sortable: true,
    renderFn: (v, row) => (
      <span className={`tabular-nums font-medium ${row.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {row.pnl >= 0 ? '+' : ''}{row.pnl?.toFixed(0)}
      </span>
    ),
  },
  {
    key: 'pnl_pct',
    header: 'P&L %',
    align: 'right',
    sortable: true,
    renderFn: (v, row) => (
      <span className={`tabular-nums font-medium ${row.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {row.pnl_pct >= 0 ? '+' : ''}{row.pnl_pct?.toFixed(2)}%
      </span>
    ),
  },
  {
    key: 'reason',
    header: 'Reason',
    sortable: false,
    renderFn: (v, row) => (
      <span className="text-gray-400 truncate max-w-[200px] block" title={row.reason}>{row.reason}</span>
    ),
  },
];

// ── Periodic Regime Breakdown ─────────────────────────────────────────────────
// Groups trades by year-quarter and shows performance per period.
// Also computes a simple trend-based regime (Bull / Bear) from avg trade P&L.
function RegimeBreakdown({ trades }) {
  const quarters = useMemo(() => {
    if (!trades?.length) return [];

    const map = {};
    trades.forEach(t => {
      const d = t.entry_date ? new Date(t.entry_date) : null;
      if (!d || isNaN(d)) return;
      const yr = d.getFullYear();
      const q  = Math.floor(d.getMonth() / 3) + 1;
      const key = `${yr}-Q${q}`;
      if (!map[key]) map[key] = { key, year: yr, quarter: q, trades: [] };
      map[key].trades.push(t);
    });

    return Object.values(map)
      .sort((a, b) => a.year !== b.year ? a.year - b.year : a.quarter - b.quarter)
      .map(g => {
        const count   = g.trades.length;
        const wins    = g.trades.filter(t => (t.pnl ?? 0) > 0).length;
        const winRate = count ? (wins / count) * 100 : 0;
        const avgPnl  = count ? g.trades.reduce((s, t) => s + (t.pnl_pct ?? 0), 0) / count : 0;
        const totalPnl = g.trades.reduce((s, t) => s + (t.pnl ?? 0), 0);
        // Simple regime: Bull if avgPnl > +0.5%, Bear if < -0.5%, else Sideways
        const regime  = avgPnl > 0.5 ? 'Bull' : avgPnl < -0.5 ? 'Bear' : 'Sideways';
        return { ...g, count, wins, winRate, avgPnl, totalPnl, regime };
      });
  }, [trades]);

  if (!quarters.length) return null;

  const REGIME_STYLE = {
    Bull:     { dot: 'bg-green-500',  text: 'text-green-400',  bg: 'bg-green-900/10'  },
    Bear:     { dot: 'bg-red-500',    text: 'text-red-400',    bg: 'bg-red-900/10'    },
    Sideways: { dot: 'bg-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-900/10' },
  };

  // Summary by regime
  const regimeSummary = ['Bull', 'Bear', 'Sideways'].map(regime => {
    const gs = quarters.filter(q => q.regime === regime);
    if (!gs.length) return null;
    const totalTrades = gs.reduce((s, g) => s + g.count, 0);
    const totalWins   = gs.reduce((s, g) => s + g.wins, 0);
    const avgReturn   = gs.reduce((s, g) => s + g.avgPnl, 0) / gs.length;
    return { regime, quarters: gs.length, totalTrades, winRate: totalTrades ? (totalWins / totalTrades) * 100 : 0, avgReturn };
  }).filter(Boolean);

  return (
    <div className="space-y-3">
      {/* Regime summary chips */}
      <div className="flex items-center gap-3 flex-wrap">
        {regimeSummary.map(r => {
          const st = REGIME_STYLE[r.regime];
          return (
            <div key={r.regime} className={`flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-800 ${st.bg}`}>
              <div className={`w-2 h-2 rounded-full ${st.dot}`} />
              <div>
                <div className={`text-[10px] font-semibold ${st.text}`}>{r.regime}</div>
                <div className="text-[9px] text-gray-600">{r.quarters}분기 · {r.totalTrades}거래</div>
              </div>
              <div className="text-right">
                <div className={`text-[11px] font-bold tabular-nums ${r.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                  {r.winRate.toFixed(0)}%
                </div>
                <div className="text-[9px] text-gray-600">Win Rate</div>
              </div>
              <div className="text-right">
                <div className={`text-[11px] font-bold tabular-nums ${r.avgReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {r.avgReturn >= 0 ? '+' : ''}{r.avgReturn.toFixed(2)}%
                </div>
                <div className="text-[9px] text-gray-600">Avg P&L</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quarterly heatmap table */}
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-[10px]">
          <thead className="bg-[#0d0d12] border-b border-gray-800">
            <tr>
              <th className="px-3 py-2 text-left text-gray-600 font-medium">Period</th>
              <th className="px-3 py-2 text-left text-gray-600 font-medium">Regime</th>
              <th className="px-3 py-2 text-right text-gray-600 font-medium">Trades</th>
              <th className="px-3 py-2 text-right text-gray-600 font-medium">Win %</th>
              <th className="px-3 py-2 text-right text-gray-600 font-medium">Avg P&L %</th>
              <th className="px-3 py-2 text-right text-gray-600 font-medium">Total P&L</th>
              <th className="px-3 py-2 text-left text-gray-600 font-medium w-24">Dist.</th>
            </tr>
          </thead>
          <tbody>
            {quarters.map(q => {
              const st = REGIME_STYLE[q.regime];
              return (
                <tr key={q.key} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="px-3 py-1.5 tabular-nums font-mono text-gray-300">{q.key}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      <span className={`text-[9px] font-medium ${st.text}`}>{q.regime}</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-gray-400">{q.count}</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${q.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                    {q.winRate.toFixed(0)}%
                  </td>
                  <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${q.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {q.avgPnl >= 0 ? '+' : ''}{q.avgPnl.toFixed(2)}%
                  </td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${q.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {q.totalPnl >= 0 ? '+' : ''}${q.totalPnl.toFixed(0)}
                  </td>
                  {/* Mini win-rate bar */}
                  <td className="px-3 py-1.5">
                    <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${q.winRate >= 50 ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${q.winRate}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main — section: 'all' | 'metrics' | 'trades' ─────────────────────────────
const QuantPerformance = ({ performance, ticker, section = 'all' }) => {
  if (!performance) return null;

  const {
    total_return, annualized_return, max_drawdown,
    sharpe, sortino, calmar, profit_factor, expectancy, recovery_factor,
    win_rate, trade_count, avg_hold_days, max_consec_losses,
    initial_capital, final_capital, trades,
  } = performance;

  const showMetrics = section === 'all' || section === 'metrics';
  const showTrades  = section === 'all' || section === 'trades';

  return (
    <div className="space-y-4">
      {ticker && (
        <div className="text-xs text-gray-400">
          Strategy results for <span className="text-cyan-300 font-semibold">{ticker}</span>
        </div>
      )}

      {showMetrics && (
        <>
          {/* Row 1 — Returns */}
          <div>
            <div className="text-[9px] font-semibold text-gray-700 uppercase tracking-widest mb-1.5">Returns</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              <MetricCard
                label="Total Return"
                value={`${total_return >= 0 ? '+' : ''}${total_return?.toFixed(2)}%`}
                positive={total_return >= 0} negative={total_return < 0}
                icon={total_return >= 0 ? TrendingUp : TrendingDown}
              />
              <MetricCard
                label="Ann. Return"
                value={`${annualized_return >= 0 ? '+' : ''}${annualized_return?.toFixed(2)}%`}
                positive={annualized_return >= 0} negative={annualized_return < 0}
                icon={Activity}
              />
              <MetricCard
                label="Final Capital"
                value={`$${(final_capital ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                sub={`from $${(initial_capital ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                positive={final_capital >= initial_capital} negative={final_capital < initial_capital}
                icon={DollarSign}
              />
              <MetricCard
                label="Expectancy"
                value={`${(expectancy ?? 0) >= 0 ? '+' : ''}$${Math.abs(expectancy ?? 0).toFixed(0)}`}
                sub="per trade avg"
                positive={(expectancy ?? 0) >= 0} negative={(expectancy ?? 0) < 0}
                icon={Target}
              />
            </div>
          </div>

          {/* Row 2 — Risk-Adjusted */}
          <div>
            <div className="text-[9px] font-semibold text-gray-700 uppercase tracking-widest mb-1.5">Risk-Adjusted</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              <MetricCard
                label="Sharpe Ratio"
                value={sharpe?.toFixed(2)}
                sub="annualised"
                positive={sharpe >= 1} negative={sharpe < 0}
                icon={BarChart2}
              />
              <MetricCard
                label="Sortino Ratio"
                value={(sortino ?? 0).toFixed(2)}
                sub="downside risk"
                positive={(sortino ?? 0) >= 1} negative={(sortino ?? 0) < 0}
                icon={Zap}
              />
              <MetricCard
                label="Calmar Ratio"
                value={(calmar ?? 0).toFixed(2)}
                sub="ann. ret / max DD"
                positive={(calmar ?? 0) >= 0.5} negative={(calmar ?? 0) < 0}
                icon={Award}
              />
              <MetricCard
                label="Profit Factor"
                value={(profit_factor ?? 0) >= 999 ? '∞' : (profit_factor ?? 0).toFixed(2)}
                sub="gross P / gross L"
                positive={(profit_factor ?? 0) >= 1.5} negative={(profit_factor ?? 0) < 1}
                icon={BarChart2}
              />
            </div>
          </div>

          {/* Row 3 — Risk */}
          <div>
            <div className="text-[9px] font-semibold text-gray-700 uppercase tracking-widest mb-1.5">Risk</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              <MetricCard
                label="Max Drawdown"
                value={`${max_drawdown?.toFixed(2)}%`}
                positive={false} negative={max_drawdown < -10}
                icon={TrendingDown}
              />
              <MetricCard
                label="Recovery Factor"
                value={(recovery_factor ?? 0).toFixed(2)}
                sub="total ret / max DD"
                positive={(recovery_factor ?? 0) >= 2} negative={(recovery_factor ?? 0) < 1}
                icon={Activity}
              />
              <MetricCard
                label="Max Consec. Losses"
                value={max_consec_losses ?? 0}
                positive={false} negative={(max_consec_losses ?? 0) >= 5}
                icon={AlertTriangle}
              />
              <MetricCard
                label="Win Rate"
                value={`${win_rate?.toFixed(1)}%`}
                positive={win_rate >= 50} negative={win_rate < 40}
                icon={Target}
              />
            </div>
          </div>

          {/* Row 4 — Trades */}
          <div>
            <div className="text-[9px] font-semibold text-gray-700 uppercase tracking-widest mb-1.5">Trade Stats</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              <MetricCard
                label="Trade Count"
                value={trade_count ?? 0}
                icon={Activity}
              />
              <MetricCard
                label="Avg Hold (days)"
                value={avg_hold_days ?? 0}
                sub="per trade"
                icon={Clock}
              />
            </div>
          </div>

          {/* Row 5 — Regime Analysis */}
          {trades?.length >= 3 && (
            <div>
              <div className="flex items-center gap-2 text-[9px] font-semibold text-gray-700 uppercase tracking-widest mb-1.5">
                <Calendar size={10} />
                Regime Analysis  <span className="normal-case text-gray-800 font-normal">— 분기별 매매 성과</span>
              </div>
              <RegimeBreakdown trades={trades} />
            </div>
          )}
        </>
      )}

      {showTrades && trades?.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Trade History ({trades.length})
          </div>
          <div className="border border-gray-800 rounded-lg overflow-hidden">
            <CommonTable
              columns={TRADE_COLUMNS}
              data={trades.map((t, i) => ({ ...t, _key: i }))}
              compact
              searchable={false}
              exportable={false}
              pageSize={20}
            />
          </div>
        </div>
      )}

      {showTrades && !showMetrics && (!trades || trades.length === 0) && (
        <div className="text-[11px] text-gray-600 text-center py-8">거래 내역이 없습니다</div>
      )}
    </div>
  );
};

export default QuantPerformance;
