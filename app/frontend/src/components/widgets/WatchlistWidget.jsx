/**
 * WatchlistWidget — CRUD watchlist with Toss-style stock list.
 *
 * Features:
 *   - Multiple watchlist tabs
 *   - Add/remove tickers with search
 *   - Stock list with price, change, sector
 *   - Create/delete watchlists
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Search, X, ChevronDown, List } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import StockListTable from './common/StockListTable';
import { watchlistAPI } from '../../config/api';
import { API_BASE } from '../../config/api';

export default function WatchlistWidget({ onRemove }) {
  const [watchlists, setWatchlists] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const searchRef = useRef(null);

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

  const handleSearch = async (q) => {
    setSearch(q);
    if (q.length < 1) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`${API_BASE}/stock/search?query=${encodeURIComponent(q)}&limit=6`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || data || []);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleAddTicker = async (ticker) => {
    if (!activeId) return;
    try {
      await watchlistAPI.addTicker(activeId, { ticker_cd: ticker });
      setAdding(false);
      setSearch('');
      setSearchResults([]);
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

  const activeWl = watchlists.find(w => w.watchlist_id === activeId);

  return (
    <BaseWidget
      title="Watchlist"
      icon={List}
      loading={false}
      onRemove={onRemove}
      onRefresh={fetchItems}
      showViewToggle={false}
      showPeriodSelector={false}
    >
      <div className="flex flex-col h-full min-h-0">
        {/* Watchlist tabs + controls */}
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-800 bg-[#0a0a0f] flex-shrink-0">
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
                className="w-24 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-[11px] text-white outline-none focus:border-cyan-500"
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

        {/* Add ticker search */}
        {adding ? (
          <div className="px-3 py-2 border-b border-gray-800 bg-[#0a0a0f] flex-shrink-0" ref={searchRef}>
            <div className="flex items-center gap-2 bg-gray-800 rounded px-2 py-1.5">
              <Search size={12} className="text-gray-500 flex-shrink-0" />
              <input
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search ticker..."
                autoFocus
                className="flex-1 bg-transparent text-xs text-white outline-none placeholder-gray-500"
              />
              <button onClick={() => { setAdding(false); setSearch(''); setSearchResults([]); }} className="text-gray-500 hover:text-gray-300">
                <X size={12} />
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-1 max-h-40 overflow-y-auto">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => handleAddTicker(r.symbol || r)}
                    className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-gray-800 rounded text-left transition-colors"
                  >
                    <span className="text-xs text-white font-medium">{r.symbol || r}</span>
                    <span className="text-[10px] text-gray-500 truncate ml-2">{r.name || ''}</span>
                  </button>
                ))}
              </div>
            )}
            {searching && <div className="text-[10px] text-gray-500 px-2 py-1">Searching...</div>}
          </div>
        ) : activeId && (
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800/50 flex-shrink-0">
            <span className="text-[10px] text-gray-600">
              {items.length} stock{items.length !== 1 ? 's' : ''}
            </span>
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
            <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-500 text-xs px-4">
              <p>No watchlist yet</p>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs rounded transition-colors"
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
    </BaseWidget>
  );
}