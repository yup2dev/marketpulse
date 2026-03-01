/**
 * StockOrderBookPanel — Korean-style 호가창 + depth area chart.
 *
 * Top section:  ask levels (red)  descending
 * Middle:       spread / mid price
 * Bottom:       bid levels (green) descending
 *
 * Right panel: cumulative depth area chart (asks right, bids left).
 */
import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPrice(p) {
  if (p == null) return '—';
  return p >= 100 ? p.toFixed(2) : p.toFixed(4);
}

function fmtSize(s) {
  if (s == null) return '—';
  if (s >= 1_000_000) return `${(s / 1_000_000).toFixed(1)}M`;
  if (s >= 1_000)     return `${(s / 1_000).toFixed(1)}K`;
  return s.toString();
}

// ─── Order book row ───────────────────────────────────────────────────────────

function OBRow({ price, size, maxSize, side }) {
  const pct = maxSize > 0 ? (size / maxSize) * 100 : 0;
  const isAsk = side === 'ask';

  return (
    <div className="relative flex items-center justify-between px-2 py-[2px] text-[10px] font-mono overflow-hidden group">
      {/* Volume bar behind the row */}
      <div
        className={`absolute inset-y-0 ${isAsk ? 'right-0' : 'right-0'} ${
          isAsk ? 'bg-red-500/10' : 'bg-green-500/10'
        }`}
        style={{ width: `${pct}%` }}
      />
      <span className={`relative z-10 tabular-nums ${isAsk ? 'text-red-400' : 'text-green-400'}`}>
        {fmtPrice(price)}
      </span>
      <span className="relative z-10 text-gray-500 tabular-nums">
        {fmtSize(size)}
      </span>
    </div>
  );
}

// ─── Depth chart tooltip ──────────────────────────────────────────────────────

const DepthTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-[#0d0d12] border border-gray-700 rounded px-2 py-1 text-[10px]">
      <div className="text-gray-500">Price: {fmtPrice(d?.price)}</div>
      {d?.bid != null && <div className="text-green-400">Bid depth: {fmtSize(d.bid)}</div>}
      {d?.ask != null && <div className="text-red-400">Ask depth: {fmtSize(d.ask)}</div>}
    </div>
  );
};

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function StockOrderBookPanel({ bids, asks, source }) {
  // Up to 8 levels each side for the table
  const askRows = asks.slice(0, 8);
  const bidRows = bids.slice(0, 8);

  const maxAskSize = Math.max(...askRows.map(r => r.size), 1);
  const maxBidSize = Math.max(...bidRows.map(r => r.size), 1);

  const bestBid = bids[0]?.price;
  const bestAsk = asks[0]?.price;
  const spread  = bestBid && bestAsk ? (bestAsk - bestBid).toFixed(2) : null;
  const mid     = bestBid && bestAsk ? ((bestBid + bestAsk) / 2).toFixed(2) : null;

  // Depth chart data
  const depthData = useMemo(() => {
    const sortedBids = [...bids].sort((a, b) => b.price - a.price).slice(0, 20);
    const sortedAsks = [...asks].sort((a, b) => a.price - b.price).slice(0, 20);

    let cumBid = 0;
    const bidRows = sortedBids.map(({ price, size }) => {
      cumBid += size;
      return { price, bid: cumBid };
    }).reverse();

    let cumAsk = 0;
    const askRows = sortedAsks.map(({ price, size }) => {
      cumAsk += size;
      return { price, ask: cumAsk };
    });

    return [...bidRows, ...askRows];
  }, [bids, asks]);

  const isEmpty = bids.length === 0 && asks.length === 0;

  if (isEmpty) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-700">
        Waiting for order book…
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">

      {/* ── 호가창 table ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-2 py-1 text-[9px] text-gray-700 border-b border-gray-800 shrink-0">
          <span>Price</span>
          <span>Size</span>
        </div>

        {/* Ask levels (red) — show in ascending price order top→bottom */}
        <div className="flex flex-col-reverse shrink-0">
          {askRows.map((row, i) => (
            <OBRow key={i} price={row.price} size={row.size} maxSize={maxAskSize} side="ask" />
          ))}
        </div>

        {/* Mid / spread */}
        <div className="flex items-center justify-between px-2 py-1 shrink-0 border-y border-gray-800 bg-[#0a0a0f]">
          <span className="text-[10px] text-gray-300 font-mono tabular-nums font-semibold">
            {mid ?? '—'}
          </span>
          {spread && (
            <span className="text-[9px] text-gray-600">
              spread {spread}
            </span>
          )}
        </div>

        {/* Bid levels (green) */}
        <div className="flex flex-col shrink-0">
          {bidRows.map((row, i) => (
            <OBRow key={i} price={row.price} size={row.size} maxSize={maxBidSize} side="bid" />
          ))}
        </div>
      </div>

      {/* ── Depth chart ────────────────────────────────────────── */}
      {depthData.length > 0 && (
        <div className="h-28 shrink-0 border-t border-gray-800">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={depthData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <XAxis
                dataKey="price"
                tick={{ fontSize: 7, fill: '#4b5563', fontFamily: 'monospace' }}
                tickFormatter={v => fmtPrice(v)}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 7, fill: '#4b5563', fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
                width={32}
                tickFormatter={fmtSize}
              />
              <Tooltip content={<DepthTooltip />} />
              <Area
                type="stepAfter"
                dataKey="bid"
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.15}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
              <Area
                type="stepBefore"
                dataKey="ask"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.15}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Source label */}
      {source && (
        <div className="px-2 py-0.5 text-[8px] text-gray-800 shrink-0">
          {source === 'quotes' ? 'NBBO aggregated · Polygon.io' : 'Best bid/ask · Polygon.io snapshot'}
        </div>
      )}
    </div>
  );
}
