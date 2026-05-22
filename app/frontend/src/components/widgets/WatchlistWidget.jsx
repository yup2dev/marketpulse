import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, X, Star, Briefcase } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import StockListTable from './common/StockListTable';
import SymbolAutocomplete from '../common/SymbolAutocomplete';
import { watchlistAPI, portfolioAPI } from '../../config/api';

export default function WatchlistWidget({ onRemove }) {
  const [mode, setMode] = useState('watchlist');

  return (
    <BaseWidget
      title={mode === 'watchlist' ? 'Watchlist' : 'Holdings'}
      icon={mode === 'watchlist' ? Star : Briefcase}
      loading={false}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
    >
      <div className="flex flex-col h-full min-h-0">
        {/* Mode tabs */}
        <div className="flex items-center px-3 py-1.5 border-b border-gray-800 bg-[#0a0a0f] flex-shrink-0">
          <div className="flex gap-3 flex-1">
            {[
              { id: 'watchlist', label: 'Watchlist', icon: Star },
              { id: 'holdings',  label: 'Holdings', icon: Briefcase },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setMode(t.id)}
                className={`flex items-center gap-1 text-[11px] font-medium pb-1 transition-colors ${
                  mode === t.id
                    ? 'text-white border-b border-cyan-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <t.icon size={10} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          {mode === 'watchlist' ? <WatchlistTab /> : <HoldingsTab />}
        </div>
      </div>
    </BaseWidget>
  );
}

// ── Watchlist Tab ──────────────────────────────────────────────────────────────

function WatchlistTab() {
  const [watchlists, setWatchlists] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addValue, setAddValue] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  const fetchWatchlists = useCallback(async () => {
    try {
      const res = await watchlistAPI.getAll();
      const list = res.data || [];
      setWatchlists(list);
      if (list.length && !activeId) {
        setActiveId(list[0].watchlist_id);
      }
    } catch {
      setWatchlists([]);
    }
  }, [activeId]);

  const fetchItems = useCallback(async () => {
    if (!activeId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await watchlistAPI.getItems(activeId);
      setItems(res.data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => { fetchWatchlists(); }, []);
  useEffect(() => { fetchItems(); }, [activeId, fetchItems]);

  const handleAddTicker = async (ticker) => {
    if (!activeId || !ticker) return;
    try {
      await watchlistAPI.addTicker(activeId, { ticker_cd: ticker });
      setAdding(false);
      setAddValue('');
      fetchItems();
    } catch { /* already exists or error */ }
  };

  const handleRemoveTicker = async (ticker) => {
    if (!activeId) return;
    try {
      await watchlistAPI.removeTicker(activeId, ticker);
      setItems(prev => prev.filter(it => it.ticker_cd !== ticker));
    } catch { /* ignore */ }
  };

  const handleCreateWatchlist = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const res = await watchlistAPI.create({ name });
      const wl = res.data;
      setWatchlists(prev => [...prev, wl]);
      setActiveId(wl.watchlist_id);
      setShowCreate(false);
      setNewName('');
    } catch { /* ignore */ }
  };

  const handleDeleteWatchlist = async (id) => {
    try {
      await watchlistAPI.delete(id);
      setWatchlists(prev => {
        const next = prev.filter(w => w.watchlist_id !== id);
        if (activeId === id) setActiveId(next[0]?.watchlist_id || null);
        return next;
      });
    } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Watchlist selector tabs */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-800/50 bg-[#0a0a0f] flex-shrink-0">
        <div className="flex gap-1 overflow-x-auto flex-1 min-w-0">
          {watchlists.map(wl => (
            <button
              key={wl.watchlist_id}
              onClick={() => setActiveId(wl.watchlist_id)}
              className={`relative px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap group/tab ${
                activeId === wl.watchlist_id
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
              }`}
            >
              {wl.name}
              {watchlists.length > 1 && (
                <span
                  onClick={(e) => { e.stopPropagation(); handleDeleteWatchlist(wl.watchlist_id); }}
                  className="ml-1 opacity-0 group-hover/tab:opacity-100 text-gray-500 hover:text-red-400 transition-all"
                >
                  <X size={9} />
                </span>
              )}
            </button>
          ))}
        </div>

        {showCreate ? (
          <div className="flex items-center gap-1">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateWatchlist()}
              placeholder="Name..."
              autoFocus
              className="w-24 bg-[#0a0a0f] border border-gray-800 rounded px-2 py-0.5 text-[11px] text-white outline-none focus:border-cyan-700"
            />
            <button onClick={handleCreateWatchlist} className="p-0.5 text-cyan-400 hover:text-cyan-300">
              <Plus size={12} />
            </button>
            <button onClick={() => { setShowCreate(false); setNewName(''); }} className="p-0.5 text-gray-500 hover:text-gray-300">
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="p-1 text-gray-500 hover:text-cyan-400 hover:bg-gray-800 rounded transition-colors flex-shrink-0"
            title="New watchlist"
          >
            <Plus size={12} />
          </button>
        )}
      </div>

      {/* Add ticker */}
      {adding ? (
        <div className="px-2 py-2 border-b border-gray-800/50 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="flex-1 min-w-0">
              <SymbolAutocomplete
                value={addValue}
                onChange={setAddValue}
                onSelect={(stock) => handleAddTicker(stock.symbol)}
                placeholder="Search ticker..."
                compact
              />
            </div>
            <button
              onClick={() => { setAdding(false); setAddValue(''); }}
              className="p-1 text-gray-500 hover:text-gray-300 flex-shrink-0"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      ) : activeId && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800/50 flex-shrink-0">
          <span className="text-[10px] text-gray-600">{items.length} stock{items.length !== 1 ? 's' : ''}</span>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-cyan-400 hover:bg-cyan-500/10 rounded transition-colors"
          >
            <Plus size={10} /> Add
          </button>
        </div>
      )}

      {/* Stock list */}
      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !activeId ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500 text-xs px-4">
            <Star size={24} className="text-gray-700" />
            <p className="text-gray-400">Create a watchlist to track stocks</p>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded transition-colors"
            >
              <Plus size={12} /> Create Watchlist
            </button>
          </div>
        ) : (
          <StockListTable
            items={items}
            showMarketCap={false}
            emptyMessage="No stocks added yet"
            actions={(item) => (
              <button
                onClick={(e) => { e.stopPropagation(); handleRemoveTicker(item.ticker_cd); }}
                className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                title="Remove"
              >
                <Trash2 size={11} />
              </button>
            )}
          />
        )}
      </div>
    </div>
  );
}

// ── Holdings Tab ──────────────────────────────────────────────────────────────

function fmtUSD(v) {
  if (v == null) return '—';
  const n = Number(v);
  if (isNaN(n)) return '—';
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(v) {
  if (v == null) return '—';
  const n = Number(v);
  if (isNaN(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function changeColor(v) {
  if (v == null) return 'text-gray-400';
  const n = Number(v);
  if (n > 0) return 'text-green-400';
  if (n < 0) return 'text-red-400';
  return 'text-gray-400';
}

function HoldingsTab() {
  const [portfolios, setPortfolios] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPortfolios = useCallback(async () => {
    try {
      const list = await portfolioAPI.getAll();
      setPortfolios(list || []);
      if (Array.isArray(list) && list.length && !activeId) {
        setActiveId(list[0].portfolio_id);
      }
    } catch {
      setPortfolios([]);
    }
  }, [activeId]);

  const fetchHoldings = useCallback(async () => {
    if (!activeId) { setHoldings([]); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await portfolioAPI.getHoldings(activeId);
      setHoldings(data || []);
    } catch {
      setHoldings([]);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => { fetchPortfolios(); }, []);
  useEffect(() => { fetchHoldings(); }, [activeId, fetchHoldings]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Portfolio selector */}
      {portfolios.length > 1 && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-800/50 bg-[#0a0a0f] flex-shrink-0">
          <div className="flex gap-1 overflow-x-auto flex-1 min-w-0">
            {portfolios.map(p => (
              <button
                key={p.portfolio_id}
                onClick={() => setActiveId(p.portfolio_id)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                  activeId === p.portfolio_id
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {portfolios.length === 1 && (
        <div className="flex items-center px-3 py-1.5 border-b border-gray-800/50 flex-shrink-0">
          <span className="text-[10px] text-gray-600">{portfolios[0].name} · {holdings.length} holding{holdings.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Holdings list */}
      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !activeId ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500 text-xs px-4">
            <Briefcase size={24} className="text-gray-700" />
            <p className="text-gray-400">No portfolio found</p>
            <p className="text-[10px] text-gray-600">Create a portfolio to track your holdings</p>
          </div>
        ) : holdings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-500 text-xs px-4">
            <Briefcase size={20} className="text-gray-700" />
            <p className="text-gray-400">No holdings in this portfolio</p>
          </div>
        ) : (
          <div className="w-full">
            {/* Header */}
            <div className="flex items-center px-3 py-2 border-b border-gray-800 bg-[#0d0d12] sticky top-0 z-10">
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-500 font-medium">Ticker</span>
              </div>
              <div className="w-16 text-right">
                <span className="text-xs text-gray-500 font-medium">Qty</span>
              </div>
              <div className="w-24 text-right">
                <span className="text-xs text-gray-500 font-medium">Avg Cost</span>
              </div>
              <div className="w-24 text-right">
                <span className="text-xs text-gray-500 font-medium">Value</span>
              </div>
              <div className="w-20 text-right">
                <span className="text-xs text-gray-500 font-medium">P&L %</span>
              </div>
            </div>

            {/* Rows */}
            {holdings.map((h, i) => {
              const ticker = h.ticker_cd || h.symbol || '';
              const qty = h.quantity ?? h.shares ?? 0;
              const avgCost = h.avg_cost ?? h.average_cost ?? h.cost_basis;
              const curPrice = h.current_price ?? h.price ?? h.close_price;
              const mktValue = h.market_value ?? (qty * (curPrice || 0));
              const pnlPct = h.pnl_percent ?? h.return_pct ?? (
                avgCost && curPrice ? ((curPrice - avgCost) / avgCost) * 100 : null
              );
              const pnlAmt = h.pnl ?? h.unrealized_pnl ?? (
                avgCost && curPrice ? (curPrice - avgCost) * qty : null
              );

              return (
                <div
                  key={h.holding_id || ticker || i}
                  className="flex items-center px-3 py-2.5 border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-white">{ticker}</span>
                    {h.ticker_name && (
                      <span className="text-xs text-gray-500 ml-1.5 truncate">{h.ticker_name}</span>
                    )}
                  </div>
                  <div className="w-16 text-right">
                    <span className="text-xs text-gray-300 tabular-nums">{Number(qty).toLocaleString()}</span>
                  </div>
                  <div className="w-24 text-right">
                    <span className="text-xs text-gray-400 tabular-nums">{fmtUSD(avgCost)}</span>
                  </div>
                  <div className="w-24 text-right">
                    <span className="text-xs text-gray-200 tabular-nums font-medium">{fmtUSD(mktValue)}</span>
                  </div>
                  <div className="w-20 text-right">
                    <span className={`text-xs tabular-nums font-medium ${changeColor(pnlPct)}`}>
                      {fmtPct(pnlPct)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
