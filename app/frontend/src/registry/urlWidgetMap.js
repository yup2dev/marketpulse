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
        // 무키 기본 그리드(랜딩이 키 없이도 채워지도록). 키 필요 위젯(fred/polygon)은 메뉴에서 추가.
        defaultWidgets: [
          { id: 'w0', type: 'tv-index-charts',   x: 0, y: 0,  w: 12, h: 4 },
          { id: 'w1', type: 'heatmap',           x: 0, y: 4,  w: 6,  h: 8 },
          { id: 'w2', type: 'tv-market-ranking', x: 6, y: 4,  w: 6,  h: 8 },
          { id: 'w3', type: 'sparkline',         x: 0, y: 12, w: 12, h: 3 },
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
          { id: 'market-ranking',     name: 'Market Ranking',      description: '실시간 급등/급락/거래량 랭킹', defaultSize: { w: 5, h: 10 } },
          { id: 'watchlist',          name: 'Watchlist',           description: 'Manage watchlists',          defaultSize: { w: 6, h: 8 } },
          { id: 'screener',           name: 'Screener',            description: 'Screen stocks by criteria',  defaultSize: { w: 12, h: 10 } },
          { id: 'news-feed',          name: 'News Feed',           description: 'Latest market news',         defaultSize: { w: 6, h: 8 } },
          { id: 'alerts',             name: 'Alerts',              description: 'Price & event alerts',       defaultSize: { w: 6, h: 8 } },
          { id: 'sparkline',          name: 'Index Charts',        description: 'Index ticker bar',           defaultSize: { w: 12, h: 3 } },
          { id: 'tv-index-charts',    name: 'Index Charts (TV)',   description: 'TradingView 지수 시세 타일',   defaultSize: { w: 12, h: 2 } },
          { id: 'tv-market-ranking',  name: 'Market Ranking (TV)', description: 'TradingView 급등/급락/거래량', defaultSize: { w: 5, h: 10 } },
          { id: 'advanced-chart',     name: 'Advanced Chart',      description: '멀티심볼·캔들·보조지표·페어분석 차트', defaultSize: { w: 8, h: 10 } },
          { id: 'comparison',         name: 'Stock Comparison',    description: 'Compare 2-4 stocks',         defaultSize: { w: 8, h: 10 } },
          { id: 'heatmap',            name: 'Sector Heatmap',      description: 'S&P 500 sector treemap',     defaultSize: { w: 8, h: 8 } },
          { id: 'correlation',        name: 'Correlation Matrix',  description: 'Multi-stock correlations',   defaultSize: { w: 8, h: 10 } },
          { id: 'economic-calendar',  name: 'Economic Calendar',   description: '경제 이벤트 (실제/예측/이전)', defaultSize: { w: 6, h: 8 } },
          { id: 'earnings-calendar',  name: 'Earnings Calendar',   description: '실적 발표 일정 (예상 EPS/시총)', defaultSize: { w: 6, h: 8 } },
          { id: 'terminal',           name: 'Terminal',            description: 'Command-line data query',    defaultSize: { w: 8, h: 10 } },
          { id: 'notes',              name: 'Notes',               description: 'Personal memo pad',          defaultSize: { w: 6, h: 8 } },
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
          { id: 'financials-ov-1',      type: 'financials',         x: 0, y: 0,  w: 8,  h: 5 },
          { id: 'insider-1',            type: 'insider',            x: 8, y: 0,  w: 4,  h: 5 },
          { id: 'ownership-overview-1', type: 'ownership-overview', x: 0, y: 5,  w: 12, h: 6 },
        ],
        widgets: [
          { id: 'earnings-history',   name: 'Earnings History',  description: 'EPS history & surprises',   defaultSize: { w: 8, h: 5 } },
          { id: 'earnings',           name: 'Earnings',          description: 'Upcoming earnings',          defaultSize: { w: 6, h: 5 } },
          { id: 'insider',            name: 'Insider',           description: 'Insider trading activity',   defaultSize: { w: 4, h: 5 } },
          { id: 'ownership-overview', name: 'Ownership Overview', description: 'Ownership breakdown',      defaultSize: { w: 12, h: 6 } },
          { id: 'research-reports',   name: 'Research Reports',  description: 'PDF import — analyst/estimates/annual reports', defaultSize: { w: 8, h: 10 } },
          { id: 'stock-sentiment',    name: 'News Sentiment',    description: 'News sentiment & trend',     defaultSize: { w: 6,  h: 8 } },
          { id: 'social-sentiment',   name: 'Social Sentiment',  description: 'Reddit & StockTwits',        defaultSize: { w: 6,  h: 8 } },
          { id: 'news-feed',          name: 'News Feed',         description: 'Latest news for this stock', defaultSize: { w: 6,  h: 8 } },
          { id: 'market-ranking',     name: 'Market Ranking',    description: '실시간 급등/급락/거래량 랭킹', defaultSize: { w: 5, h: 10 } },
          { id: 'watchlist',          name: 'Watchlist',          description: 'Manage watchlists',          defaultSize: { w: 6,  h: 8 } },
          { id: 'sparkline',          name: 'Index Charts',      description: 'Index ticker bar',           defaultSize: { w: 12, h: 3 } },
          { id: 'advanced-chart',     name: 'Advanced Chart',    description: '멀티심볼·캔들·보조지표·페어분석 차트', defaultSize: { w: 8, h: 10 } },
          { id: 'comparison',         name: 'Stock Comparison',  description: 'Compare 2-4 stocks',         defaultSize: { w: 8,  h: 10 } },
          { id: 'correlation',        name: 'Correlation Matrix',description: 'Multi-stock correlations',   defaultSize: { w: 8,  h: 10 } },
          { id: 'notes',              name: 'Notes',             description: 'Personal memo pad',          defaultSize: { w: 6,  h: 8 } },
          { id: 'terminal',           name: 'Terminal',          description: 'Command-line data query',    defaultSize: { w: 8,  h: 10 } },
        ],
      },
      {
        id: 'financials',
        label: 'Financials',
        defaultWidgets: [
          { id: 'financials-1', type: 'financials', x: 0, y: 0, w: 12, h: 10 },
        ],
        widgets: [
          { id: 'financials',     name: 'Financial Statements',   description: 'Income, Balance, Cash Flow (provider 선택)',     defaultSize: { w: 12, h: 10 } },
        ],
      },
      {
        id: 'institutional',
        label: 'Institutional Holdings',
        defaultWidgets: [
          { id: 'inst-portfolios-1',  type: 'institutional-portfolios', x: 0, y: 0,  w: 12, h: 10 },
          { id: 'holder-breakdown-1', type: 'holder-breakdown',         x: 0, y: 10, w: 12, h: 7  },
        ],
        widgets: [
          { id: 'institutional-portfolios', name: 'Institutional Portfolios', description: '13F holdings by manager',              defaultSize: { w: 12, h: 10 } },
          { id: 'holder-breakdown',         name: 'Holder Breakdown',         description: 'Holder weight & change (table/chart)', defaultSize: { w: 12, h: 7  } },
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
          { id: 'ownership-overview',      name: 'Ownership Overview',    description: 'Ownership breakdown',            defaultSize: { w: 12, h: 6 } },
          { id: 'ownership-institutional', name: 'Institutional Holders', description: 'Top institutional holders',      defaultSize: { w: 6,  h: 6 } },
          { id: 'ownership-insider',       name: 'Insider Activity',      description: 'Insider trading (Yahoo)',        defaultSize: { w: 6,  h: 6 } },
        ],
      },
      {
        id: 'calendar',
        label: 'Calendar',
        // 무키 이벤트만(splits/dividend/filings). earnings-history(polygon)는 메뉴에서 추가.
        defaultWidgets: [
          { id: 'stock-splits-1',    type: 'stock-splits',    x: 0, y: 0, w: 6,  h: 5 },
          { id: 'dividends-1',       type: 'dividend',        x: 6, y: 0, w: 6,  h: 5 },
          { id: 'company-filings-1', type: 'company-filings', x: 0, y: 5, w: 12, h: 5 },
        ],
        widgets: [
          { id: 'earnings-history', name: 'Earnings History', description: 'EPS history & surprises', defaultSize: { w: 6, h: 6 } },
          { id: 'stock-splits',     name: 'Stock Splits',     description: 'Split history',            defaultSize: { w: 6, h: 6 } },
          { id: 'dividend',         name: 'Dividends',        description: 'Dividend payments',        defaultSize: { w: 6, h: 6 } },
          { id: 'company-filings',  name: 'SEC Filings',      description: 'SEC filings & reports (provider 선택)', defaultSize: { w: 6, h: 6 } },
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
        // social-sentiment(무키)만 기본. stock-sentiment(News, polygon)은 메뉴에서 추가.
        defaultWidgets: [
          { id: 'social-sentiment-1', type: 'social-sentiment', x: 0, y: 0, w: 12, h: 8 },
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
          { id: 'economic-calendar',  name: 'Economic Calendar',  description: '경제 이벤트 (실제/예측/이전)', defaultSize: { w: 6, h: 8 } },
          { id: 'earnings-calendar',  name: 'Earnings Calendar',  description: '실적 발표 일정 (예상 EPS/시총)', defaultSize: { w: 6, h: 8 } },
          { id: 'heatmap',            name: 'Sector Heatmap',     description: 'S&P 500 sector treemap',     defaultSize: { w: 8, h: 8 } },
          { id: 'notes',              name: 'Notes',              description: 'Personal memo pad',          defaultSize: { w: 6, h: 8 } },
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

  // ─── QuantLib (/quantlib) ────────────────────────────────────────────────────
  '/quantlib': {
    label: 'QuantLib',
    needsSymbol: true,
    needsPortfolio: false,
    categories: [
      {
        id: 'pricing',
        label: 'Pricing',
        defaultWidgets: [
          { id: 'option-pricing-1', type: 'option-pricing', x: 0, y: 0, w: 8, h: 16 },
        ],
        widgets: [
          { id: 'option-pricing', name: 'Option Pricing', description: 'Black-Scholes / Binomial / MC — NPV & Greeks', defaultSize: { w: 8, h: 16 } },
        ],
      },
      {
        id: 'analytics',
        label: 'Analytics',
        defaultWidgets: [
          { id: 'quant-summary-1',   type: 'quant-summary',   x: 0, y: 0,  w: 6, h: 10 },
          { id: 'quant-normality-1', type: 'quant-normality', x: 6, y: 0,  w: 6, h: 10 },
          { id: 'quant-capm-1',      type: 'quant-capm',      x: 0, y: 10, w: 6, h: 12 },
          { id: 'quant-adf-1',       type: 'quant-adf',       x: 6, y: 10, w: 6, h: 12 },
          { id: 'quant-rolling-1',   type: 'quant-rolling',   x: 0, y: 22, w: 12, h: 10 },
        ],
        widgets: [
          { id: 'quant-summary',   name: 'Summary',     description: 'Descriptive stats (mean, std, skew, kurtosis, percentiles)', defaultSize: { w: 6, h: 10 } },
          { id: 'quant-normality', name: 'Normality',   description: 'Jarque-Bera / Shapiro / KS / kurtosis / skew tests',         defaultSize: { w: 6, h: 10 } },
          { id: 'quant-capm',      name: 'CAPM',        description: 'β / α / R² vs benchmark',                                    defaultSize: { w: 6, h: 12 } },
          { id: 'quant-rolling',   name: 'Rolling',     description: 'Rolling Sharpe/Sortino/stdev/mean/skew/kurtosis/quantile',   defaultSize: { w: 12, h: 10 } },
          { id: 'quant-adf',       name: 'ADF',         description: 'Augmented Dickey-Fuller stationarity test',                  defaultSize: { w: 6, h: 12 } },
          { id: 'correlation',    name: 'Correlation', description: 'Multi-stock correlation matrix',                             defaultSize: { w: 8, h: 10 } },
          { id: 'comparison',     name: 'Comparison',  description: 'Side-by-side stock comparison',                              defaultSize: { w: 8, h: 10 } },
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

  // ─── Screener (/screener) ───────────────────────────────────────────────────
  '/screener': {
    label: 'Screener',
    needsSymbol: false,
    needsPortfolio: false,
    categories: [
      {
        id: 'screener',
        label: 'Screener',
        defaultWidgets: [
          { id: 'screener-1', type: 'screener', x: 0, y: 0, w: 12, h: 14 },
        ],
        widgets: [
          { id: 'screener',        name: 'Stock Screener', description: 'Filter stocks by fundamentals', defaultSize: { w: 12, h: 14 } },
          { id: 'market-ranking', name: 'Market Ranking', description: '실시간 급등/급락/거래량 랭킹', defaultSize: { w: 5, h: 10 } },
          { id: 'watchlist',      name: 'Watchlist',       description: 'Manage watchlists',             defaultSize: { w: 6,  h: 8  } },
          { id: 'heatmap',        name: 'Sector Heatmap',  description: 'S&P 500 sector treemap',        defaultSize: { w: 8,  h: 8  } },
          { id: 'sparkline',      name: 'Index Charts',    description: 'Index ticker bar',              defaultSize: { w: 12, h: 3  } },
        ],
      },
    ],
  },

  // ─── Alerts (/alerts) ──────────────────────────────────────────────────────
  '/alerts': {
    label: 'Alerts',
    needsSymbol: false,
    needsPortfolio: false,
    categories: [
      {
        id: 'overview',
        label: 'Overview',
        defaultWidgets: [
          { id: 'alerts-1',   type: 'alerts',    x: 0, y: 0, w: 6,  h: 10 },
          { id: 'news-feed-1', type: 'news-feed', x: 6, y: 0, w: 6,  h: 10 },
        ],
        widgets: [
          { id: 'alerts',         name: 'Alerts',         description: 'Price & event alerts',         defaultSize: { w: 6,  h: 10 } },
          { id: 'news-feed',      name: 'News Feed',      description: 'Latest market news',           defaultSize: { w: 6,  h: 8  } },
          { id: 'market-ranking', name: 'Market Ranking', description: '실시간 급등/급락/거래량 랭킹', defaultSize: { w: 5,  h: 10 } },
          { id: 'watchlist',      name: 'Watchlist',      description: 'Manage watchlists',            defaultSize: { w: 6,  h: 8  } },
          { id: 'screener',       name: 'Screener',       description: 'Screen stocks',                defaultSize: { w: 12, h: 10 } },
        ],
      },
    ],
  },
};

/**
 * getGlobalWidgetCategories — 전 페이지의 완성 위젯 카탈로그를 페이지 단위 카테고리로 집계.
 *
 * WidgetMenu에 현재 pane 카테고리 외에 다른 페이지의 완성 위젯
 * (institutional-portfolios, holder-breakdown, quant-* 등)도 노출하기 위해 사용.
 * 같은 위젯 id가 여러 페이지에 있으면 첫 등장만 유지(정의 순서 기준).
 *
 *   excludeIds       — 이미 메뉴에 있는 위젯 id (현재 pane 카테고리)
 *   includePortfolio — portfolioId가 필요한 페이지(needsPortfolio) 포함 여부.
 *                      포트폴리오 컨텍스트가 없는 페이지에서는 렌더링이 깨지므로 기본 제외.
 */
export function getGlobalWidgetCategories({ excludeIds, includePortfolio = false } = {}) {
  const seen = new Set(excludeIds ?? []);
  const result = [];
  for (const [path, page] of Object.entries(URL_WIDGET_MAP)) {
    if (!includePortfolio && page.needsPortfolio) continue;
    const widgets = [];
    for (const cat of page.categories || []) {
      for (const w of cat.widgets || []) {
        if (seen.has(w.id)) continue;
        seen.add(w.id);
        widgets.push(w);
      }
    }
    if (widgets.length) {
      result.push({ id: `page:${path}`, label: page.label, widgets });
    }
  }
  return result;
}

export default URL_WIDGET_MAP;
