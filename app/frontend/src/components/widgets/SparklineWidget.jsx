import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { Activity, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import SymbolAutocomplete from '../common/SymbolAutocomplete';
import { apiClient, API_BASE } from '../../config/api';
import useQuoteSocket from '../../hooks/useQuoteSocket';

const DEFAULT_ITEMS = [
  { sym: '^KS11',     label: 'KOSPI',     market: 'domestic' },
  { sym: '^KQ11',     label: 'KOSDAQ',    market: 'domestic' },
  { sym: '148070.KS', label: '국채10년',  market: 'domestic' },
  { sym: 'QQQ',       label: '나스닥',    market: 'foreign' },
  { sym: 'SPY',       label: 'S&P 500',   market: 'foreign' },
  { sym: 'KRW=X',     label: '달러 환율', market: 'foreign' },
  { sym: '^VIX',      label: 'VIX',       market: 'foreign' },
  { sym: '^TNX',      label: '미국 10Y',  market: 'foreign' },
];

const PERIOD    = '2d';
const INTERVAL  = '5m';
const CARD_GAP = 8;
const CARD_MIN = 160;
const TABS_W   = 116;
const ARROW_W  = 24;

// ── 시장 개장 여부 계산 ──────────────────────────────────────────────────────
function useMarketStatus() {
  const now      = new Date();
  const utcTotal = now.getUTCHours() * 60 + now.getUTCMinutes();

  const krTotal  = (utcTotal + 9 * 60) % 1440;
  const krDay    = new Date(now.getTime() + 9 * 3600 * 1000).getUTCDay();
  const isKROpen = krDay >= 1 && krDay <= 5 && krTotal >= 9 * 60 && krTotal < 15 * 60 + 30;

  const edtTotal = ((utcTotal - 240 + 1440) % 1440);
  const usDay    = new Date(now.getTime() - 4 * 3600 * 1000).getUTCDay();
  const isUSOpen = usDay >= 1 && usDay <= 5 && edtTotal >= 9 * 60 + 30 && edtTotal < 16 * 60;

  return { isKROpen, isUSOpen };
}

export default function SparklineWidget({ onRemove }) {
  const [items,        setItems]        = useState(DEFAULT_ITEMS);
  const [history,      setHistory]      = useState({});
  const [prevClose,    setPrevClose]    = useState({});
  const [loading,      setLoading]      = useState(true);
  const [addOpen,      setAddOpen]      = useState(false);
  const [addInput,     setAddInput]     = useState('');
  const [activeMarket, setActiveMarket] = useState('all'); // 'all' | 'domestic' | 'foreign'
  const addRef = useRef(null);

  const symbols = useMemo(() => items.map((i) => i.sym), [items]);
  const { quotes, connected, subscribe, unsubscribe } = useQuoteSocket();

  useEffect(() => {
    if (symbols.length) subscribe(symbols);
    return () => unsubscribe(symbols);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(',')]);

  const fetchHistory = useCallback(async (syms = symbols) => {
    setLoading(true);
    const results = { ...history };
    const prevCloses = { ...prevClose };
    await Promise.allSettled(
      syms.map(async (sym) => {
        if (results[sym]?.length) return;
        try {
          const res = await apiClient.get(
            `${API_BASE}/stock/history/${encodeURIComponent(sym)}?period=${PERIOD}&interval=${INTERVAL}`
          );
          const bars = (res.results || res.data || res.prices || []).filter((d) => (d.close ?? d.Close) != null);
          if (bars.length === 0) { results[sym] = []; return; }

          const todayStr = bars[bars.length - 1].date?.slice(0, 10);
          const todayBars = [];
          let lastPrevClose = null;
          for (const b of bars) {
            if (b.date?.slice(0, 10) === todayStr) {
              todayBars.push(b.close ?? b.Close);
            } else {
              lastPrevClose = b.close ?? b.Close;
            }
          }
          results[sym] = todayBars.length ? todayBars : bars.map((d) => d.close ?? d.Close);
          if (lastPrevClose != null) prevCloses[sym] = lastPrevClose;
        } catch {
          results[sym] = [];
        }
      })
    );
    setHistory({ ...results });
    setPrevClose({ ...prevCloses });
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(',')]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // 심볼 추가
  const addSymbol = (stock) => {
    const sym   = (stock?.symbol || addInput).toUpperCase().trim();
    const label = stock?.name?.split(' ')[0] || sym;
    if (!sym || items.find((i) => i.sym === sym)) return;
    const next = [...items, { sym, label, market: 'foreign' }];
    setItems(next);
    fetchHistory([sym]);
    setAddInput('');
    setAddOpen(false);
  };

  // 심볼 제거
  const removeSymbol = (sym) => setItems((p) => p.filter((i) => i.sym !== sym));

  // 팔레트 외부 클릭 닫기
  useEffect(() => {
    if (!addOpen) return;
    const handler = (e) => {
      if (addRef.current && !addRef.current.contains(e.target)) setAddOpen(false);
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [addOpen]);

  // 필터링된 항목
  const filteredItems = useMemo(() =>
    activeMarket === 'all' ? items : items.filter((i) => i.market === activeMarket || !i.market),
  [items, activeMarket]);

  // ── 컨테이너 크기 감지 ────────────────────────────────────────────────────
  const containerRef = useRef(null);
  const [containerW, setContainerW] = useState(800);
  const [containerH, setContainerH] = useState(120);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width  > 0) setContainerW(Math.floor(r.width));
      if (r.height > 0) setContainerH(Math.floor(r.height));
    };
    measure();
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width  > 0) setContainerW(Math.floor(width));
      if (height > 0) setContainerH(Math.floor(height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const showTabs   = containerW >= 280 && containerH >= 36;
  const showArrows = filteredItems.length > 1 && containerW >= 200;
  const tabsW      = showTabs ? TABS_W + 1 : 0; // +1 = 구분선
  const arrowW     = showArrows ? ARROW_W : 0;

  const available  = Math.max(0, containerW - tabsW - arrowW * 2 - CARD_GAP);
  const maxVisible = Math.max(1, Math.floor((available + CARD_GAP) / (CARD_MIN + CARD_GAP)));
  const visibleN   = Math.min(filteredItems.length, maxVisible);
  const idealW     = Math.floor((available - CARD_GAP * (visibleN - 1)) / visibleN);
  const cardW      = Math.max(1, Math.min(idealW, 320));
  // 고정 높이 — split bar 이동에 따라 동적 변경 안 함
  const cardH      = 72;

  // ── 슬라이드 ─────────────────────────────────────────────────────────────
  const scrollRef = useRef(null);
  const autoRef   = useRef(null);

  const slide = useCallback((dir) => {
    clearInterval(autoRef.current);
    scrollRef.current?.scrollBy({
      left: dir * (cardW + CARD_GAP) * visibleN,
      behavior: 'smooth',
    });
  }, [cardW, visibleN]);

  useEffect(() => {
    clearInterval(autoRef.current);
    if (filteredItems.length <= visibleN) return;
    autoRef.current = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      el.scrollLeft >= max - 4
        ? el.scrollTo({ left: 0, behavior: 'smooth' })
        : el.scrollBy({ left: (cardW + CARD_GAP) * visibleN, behavior: 'smooth' });
    }, 4000);
    return () => clearInterval(autoRef.current);
  }, [cardW, visibleN, filteredItems.length]);

  // ── 헤더 Extra (+ 추가 버튼) ─────────────────────────────────────────────
  const headerExtra = (
    <div ref={addRef} className="relative flex items-center gap-2">
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${connected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`}
        title={connected ? '실시간 연결됨' : '연결 대기 중'}
      />
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => setAddOpen((v) => !v)}
        className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-cyan-400 border border-cyan-800/50 rounded hover:bg-cyan-900/30 transition-colors"
      >
        <Plus size={11} />
        Add
      </button>

      {addOpen && (
        <div
          className="absolute right-0 top-full mt-1 z-[200] w-56 bg-[#0d0d12] border border-gray-700 rounded-lg shadow-2xl p-2"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <SymbolAutocomplete
            value={addInput}
            onChange={setAddInput}
            onSelect={addSymbol}
            placeholder="심볼 검색…"
            compact
          />
          {addInput && (
            <button
              onClick={() => addSymbol(null)}
              className="mt-1.5 w-full text-[11px] text-cyan-400 hover:bg-cyan-900/30 rounded py-1 transition-colors"
            >
              "{addInput}" 직접 추가
            </button>
          )}
        </div>
      )}
    </div>
  );

  const { isKROpen, isUSOpen } = useMarketStatus();

  return (
    <BaseWidget
      title="Index Charts"
      icon={Activity}
      loading={loading && Object.keys(history).length === 0}
      onRefresh={() => { setHistory({}); fetchHistory(); }}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
      headerExtra={headerExtra}
    >
      <div ref={containerRef} className="w-full h-full flex items-stretch overflow-hidden">

        {/* ── 국내/해외 필터 탭 ──────────────────────────────────────── */}
        {showTabs && (
          <>
            <MarketFilterTabs
              active={activeMarket}
              onChange={setActiveMarket}
              isKROpen={isKROpen}
              isUSOpen={isUSOpen}
              width={TABS_W}
            />
            <div className="w-px bg-gray-800 flex-shrink-0 my-2" />
          </>
        )}

        {/* ── 좌 화살표 ─────────────────────────────────────────────── */}
        {showArrows && (
          <button
            onClick={() => slide(-1)}
            className="flex items-center justify-center flex-shrink-0 text-gray-600 hover:text-gray-300 transition-colors"
            style={{
              width: ARROW_W,
              background: 'linear-gradient(to right, var(--color-bg-widget,#0d0d12) 50%, transparent)',
            }}
          >
            <ChevronLeft size={13} />
          </button>
        )}

        {/* ── 카드 트랙 ──────────────────────────────────────────────── */}
        <div
          ref={scrollRef}
          className="flex items-center overflow-x-auto overflow-y-hidden"
          style={{
            flex: 1,
            minWidth: 0,
            gap: CARD_GAP,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            scrollSnapType: 'x mandatory',
            padding: '4px 2px',
          }}
        >
          {filteredItems.map(({ sym, label }) => {
            const prices  = history[sym] || [];
            const live    = quotes[sym];
            const lastP   = prices[prices.length - 1];
            const price   = live?.price ?? lastP;
            const pc      = prevClose[sym];
            const pct     = pc && price ? ((price - pc) / pc) * 100
                          : live?.change_percent ?? null;
            const isUp    = (pct ?? 0) >= 0;

            return (
              <TickerCard
                key={sym}
                label={label}
                sym={sym}
                prices={prices}
                price={price}
                pct={pct}
                isUp={isUp}
                loading={loading && prices.length === 0}
                cardW={cardW}
                cardH={cardH}
                onRemove={() => removeSymbol(sym)}
              />
            );
          })}
        </div>

        {/* ── 우 화살표 ─────────────────────────────────────────────── */}
        {showArrows && (
          <button
            onClick={() => slide(1)}
            className="flex items-center justify-center flex-shrink-0 text-gray-600 hover:text-gray-300 transition-colors"
            style={{
              width: ARROW_W,
              background: 'linear-gradient(to left, var(--color-bg-widget,#0d0d12) 50%, transparent)',
            }}
          >
            <ChevronRight size={13} />
          </button>
        )}

      </div>
    </BaseWidget>
  );
}

// ── 국내/해외 필터 탭 ────────────────────────────────────────────────────────
function MarketFilterTabs({ active, onChange, isKROpen, isUSOpen, width }) {
  const tabs = [
    { key: 'domestic', label: '국내 장', isOpen: isKROpen },
    { key: 'foreign',  label: '해외 장', isOpen: isUSOpen },
  ];

  return (
    <div className="flex flex-col justify-center gap-1 px-2 flex-shrink-0" style={{ width }}>
      {tabs.map(({ key, label, isOpen }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onChange(isActive ? 'all' : key)}
            className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-left transition-colors ${
              isActive
                ? 'bg-white/5 text-gray-200'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOpen ? 'bg-green-400' : 'bg-gray-600'}`}
            />
            <span className="text-[10px] font-medium leading-tight">
              {label} {isOpen ? '열림' : '닫힘'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── 개별 카드 ────────────────────────────────────────────────────────────────
function TickerCard({ label, sym, prices, price, pct, isUp, loading, cardW, cardH, onRemove }) {
  const color      = isUp ? '#ef4444' : '#3b82f6';
  const colorClass = isUp ? 'text-red-400' : 'text-blue-400';

  // 높이 단계별 표시 여부
  const showLabel    = cardH >= 52;   // 레이블(ticker name) 표시
  const showSparkline = cardH >= 36;  // 스파크라인 표시
  const showRemove   = cardH >= 30;

  // 높이에 따른 폰트 크기
  const priceSize = cardH >= 48 ? 'text-[13px]' : cardH >= 32 ? 'text-[11px]' : 'text-[9px]';
  const pctSize   = cardH >= 36 ? 'text-[10px]' : 'text-[9px]';

  const fmt = (v) => {
    if (v == null) return '—';
    if (v >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return v.toFixed(2);
  };

  const INNER  = cardW - 24;
  const TEXT_W = Math.min(84, INNER);
  const chartW = showSparkline && INNER - TEXT_W >= 36 ? INNER - TEXT_W : 0;
  const chartH = Math.max(12, cardH - 8);

  return (
    <div
      className="group relative flex-shrink-0 flex items-center gap-2 rounded-lg px-2 overflow-hidden"
      style={{
        width: cardW,
        height: cardH,
        scrollSnapAlign: 'start',
        border: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
        flexShrink: 0,
      }}
    >
      {showRemove && (
        <button
          onClick={onRemove}
          className="absolute top-0.5 right-0.5 z-10 text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X size={9} />
        </button>
      )}

      {chartW > 0 && (
        <div className="flex-shrink-0" style={{ width: chartW, height: chartH }}>
          {loading ? (
            <div className="w-full h-full rounded bg-gray-800 animate-pulse" />
          ) : (
            <MiniSparkline prices={prices} color={color} />
          )}
        </div>
      )}

      <div className="flex flex-col justify-center min-w-0 flex-1" style={{ maxWidth: TEXT_W }}>
        {showLabel && (
          <span className="text-[9px] text-gray-400 leading-tight truncate">{label}</span>
        )}
        <span className={`${priceSize} font-bold text-white tabular-nums leading-none`}>
          {fmt(price)}
        </span>
        <span className={`${pctSize} font-semibold tabular-nums leading-tight ${colorClass}`}>
          {pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : '—'}
        </span>
      </div>
    </div>
  );
}

// ── 미니 스파크라인 ──────────────────────────────────────────────────────────
const VW = 200, VH = 60;

function MiniSparkline({ prices, color }) {
  const { line, area } = useMemo(() => {
    if (prices.length < 2) return { line: null, area: null };
    const pad   = 2;
    const min   = Math.min(...prices);
    const max   = Math.max(...prices);
    const range = max - min || 1;
    const px = (i) => pad + (i / (prices.length - 1)) * (VW - pad * 2);
    const py = (v) => (VH - pad) - ((v - min) / range) * (VH - pad * 2);
    let d = `M ${px(0).toFixed(1)} ${py(prices[0]).toFixed(1)}`;
    for (let i = 1; i < prices.length; i++) {
      const x0 = px(i - 1), y0 = py(prices[i - 1]);
      const x1 = px(i),     y1 = py(prices[i]);
      const cx = ((x0 + x1) / 2).toFixed(1);
      d += ` C ${cx} ${y0.toFixed(1)}, ${cx} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    const n = prices.length - 1;
    const a = `${d} L ${px(n).toFixed(1)} ${VH} L ${px(0).toFixed(1)} ${VH} Z`;
    return { line: d, area: a };
  }, [prices]);

  const gradId = `spark-${color.replace('#', '')}`;
  if (!line) return <div className="w-full h-full rounded bg-gray-800 animate-pulse" />;

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none"
      style={{ display: 'block', width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
