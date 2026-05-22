import { useState, useEffect, useRef, useCallback } from 'react';
import { LayoutGrid } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import { apiClient, API_BASE } from '../../config/api';

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

function getColor(sector) {
  return SECTOR_COLORS[sector] || '#6b7280';
}

export default function HeatmapWidget({ onRemove }) {
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('treemap');
  const [selected, setSelected] = useState(null);

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
            <button onClick={() => setSelected(null)} className="text-[10px] text-cyan-400 ml-auto">
              ← All Sectors
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto p-2">
          {!loading && !sectors.length ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-[11px]">No sector data available</div>
          ) : view === 'treemap' ? (
            <Treemap sectors={sectors} selected={selected} onSelect={setSelected} />
          ) : (
            <SectorList sectors={sectors} selected={selected} onSelect={setSelected} />
          )}
        </div>
      </div>
    </BaseWidget>
  );
}

function Treemap({ sectors, selected, onSelect }) {
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: width, h: height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const items = selected
    ? (sectors.find((s) => s.sector === selected)?.stocks || []).map((st) => ({
        label: st.symbol,
        sublabel: st.name,
        value: st.market_cap || 1,
        color: getColor(selected),
      }))
    : sectors.map((s) => ({
        label: s.sector,
        sublabel: `${s.count} stocks`,
        value: s.total_market_cap || 1,
        color: getColor(s.sector),
        sector: s.sector,
      }));

  const rects = layoutTreemap(items, dims.w, dims.h);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[200px]">
      {rects.map((r, i) => (
        <div
          key={i}
          onClick={() => !selected && r.item.sector && onSelect(r.item.sector)}
          className="absolute overflow-hidden flex flex-col justify-center items-center transition-all hover:brightness-125"
          style={{
            left: r.x,
            top: r.y,
            width: Math.max(r.w - 1, 0),
            height: Math.max(r.h - 1, 0),
            backgroundColor: r.item.color,
            opacity: 0.85,
            cursor: !selected ? 'pointer' : 'default',
            borderRadius: 2,
          }}
        >
          {r.w > 40 && r.h > 20 && (
            <span className="text-[10px] font-semibold text-white drop-shadow truncate px-1">
              {r.item.label}
            </span>
          )}
          {r.w > 60 && r.h > 35 && (
            <span className="text-[8px] text-white/70 truncate px-1">{r.item.sublabel}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function layoutTreemap(items, W, H) {
  if (!items.length || W <= 0 || H <= 0) return [];
  const total = items.reduce((s, it) => s + it.value, 0);
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const rects = [];

  let x = 0, y = 0, w = W, h = H;
  let remaining = [...sorted];
  let remTotal = total;

  while (remaining.length > 0) {
    const isWide = w >= h;
    const side = isWide ? h : w;
    let row = [];
    let rowArea = 0;
    let bestAspect = Infinity;

    for (const item of remaining) {
      const testRow = [...row, item];
      const testArea = rowArea + (item.value / remTotal) * w * h;
      const strip = testArea / side;
      const worst = testRow.reduce((worst, it) => {
        const itArea = (it.value / remTotal) * w * h;
        const dim = itArea / strip;
        const aspect = Math.max(strip / dim, dim / strip);
        return Math.max(worst, aspect);
      }, 0);

      if (worst <= bestAspect || row.length === 0) {
        row = testRow;
        rowArea = testArea;
        bestAspect = worst;
      } else {
        break;
      }
    }

    const strip = rowArea / side;
    let offset = 0;
    for (const item of row) {
      const itArea = (item.value / remTotal) * w * h;
      const dim = itArea / strip;
      if (isWide) {
        rects.push({ x: x + offset, y, w: dim, h: strip, item });
        offset += dim;
      } else {
        rects.push({ x, y: y + offset, w: strip, h: dim, item });
        offset += dim;
      }
    }

    if (isWide) {
      y += strip;
      h -= strip;
    } else {
      x += strip;
      w -= strip;
    }

    remaining = remaining.slice(row.length);
    remTotal -= row.reduce((s, it) => s + it.value, 0);
    if (h <= 0 || w <= 0) break;
  }

  return rects;
}

function SectorList({ sectors, selected, onSelect }) {
  const items = selected
    ? sectors.find((s) => s.sector === selected)?.stocks || []
    : sectors;

  return (
    <div className="space-y-1">
      {items.map((item, i) => {
        const isSector = !selected;
        const label = isSector ? item.sector : item.symbol;
        const sub = isSector ? `${item.count} stocks` : item.name;
        const mcap = isSector ? item.total_market_cap : item.market_cap;
        return (
          <button
            key={i}
            onClick={() => isSector && onSelect(item.sector)}
            className="w-full flex items-center justify-between px-3 py-2 bg-[#0a0a0f] rounded hover:bg-gray-800/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              {isSector && (
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: getColor(item.sector) }} />
              )}
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-white truncate">{label}</div>
                <div className="text-[10px] text-gray-500 truncate">{sub}</div>
              </div>
            </div>
            <div className="text-[10px] text-gray-400 tabular-nums flex-shrink-0">
              {mcap >= 1e12 ? `$${(mcap / 1e12).toFixed(1)}T` : mcap >= 1e9 ? `$${(mcap / 1e9).toFixed(0)}B` : '—'}
            </div>
          </button>
        );
      })}
    </div>
  );
}
