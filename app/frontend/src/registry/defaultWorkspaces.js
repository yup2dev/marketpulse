/**
 * Default workspace templates for each screen route.
 * Each widget entry: { type: widgetId, x, y, w, h, config? }
 * Grid is 12 columns wide. Row height = 60px.
 */

export const DEFAULT_WORKSPACE_TEMPLATES = {
  dashboard: {
    name: 'Default Dashboard',
    widgets: [
      { id: 'w1', type: 'market-overview', x: 0, y: 0, w: 12, h: 2, config: {} },
      { id: 'w2', type: 'live-watchlist',  x: 0, y: 2, w: 8,  h: 6, config: {} },
      { id: 'w3', type: 'ticker-info',     x: 8, y: 2, w: 4,  h: 3, config: { symbol: 'AAPL' } },
      { id: 'w4', type: 'macro-chart',     x: 8, y: 5, w: 4,  h: 3, config: { indicator: 'fed_rate' } },
    ],
  },

  stock: {
    name: 'Stock Overview',
    widgets: [
      { id: 'w1', type: 'ticker-info',     x: 0,  y: 0, w: 4,  h: 3, config: { symbol: 'AAPL' } },
      { id: 'w2', type: 'stock-chart',     x: 4,  y: 0, w: 8,  h: 6, config: { symbol: 'AAPL', chartType: 'candlestick' } },
      { id: 'w3', type: 'key-metrics',     x: 0,  y: 3, w: 4,  h: 3, config: { symbol: 'AAPL' } },
      { id: 'w4', type: 'financial-table', x: 0,  y: 6, w: 6,  h: 5, config: { symbol: 'AAPL' } },
      { id: 'w5', type: 'analyst',         x: 6,  y: 6, w: 3,  h: 4, config: { symbol: 'AAPL' } },
      { id: 'w6', type: 'earnings',        x: 9,  y: 6, w: 3,  h: 4, config: { symbol: 'AAPL' } },
    ],
  },

  macro: {
    name: 'Macro Dashboard',
    widgets: [
      { id: 'w1', type: 'regime',           x: 0, y: 0, w: 3,  h: 3, config: {} },
      { id: 'w2', type: 'fed-policy-stance',x: 3, y: 0, w: 3,  h: 3, config: {} },
      { id: 'w3', type: 'yield-curve',      x: 6, y: 0, w: 6,  h: 4, config: {} },
      { id: 'w4', type: 'inflation-trends', x: 0, y: 3, w: 6,  h: 4, config: {} },
      { id: 'w5', type: 'labor-market',     x: 6, y: 4, w: 6,  h: 4, config: {} },
      { id: 'w6', type: 'gdp-forecast',     x: 0, y: 7, w: 6,  h: 4, config: {} },
      { id: 'w7', type: 'pmi',              x: 6, y: 8, w: 6,  h: 3, config: {} },
    ],
  },

  portfolio: {
    name: 'Portfolio View',
    widgets: [
      { id: 'w1', type: 'portfolio-stats',    x: 0, y: 0, w: 4,  h: 3, config: {} },
      { id: 'w2', type: 'portfolio-balances', x: 4, y: 0, w: 4,  h: 3, config: {} },
      { id: 'w3', type: 'portfolio-pnl-chart',x: 8, y: 0, w: 4,  h: 3, config: {} },
      { id: 'w4', type: 'portfolio-holdings', x: 0, y: 3, w: 8,  h: 5, config: {} },
      { id: 'w5', type: 'portfolio-positions',x: 8, y: 3, w: 4,  h: 5, config: {} },
    ],
  },

  backtest: {
    name: 'Backtest Runner',
    // Backtest has a special 2-panel layout, handled by UnifiedBacktest directly
    widgets: [],
  },

  alerts: {
    name: 'Alerts Overview',
    widgets: [
      { id: 'w1', type: 'live-watchlist', x: 0, y: 0, w: 12, h: 6, config: {} },
    ],
  },

  screener: {
    name: 'Stock Screener',
    widgets: [],
  },

  watchlist: {
    name: 'My Watchlist',
    widgets: [
      { id: 'w1', type: 'live-watchlist', x: 0, y: 0, w: 8, h: 8, config: {} },
      { id: 'w2', type: 'stock-chart',    x: 8, y: 0, w: 4, h: 5, config: { symbol: 'AAPL', chartType: 'line' } },
      { id: 'w3', type: 'ticker-info',    x: 8, y: 5, w: 4, h: 3, config: { symbol: 'AAPL' } },
    ],
  },

  quant: {
    name: 'Quant Research',
    widgets: [],
  },

  strategy: {
    name: 'Strategy Builder',
    widgets: [],
  },

  trading: {
    name: 'Trading Terminal',
    widgets: [
      { id: 'w1', type: 'stock-chart',  x: 0, y: 0, w: 8, h: 7, config: { symbol: 'AAPL', chartType: 'candlestick' } },
      { id: 'w2', type: 'ticker-info',  x: 8, y: 0, w: 4, h: 3, config: { symbol: 'AAPL' } },
      { id: 'w3', type: 'live-watchlist', x: 8, y: 3, w: 4, h: 4, config: {} },
    ],
  },
};

export default DEFAULT_WORKSPACE_TEMPLATES;
