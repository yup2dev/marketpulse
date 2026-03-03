/**
 * Screen-level configuration registry.
 * Defines tabs, available widgets, and default widget layouts per screen.
 * Used by TabDashboard to render any screen without per-screen boilerplate.
 */

export const SCREEN_CONFIGS = {

  // ─── Dashboard (/) ─────────────────────────────────────────────────────────
  dashboard: {
    label: 'Dashboard',
    symbol: true,
    portfolioSelector: false,
    tabs: [{ id: 'main', label: 'Overview' }],
    availableWidgets: [
      { id: 'market-overview',   name: 'Market Overview',     description: 'Market indices overview',       defaultSize: { w: 12, h: 2 } },
      { id: 'live-watchlist',    name: 'Live Watchlist',       description: 'Real-time watchlist',           defaultSize: { w: 8,  h: 6 } },
      { id: 'ticker-info',       name: 'Ticker Info',          description: 'Company details & price',      defaultSize: { w: 4,  h: 4 } },
      { id: 'stock-chart',       name: 'Stock Chart',          description: 'Price chart with indicators',  defaultSize: { w: 8,  h: 6 } },
      { id: 'key-metrics',       name: 'Key Metrics',          description: 'Valuation metrics',            defaultSize: { w: 4,  h: 6 } },
      { id: 'financial-table',   name: 'Financial Table',      description: 'Income/Balance/Cash Flow',     defaultSize: { w: 6,  h: 5 } },
      { id: 'analyst',           name: 'Analyst',              description: 'Ratings & price targets',      defaultSize: { w: 4,  h: 6 } },
      { id: 'earnings',          name: 'Earnings',             description: 'EPS history & surprises',      defaultSize: { w: 4,  h: 6 } },
      { id: 'insider',           name: 'Insider',              description: 'Insider trading activity',      defaultSize: { w: 4,  h: 6 } },
      { id: 'regime',            name: 'Regime',               description: 'Market regime indicator',      defaultSize: { w: 4,  h: 4 } },
      { id: 'yield-curve',       name: 'Yield Curve',          description: 'Current yield curve',         defaultSize: { w: 6,  h: 4 } },
      { id: 'alert-statistics',  name: 'Alert Statistics',     description: 'Alert summary stats',          defaultSize: { w: 4,  h: 4 } },
      { id: 'recent-triggers',   name: 'Recent Triggers',      description: 'Recently triggered alerts',    defaultSize: { w: 6,  h: 4 } },
    ],
    defaultWidgets: {
      main: [
        { id: 'w1', type: 'market-overview', x: 0, y: 0, w: 12, h: 2 },
        { id: 'w2', type: 'live-watchlist',  x: 0, y: 2, w: 8,  h: 6 },
        { id: 'w3', type: 'ticker-info',     x: 8, y: 2, w: 4,  h: 3 },
        { id: 'w4', type: 'regime',          x: 8, y: 5, w: 4,  h: 3 },
      ],
    },
  },

  // ─── Stock Analysis (/stock) ────────────────────────────────────────────────
  stock: {
    label: 'Stock Analysis',
    symbol: true,
    portfolioSelector: false,
    tabs: [
      { id: 'overview',               label: 'Overview' },
      { id: 'financials',             label: 'Financials' },
      { id: 'revenue-segments',       label: 'Revenue' },
      { id: 'institutional-holdings', label: 'Institutional' },
      { id: 'comparison-analysis',    label: 'Comparison' },
      { id: 'ownership',              label: 'Ownership' },
      { id: 'company-calendar',       label: 'Calendar' },
      { id: 'estimates',              label: 'Estimates' },
      { id: 'analysis',               label: 'Analysis' },
      { id: 'sentiment',              label: 'Sentiment' },
      { id: 'scorecard',              label: 'Scorecard' },
      { id: 'relations',              label: 'Relations' },
    ],
    availableWidgets: {
      overview: [
        { id: 'ticker-information', name: 'Ticker Information', description: 'Price with mini chart',        defaultSize: { w: 4, h: 4 } },
        { id: 'key-metrics',        name: 'Key Metrics',        description: 'Valuation & profitability',    defaultSize: { w: 4, h: 8 } },
        { id: 'advanced-chart',     name: 'Advanced Chart',     description: 'Price chart with indicators',  defaultSize: { w: 8, h: 7 } },
        { id: 'earnings-history',   name: 'Earnings History',   description: 'EPS history & surprises',      defaultSize: { w: 6, h: 5 } },
        { id: 'analyst',            name: 'Analyst',            description: 'Ratings & price targets',      defaultSize: { w: 4, h: 7 } },
        { id: 'insider',            name: 'Insider',            description: 'Insider trading activity',     defaultSize: { w: 4, h: 6 } },
      ],
      financials: [
        { id: 'financial-table', name: 'Financial Statements', description: 'Income, Balance, Cash Flow', defaultSize: { w: 12, h: 8 } },
        { id: 'key-metrics',     name: 'Key Metrics',          description: 'Valuation metrics',           defaultSize: { w: 4,  h: 6 } },
      ],
      'revenue-segments': [
        { id: 'revenue-segments', name: 'Revenue Breakdown', description: 'Product & geographic segment revenue', defaultSize: { w: 12, h: 8 } },
      ],
      'institutional-holdings': [
        { id: 'institutional-portfolios', name: 'Institutional Portfolios', description: 'Top institutional holders', defaultSize: { w: 12, h: 8 } },
      ],
      'comparison-analysis': [
        { id: 'comparison-analysis', name: 'Comparison Analysis', description: 'Compare multiple stocks', defaultSize: { w: 12, h: 10 } },
      ],
      ownership: [
        { id: 'ownership-overview',       name: 'Ownership Overview',      description: 'Ownership breakdown',      defaultSize: { w: 12, h: 6 } },
        { id: 'ownership-institutional',  name: 'Institutional Holders',   description: 'Top institutional holders', defaultSize: { w: 6,  h: 6 } },
        { id: 'ownership-insider',        name: 'Insider Activity',        description: 'Insider trading',           defaultSize: { w: 6,  h: 6 } },
      ],
      'company-calendar': [
        { id: 'earnings-history',  name: 'Earnings History', description: 'EPS history & surprises', defaultSize: { w: 6, h: 6 } },
        { id: 'stock-splits',      name: 'Stock Splits',     description: 'Split history',           defaultSize: { w: 6, h: 6 } },
        { id: 'dividends',         name: 'Dividends',        description: 'Dividend payments',        defaultSize: { w: 6, h: 6 } },
        { id: 'company-filings',   name: 'SEC Filings',      description: 'SEC filings & reports',    defaultSize: { w: 6, h: 6 } },
      ],
      estimates: [
        { id: 'estimates', name: 'Analyst Estimates', description: 'Estimates overview with tabs', defaultSize: { w: 12, h: 10 } },
      ],
      analysis: [
        { id: 'swot',          name: 'SWOT Analysis',  description: 'Data-driven SWOT',          defaultSize: { w: 6, h: 8 } },
        { id: 'management',    name: 'Management',     description: 'Executive team & governance', defaultSize: { w: 6, h: 7 } },
        { id: 'economic-moat', name: 'Economic Moat',  description: '10-year moat metrics',       defaultSize: { w: 6, h: 7 } },
      ],
      sentiment: [
        { id: 'stock-sentiment',  name: 'News Sentiment',   description: 'News sentiment & trend',     defaultSize: { w: 6, h: 8 } },
        { id: 'social-sentiment', name: 'Social Sentiment', description: 'Reddit & StockTwits',        defaultSize: { w: 6, h: 8 } },
      ],
      scorecard: [
        { id: 'investment-scorecard', name: 'Investment Scorecard', description: '5-category scorecard',   defaultSize: { w: 6, h: 10 } },
        { id: 'macro-cross',          name: 'Macro Cross',           description: 'Macro impact analysis', defaultSize: { w: 6, h: 8  } },
      ],
      relations: [
        { id: 'company-relations', name: 'Company Relations', description: 'Supply chain & competitor network', defaultSize: { w: 12, h: 10 } },
      ],
    },
    defaultWidgets: {
      overview: [
        { id: 'ticker-information-1', type: 'ticker-information', x: 0, y: 0, w: 4, h: 4 },
        { id: 'key-metrics-1',        type: 'key-metrics',        x: 4, y: 0, w: 4, h: 8 },
        { id: 'analyst-1',            type: 'analyst',            x: 8, y: 0, w: 4, h: 8 },
        { id: 'chart-1',              type: 'advanced-chart',     x: 0, y: 4, w: 4, h: 5 },
        { id: 'earnings-history-1',   type: 'earnings-history',   x: 0, y: 9, w: 12, h: 5 },
      ],
      financials: [
        { id: 'financial-table-1', type: 'financial-table', x: 0, y: 0, w: 12, h: 8 },
      ],
      'revenue-segments': [
        { id: 'revenue-segments-1', type: 'revenue-segments', x: 0, y: 0, w: 12, h: 9 },
      ],
      'institutional-holdings': [
        { id: 'institutional-1', type: 'institutional-portfolios', x: 0, y: 0, w: 12, h: 8 },
      ],
      'comparison-analysis': [
        { id: 'comparison-1', type: 'comparison-analysis', x: 0, y: 0, w: 12, h: 10 },
      ],
      ownership: [
        { id: 'ownership-overview-1',      type: 'ownership-overview',      x: 0, y: 0, w: 12, h: 6 },
        { id: 'ownership-institutional-1', type: 'ownership-institutional', x: 0, y: 6, w: 6,  h: 6 },
        { id: 'ownership-insider-1',       type: 'ownership-insider',       x: 6, y: 6, w: 6,  h: 6 },
      ],
      'company-calendar': [
        { id: 'earnings-history-cal-1', type: 'earnings-history', x: 0, y: 0, w: 7, h: 5 },
        { id: 'stock-splits-1',         type: 'stock-splits',     x: 7, y: 0, w: 5, h: 5 },
        { id: 'dividends-1',            type: 'dividends',        x: 0, y: 5, w: 7, h: 5 },
        { id: 'company-filings-1',      type: 'company-filings',  x: 7, y: 5, w: 5, h: 5 },
      ],
      estimates: [
        { id: 'estimates-1', type: 'estimates', x: 0, y: 0, w: 12, h: 10 },
      ],
      analysis: [
        { id: 'swot-1',          type: 'swot',          x: 0, y: 0, w: 6, h: 8 },
        { id: 'management-1',    type: 'management',    x: 6, y: 0, w: 6, h: 7 },
        { id: 'economic-moat-1', type: 'economic-moat', x: 6, y: 7, w: 6, h: 7 },
      ],
      sentiment: [
        { id: 'stock-sentiment-1',  type: 'stock-sentiment',  x: 0, y: 0, w: 6, h: 8 },
        { id: 'social-sentiment-1', type: 'social-sentiment', x: 6, y: 0, w: 6, h: 8 },
      ],
      scorecard: [
        { id: 'investment-scorecard-1', type: 'investment-scorecard', x: 0, y: 0, w: 6, h: 10 },
        { id: 'macro-cross-1',          type: 'macro-cross',          x: 6, y: 0, w: 6, h: 8  },
      ],
      relations: [
        { id: 'company-relations-1', type: 'company-relations', x: 0, y: 0, w: 12, h: 10 },
      ],
    },
  },

  // ─── Macro (/macro) ─────────────────────────────────────────────────────────
  macro: {
    label: 'Macro',
    symbol: false,
    portfolioSelector: false,
    tabs: [
      { id: 'overview',              label: 'Overview' },
      { id: 'business-cycle',        label: 'Business Cycle' },
      { id: 'fed-policy',            label: 'Fed Policy' },
      { id: 'yield-curve',           label: 'Yield Curve' },
      { id: 'inflation',             label: 'Inflation' },
      { id: 'labor-market',          label: 'Labor Market' },
      { id: 'financial-conditions',  label: 'Fin. Conditions' },
      { id: 'sentiment',             label: 'Sentiment' },
      { id: 'commodities',           label: 'Commodities' },
    ],
    availableWidgets: {
      overview: [
        { id: 'gdp-forecast',       name: 'GDP Forecast',        description: 'Evolution of GDP forecast',         defaultSize: { w: 6, h: 6 } },
        { id: 'inflation-momentum', name: 'Inflation Momentum',  description: '12M, 6M, 3M momentum',             defaultSize: { w: 6, h: 6 } },
        { id: 'initial-claims',     name: 'Initial Claims',      description: 'Weekly claims with 4-week MA',      defaultSize: { w: 6, h: 6 } },
        { id: 'jobs-breakdown',     name: 'Jobs Breakdown',      description: 'Private vs Government jobs',        defaultSize: { w: 6, h: 6 } },
      ],
      'business-cycle': [
        { id: 'pmi', name: 'ISM PMI / LEI', description: 'Manufacturing PMI & Leading Economic Index', defaultSize: { w: 8, h: 6 } },
      ],
      'fed-policy': [
        { id: 'fed-policy-stance',  name: 'Fed Policy Stance', description: 'Fed stance, probabilities & signals', defaultSize: { w: 6, h: 6 } },
        { id: 'fed-balance-sheet',  name: 'Fed Balance Sheet', description: 'QE/QT monitor — total assets',        defaultSize: { w: 6, h: 6 } },
      ],
      'yield-curve': [
        { id: 'yield-curve-snapshot', name: 'Yield Curve',          description: 'Current yield curve shape',                      defaultSize: { w: 6, h: 6 } },
        { id: 'yield-trends',         name: 'Yield Trends',          description: 'Historical yield trends & spreads',              defaultSize: { w: 6, h: 6 } },
        { id: 'real-rates',           name: 'Real Rates (TIPS)',     description: 'Nominal vs real yields vs breakeven inflation',   defaultSize: { w: 6, h: 6 } },
      ],
      inflation: [
        { id: 'inflation-decomp',   name: 'Inflation Decomposition', description: 'CPI components breakdown',        defaultSize: { w: 6, h: 6 } },
        { id: 'inflation-trends',   name: 'Inflation Trends',        description: 'Historical CPI sector trends',   defaultSize: { w: 6, h: 6 } },
      ],
      'labor-market': [
        { id: 'labor-market-dashboard', name: 'Labor Market', description: 'Employment metrics dashboard', defaultSize: { w: 6, h: 6 } },
      ],
      'financial-conditions': [
        { id: 'fin-conditions-tab', name: 'Financial Conditions', description: 'Credit spreads & liquidity', defaultSize: { w: 12, h: 8 } },
      ],
      sentiment: [
        { id: 'sentiment-tab', name: 'Market Sentiment', description: 'Fear/Greed & VIX', defaultSize: { w: 12, h: 8 } },
      ],
      commodities: [
        { id: 'commodities-tab', name: 'Commodities', description: 'Commodity ratios', defaultSize: { w: 12, h: 8 } },
      ],
    },
    defaultWidgets: {
      overview: [
        { id: 'gdp-1',       type: 'gdp-forecast',       x: 0, y: 0, w: 6, h: 6 },
        { id: 'inflation-1', type: 'inflation-momentum', x: 6, y: 0, w: 6, h: 6 },
        { id: 'claims-1',    type: 'initial-claims',     x: 0, y: 6, w: 6, h: 6 },
        { id: 'jobs-1',      type: 'jobs-breakdown',     x: 6, y: 6, w: 6, h: 6 },
      ],
      'business-cycle': [
        { id: 'pmi-1', type: 'pmi', x: 0, y: 0, w: 8, h: 7 },
      ],
      'fed-policy': [
        { id: 'fed-1',    type: 'fed-policy-stance', x: 0, y: 0, w: 6, h: 6 },
        { id: 'fed-bs-1', type: 'fed-balance-sheet', x: 6, y: 0, w: 6, h: 6 },
      ],
      'yield-curve': [
        { id: 'yield-snap-1',   type: 'yield-curve-snapshot', x: 0, y: 0, w: 6, h: 6 },
        { id: 'yield-trends-1', type: 'yield-trends',         x: 6, y: 0, w: 6, h: 6 },
        { id: 'real-rates-1',   type: 'real-rates',           x: 0, y: 6, w: 8, h: 7 },
      ],
      inflation: [
        { id: 'inflation-decomp-1',   type: 'inflation-decomp',   x: 0, y: 0, w: 6, h: 6 },
        { id: 'inflation-trends-1',   type: 'inflation-trends',   x: 6, y: 0, w: 6, h: 6 },
      ],
      'labor-market': [
        { id: 'labor-dash-1', type: 'labor-market-dashboard', x: 0, y: 0, w: 6, h: 6 },
      ],
      'financial-conditions': [
        { id: 'fin-1', type: 'fin-conditions-tab', x: 0, y: 0, w: 12, h: 8 },
      ],
      sentiment: [
        { id: 'sentiment-1', type: 'sentiment-tab', x: 0, y: 0, w: 12, h: 8 },
      ],
      commodities: [
        { id: 'commodities-1', type: 'commodities-tab', x: 0, y: 0, w: 12, h: 8 },
      ],
    },
  },

  // ─── Portfolio (/portfolios) ─────────────────────────────────────────────────
  portfolio: {
    label: 'Portfolio',
    symbol: false,
    portfolioSelector: true,
    tabs: [
      { id: 'overview',      label: 'Overview' },
      { id: 'balances',      label: 'Balances' },
      { id: 'positions',     label: 'Positions' },
      { id: 'trade-history', label: 'Trade History' },
      { id: 'open-orders',   label: 'Open Orders' },
      { id: 'dividends',     label: 'Dividends' },
      { id: 'deposits',      label: 'Deposits & Withdrawals' },
    ],
    availableWidgets: {
      overview:      [{ id: 'portfolio-stats', name: 'Portfolio Stats', description: 'P&L overview', defaultSize: { w: 5, h: 6 } }, { id: 'portfolio-chart', name: 'Portfolio Chart', description: 'P&L history', defaultSize: { w: 7, h: 6 } }, { id: 'portfolio-holdings', name: 'Holdings', description: 'Current holdings', defaultSize: { w: 12, h: 6 } }],
      balances:      [{ id: 'portfolio-balances', name: 'Balances', description: 'Account balances', defaultSize: { w: 12, h: 10 } }],
      positions:     [{ id: 'portfolio-positions', name: 'Positions', description: 'Open positions', defaultSize: { w: 12, h: 10 } }],
      'trade-history': [{ id: 'portfolio-trade-history', name: 'Trade History', description: 'Transaction history', defaultSize: { w: 12, h: 10 } }],
      'open-orders': [],
      dividends:     [],
      deposits:      [],
    },
    defaultWidgets: {
      overview: [
        { id: 'stats-1',    type: 'portfolio-stats',    x: 0, y: 0, w: 5,  h: 6 },
        { id: 'chart-1',    type: 'portfolio-chart',    x: 5, y: 0, w: 7,  h: 6 },
        { id: 'holdings-1', type: 'portfolio-holdings', x: 0, y: 6, w: 12, h: 6 },
      ],
      balances:      [{ id: 'balances-1',      type: 'portfolio-balances',      x: 0, y: 0, w: 12, h: 10 }],
      positions:     [{ id: 'positions-1',     type: 'portfolio-positions',     x: 0, y: 0, w: 12, h: 10 }],
      'trade-history': [{ id: 'trade-history-1', type: 'portfolio-trade-history', x: 0, y: 0, w: 12, h: 10 }],
      'open-orders': [],
      dividends:     [],
      deposits:      [],
    },
  },
};

export default SCREEN_CONFIGS;
