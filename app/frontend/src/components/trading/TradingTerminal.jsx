/**
 * TradingTerminal – Real-time crypto trading terminal.
 *
 * Layout (matches trading.mp4):
 * ┌─────────────────────────────────────────────────────┐
 * │  Header: symbol selector, connection, live price    │
 * ├──────────────────┬───────────────┬──────────────────┤
 * │  Candlestick     │  CVD Chart    │  Depth Chart     │
 * │  (1m OHLCV)      │  (Vol Delta)  │  (Bid/Ask)       │
 * ├──────────────────┴───────────────┴──────────────────┤
 * │  Liquidations Monitor  │  Live Trades Feed           │
 * └────────────────────────┴────────────────────────────┘
 *
 * Data source: Binance Futures WebSocket (public, no auth required)
 */
import { useState, useRef } from 'react';
import { Wifi, WifiOff, ChevronDown } from 'lucide-react';
import useBinanceStreams from './hooks/useBinanceStreams';
import CandleChart       from './panels/CandleChart';
import CVDChart          from './panels/CVDChart';
import DepthChart        from './panels/DepthChart';
import LiquidationsPanel from './panels/LiquidationsPanel';
import LiveTradesPanel   from './panels/LiveTradesPanel';

const SYMBOLS = [
  { value: 'BTCUSDT',  label: 'BTC/USDT' },
  { value: 'ETHUSDT',  label: 'ETH/USDT' },
  { value: 'SOLUSDT',  label: 'SOL/USDT' },
  { value: 'BNBUSDT',  label: 'BNB/USDT' },
  { value: 'XRPUSDT',  label: 'XRP/USDT' },
  { value: 'DOGEUSDT', label: 'DOGE/USDT' },
];

function PanelBorder({ children, className = '' }) {
  return (
    <div className={`border border-gray-800/60 rounded-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export default function TradingTerminal() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const prevPriceRef = useRef(null);

  const {
    candles, liveCandle, cvdPoints,
    bids, asks,
    trades, liquidations,
    connected, lastPrice,
  } = useBinanceStreams(symbol);

  // Track price direction for color flash
  const priceUp = lastPrice !== null && prevPriceRef.current !== null
    ? lastPrice >= prevPriceRef.current
    : true;
  if (lastPrice !== null) prevPriceRef.current = lastPrice;

  const selectedLabel = SYMBOLS.find(s => s.value === symbol)?.label || symbol;

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col bg-[#0a0a0f] overflow-hidden select-none">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 h-10 border-b border-gray-800/60 shrink-0 bg-[#060608]">

        {/* Symbol selector */}
        <div className="relative">
          <select
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            className="appearance-none pl-2.5 pr-6 py-1 bg-[#0d0d12] border border-gray-700/60 rounded text-[11px] font-semibold text-white focus:outline-none focus:border-cyan-500/60 cursor-pointer"
          >
            {SYMBOLS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>

        {/* Perpetual badge */}
        <span className="text-[9px] px-1.5 py-0.5 bg-gray-800/60 text-gray-600 border border-gray-700/40 rounded-sm">
          PERP
        </span>

        {/* Connection indicator */}
        <div className={`flex items-center gap-1 text-[10px] ${connected ? 'text-green-400' : 'text-gray-600'}`}>
          {connected
            ? <Wifi size={11} />
            : <WifiOff size={11} />}
          <span>{connected ? 'Live' : 'Connecting…'}</span>
        </div>

        {/* Live price */}
        {lastPrice != null && (
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-base font-mono font-bold tabular-nums transition-colors ${
                priceUp ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {lastPrice.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] text-gray-700">USDT</span>
          </div>
        )}

        {/* Exchange label (right) */}
        <div className="ml-auto flex items-center gap-2 text-[9px] text-gray-700">
          <span>Binance Futures</span>
          <span>·</span>
          <span>Perpetual</span>
        </div>
      </div>

      {/* ── Top row: 3 chart panels ───────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 gap-1 p-1 pb-0.5">

        {/* Candlestick – takes remaining space */}
        <PanelBorder className="flex-1 min-w-0 p-1.5 bg-[#0d0d12]">
          <CandleChart candles={candles} liveCandle={liveCandle} symbol={selectedLabel} />
        </PanelBorder>

        {/* CVD */}
        <PanelBorder className="w-[270px] shrink-0 p-1.5 bg-[#0d0d12]">
          <CVDChart cvdPoints={cvdPoints} />
        </PanelBorder>

        {/* Depth */}
        <PanelBorder className="w-[250px] shrink-0 p-1.5 bg-[#0d0d12]">
          <DepthChart bids={bids} asks={asks} />
        </PanelBorder>
      </div>

      {/* ── Bottom row: 2 table panels ───────────────────────────────────── */}
      <div className="flex h-[250px] shrink-0 gap-1 p-1 pt-0.5">

        {/* Liquidations – takes remaining space */}
        <PanelBorder className="flex-1 min-w-0 bg-[#0d0d12]">
          <LiquidationsPanel liquidations={liquidations} />
        </PanelBorder>

        {/* Live Trades */}
        <PanelBorder className="w-[360px] shrink-0 bg-[#0d0d12]">
          <LiveTradesPanel trades={trades} />
        </PanelBorder>
      </div>
    </div>
  );
}
