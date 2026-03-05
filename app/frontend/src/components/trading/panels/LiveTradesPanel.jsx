/**
 * LiveTradesPanel – Real-time aggregated trade feed from Binance aggTrade stream.
 * Newest trades appear at the top.
 */

function fmtTime(ts) {
  const d = new Date(ts);
  return [
    d.getHours().toString().padStart(2, '0'),
    d.getMinutes().toString().padStart(2, '0'),
    d.getSeconds().toString().padStart(2, '0'),
  ].join(':');
}

export default function LiveTradesPanel({ trades, hideHeader = false }) {
  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      {!hideHeader && (
      <div className="px-3 py-1.5 border-b border-gray-800/60 shrink-0 flex items-center gap-2">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          Live Trades
        </span>
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
      </div>
      )}

      {/* Column headers */}
      <div
        className="grid gap-1 px-3 py-1 text-[9px] text-gray-700 uppercase tracking-wider border-b border-gray-800/40 shrink-0"
        style={{ gridTemplateColumns: '68px 46px 1fr 1fr 1fr' }}
      >
        <span>Time</span>
        <span>Side</span>
        <span className="text-right">Price</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Total(USDT)</span>
      </div>

      {/* Scrolling rows */}
      <div className="flex-1 overflow-y-auto">
        {trades.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[10px] text-gray-800">
            Connecting to trade stream…
          </div>
        ) : (
          trades.map(t => (
            <div
              key={t.id}
              className={`grid gap-1 px-3 py-0.5 text-[10px] border-b border-gray-800/10 ${
                t.isBuy ? 'hover:bg-green-900/5' : 'hover:bg-red-900/5'
              }`}
              style={{ gridTemplateColumns: '68px 46px 1fr 1fr 1fr' }}
            >
              <span className="text-gray-700 font-mono">{fmtTime(t.time)}</span>
              <span className={`font-semibold text-[9px] ${t.isBuy ? 'text-green-400' : 'text-red-400'}`}>
                {t.isBuy ? 'BUY' : 'SELL'}
              </span>
              <span className={`text-right font-mono tabular-nums ${t.isBuy ? 'text-green-300' : 'text-red-300'}`}>
                {t.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </span>
              <span className="text-right font-mono tabular-nums text-gray-500">
                {t.qty.toFixed(3)}
              </span>
              <span className="text-right font-mono tabular-nums text-gray-600">
                {t.total >= 1000
                  ? `${(t.total / 1000).toFixed(1)}K`
                  : t.total.toFixed(0)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
