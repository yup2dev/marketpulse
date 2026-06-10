/**
 * PortfolioStatsWidget — self-fetching portfolio summary stats card.
 *
 * Calls /user-portfolio/portfolios/{portfolioId}/summary and renders
 * P&L stats as stat cards. No UniversalWidget — the flat-dict response
 * needs a dedicated display, not a generic table.
 */
import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, X } from 'lucide-react';
import { apiClient, API_BASE } from '../../config/api';

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, positive, negative }) {
  const color = positive ? 'text-emerald-400' : negative ? 'text-red-400' : 'text-gray-200';
  const Icon  = positive ? TrendingUp : negative ? TrendingDown : null;
  return (
    <div className="bg-[#111118] rounded-lg p-3 border border-gray-800/50">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</span>
        {Icon && <Icon size={11} className={color} />}
      </div>
      <div className={`text-sm font-bold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-600 mt-0.5 tabular-nums">{sub}</div>}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtUSD(v) {
  if (v == null) return '—';
  const abs = Math.abs(v);
  const prefix = v < 0 ? '-$' : '$';
  if (abs >= 1e9) return `${prefix}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${prefix}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${prefix}${(abs / 1e3).toFixed(2)}K`;
  return `${prefix}${abs.toFixed(2)}`;
}

function fmtPct(v, showSign = true) {
  if (v == null) return '—';
  const sign = showSign && v > 0 ? '+' : '';
  return `${sign}${Number(v).toFixed(2)}%`;
}

// ── Widget ────────────────────────────────────────────────────────────────────
export default function PortfolioStatsWidget({ portfolioId, onRemove }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const fetchStats = useCallback(async () => {
    if (!portfolioId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`${API_BASE}/user-portfolio/portfolios/${portfolioId}/summary`);
      setData(res);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ── Header ─────────────────────────────────────────────────────────────────
  const header = (
    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 drag-handle cursor-grab active:cursor-grabbing flex-shrink-0">
      <span className="text-xs font-semibold text-gray-300">Portfolio Stats</span>
      <div className="flex items-center gap-1">
        <button
          onClick={fetchStats}
          className="p-1 text-gray-600 hover:text-gray-300 transition-colors rounded"
          title="Refresh"
          onMouseDown={e => e.stopPropagation()}
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-1 text-gray-600 hover:text-red-400 transition-colors rounded"
            onMouseDown={e => e.stopPropagation()}
          >
            <X size={11} />
          </button>
        )}
      </div>
    </div>
  );

  // ── Empty / loading / error ────────────────────────────────────────────────
  if (!portfolioId) {
    return (
      <div className="flex flex-col h-full bg-[#0d0d12] rounded-lg border border-gray-800/40 overflow-hidden">
        {header}
        <div className="flex-1 flex items-center justify-center text-gray-600 text-xs">
          Select a portfolio
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col h-full bg-[#0d0d12] rounded-lg border border-gray-800/40 overflow-hidden">
        {header}
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw size={16} className="animate-spin text-cyan-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full bg-[#0d0d12] rounded-lg border border-gray-800/40 overflow-hidden">
        {header}
        <div className="flex-1 flex items-center justify-center text-red-400 text-xs px-3 text-center">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const pnl        = data.total_unrealized_pnl ?? 0;
  const returnPct  = data.total_return_pct ?? 0;
  const positive   = pnl > 0;
  const negative   = pnl < 0;

  return (
    <div className="flex flex-col h-full bg-[#0d0d12] rounded-lg border border-gray-800/40 overflow-hidden">
      {header}

      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">

        {/* Total Value — hero stat */}
        <div className="bg-[#0a0a0f] rounded-lg p-3 border border-gray-800">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
            {data.name || 'Portfolio'}
          </div>
          <div className="text-xl font-bold text-white tabular-nums">
            {fmtUSD(data.total_market_value)}
          </div>
          <div className="text-[11px] text-gray-600 mt-0.5 tabular-nums">
            Cost Basis: <span className="text-gray-400">{fmtUSD(data.total_cost)}</span>
          </div>
        </div>

        {/* Unrealized P&L */}
        <StatCard
          label="Unrealized P&L"
          value={`${pnl >= 0 ? '+' : ''}${fmtUSD(pnl)}`}
          sub={fmtPct(returnPct)}
          positive={positive}
          negative={negative}
        />

        {/* Holdings count */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#111118] rounded-lg border border-gray-800/50">
          <span className="text-[10px] text-gray-500 uppercase tracking-wide">Holdings</span>
          <span className="text-sm font-semibold text-white">
            {data.total_holdings ?? 0}
          </span>
        </div>

        {/* Currency */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#111118] rounded-lg border border-gray-800/50">
          <span className="text-[10px] text-gray-500 uppercase tracking-wide">Currency</span>
          <span className="text-sm font-medium text-gray-300">{data.currency}</span>
        </div>

        {/* Last updated */}
        {data.last_updated && (
          <div className="text-center text-[10px] text-gray-700 pt-1">
            Updated {new Date(data.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  );
}
