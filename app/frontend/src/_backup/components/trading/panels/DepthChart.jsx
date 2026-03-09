/**
 * DepthChart – Orderbook depth chart (bid/ask cumulative volume by price).
 * Bids (green) on the left, Asks (red) on the right.
 */
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useMemo } from 'react';

function fmtPrice(p) {
  return p >= 100 ? p.toFixed(0) : p.toFixed(3);
}

function fmtQty(q) {
  return q >= 100 ? q.toFixed(0) : q.toFixed(3);
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-[#0d0d12] border border-gray-700 rounded px-2 py-1 text-[10px] space-y-0.5">
      <div className="text-gray-500">Price: {fmtPrice(d.price)}</div>
      {d.bid != null && <div className="text-green-400">Bid depth: {fmtQty(d.bid)}</div>}
      {d.ask != null && <div className="text-red-400">Ask depth: {fmtQty(d.ask)}</div>}
    </div>
  );
};

export default function DepthChart({ bids, asks }) {
  const data = useMemo(() => {
    if (bids.length === 0 && asks.length === 0) return [];

    // Sort bids descending (best bid first), take top 20
    const sortedBids = [...bids].sort((a, b) => b[0] - a[0]).slice(0, 20);
    // Sort asks ascending (best ask first), take top 20
    const sortedAsks = [...asks].sort((a, b) => a[0] - b[0]).slice(0, 20);

    // Cumulative bids: accumulate from best bid downward
    let cumBid = 0;
    const bidRows = sortedBids.map(([p, q]) => {
      cumBid += q;
      return { price: p, bid: +cumBid.toFixed(4) };
    }).reverse(); // reverse so price ascends left→right

    // Cumulative asks: accumulate from best ask upward
    let cumAsk = 0;
    const askRows = sortedAsks.map(([p, q]) => {
      cumAsk += q;
      return { price: p, ask: +cumAsk.toFixed(4) };
    });

    return [...bidRows, ...askRows];
  }, [bids, asks]);

  const midPrice = useMemo(() => {
    const bestBid = bids.length ? Math.max(...bids.map(b => b[0])) : 0;
    const bestAsk = asks.length ? Math.min(...asks.map(a => a[0])) : 0;
    return bestBid && bestAsk ? ((bestBid + bestAsk) / 2).toFixed(1) : null;
  }, [bids, asks]);

  const spread = useMemo(() => {
    const bestBid = bids.length ? Math.max(...bids.map(b => b[0])) : 0;
    const bestAsk = asks.length ? Math.min(...asks.map(a => a[0])) : 0;
    return bestBid && bestAsk ? (bestAsk - bestBid).toFixed(2) : null;
  }, [bids, asks]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="text-[10px] text-gray-600 px-1 mb-0.5 shrink-0 flex items-center gap-2">
        <span>Depth</span>
        <span className="text-gray-800">·</span>
        <span>Orderbook</span>
        {midPrice && (
          <span className="ml-auto text-gray-500 tabular-nums">
            mid {midPrice}
            {spread && <span className="text-gray-700 ml-1">Δ{spread}</span>}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[10px] text-gray-800">
            Waiting for orderbook…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <XAxis
                dataKey="price"
                tick={{ fontSize: 8, fill: '#4b5563', fontFamily: 'monospace' }}
                tickFormatter={fmtPrice}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 8, fill: '#4b5563', fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
                width={38}
                tickFormatter={fmtQty}
              />
              <Tooltip content={<CustomTooltip />} />
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
        )}
      </div>
    </div>
  );
}
