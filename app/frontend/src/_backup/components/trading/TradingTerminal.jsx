/**
 * TradingTerminal — GridLayout widget system
 * Supports Crypto (Binance Futures streams) and Stocks (TradingView charts).
 *
 * Crypto widgets: TradingView chart, CVD, Order Book Depth, Live Trades, Liquidations
 * Stock widgets:  TradingView chart only
 *
 * Right-click anywhere to add/remove widgets.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import GridLayout from 'react-grid-layout';
import { ChevronDown, Wifi, WifiOff } from 'lucide-react';

import useBinanceStreams   from './hooks/useBinanceStreams';
import useStockIntraday   from './hooks/useStockIntraday';
import useStockOrderBook  from './hooks/useStockOrderBook';
import TradingViewChartWidget from './widgets/TradingViewChartWidget';
import CVDWidget          from './widgets/CVDWidget';
import DepthWidget        from './widgets/DepthWidget';
import LiveTradesWidget   from './widgets/LiveTradesWidget';
import LiquidationsWidget from './widgets/LiquidationsWidget';
import WidgetContextMenu  from '../common/WidgetContextMenu';
import TickerSearch       from '../common/TickerSearch';
import { useGlobalWidgetContext } from '../../contexts/GlobalWidgetContext';
import 'react-grid-layout/css/styles.css';

// ─── Symbol lists ────────────────────────────────────────────────────────────

const CRYPTO_SYMBOLS = [
  { value: 'BTCUSDT',  label: 'BTC / USDT' },
  { value: 'ETHUSDT',  label: 'ETH / USDT' },
  { value: 'SOLUSDT',  label: 'SOL / USDT' },
  { value: 'BNBUSDT',  label: 'BNB / USDT' },
  { value: 'XRPUSDT',  label: 'XRP / USDT' },
  { value: 'DOGEUSDT', label: 'DOGE / USDT' },
  { value: 'AVAXUSDT', label: 'AVAX / USDT' },
  { value: 'ADAUSDT',  label: 'ADA / USDT'  },
  { value: 'DOTUSDT',  label: 'DOT / USDT'  },
  { value: 'LINKUSDT', label: 'LINK / USDT' },
];

// ─── Widget catalog ──────────────────────────────────────────────────────────

const AVAILABLE_WIDGETS = {
  crypto: [
    { id: 'tv-chart',     name: 'Chart',          description: 'TradingView candlestick chart', defaultSize: { w: 8, h: 8 } },
    { id: 'cvd-chart',    name: 'CVD',             description: 'Cumulative Volume Delta',       defaultSize: { w: 4, h: 6 } },
    { id: 'depth-chart',  name: 'Order Book',      description: 'Bid/Ask depth chart',           defaultSize: { w: 4, h: 6 } },
    { id: 'live-trades',  name: 'Live Trades',     description: 'Real-time trade feed',          defaultSize: { w: 5, h: 6 } },
    { id: 'liquidations', name: 'Liquidations',    description: 'Force liquidation events',      defaultSize: { w: 7, h: 6 } },
  ],
  stock: [
    { id: 'tv-chart',    name: 'Chart',      description: 'TradingView advanced chart', defaultSize: { w: 8, h: 8 } },
    { id: 'cvd-chart',   name: 'CVD',        description: 'Cumulative Volume Delta',    defaultSize: { w: 4, h: 6 } },
    { id: 'depth-chart', name: 'Order Book', description: 'Bid/Ask depth chart',        defaultSize: { w: 4, h: 6 } },
  ],
};

const DEFAULT_WIDGETS = {
  crypto: [
    { id: 'tv-chart-1',  type: 'tv-chart'     },
    { id: 'cvd-1',       type: 'cvd-chart'    },
    { id: 'depth-1',     type: 'depth-chart'  },
    { id: 'trades-1',    type: 'live-trades'  },
    { id: 'liqs-1',      type: 'liquidations' },
  ],
  stock: [
    { id: 'tv-chart-1', type: 'tv-chart'    },
    { id: 'cvd-1',      type: 'cvd-chart'   },
    { id: 'depth-1',    type: 'depth-chart' },
  ],
};

const DEFAULT_LAYOUTS = {
  crypto: [
    { i: 'tv-chart-1', x: 0, y: 0, w: 8, h: 8,  minW: 4, minH: 4 },
    { i: 'cvd-1',      x: 8, y: 0, w: 4, h: 4,  minW: 3, minH: 3 },
    { i: 'depth-1',    x: 8, y: 4, w: 4, h: 4,  minW: 3, minH: 3 },
    { i: 'trades-1',   x: 0, y: 8, w: 5, h: 6,  minW: 3, minH: 3 },
    { i: 'liqs-1',     x: 5, y: 8, w: 7, h: 6,  minW: 4, minH: 3 },
  ],
  stock: [
    { i: 'tv-chart-1', x: 0, y: 0, w: 8, h: 8, minW: 4, minH: 4 },
    { i: 'cvd-1',      x: 8, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
    { i: 'depth-1',    x: 8, y: 4, w: 4, h: 4, minW: 3, minH: 3 },
  ],
};

// ─── Main terminal ────────────────────────────────────────────────────────────

export default function TradingTerminal() {
  const globalContext = useGlobalWidgetContext();

  const [assetType, setAssetType] = useState(
    () => localStorage.getItem('trading-asset-type') || 'crypto'
  );
  const [cryptoSymbol, setCryptoSymbol] = useState(
    () => localStorage.getItem('trading-crypto-symbol') || 'BTCUSDT'
  );
  const [stockSymbol, setStockSymbol] = useState(
    () => localStorage.getItem('trading-stock-symbol') || 'AAPL'
  );

  const symbol = assetType === 'crypto' ? cryptoSymbol : stockSymbol;

  const [gridWidth,   setGridWidth]   = useState(1200);
  const [contextMenu, setContextMenu] = useState(null);
  const containerRef = useRef(null);

  // Persist preferences
  useEffect(() => { localStorage.setItem('trading-asset-type',    assetType);    }, [assetType]);
  useEffect(() => { localStorage.setItem('trading-crypto-symbol', cryptoSymbol); }, [cryptoSymbol]);
  useEffect(() => { localStorage.setItem('trading-stock-symbol',  stockSymbol);  }, [stockSymbol]);

  // Binance streams — always active for crypto widgets
  const binance = useBinanceStreams(cryptoSymbol);
  // Stock intraday (CVD) + order book — active only in stock mode
  const stock    = useStockIntraday(assetType === 'stock' ? stockSymbol : null);
  const stockOB  = useStockOrderBook(assetType === 'stock' ? stockSymbol : null);

  // Widget state — persisted per asset type
  const [widgets, setWidgets] = useState(() => {
    const saved = localStorage.getItem(`trading-widgets-${assetType}`);
    if (!saved) return DEFAULT_WIDGETS[assetType];
    try {
      const parsed = JSON.parse(saved);
      // Ensure all default widget IDs are still present (migration guard)
      const savedIds = new Set(parsed.map(w => w.id));
      const hasMissing = DEFAULT_WIDGETS[assetType].some(w => !savedIds.has(w.id));
      return hasMissing ? DEFAULT_WIDGETS[assetType] : parsed;
    } catch { return DEFAULT_WIDGETS[assetType]; }
  });

  const [layout, setLayout] = useState(() => {
    const saved = localStorage.getItem(`trading-layout-${assetType}`);
    if (!saved) return DEFAULT_LAYOUTS[assetType];
    try {
      const parsed = JSON.parse(saved);
      const savedIds = new Set(parsed.map(l => l.i));
      const hasMissing = DEFAULT_LAYOUTS[assetType].some(l => !savedIds.has(l.i));
      return hasMissing ? DEFAULT_LAYOUTS[assetType] : parsed;
    } catch { return DEFAULT_LAYOUTS[assetType]; }
  });

  // Switch asset type → load saved state or defaults (with migration guard)
  const switchAssetType = useCallback((type) => {
    setAssetType(type);
    try {
      const savedW = localStorage.getItem(`trading-widgets-${type}`);
      const parsedW = savedW ? JSON.parse(savedW) : null;
      const savedIds = new Set((parsedW || []).map(w => w.id));
      const hasMissingW = !parsedW || DEFAULT_WIDGETS[type].some(w => !savedIds.has(w.id));
      setWidgets(hasMissingW ? DEFAULT_WIDGETS[type] : parsedW);

      const savedL = localStorage.getItem(`trading-layout-${type}`);
      const parsedL = savedL ? JSON.parse(savedL) : null;
      const savedLIds = new Set((parsedL || []).map(l => l.i));
      const hasMissingL = !parsedL || DEFAULT_LAYOUTS[type].some(l => !savedLIds.has(l.i));
      setLayout(hasMissingL ? DEFAULT_LAYOUTS[type] : parsedL);
    } catch {
      setWidgets(DEFAULT_WIDGETS[type]);
      setLayout(DEFAULT_LAYOUTS[type]);
    }
  }, []);

  // Persist widget state
  useEffect(() => {
    localStorage.setItem(`trading-widgets-${assetType}`, JSON.stringify(widgets));
  }, [widgets, assetType]);

  useEffect(() => {
    if (layout.length > 0) {
      localStorage.setItem(`trading-layout-${assetType}`, JSON.stringify(layout));
    }
  }, [layout, assetType]);

  // Grid width
  useEffect(() => {
    const update = () => {
      if (containerRef.current) setGridWidth(containerRef.current.offsetWidth);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Available widgets for current mode
  const availableWidgets = AVAILABLE_WIDGETS[assetType];

  // Widget add/remove
  const handleAddWidget = useCallback((widgetConfig) => {
    const newW = { id: `widget-${Date.now()}`, type: widgetConfig.id };
    setWidgets(prev => [...prev, newW]);
    const size = widgetConfig.defaultSize || { w: 6, h: 6 };
    setLayout(prev => [...prev, { i: newW.id, x: 0, y: Infinity, w: size.w, h: size.h, minW: 3, minH: 3 }]);
    setContextMenu(null);
  }, []);

  const handleRemoveWidget = useCallback((widgetId) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
    setLayout(prev  => prev.filter(l => l.i  !== widgetId));
  }, []);

  const handleLayoutChange = useCallback((newLayout) => {
    if (newLayout.length === widgets.length) setLayout(newLayout);
  }, [widgets.length]);

  // Register global widget context
  useEffect(() => {
    if (globalContext?.registerWidgets && availableWidgets.length > 0) {
      globalContext.registerWidgets(availableWidgets, handleAddWidget);
    }
    return () => globalContext?.unregisterWidgets?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetType]);

  // Render widget by type
  const renderWidget = useCallback((widget) => {
    const onRemove = () => handleRemoveWidget(widget.id);

    const isStock = assetType === 'stock';

    switch (widget.type) {
      case 'tv-chart':
        return <TradingViewChartWidget symbol={symbol} assetType={assetType} onRemove={onRemove} />;
      case 'cvd-chart':
        return (
          <CVDWidget
            cvdPoints={isStock ? stock.cvdPoints : binance.cvdPoints}
            connected={isStock ? undefined : binance.connected}
            assetType={assetType}
            onRemove={onRemove}
          />
        );
      case 'depth-chart':
        return (
          <DepthWidget
            bids={binance.bids}
            asks={binance.asks}
            stockBids={stockOB.bids}
            stockAsks={stockOB.asks}
            stockSource={stockOB.source}
            assetType={assetType}
            connected={isStock ? undefined : binance.connected}
            onRemove={onRemove}
          />
        );
      case 'live-trades':
        return <LiveTradesWidget trades={binance.trades} connected={binance.connected} assetType={assetType} onRemove={onRemove} />;
      case 'liquidations':
        return <LiquidationsWidget liquidations={binance.liquidations} connected={binance.connected} assetType={assetType} onRemove={onRemove} />;
      default:
        return <div className="p-4 text-gray-600 text-xs">Unknown: {widget.type}</div>;
    }
  }, [symbol, assetType, binance, stock, stockOB, handleRemoveWidget]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[calc(100vh-56px)] flex flex-col bg-[#0a0a0f]"
      onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY }); }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 h-12 border-b border-gray-800 shrink-0 bg-[#060608]">

        {/* Asset type toggle */}
        <div className="flex items-center bg-gray-800/50 rounded p-0.5 gap-0.5">
          {['crypto', 'stock'].map(type => (
            <button
              key={type}
              onClick={() => switchAssetType(type)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                assetType === type
                  ? 'bg-gray-700 text-white shadow'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {type === 'crypto' ? 'Crypto' : 'Stocks'}
            </button>
          ))}
        </div>

        {/* Symbol selector */}
        {assetType === 'crypto' ? (
          <div className="relative">
            <select
              value={cryptoSymbol}
              onChange={e => setCryptoSymbol(e.target.value)}
              className="appearance-none pl-2.5 pr-6 py-1 bg-[#0d0d12] border border-gray-700 rounded text-xs font-semibold text-white focus:outline-none focus:border-cyan-600 cursor-pointer"
            >
              {CRYPTO_SYMBOLS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>
        ) : (
          <div className="flex items-center gap-2" onMouseDown={e => e.stopPropagation()}>
            <span className="text-xs font-bold text-cyan-400 px-2 py-0.5 bg-cyan-500/10 rounded border border-cyan-500/20 shrink-0">
              {stockSymbol}
            </span>
            <div className="w-44">
              <TickerSearch
                onSelect={stock => setStockSymbol(stock.symbol)}
                placeholder="종목 검색…"
              />
            </div>
          </div>
        )}

        {/* Binance connection (crypto only) */}
        {assetType === 'crypto' && (
          <>
            <div className={`flex items-center gap-1.5 text-[11px] ${
              binance.connected ? 'text-green-400' : 'text-gray-600'
            }`}>
              {binance.connected ? <Wifi size={11} /> : <WifiOff size={11} />}
              {binance.connected ? 'Live' : 'Connecting…'}
            </div>

            {binance.lastPrice != null && (
              <div className="flex items-baseline gap-1">
                <span className="text-base font-mono font-bold text-green-400 tabular-nums">
                  {binance.lastPrice.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[9px] text-gray-700">USDT</span>
              </div>
            )}
          </>
        )}

        <span className="ml-auto text-[10px] text-gray-700">
          {assetType === 'crypto' ? 'Binance Futures · Perpetual' : 'TradingView · Market Data'}
        </span>
      </div>

      {/* ── Grid ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-3">
        <GridLayout
          className="layout"
          layout={layout}
          cols={12}
          rowHeight={50}
          width={gridWidth - 24}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".drag-handle-area"
          compactType="vertical"
          preventCollision={false}
          isResizable
          isDraggable
          margin={[10, 10]}
        >
          {widgets.map(widget => (
            <div key={widget.id} className="overflow-hidden">
              {renderWidget(widget)}
            </div>
          ))}
        </GridLayout>

        {widgets.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600 gap-2">
            <p className="text-sm">No widgets</p>
            <p className="text-xs text-gray-700">Right-click to add widgets</p>
          </div>
        )}
      </div>

      {/* ── Context menu ───────────────────────────────────────────────────── */}
      {contextMenu && (
        <WidgetContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          availableWidgets={availableWidgets}
          onSelect={handleAddWidget}
        />
      )}
    </div>
  );
}
