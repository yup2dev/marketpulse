import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, X, Star, Briefcase, FolderOpen, ChevronDown } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import StockListTable from './common/StockListTable';
import SymbolAutocomplete from '../common/SymbolAutocomplete';
import { watchlistAPI, portfolioAPI } from '../../config/api';
import useQuoteSocket from '../../hooks/useQuoteSocket';

// ── 공통 ──────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function EmptyState({ icon: Icon, message, sub, action }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
      <Icon size={24} className="text-gray-700" />
      <p className="text-xs text-gray-400">{message}</p>
      {sub && <p className="text-[10px] text-gray-600">{sub}</p>}
      {action}
    </div>
  );
}

// ── WatchlistWidget ────────────────────────────────────────────────────────────

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
              { id: 'holdings',  label: 'Holdings',  icon: Briefcase },
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
  const [watchlists,  setWatchlists]  = useState([]);
  const [activeId,    setActiveId]    = useState(null);
  const [items,       setItems]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [adding,      setAdding]      = useState(false);
  const [addValue,    setAddValue]    = useState('');
  const [showGroups,  setShowGroups]  = useState(false);
  const [newName,     setNewName]     = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const { quotes, connected, subscribe, unsubscribe } = useQuoteSocket();
  const prevSymbolsRef = useRef([]);

  // 초기 watchlist 목록 로드
  useEffect(() => {
    let cancelled = false;
    watchlistAPI.getAll()
      .then(res => {
        if (cancelled) return;
        const list = res.data || [];
        setWatchlists(list);
        setActiveId(list[0]?.watchlist_id ?? null);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // activeId 변경 시 아이템 로드 (race condition 방지)
  useEffect(() => {
    if (!activeId) { setItems([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    watchlistAPI.getItems(activeId)
      .then(res  => { if (!cancelled) setItems(res.data || []); })
      .catch(()  => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeId]);

  // WebSocket 심볼 구독 동기화
  useEffect(() => {
    const symbols = items.map(it => (it.ticker_cd || '').toUpperCase()).filter(Boolean);
    const prev    = prevSymbolsRef.current;
    const toUnsub = prev.filter(s => !symbols.includes(s));
    const toSub   = symbols.filter(s => !prev.includes(s));
    if (toUnsub.length) unsubscribe(toUnsub);
    if (toSub.length)   subscribe(toSub);
    prevSymbolsRef.current = symbols;
  }, [items, subscribe, unsubscribe]);

  const handleAddTicker = useCallback(async (ticker) => {
    if (!ticker) return;
    const sym = ticker.toUpperCase();
    setAdding(false);
    setAddValue('');
    // 낙관적 업데이트
    setItems(prev => [...prev, { ticker_cd: sym, _pending: true }]);
    try {
      await watchlistAPI.quickAdd(sym);
      // activeId가 있으면 서버 데이터로 갱신
      if (activeId) {
        const res = await watchlistAPI.getItems(activeId);
        setItems(res.data || []);
      }
    } catch {
      setItems(prev => prev.filter(it => it.ticker_cd !== sym));
    }
  }, [activeId]);

  const handleRemoveTicker = useCallback(async (ticker) => {
    // 낙관적 제거
    setItems(prev => prev.filter(it => it.ticker_cd !== ticker));
    try {
      await watchlistAPI.quickRemove(ticker);
    } catch {
      // 실패 시 재로드
      if (activeId) {
        const res = await watchlistAPI.getItems(activeId);
        setItems(res.data || []);
      }
    }
  }, [activeId]);

  const handleCreateGroup = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const res = await watchlistAPI.create({ name });
      const wl  = res.data;
      setWatchlists(prev => [...prev, wl]);
      setActiveId(wl.watchlist_id);
      setNewName('');
      setCreatingGroup(false);
    } catch {}
  }, [newName]);

  const handleDeleteGroup = useCallback(async (id) => {
    try {
      await watchlistAPI.delete(id);
      setWatchlists(prev => {
        const next = prev.filter(w => w.watchlist_id !== id);
        if (activeId === id) setActiveId(next[0]?.watchlist_id ?? null);
        return next;
      });
    } catch {}
  }, [activeId]);

  const mergedItems = items.map(it => {
    const sym = (it.ticker_cd || '').toUpperCase();
    const q   = quotes[sym];
    if (!q) return it;
    return { ...it, close_price: q.price ?? it.close_price, change_rate: q.change_percent ?? it.change_rate };
  });

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* 상태바 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800/50 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span
            title={connected ? 'Live' : 'Reconnecting…'}
            className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-yellow-500 animate-pulse'}`}
          />
          <span className="text-[10px] text-gray-600">
            {items.length} stock{items.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* 그룹 관리 토글 */}
          <button
            onClick={() => setShowGroups(v => !v)}
            className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded transition-colors ${
              showGroups
                ? 'text-cyan-400 bg-cyan-500/10'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
            }`}
          >
            <FolderOpen size={10} />
            그룹
            <ChevronDown size={9} className={`transition-transform ${showGroups ? 'rotate-180' : ''}`} />
          </button>
          {/* 종목 추가 */}
          {activeId && (
            <button
              onClick={() => setAdding(v => !v)}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-cyan-400 hover:bg-cyan-500/10 rounded transition-colors"
            >
              <Plus size={10} /> Add
            </button>
          )}
        </div>
      </div>

      {/* 그룹 관리 패널 */}
      {showGroups && (
        <div className="flex-shrink-0 px-2 py-2 border-b border-gray-800/50 bg-[#0a0a0f]">
          <div className="flex flex-wrap gap-1 mb-1.5">
            {watchlists.map(wl => (
              <div
                key={wl.watchlist_id}
                className={`group/tab flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                  activeId === wl.watchlist_id
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-800/60 text-gray-400 hover:text-gray-200'
                }`}
                onClick={() => setActiveId(wl.watchlist_id)}
              >
                {wl.name}
                {watchlists.length > 1 && (
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteGroup(wl.watchlist_id); }}
                    className="opacity-0 group-hover/tab:opacity-100 text-gray-500 hover:text-red-400 transition-all"
                  >
                    <X size={9} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {creatingGroup ? (
            <div className="flex items-center gap-1">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup(); if (e.key === 'Escape') { setCreatingGroup(false); setNewName(''); } }}
                placeholder="그룹 이름..."
                autoFocus
                className="flex-1 bg-[#0a0a0f] border border-gray-700 rounded px-2 py-0.5 text-[11px] text-white outline-none focus:border-cyan-700"
              />
              <button onClick={handleCreateGroup} className="p-0.5 text-cyan-400 hover:text-cyan-300">
                <Plus size={12} />
              </button>
              <button onClick={() => { setCreatingGroup(false); setNewName(''); }} className="p-0.5 text-gray-500 hover:text-gray-300">
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreatingGroup(true)}
              className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-cyan-400 transition-colors"
            >
              <Plus size={10} /> 새 그룹
            </button>
          )}
        </div>
      )}

      {/* 종목 추가 인풋 */}
      {adding && (
        <div className="px-2 py-2 border-b border-gray-800/50 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="flex-1 min-w-0">
              <SymbolAutocomplete
                value={addValue}
                onChange={setAddValue}
                onSelect={stock => handleAddTicker(stock.symbol)}
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
      )}

      {/* 목록 */}
      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <Spinner />
        ) : !activeId ? (
          <EmptyState
            icon={Star}
            message="관심종목을 추적할 그룹을 만드세요"
            action={
              <button
                onClick={() => { setShowGroups(true); setCreatingGroup(true); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded transition-colors"
              >
                <Plus size={12} /> 그룹 만들기
              </button>
            }
          />
        ) : (
          <StockListTable
            items={mergedItems}
            showMarketCap={false}
            showSector={false}
            emptyMessage="종목을 추가하세요"
            actions={item => (
              <button
                onClick={e => { e.stopPropagation(); handleRemoveTicker(item.ticker_cd); }}
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
  if (v == null || isNaN(Number(v))) return '—';
  return `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(v) {
  if (v == null || isNaN(Number(v))) return '—';
  const n = Number(v);
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function changeColor(v) {
  const n = Number(v);
  if (v == null || isNaN(n)) return 'text-gray-400';
  return n > 0 ? 'text-green-400' : n < 0 ? 'text-red-400' : 'text-gray-400';
}

function HoldingsTab() {
  const [portfolios, setPortfolios] = useState([]);
  const [activeId,   setActiveId]   = useState(null);
  const [holdings,   setHoldings]   = useState([]);
  const [loading,    setLoading]    = useState(true);

  // 초기 포트폴리오 목록 로드
  useEffect(() => {
    let cancelled = false;
    portfolioAPI.getAll()
      .then(list => {
        if (cancelled) return;
        const arr = list || [];
        setPortfolios(arr);
        setActiveId(arr[0]?.portfolio_id ?? null);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // activeId 변경 시 holdings 로드 (race condition 방지)
  useEffect(() => {
    if (!activeId) { setHoldings([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    portfolioAPI.getHoldings(activeId)
      .then(data  => { if (!cancelled) setHoldings(data || []); })
      .catch(()   => { if (!cancelled) setHoldings([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeId]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 포트폴리오 탭 (2개 이상일 때만 표시) */}
      {portfolios.length > 1 && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-800/50 bg-[#0a0a0f] flex-shrink-0 overflow-x-auto">
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
      )}

      {portfolios.length === 1 && (
        <div className="flex items-center px-3 py-1.5 border-b border-gray-800/50 flex-shrink-0">
          <span className="text-[10px] text-gray-600">
            {portfolios[0].name} · {holdings.length} holding{holdings.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <Spinner />
        ) : !activeId ? (
          <EmptyState
            icon={Briefcase}
            message="포트폴리오가 없습니다"
            sub="포트폴리오를 생성하여 보유 종목을 추적하세요"
          />
        ) : holdings.length === 0 ? (
          <EmptyState icon={Briefcase} message="보유 종목이 없습니다" />
        ) : (
          <div className="w-full">
            <div className="flex items-center px-3 py-2 border-b border-gray-800 bg-[#0d0d12] sticky top-0 z-10">
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-500 font-medium">Ticker</span>
              </div>
              <div className="w-16 text-right"><span className="text-xs text-gray-500 font-medium">Qty</span></div>
              <div className="w-24 text-right"><span className="text-xs text-gray-500 font-medium">Avg Cost</span></div>
              <div className="w-24 text-right"><span className="text-xs text-gray-500 font-medium">Value</span></div>
              <div className="w-20 text-right"><span className="text-xs text-gray-500 font-medium">P&L %</span></div>
            </div>

            {holdings.map((h, i) => {
              const ticker   = h.ticker_cd || h.symbol || '';
              const qty      = h.quantity ?? h.shares ?? 0;
              const avgCost  = h.avg_cost ?? h.average_cost ?? h.cost_basis;
              const curPrice = h.current_price ?? h.price ?? h.close_price;
              const mktValue = h.market_value ?? (qty * (curPrice || 0));
              const pnlPct   = h.pnl_percent ?? h.return_pct ??
                (avgCost && curPrice ? ((curPrice - avgCost) / avgCost) * 100 : null);

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
