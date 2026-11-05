import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TrendingUp, Heart } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import { SegmentedControl, Select, FilterDivider, WidgetState, periodOptions } from './ui';
import { rankingAPI, watchlistAPI } from '../../config/api';
import useQuoteSocket from '../../hooks/useQuoteSocket';
import toast from 'react-hot-toast';

// ── 상수 ──────────────────────────────────────────────────────────────────────

const MARKET_OPTS  = [{ value:'all',label:'All' },{ value:'domestic',label:'Korea' },{ value:'overseas',label:'Global' }];
const SORT_OPTS    = [{ value:'gainers',label:'Gainers' },{ value:'losers',label:'Losers' },{ value:'trade_value',label:'Trade value' },{ value:'volume',label:'Volume' }];
// 기간 표기는 periods.js 기준 (1D 1W 1M …) + 실시간
const PERIOD_OPTS  = [
  { value:'realtime', label:'Live' },
  ...periodOptions(['1d','1w','1mo','3mo','6mo','1y']).map((o) => ({ value:o.id, label:o.label })),
];
// realtime만 WebSocket 실시간. 1일~1년은 DB 정적 데이터(기간 등락률).
const LIVE_PERIODS = new Set(['realtime']);

// ── 포맷 헬퍼 ─────────────────────────────────────────────────────────────────

function fmtPrice(v, curr) {
  if (v == null) return '—';
  if (curr === 'KRW') return `₩${Math.round(v).toLocaleString('ko-KR')}`;
  return `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtChange(v) {
  if (v == null) return null;
  const n = Number(v);
  return { text: `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`, up: n > 0, zero: n === 0 };
}

function fmtTradeValue(v, curr) {
  if (v == null || v === 0) return '—';
  if (curr === 'KRW') {
    if (v >= 1e12) return `₩${(v/1e12).toFixed(1)}T`;
    if (v >= 1e9)  return `₩${(v/1e9).toFixed(1)}B`;
    return `₩${Math.round(v/1e6)}M`;
  }
  if (v >= 1e9) return `$${(v/1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v/1e6).toFixed(1)}M`;
  return `$${(v/1e3).toFixed(0)}K`;
}

function fmtVolume(v) {
  if (v == null || v === 0) return '—';
  if (v >= 1e9) return `${(v/1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v/1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v/1e3).toFixed(0)}K`;
  return String(v);
}

function fmtTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// ── 로고 서클 ─────────────────────────────────────────────────────────────────

const LOGO_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316','#14b8a6','#6366f1'];
function logoColor(sym) {
  const n = (sym||'').split('').reduce((a,c)=>a+c.charCodeAt(0),0);
  return LOGO_COLORS[n % LOGO_COLORS.length];
}

function LogoCircle({ symbol }) {
  return (
    <div className="relative flex-shrink-0">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[11px] select-none"
        style={{ backgroundColor: logoColor(symbol) }}
      >
        {(symbol||'??').replace(/[^A-Z]/gi,'').slice(0,2).toUpperCase()}
      </div>
    </div>
  );
}

// ── 등락률 Pill (한국: 상승=빨강, 하락=파랑) ──────────────────────────────────

function ChangePill({ value }) {
  const c = fmtChange(value);
  if (!c) return <span className="text-xs text-gray-600">—</span>;
  if (c.zero) return (
    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold tabular-nums bg-gray-700/50 text-gray-400">
      0.00%
    </span>
  );
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold tabular-nums
      ${c.up ? 'bg-red-500/15 text-red-400' : 'bg-blue-500/15 text-blue-400'}`}>
      {c.text}
    </span>
  );
}

function sortRows(rows, sortBy) {
  if (sortBy === 'gainers')     return [...rows].filter(r=>(r.change_rate??0)>0).sort((a,b)=>(b.change_rate??0)-(a.change_rate??0));
  if (sortBy === 'losers')      return [...rows].filter(r=>(r.change_rate??0)<0).sort((a,b)=>(a.change_rate??0)-(b.change_rate??0));
  if (sortBy === 'volume')      return [...rows].sort((a,b)=>(b.volume??0)-(a.volume??0));
  if (sortBy === 'trade_value') return [...rows].sort((a,b)=>(b.trade_value??0)-(a.trade_value??0));
  return rows;
}

// ── 메인 ─────────────────────────────────────────────────────────────────────

export default function MarketRankingWidget({ onRemove }) {
  const [market,    setMarket]    = useState('all');
  const [sortBy,    setSortBy]    = useState('gainers');
  const [period,    setPeriod]    = useState('realtime');
  const [baseRows,  setBaseRows]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [favorites, setFavorites] = useState([]);
  const [lastUpdate,setLastUpdate]= useState(null);

  const { quotes, subscribe, unsubscribe } = useQuoteSocket();
  const prevSymsRef = useRef([]);
  const isLive = LIVE_PERIODS.has(period);   // realtime만 WebSocket

  useEffect(() => {
    watchlistAPI.getMyTickers().then(r => setFavorites(r.results||[])).catch(()=>{});
  }, []);

  const fetchRanking = useCallback(async () => {
    setLoading(true);
    try {
      const res = LIVE_PERIODS.has(period)
        ? await rankingAPI.getLive({ market, sortBy, limit: 50 })
        : await rankingAPI.get({ market, sortBy, period, limit: 50 });
      setBaseRows(res.results || []);
      setLastUpdate(new Date());
    } catch {
      setBaseRows([]);
    } finally {
      setLoading(false);
    }
  }, [market, sortBy, period]);

  useEffect(() => { fetchRanking(); }, [fetchRanking]);

  useEffect(() => {
    // 기간 탭(DB 정적): 실시간 구독 전부 해제하고 종료.
    if (!isLive) {
      if (prevSymsRef.current.length) {
        unsubscribe(prevSymsRef.current);
        prevSymsRef.current = [];
      }
      return;
    }
    const syms = baseRows.map(r=>(r.stk_cd||'').toUpperCase()).filter(Boolean);
    const prev = prevSymsRef.current;
    const toUnsub = prev.filter(s=>!syms.includes(s));
    const toSub   = syms.filter(s=>!prev.includes(s));
    if (toUnsub.length) unsubscribe(toUnsub);
    if (toSub.length)   subscribe(toSub);
    prevSymsRef.current = syms;
  }, [baseRows, isLive, subscribe, unsubscribe]);

  const toggleFav = useCallback(async (sym) => {
    const isAdding = !favorites.includes(sym);
    setFavorites(prev => isAdding ? [...prev,sym] : prev.filter(s=>s!==sym));
    try {
      if (isAdding) { await watchlistAPI.quickAdd(sym); toast.success(`Added ${sym} to watchlist`); }
      else          { await watchlistAPI.quickRemove(sym); toast.success(`Removed ${sym} from watchlist`); }
    } catch {
      setFavorites(prev => isAdding ? prev.filter(s=>s!==sym) : [...prev,sym]);
      toast.error('Could not update watchlist');
    }
  }, [favorites]);

  const liveRows = useMemo(() => {
    // 기간 탭: DB가 이미 정렬·계산한 정적 데이터를 그대로 사용 (WS 병합 없음).
    if (!isLive) return baseRows;
    const merged = baseRows.map(r => {
      const sym = (r.stk_cd||'').toUpperCase();
      const q   = quotes[sym];
      if (!q) return r;
      const price = q.price          ?? r.close_price;
      const chg   = q.change_percent ?? r.change_rate;
      const vol   = q.volume         ?? r.volume;
      return { ...r, close_price: price, change_rate: chg, volume: vol,
               trade_value: (vol!=null&&price!=null) ? vol*price : r.trade_value };
    });
    return sortRows(merged, sortBy);
  }, [baseRows, quotes, sortBy, isLive]);

  // 현재 sort 기준에 맞는 우측 숫자 컬럼
  const metricLabel = sortBy === 'volume' ? 'Volume' : 'Trade value';
  const metricFmt   = (row) => sortBy === 'volume'
    ? fmtVolume(row.volume)
    : fmtTradeValue(row.trade_value, row.curr);

  return (
    <BaseWidget
      title="Market Ranking"
      icon={TrendingUp}
      onRemove={onRemove}
      onRefresh={fetchRanking}
      filters={{
        left: (
          <>
            <SegmentedControl value={market} options={MARKET_OPTS} onChange={setMarket} ariaLabel="Market" />
            <FilterDivider />
            <SegmentedControl value={sortBy} options={SORT_OPTS} onChange={setSortBy} ariaLabel="Sort" />
            <FilterDivider />
            <Select value={period} options={PERIOD_OPTS} onChange={setPeriod} title="Period" align="left" menuWidth="min-w-[80px]" />
          </>
        ),
        right: lastUpdate ? `As of ${fmtTime(lastUpdate)}` : null,
      }}
    >
      <div className="flex flex-col h-full min-h-0 text-[var(--color-text-primary)]">

        {/* ── 컬럼 헤더 ───────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex items-center px-3 py-2 border-b text-[10px] font-medium"
          style={{ borderColor:'var(--color-border)', color:'var(--color-text-muted)',
                   backgroundColor:'var(--color-bg-widget)' }}>
          <div className="w-4" />
          <div className="w-6 text-center">#</div>
          <div className="w-2" />
          <div className="flex-1 text-[10px]">Name</div>
          <div className="w-[80px] text-right">Price</div>
          <div className="w-[66px] text-right">Change</div>
          <div className="w-[64px] text-right">{metricLabel}</div>
        </div>

        {/* ── 목록 ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <WidgetState kind="loading" />
          ) : liveRows.length === 0 ? (
            <WidgetState kind="empty" message="No stocks match this market and period." />
          ) : liveRows.map((row, i) => {
            const sym   = row.stk_cd || '';
            const name  = row.stk_nm || sym;
            const isFav = favorites.includes(sym);

            return (
              <div
                key={sym || i}
                className="flex items-center px-3 py-2.5 border-b cursor-default"
                style={{ borderColor:'var(--color-border-subtle)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
              >
                {/* 즐겨찾기 */}
                <button
                  onClick={() => toggleFav(sym)}
                  className={`w-4 flex justify-center flex-shrink-0 transition-colors ${
                    isFav ? 'text-red-400' : 'text-gray-700 hover:text-red-400'}`}
                >
                  <Heart size={12} fill={isFav ? 'currentColor' : 'none'} />
                </button>

                {/* 순위 */}
                <div className="w-6 text-center text-[11px] font-medium tabular-nums flex-shrink-0"
                  style={{ color:'var(--color-text-muted)' }}>
                  {i + 1}
                </div>

                <div className="w-2" />

                {/* 로고 + 종목명 */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <LogoCircle symbol={sym} />
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold truncate leading-tight">{name}</div>
                    <div className="text-[10px] font-mono leading-tight" style={{ color:'var(--color-text-muted)' }}>{sym}</div>
                  </div>
                </div>

                {/* 현재가 */}
                <div className="w-[80px] text-right flex-shrink-0">
                  <span className="text-[12px] font-semibold tabular-nums">
                    {fmtPrice(row.close_price, row.curr)}
                  </span>
                </div>

                {/* 등락률 pill */}
                <div className="w-[66px] text-right flex-shrink-0 pr-1">
                  <ChangePill value={row.change_rate} />
                </div>

                {/* 거래대금 or 거래량 */}
                <div className="w-[64px] text-right flex-shrink-0">
                  <span className="text-[11px] tabular-nums" style={{ color:'var(--color-text-muted)' }}>
                    {metricFmt(row)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </BaseWidget>
  );
}
