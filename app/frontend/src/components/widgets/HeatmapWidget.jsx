import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { LayoutGrid } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import { apiClient, API_BASE } from '../../config/api';
import useQuoteSocket from '../../hooks/useQuoteSocket';

const SECTOR_COLORS = {
  'Technology':             '#3b82f6',
  'Healthcare':             '#22c55e',
  'Financial Services':     '#f59e0b',
  'Consumer Cyclical':      '#ec4899',
  'Communication Services': '#8b5cf6',
  'Industrials':            '#06b6d4',
  'Consumer Defensive':     '#10b981',
  'Energy':                 '#ef4444',
  'Utilities':              '#a855f7',
  'Real Estate':            '#f97316',
  'Basic Materials':        '#14b8a6',
};

function getSectorColor(sector) {
  return SECTOR_COLORS[sector] || '#6b7280';
}

function fmtMcap(v) {
  if (!v) return '—';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(0)}B`;
  return `$${(v / 1e6).toFixed(0)}M`;
}

// Green-red gradient: ±5% = full saturation
function changeColor(pct) {
  if (pct == null) return '#1f2937';
  const t = Math.max(-1, Math.min(1, pct / 5));
  if (t >= 0) {
    const g = Math.round(80 + 110 * t);
    return `rgb(15,${g},45)`;
  } else {
    const u = -t;
    const r = Math.round(90 + 140 * u);
    return `rgb(${r},18,18)`;
  }
}

function fmtChange(pct) {
  if (pct == null) return '';
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

// ── Squarified treemap layout ──────────────────────────────────────────────

function layoutTreemap(items, W, H) {
  if (!items.length || W <= 0 || H <= 0) return [];
  const total = items.reduce((s, it) => s + it.value, 0);
  if (total <= 0) return [];
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const rects = [];
  let x = 0, y = 0, remW = W, remH = H;
  let remaining = [...sorted];
  let remTotal = total;

  while (remaining.length > 0 && remW > 1 && remH > 1) {
    const isWide   = remW >= remH;
    const longSide  = isWide ? remW : remH;
    const shortSide = isWide ? remH : remW;

    let bestRow = [], bestValue = 0, bestAspect = Infinity;
    let row = [], rowValue = 0;

    for (const item of remaining) {
      row = [...row, item];
      rowValue += item.value;
      const stripLen = (rowValue / remTotal) * shortSide;
      if (stripLen <= 0) continue;
      let worst = 0;
      for (const it of row) {
        const dim = (it.value / rowValue) * longSide;
        worst = Math.max(worst, dim > stripLen ? dim / stripLen : stripLen / dim);
      }
      if (worst < bestAspect || bestRow.length === 0) {
        bestRow = [...row]; bestValue = rowValue; bestAspect = worst;
      } else break;
    }

    const stripLen = (bestValue / remTotal) * shortSide;
    let offset = 0;
    for (const item of bestRow) {
      const dim = (item.value / bestValue) * longSide;
      if (isWide) rects.push({ x: x + offset, y, w: dim, h: stripLen, item });
      else        rects.push({ x, y: y + offset, w: stripLen, h: dim, item });
      offset += dim;
    }
    if (isWide) { y += stripLen; remH -= stripLen; }
    else        { x += stripLen; remW -= stripLen; }
    remaining = remaining.slice(bestRow.length);
    remTotal -= bestValue;
  }
  return rects;
}

// ── Main widget ────────────────────────────────────────────────────────────

export default function HeatmapWidget({ onRemove }) {
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('treemap');
  const [selected, setSelected] = useState(null);

  const { quotes, connected, subscribe, unsubscribe } = useQuoteSocket();

  const fetchSectors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`${API_BASE}/stock/sector-performance`);
      setSectors(res.sectors || []);
    } catch {
      setSectors([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSectors(); }, [fetchSectors]);

  // Subscribe to all symbols for live updates
  const allSymbols = useMemo(
    () => sectors.flatMap(s => s.stocks.map(st => st.symbol)),
    [sectors]
  );
  const prevSymbolsRef = useRef([]);
  useEffect(() => {
    const prev = prevSymbolsRef.current;
    const toUnsub = prev.filter(s => !allSymbols.includes(s));
    const toSub   = allSymbols.filter(s => !prev.includes(s));
    if (toUnsub.length) unsubscribe(toUnsub);
    if (toSub.length)   subscribe(toSub);
    prevSymbolsRef.current = allSymbols;
    return () => { if (prevSymbolsRef.current.length) unsubscribe(prevSymbolsRef.current); };
  }, [allSymbols, subscribe, unsubscribe]);

  const wsIndicator = (
    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${connected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
  );

  return (
    <BaseWidget
      title="Sector Heatmap"
      icon={LayoutGrid}
      loading={loading}
      onRefresh={fetchSectors}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
    >
      <div className="flex flex-col h-full min-h-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 pt-2 pb-1 flex-shrink-0">
          {['treemap', 'list'].map((v) => (
            <button
              key={v}
              onClick={() => { setView(v); setSelected(null); }}
              className={`text-[10px] font-medium pb-0.5 ${
                view === v ? 'text-white border-b border-cyan-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {v === 'treemap' ? 'Treemap' : 'List'}
            </button>
          ))}
          {selected && (
            <button onClick={() => setSelected(null)} className="text-[10px] text-cyan-400 ml-2">
              ← All Sectors
            </button>
          )}
          {selected && (
            <span className="text-[10px] text-gray-500">
              {sectors.find(s => s.sector === selected)?.count ?? 0} stocks
            </span>
          )}
          <span className="ml-auto flex items-center text-[9px] text-gray-600">
            {wsIndicator}{connected ? 'Live' : 'Connecting…'}
          </span>
        </div>

        <div className={`flex-1 min-h-0 p-2 ${view === 'list' ? 'overflow-auto' : 'overflow-hidden'}`}>
          {!loading && !sectors.length ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-[11px]">
              No sector data available
            </div>
          ) : view === 'treemap' ? (
            <NestedTreemap
              sectors={sectors}
              quotes={quotes}
              selected={selected}
              onSelect={setSelected}
            />
          ) : (
            <SectorList
              sectors={sectors}
              quotes={quotes}
              selected={selected}
              onSelect={setSelected}
            />
          )}
        </div>
      </div>
    </BaseWidget>
  );
}

// ── Nested Treemap ─────────────────────────────────────────────────────────

const HEADER_H = 15;
const GAP = 1;

function NestedTreemap({ sectors, quotes, selected, onSelect }) {
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Sector layout — stable (market_cap rarely changes)
  const sectorRects = useMemo(() => {
    if (!dims.w || !dims.h || !sectors.length) return [];
    const items = sectors.map(s => ({
      ...s,
      value: Math.max(s.total_market_cap || 1, 1),
    }));
    return layoutTreemap(items, dims.w, dims.h);
  }, [sectors, dims]);

  // Stock layout per sector — stable (market_cap rarely changes)
  const stockRectsMap = useMemo(() => {
    const map = {};
    for (const sr of sectorRects) {
      const tw = Math.max(sr.w - 2, 0);
      const th = Math.max(sr.h - 2, 0);
      const innerW = tw - GAP * 2;
      const innerH = th - HEADER_H - GAP * 2;
      if (innerW < 4 || innerH < 4) { map[sr.item.sector] = []; continue; }
      const items = (sr.item.stocks || []).map(st => ({
        symbol: st.symbol,
        name: st.name,
        value: Math.max(st.market_cap || 1, 1),
        // static change_pct from API (live override comes from quotes at render time)
        change_pct: st.change_pct,
      }));
      map[sr.item.sector] = layoutTreemap(items, innerW, innerH);
    }
    return map;
  }, [sectorRects]);

  // Drill-down: single sector
  if (selected) {
    const sec = sectors.find(s => s.sector === selected);
    const stocks = (sec?.stocks || []).map(st => ({
      symbol: st.symbol,
      name: st.name,
      value: Math.max(st.market_cap || 1, 1),
      change_pct: st.change_pct,
    }));
    const rects = dims.w > 0 && dims.h > 0 ? layoutTreemap(stocks, dims.w, dims.h) : [];

    return (
      <div ref={containerRef} className="relative w-full h-full">
        <svg width={dims.w} height={dims.h} className="absolute inset-0" style={{ shapeRendering: 'crispEdges' }}>
          {rects.map((r, i) => {
            const live = quotes[r.item.symbol];
            const pct  = live?.change_percent ?? r.item.change_pct;
            const tw   = Math.max(r.w - 2, 0);
            const th   = Math.max(r.h - 2, 0);
            const showLbl = tw > 24 && th > 13;
            const showChg = tw > 32 && th > 26;
            const fs = Math.max(7, Math.min(12, tw / 5.5));
            return (
              <g key={i}>
                <rect x={r.x+1} y={r.y+1} width={tw} height={th}
                  fill={changeColor(pct)} fillOpacity={0.9} rx={2} />
                {showLbl && (
                  <text x={r.x + r.w/2} y={r.y + r.h/2 - (showChg ? fs * 0.65 : 0)}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="white" fontSize={fs} fontWeight={600}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {r.item.symbol}
                  </text>
                )}
                {showChg && pct != null && (
                  <text x={r.x + r.w/2} y={r.y + r.h/2 + fs * 0.85}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="rgba(255,255,255,0.8)" fontSize={Math.max(6, fs - 1)}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {fmtChange(pct)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  // Default: nested sector + stock treemap
  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg width={dims.w} height={dims.h} className="absolute inset-0" style={{ shapeRendering: 'crispEdges' }}>
        {sectorRects.map((sr, si) => {
          const sectorName  = sr.item.sector;
          const sectorColor = getSectorColor(sectorName);
          const tw = Math.max(sr.w - 2, 0);
          const th = Math.max(sr.h - 2, 0);
          const showHdr = tw > 28 && th > HEADER_H + 8;
          const hdrH = showHdr ? HEADER_H : 0;
          const innerX = sr.x + 1 + GAP;
          const innerY = sr.y + 1 + hdrH + GAP;
          const sLabelFs = Math.max(8, Math.min(11, tw / 9));
          const stockRects = stockRectsMap[sectorName] || [];

          return (
            <g key={si} onClick={() => onSelect(sectorName)} style={{ cursor: 'pointer' }}>
              {/* Sector border */}
              <rect x={sr.x+1} y={sr.y+1} width={tw} height={th}
                fill={sectorColor} fillOpacity={0.06} rx={2}
                stroke={sectorColor} strokeWidth={0.8} strokeOpacity={0.35} />

              {/* Sector header */}
              {showHdr && (
                <>
                  <rect x={sr.x+1} y={sr.y+1} width={tw} height={HEADER_H}
                    fill={sectorColor} fillOpacity={0.5} rx={2} />
                  <text x={sr.x + 1 + tw / 2} y={sr.y + 1 + HEADER_H / 2}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="white" fontSize={sLabelFs} fontWeight={700}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {tw > 70 ? sectorName : sectorName.split(' ').slice(0, 2).join(' ')}
                  </text>
                </>
              )}

              {/* Stock cells */}
              {stockRects.map((r, i) => {
                const sym  = r.item.symbol;
                const live = quotes[sym];
                const pct  = live?.change_percent ?? r.item.change_pct;
                const stw  = Math.max(r.w - 1, 0);
                const sth  = Math.max(r.h - 1, 0);
                const showLbl = stw > 20 && sth > 11;
                const showChg = stw > 28 && sth > 24;
                const fs = Math.max(6, Math.min(10, stw / 4.5));
                return (
                  <g key={i}>
                    <rect
                      x={innerX + r.x + 0.5}
                      y={innerY + r.y + 0.5}
                      width={stw} height={sth}
                      fill={changeColor(pct)} fillOpacity={0.88} rx={1}
                    />
                    {showLbl && (
                      <text
                        x={innerX + r.x + r.w / 2}
                        y={innerY + r.y + r.h / 2 - (showChg ? fs * 0.6 : 0)}
                        textAnchor="middle" dominantBaseline="middle"
                        fill="white" fontSize={fs} fontWeight={600}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}>
                        {sym}
                      </text>
                    )}
                    {showChg && pct != null && (
                      <text
                        x={innerX + r.x + r.w / 2}
                        y={innerY + r.y + r.h / 2 + fs * 0.8}
                        textAnchor="middle" dominantBaseline="middle"
                        fill="rgba(255,255,255,0.75)" fontSize={Math.max(5, fs - 1)}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}>
                        {fmtChange(pct)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Sector List ────────────────────────────────────────────────────────────

function SectorList({ sectors, quotes, selected, onSelect }) {
  const items = selected
    ? sectors.find((s) => s.sector === selected)?.stocks || []
    : sectors;

  return (
    <div className="space-y-1">
      {items.map((item, i) => {
        const isSector = !selected;
        const label    = isSector ? item.sector : item.symbol;
        const sub      = isSector ? `${item.count} stocks` : (item.name || '');
        const mcap     = isSector ? item.total_market_cap : item.market_cap;
        const live     = !isSector && quotes[item.symbol];
        const pct      = live?.change_percent ?? item.change_pct;

        return (
          <button
            key={i}
            onClick={() => isSector && onSelect(item.sector)}
            className="w-full flex items-center justify-between px-3 py-2 bg-[#0a0a0f] rounded hover:bg-gray-800/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              {isSector ? (
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: getSectorColor(item.sector) }} />
              ) : (
                <div className="w-1.5 h-8 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: changeColor(pct) }} />
              )}
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-white truncate">{label}</div>
                <div className="text-[10px] text-gray-500 truncate">{sub}</div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
              <div className="text-[10px] text-gray-400 tabular-nums">{fmtMcap(mcap)}</div>
              {!isSector && pct != null && (
                <div className={`text-[10px] tabular-nums font-medium ${pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtChange(pct)}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
