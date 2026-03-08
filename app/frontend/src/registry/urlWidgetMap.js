/**
 * urlWidgetMap — per-URL widget configuration.
 *
 * Each entry maps a URL pathname to:
 *   label           — page title shown in header
 *   needsSymbol     — show stock symbol selector
 *   needsPortfolio  — show portfolio selector + actions
 *   categories      — tabs mapped to ?section= URL param
 *     ├ id            — used as ?section= value
 *     ├ label         — tab display label
 *     ├ defaultWidgets — initial grid for this section (no saved workspace)
 *     └ widgets       — widget catalog for WidgetMenu popup
 */

export const URL_WIDGET_MAP = {

  // ─── Dashboard (/) ─────────────────────────────────────────────────────────
  '/': {
    label: 'Dashboard',
    needsSymbol: true,
    needsPortfolio: false,
    categories: [
      {
        id: 'overview',
        label: 'Overview',
        defaultWidgets: [
          { id: 'w1', type: 'gdp-forecast',       x: 0, y: 0, w: 6, h: 6 },
          { id: 'w2', type: 'inflation-momentum', x: 6, y: 0, w: 6, h: 6 },
          { id: 'w3', type: 'earnings',           x: 0, y: 6, w: 6, h: 6 },
          { id: 'w4', type: 'insider',            x: 6, y: 6, w: 6, h: 6 },
        ],
        widgets: [
          { id: 'gdp-forecast',       name: 'GDP Forecast',       description: 'Evolution of GDP forecast',  defaultSize: { w: 6, h: 6 } },
          { id: 'inflation-momentum', name: 'Inflation Momentum', description: '12M, 6M, 3M momentum',       defaultSize: { w: 6, h: 6 } },
          { id: 'earnings',           name: 'Earnings',           description: 'EPS history & surprises',    defaultSize: { w: 6, h: 6 } },
          { id: 'insider',            name: 'Insider',            description: 'Insider trading activity',   defaultSize: { w: 6, h: 6 } },
          { id: 'yield-curve-snapshot', name: 'Yield Curve',      description: 'Current yield curve shape',  defaultSize: { w: 6, h: 6 } },
          { id: 'pmi',                name: 'ISM PMI / LEI',      description: 'Manufacturing PMI & LEI',    defaultSize: { w: 8, h: 6 } },
          { id: 'stock-sentiment',    name: 'News Sentiment',     description: 'News sentiment & trend',     defaultSize: { w: 6, h: 8 } },
          { id: 'social-sentiment',   name: 'Social Sentiment',   description: 'Reddit & StockTwits',        defaultSize: { w: 6, h: 8 } },
        ],
      },
    ],
  },

  // ─── Stock Analysis (/stock) ────────────────────────────────────────────────
  '/stock': {
    label: 'Stock Analysis',
    needsSymbol: true,
    needsPortfolio: false,
    categories: [
      {
        id: 'overview',
        label: 'Overview',
        defaultWidgets: [
          { id: 'earnings-history-1',   type: 'earnings-history',   x: 0, y: 0,  w: 8,  h: 5 },
          { id: 'insider-1',            type: 'insider',            x: 8, y: 0,  w: 4,  h: 5 },
          { id: 'ownership-overview-1', type: 'ownership-overview', x: 0, y: 5,  w: 12, h: 6 },
        ],
        widgets: [
          { id: 'earnings-history',   name: 'Earnings History',  description: 'EPS history & surprises',   defaultSize: { w: 8, h: 5 } },
          { id: 'earnings',           name: 'Earnings',          description: 'Upcoming earnings',          defaultSize: { w: 6, h: 5 } },
          { id: 'insider',            name: 'Insider',           description: 'Insider trading activity',   defaultSize: { w: 4, h: 5 } },
          { id: 'ownership-overview', name: 'Ownership Overview', description: 'Ownership breakdown',      defaultSize: { w: 12, h: 6 } },
          { id: 'stock-sentiment',    name: 'News Sentiment',    description: 'News sentiment & trend',     defaultSize: { w: 6,  h: 8 } },
          { id: 'social-sentiment',   name: 'Social Sentiment',  description: 'Reddit & StockTwits',        defaultSize: { w: 6,  h: 8 } },
        ],
      },
      {
        id: 'financials',
        label: 'Financials',
        defaultWidgets: [
          { id: 'financials-1', type: 'financials', x: 0, y: 0, w: 12, h: 10 },
        ],
        widgets: [
          { id: 'financials', name: 'Financial Statements', description: 'Income, Balance, Cash Flow', defaultSize: { w: 12, h: 10 } },
        ],
      },
      {
        id: 'ownership',
        label: 'Ownership',
        defaultWidgets: [
          { id: 'ownership-overview-1',      type: 'ownership-overview',      x: 0, y: 0, w: 12, h: 6 },
          { id: 'ownership-institutional-1', type: 'ownership-institutional', x: 0, y: 6, w: 6,  h: 6 },
          { id: 'ownership-insider-1',       type: 'ownership-insider',       x: 6, y: 6, w: 6,  h: 6 },
        ],
        widgets: [
          { id: 'ownership-overview',      name: 'Ownership Overview',    description: 'Ownership breakdown',       defaultSize: { w: 12, h: 6 } },
          { id: 'ownership-institutional', name: 'Institutional Holders', description: 'Top institutional holders', defaultSize: { w: 6,  h: 6 } },
          { id: 'ownership-insider',       name: 'Insider Activity',      description: 'Insider trading',           defaultSize: { w: 6,  h: 6 } },
        ],
      },
      {
        id: 'calendar',
        label: 'Calendar',
        defaultWidgets: [
          { id: 'earnings-history-cal-1', type: 'earnings-history', x: 0, y: 0, w: 7, h: 5 },
          { id: 'stock-splits-1',         type: 'stock-splits',     x: 7, y: 0, w: 5, h: 5 },
          { id: 'dividends-1',            type: 'dividend',         x: 0, y: 5, w: 7, h: 5 },
          { id: 'company-filings-1',      type: 'company-filings',  x: 7, y: 5, w: 5, h: 5 },
        ],
        widgets: [
          { id: 'earnings-history', name: 'Earnings History', description: 'EPS history & surprises', defaultSize: { w: 6, h: 6 } },
          { id: 'stock-splits',     name: 'Stock Splits',     description: 'Split history',            defaultSize: { w: 6, h: 6 } },
          { id: 'dividend',         name: 'Dividends',        description: 'Dividend payments',        defaultSize: { w: 6, h: 6 } },
          { id: 'company-filings',  name: 'SEC Filings',      description: 'SEC filings & reports',    defaultSize: { w: 6, h: 6 } },
        ],
      },
      {
        id: 'analysis',
        label: 'Analysis',
        defaultWidgets: [
          { id: 'swot-1',          type: 'swot',          x: 0, y: 0,  w: 6,  h: 8 },
          { id: 'management-1',    type: 'management',    x: 6, y: 0,  w: 6,  h: 7 },
          { id: 'economic-moat-1', type: 'economic-moat', x: 6, y: 7,  w: 6,  h: 7 },
        ],
        widgets: [
          { id: 'swot',                 name: 'SWOT Analysis',        description: 'Data-driven SWOT',      defaultSize: { w: 6,  h: 8  } },
          { id: 'management',           name: 'Management',           description: 'Executive team',         defaultSize: { w: 6,  h: 7  } },
          { id: 'economic-moat',        name: 'Economic Moat',        description: '10-year moat metrics',   defaultSize: { w: 6,  h: 7  } },
          { id: 'investment-scorecard', name: 'Investment Scorecard', description: '5-category scorecard',   defaultSize: { w: 6,  h: 10 } },
        ],
      },
      {
        id: 'sentiment',
        label: 'Sentiment',
        defaultWidgets: [
          { id: 'stock-sentiment-1',  type: 'stock-sentiment',  x: 0, y: 0, w: 6, h: 8 },
          { id: 'social-sentiment-1', type: 'social-sentiment', x: 6, y: 0, w: 6, h: 8 },
        ],
        widgets: [
          { id: 'stock-sentiment',  name: 'News Sentiment',   description: 'News sentiment & trend', defaultSize: { w: 6, h: 8 } },
          { id: 'social-sentiment', name: 'Social Sentiment', description: 'Reddit & StockTwits',    defaultSize: { w: 6, h: 8 } },
        ],
      },
    ],
  },

  // ─── Macro (/macro) ─────────────────────────────────────────────────────────
  '/macro': {
    label: 'Macro',
    needsSymbol: false,
    needsPortfolio: false,
    categories: [
      {
        id: 'overview',
        label: 'Overview',
        defaultWidgets: [
          { id: 'gdp-1',       type: 'gdp-forecast',       x: 0, y: 0, w: 6, h: 6 },
          { id: 'inflation-1', type: 'inflation-momentum', x: 6, y: 0, w: 6, h: 6 },
          { id: 'claims-1',    type: 'initial-claims',     x: 0, y: 6, w: 6, h: 6 },
          { id: 'jobs-1',      type: 'jobs-breakdown',     x: 6, y: 6, w: 6, h: 6 },
        ],
        widgets: [
          { id: 'gdp-forecast',       name: 'GDP Forecast',       description: 'Evolution of GDP forecast',  defaultSize: { w: 6, h: 6 } },
          { id: 'inflation-momentum', name: 'Inflation Momentum', description: '12M, 6M, 3M momentum',       defaultSize: { w: 6, h: 6 } },
          { id: 'initial-claims',     name: 'Initial Claims',     description: 'Weekly claims with 4-wk MA', defaultSize: { w: 6, h: 6 } },
          { id: 'jobs-breakdown',     name: 'Jobs Breakdown',     description: 'Private vs Government jobs',  defaultSize: { w: 6, h: 6 } },
          { id: 'pmi',                name: 'ISM PMI / LEI',      description: 'Manufacturing PMI & LEI',     defaultSize: { w: 8, h: 6 } },
        ],
      },
      {
        id: 'rates',
        label: 'Rates & Fed',
        defaultWidgets: [
          { id: 'fed-bs-1',       type: 'fed-balance-sheet',    x: 0, y: 0,  w: 6, h: 6 },
          { id: 'yield-snap-1',   type: 'yield-curve-snapshot', x: 6, y: 0,  w: 6, h: 6 },
          { id: 'yield-trends-1', type: 'yield-trends',         x: 0, y: 6,  w: 6, h: 6 },
          { id: 'real-rates-1',   type: 'real-rates',           x: 6, y: 6,  w: 6, h: 6 },
        ],
        widgets: [
          { id: 'fed-balance-sheet',    name: 'Fed Balance Sheet', description: 'QE/QT monitor — total assets', defaultSize: { w: 6, h: 6 } },
          { id: 'yield-curve-snapshot', name: 'Yield Curve',       description: 'Current yield curve shape',    defaultSize: { w: 6, h: 6 } },
          { id: 'yield-trends',         name: 'Yield Trends',      description: 'Historical yield trends',      defaultSize: { w: 6, h: 6 } },
          { id: 'real-rates',           name: 'Real Rates (TIPS)', description: 'Nominal vs real yields',       defaultSize: { w: 6, h: 6 } },
        ],
      },
      {
        id: 'inflation',
        label: 'Inflation',
        defaultWidgets: [
          { id: 'inflation-decomp-1', type: 'inflation-decomp',  x: 0, y: 0, w: 6, h: 6 },
          { id: 'inflation-trends-1', type: 'inflation-trends',  x: 6, y: 0, w: 6, h: 6 },
        ],
        widgets: [
          { id: 'inflation-decomp', name: 'Inflation Decomposition', description: 'CPI components breakdown', defaultSize: { w: 6, h: 6 } },
          { id: 'inflation-trends', name: 'Inflation Trends',        description: 'Historical CPI trends',     defaultSize: { w: 6, h: 6 } },
        ],
      },
      {
        id: 'conditions',
        label: 'Conditions',
        defaultWidgets: [
          { id: 'labor-dash-1',  type: 'labor-market-dashboard', x: 0, y: 0,  w: 6,  h: 6 },
          { id: 'fin-1',         type: 'fin-conditions-tab',     x: 0, y: 6,  w: 12, h: 8 },
          { id: 'sentiment-1',   type: 'sentiment-tab',          x: 0, y: 14, w: 12, h: 8 },
          { id: 'commodities-1', type: 'commodities-tab',        x: 0, y: 22, w: 12, h: 8 },
        ],
        widgets: [
          { id: 'labor-market-dashboard', name: 'Labor Market',         description: 'Employment metrics dashboard', defaultSize: { w: 6,  h: 6 } },
          { id: 'fin-conditions-tab',     name: 'Financial Conditions', description: 'Credit spreads & liquidity',   defaultSize: { w: 12, h: 8 } },
          { id: 'sentiment-tab',          name: 'Market Sentiment',     description: 'Fear/Greed & VIX',             defaultSize: { w: 12, h: 8 } },
          { id: 'commodities-tab',        name: 'Commodities',          description: 'Commodity ratios',             defaultSize: { w: 12, h: 8 } },
        ],
      },
    ],
  },

  // ─── Portfolio (/portfolios) ─────────────────────────────────────────────────
  '/portfolios': {
    label: 'Portfolio',
    needsSymbol: false,
    needsPortfolio: true,
    categories: [
      {
        id: 'overview',
        label: 'Overview',
        defaultWidgets: [
          { id: 'stats-1',    type: 'portfolio-stats',    x: 0, y: 0, w: 5,  h: 6 },
          { id: 'chart-1',    type: 'portfolio-chart',    x: 5, y: 0, w: 7,  h: 6 },
          { id: 'holdings-1', type: 'portfolio-holdings', x: 0, y: 6, w: 12, h: 6 },
        ],
        widgets: [
          { id: 'portfolio-stats',    name: 'Portfolio Stats', description: 'P&L overview',     defaultSize: { w: 5,  h: 6 } },
          { id: 'portfolio-chart',    name: 'Portfolio Chart', description: 'P&L history',      defaultSize: { w: 7,  h: 6 } },
          { id: 'portfolio-holdings', name: 'Holdings',        description: 'Current holdings', defaultSize: { w: 12, h: 6 } },
        ],
      },
      {
        id: 'balances',
        label: 'Balances',
        defaultWidgets: [
          { id: 'balances-1', type: 'portfolio-balances', x: 0, y: 0, w: 12, h: 10 },
        ],
        widgets: [
          { id: 'portfolio-balances', name: 'Balances', description: 'Account balances', defaultSize: { w: 12, h: 10 } },
        ],
      },
      {
        id: 'positions',
        label: 'Positions',
        defaultWidgets: [
          { id: 'positions-1', type: 'portfolio-positions', x: 0, y: 0, w: 12, h: 10 },
        ],
        widgets: [
          { id: 'portfolio-positions', name: 'Positions', description: 'Open positions', defaultSize: { w: 12, h: 10 } },
        ],
      },
      {
        id: 'history',
        label: 'Trade History',
        defaultWidgets: [
          { id: 'trade-history-1', type: 'portfolio-trade-history', x: 0, y: 0, w: 12, h: 10 },
        ],
        widgets: [
          { id: 'portfolio-trade-history', name: 'Trade History', description: 'Transaction history', defaultSize: { w: 12, h: 10 } },
        ],
      },
    ],
  },
};

export default URL_WIDGET_MAP;
