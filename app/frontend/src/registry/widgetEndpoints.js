/**
 * widgetEndpoints — single source of truth for every widget type.
 *
 * Entry shape:
 *   {
 *     title:       string,
 *     endpoint:    '/path/{symbol}'        // {placeholder} → from params or outer state
 *     dataPath?:   'result' | 'a.b.c'       // dotted path to unwrap response → rows / object
 *     display?:    'kv'                     // flat object → metric/value 2-col table
 *     params?:     [{                       // inline form; values feed {placeholder} + querystring
 *       name, label?, kind: 'text'|'number'|'date'|'select',
 *       default, options?, step?, hint?, upper?
 *     }]
 *     expandable?: { keyField, endpoint, dataPath? }
 *     component?:  Component                // escape hatch — only for portfolio widgets that need
 *                                           //   non-API state (e.g. portfolioData)
 *     propsFrom?:  ['symbol'|'portfolioId']  // which extra props to inject into custom component
 *   }
 *
 * Add a new widget: add an entry here, reference id in urlWidgetMap.js.
 */
import PortfolioStatsWidget  from '../components/widgets/PortfolioStatsWidget';
import WatchlistWidget       from '../components/widgets/WatchlistWidget';
import ScreenerWidget        from '../components/widgets/ScreenerWidget';
import AlertsWidget          from '../components/widgets/AlertsWidget';
import NewsFeedWidget        from '../components/widgets/NewsFeedWidget';

// ── date helpers (used by quant param defaults) ─────────────────────────────
const isoDate = (d) => d.toISOString().slice(0, 10);
const today      = () => isoDate(new Date());
const yearsAgo   = (n) => { const d = new Date(); d.setFullYear(d.getFullYear() - n); return isoDate(d); };
const monthsAhead = (n) => { const d = new Date(); d.setMonth(d.getMonth() + n); return isoDate(d); };

const TARGET_OPTIONS = ['close', 'open', 'high', 'low', 'adj_close', 'return'];

export const WIDGET_ENDPOINTS = {

  // ── Institutional 13F ─────────────────────────────────────────────────────
  'institutional-portfolios': {
    title:    'Institutional Portfolios',
    endpoint: '/portfolio/13f/institutions',
    dataPath: 'institutions',
    expandable: {
      keyField: 'key',
      endpoint: '/portfolio/13f/{key}',
      dataPath: 'stocks',
    },
  },

  // ── Stock ──────────────────────────────────────────────────────────────────
  'dividend':              { title: 'Dividends',              endpoint: '/stock/dividends/{symbol}' },
  'stock-splits':          { title: 'Stock Splits',           endpoint: '/stock/splits/{symbol}' },
  'company-filings':       { title: 'SEC Filings',            endpoint: '/stock/filings/{symbol}' },
  'earnings':              { title: 'Earnings',               endpoint: '/stock/earnings/{symbol}' },
  'earnings-history':      { title: 'Earnings History',       endpoint: '/stock/earnings/{symbol}' },
  'insider':               { title: 'Insider Trading',        endpoint: '/stock/insider-trading/{symbol}' },
  'ownership-overview':    { title: 'Ownership Overview',     endpoint: '/stock/holders/{symbol}' },
  'ownership-institutional': { title: 'Institutional Holders', endpoint: '/stock/holders/{symbol}' },
  'holder-breakdown':      { title: 'Holder Breakdown',        endpoint: '/stock/holders/{symbol}', dataPath: 'institutional' },
  'ownership-insider':     { title: 'Insider Activity',       endpoint: '/stock/insider-trading/{symbol}' },
  'management':            { title: 'Management',             endpoint: '/stock/management/{symbol}' },
  'swot':                  { title: 'SWOT Analysis',          endpoint: '/stock/swot/{symbol}' },
  'economic-moat':         { title: 'Economic Moat',          endpoint: '/stock/moat/{symbol}' },
  'investment-scorecard':  { title: 'Investment Scorecard',   endpoint: '/stock/scorecard/{symbol}' },
  'stock-sentiment':       { title: 'News Sentiment',         endpoint: '/stock/sentiment/{symbol}' },
  'social-sentiment':      { title: 'Social Sentiment',       endpoint: '/stock/reddit/{symbol}' },
  'financials':            { title: 'Financial Statements',   endpoint: '/stock/financials/{symbol}' },

  // ── Macro ──────────────────────────────────────────────────────────────────
  'gdp-forecast':          { title: 'GDP Forecast',           endpoint: '/macro/overview/gdp-forecast?period={period}' },
  'inflation-momentum':    { title: 'Inflation Momentum',     endpoint: '/macro/overview/inflation-momentum?period={period}' },
  'initial-claims':        { title: 'Initial Claims',         endpoint: '/macro/overview/initial-claims?period={period}' },
  'jobs-breakdown':        { title: 'Jobs Breakdown',         endpoint: '/macro/overview/jobs-breakdown?period={period}' },
  'yield-curve-snapshot':  { title: 'Yield Curve',            endpoint: '/macro/yield-curve' },
  'yield-trends':          { title: 'Yield Trends',           endpoint: '/macro/yield-curve/history?period={period}' },
  'real-rates':            { title: 'Real Rates (TIPS)',       endpoint: '/macro/real-rates?period={period}' },
  'fed-balance-sheet':     { title: 'Fed Balance Sheet',      endpoint: '/macro/fed-balance-sheet?period={period}' },
  'inflation-decomp':      { title: 'Inflation Decomposition', endpoint: '/macro/inflation/decomposition' },
  'inflation-trends':      { title: 'Inflation Trends',       endpoint: '/macro/inflation/sector-history?period={period}' },
  'labor-market-dashboard': { title: 'Labor Market',          endpoint: '/macro/labor/dashboard' },
  'pmi':                   { title: 'ISM PMI / LEI',          endpoint: '/macro/business-cycle/pmi?period={period}' },
  'fin-conditions-tab':    { title: 'Financial Conditions',   endpoint: '/macro/financial-conditions' },
  'sentiment-tab':         { title: 'Market Sentiment',       endpoint: '/macro/sentiment/composite' },
  'commodities-tab':       { title: 'Commodities',            endpoint: '/macro/fred/series' },

  // ── QuantLib option pricing (form-driven, common-widget) ──────────────────
  'option-pricing': {
    title:    'Option Pricing',
    endpoint: '/quantlib/pricing/option',
    dataPath: 'result',
    display:  'kv',
    params: [
      { name: 'option_type',     label: 'Type',     kind: 'select', default: 'call',
        options: ['call', 'put'] },
      { name: 'exercise_style',  label: 'Exercise', kind: 'select', default: 'european',
        options: ['european', 'american'] },
      { name: 'engine',          label: 'Engine',   kind: 'select', default: 'analytic',
        options: [
          { value: 'analytic', label: 'Analytic (Black-Scholes)' },
          { value: 'binomial', label: 'Binomial (CRR)' },
          { value: 'mc',       label: 'Monte Carlo' },
        ] },
      { name: 'spot',            label: 'Spot (S)',          kind: 'number', default: 100,    step: 0.01 },
      { name: 'strike',          label: 'Strike (K)',        kind: 'number', default: 100,    step: 0.01 },
      { name: 'evaluation_date', label: 'Eval Date',         kind: 'date',   default: today },
      { name: 'expiry',          label: 'Expiry',            kind: 'date',   default: () => monthsAhead(3) },
      { name: 'volatility',      label: 'Volatility (σ)',    kind: 'number', default: 0.20,   step: 0.01,  hint: '0.20 = 20%' },
      { name: 'risk_free_rate',  label: 'Risk-Free (r)',     kind: 'number', default: 0.04,   step: 0.001, hint: '0.04 = 4%' },
      { name: 'dividend_yield',  label: 'Dividend Yield (q)', kind: 'number', default: 0.0,   step: 0.001 },
    ],
  },

  // ── Quantitative analytics (yfinance + scipy + statsmodels) ───────────────
  'quant-summary': {
    title:    'Quant — Summary',
    endpoint: '/quantitative/summary',
    dataPath: 'result',
    display:  'kv',
    params: [
      { name: 'symbol',     label: 'Symbol', kind: 'text',   default: 'AAPL', upper: true },
      { name: 'target',     label: 'Target', kind: 'select', default: 'close', options: TARGET_OPTIONS },
      { name: 'start_date', label: 'Start',  kind: 'date',   default: () => yearsAgo(2) },
      { name: 'end_date',   label: 'End',    kind: 'date',   default: today },
    ],
  },
  'quant-normality': {
    title:    'Quant — Normality',
    endpoint: '/quantitative/normality',
    dataPath: 'result.tests',
    params: [
      { name: 'symbol',     label: 'Symbol', kind: 'text',   default: 'AAPL', upper: true },
      { name: 'target',     label: 'Target', kind: 'select', default: 'return', options: TARGET_OPTIONS },
      { name: 'start_date', label: 'Start',  kind: 'date',   default: () => yearsAgo(2) },
      { name: 'end_date',   label: 'End',    kind: 'date',   default: today },
    ],
  },
  'quant-capm': {
    title:    'Quant — CAPM',
    endpoint: '/quantitative/capm',
    dataPath: 'result',
    display:  'kv',
    params: [
      { name: 'symbol',         label: 'Symbol',    kind: 'text',   default: 'AAPL', upper: true },
      { name: 'benchmark',      label: 'Benchmark', kind: 'text',   default: '^GSPC', upper: true },
      { name: 'risk_free_rate', label: 'Risk-Free', kind: 'number', default: 0.04, step: 0.001, hint: '0.04 = 4%' },
      { name: 'target',         label: 'Target',    kind: 'select', default: 'return', options: TARGET_OPTIONS },
      { name: 'start_date',     label: 'Start',     kind: 'date',   default: () => yearsAgo(2) },
      { name: 'end_date',       label: 'End',       kind: 'date',   default: today },
    ],
  },
  'quant-rolling': {
    title:    'Quant — Rolling',
    endpoint: '/quantitative/rolling',
    dataPath: 'result.points',
    chart: {
      defaultType:    'area',
      referenceLines: [{ y: 0, color: '#475569', label: 'zero' }],
    },
    params: [
      { name: 'symbol',         label: 'Symbol', kind: 'text',   default: 'AAPL', upper: true },
      { name: 'metric',         label: 'Metric', kind: 'select', default: 'sharpe',
        options: ['sharpe', 'sortino', 'stdev', 'mean', 'skew', 'kurtosis', 'quantile'] },
      { name: 'window',         label: 'Window', kind: 'number', default: 21, step: 1 },
      { name: 'target',         label: 'Target', kind: 'select', default: 'return', options: TARGET_OPTIONS },
      { name: 'risk_free_rate', label: 'Risk-Free', kind: 'number', default: 0.04, step: 0.001 },
      { name: 'quantile_pct',   label: 'Quantile (0-1)', kind: 'number', default: 0.5, step: 0.05, min: 0, max: 1 },
      { name: 'start_date',     label: 'Start',  kind: 'date',   default: () => yearsAgo(2) },
      { name: 'end_date',       label: 'End',    kind: 'date',   default: today },
    ],
  },
  'quant-adf': {
    title:    'Quant — ADF (Stationarity)',
    endpoint: '/quantitative/unitroot',
    dataPath: 'result',
    display:  'kv',
    params: [
      { name: 'symbol',     label: 'Symbol', kind: 'text',   default: 'AAPL', upper: true },
      { name: 'target',     label: 'Target', kind: 'select', default: 'close', options: TARGET_OPTIONS },
      { name: 'regression', label: 'Regression', kind: 'select', default: 'c',
        options: [
          { value: 'c',   label: 'c (constant)' },
          { value: 'ct',  label: 'ct (const + trend)' },
          { value: 'ctt', label: 'ctt (quadratic trend)' },
          { value: 'n',   label: 'n (none)' },
        ],
        hint: 'ADF regression form' },
      { name: 'start_date', label: 'Start',  kind: 'date',   default: () => yearsAgo(2) },
      { name: 'end_date',   label: 'End',    kind: 'date',   default: today },
    ],
  },

  // ── Watchlist / Screener / Alerts / News (custom CRUD widgets) ─────────────
  'watchlist': {
    title:     'Watchlist',
    component: WatchlistWidget,
  },
  'screener': {
    title:     'Screener',
    component: ScreenerWidget,
  },
  'alerts': {
    title:     'Alerts',
    component: AlertsWidget,
  },
  'news-feed': {
    title:     'News Feed',
    component: NewsFeedWidget,
    propsFrom: ['symbol'],
  },

  // ── Portfolio (custom + data-driven) ───────────────────────────────────────
  'portfolio-stats': {
    title:     'Portfolio Stats',
    component: PortfolioStatsWidget,
    propsFrom: ['portfolioId'],
  },
  'portfolio-chart':         { title: 'Portfolio Chart',    endpoint: '/user-portfolio/portfolios/{portfolioId}/chart' },
  'portfolio-holdings':      { title: 'Holdings',           endpoint: '/user-portfolio/portfolios/{portfolioId}/holdings' },
  'portfolio-balances':      { title: 'Balances',           endpoint: '/user-portfolio/portfolios/{portfolioId}/holdings' },
  'portfolio-positions':     { title: 'Positions',          endpoint: '/user-portfolio/portfolios/{portfolioId}/holdings' },
  'portfolio-trade-history': { title: 'Trade History',      endpoint: '/user-portfolio/portfolios/{portfolioId}/transactions' },
};
