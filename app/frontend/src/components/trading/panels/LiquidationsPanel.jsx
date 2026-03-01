/**
 * LiquidationsPanel – Real-time liquidation events from Binance forceOrder stream.
 */

function fmtTime(ts) {
  const d = new Date(ts);
  return [
    d.getHours().toString().padStart(2, '0'),
    d.getMinutes().toString().padStart(2, '0'),
    d.getSeconds().toString().padStart(2, '0'),
  ].join(':');
}

function fmtNum(n, dec = 2) {
  return n.toLocaleString('en-US', { maximumFractionDigits: dec, minimumFractionDigits: dec });
}

export default function LiquidationsPanel({ liquidations, hideHeader = false }) {
  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      {!hideHeader && (
        <div className="px-3 py-1.5 border-b border-gray-800/60 shrink-0 flex items-center gap-2">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Liquidations
          </span>
          {liquidations.length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 bg-red-900/20 text-red-400 border border-red-800/30 rounded-full tabular-nums">
              {liquidations.length}
            </span>
          )}
        </div>
      )}

      {/* Column headers */}
      <div
        className="grid gap-1 px-3 py-1 text-[9px] text-gray-700 uppercase tracking-wider border-b border-gray-800/40 shrink-0"
        style={{ gridTemplateColumns: '70px 46px 1fr 1fr 1fr 70px' }}
      >
        <span>Time</span>
        <span>Side</span>
        <span className="text-right">Price</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Total(USDT)</span>
        <span>Symbol</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {liquidations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[10px] text-gray-800 gap-1">
            <span>Waiting for liquidation data...</span>
            <span className="text-[9px] text-gray-900">Events appear when large positions are force-closed</span>
          </div>
        ) : (
          liquidations.map(liq => (
            <div
              key={liq.id}
              className="grid gap-1 px-3 py-1 text-[10px] border-b border-gray-800/20 hover:bg-gray-800/10 transition-colors"
              style={{ gridTemplateColumns: '70px 46px 1fr 1fr 1fr 70px' }}
            >
              <span className="text-gray-600 font-mono">{fmtTime(liq.time)}</span>
              <span className={`font-semibold ${liq.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                {liq.side}
              </span>
              <span className="text-right font-mono tabular-nums text-gray-300">
                {fmtNum(liq.price, 1)}
              </span>
              <span className="text-right font-mono tabular-nums text-gray-400">
                {fmtNum(liq.qty, 4)}
              </span>
              <span className="text-right font-mono tabular-nums text-gray-400">
                {fmtNum(liq.total, 0)}
              </span>
              <span className="text-gray-600 text-[9px]">{liq.symbol}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
