/**
 * widgetEndpoints — minimal registry.
 *
 * OpenBB style: widgetId → { endpoint, title } only.
 * Rendering is fully data-driven — the API response shape determines
 * whether to show a Plotly chart or an auto-column table.
 *
 * Add a new widget:
 *   1. Add an entry here (endpoint + title)
 *   2. Add it to urlWidgetMap.js (page / category / defaultWidgets)
 *   Done. No column definitions, no chartConfig, no dataTransform.
 */

export const WIDGET_ENDPOINTS = {

  // ── Stock ──────────────────────────────────────────────────────────────────
  'dividend':              { title: 'Dividends',              endpoint: '/stock/dividends/{symbol}' },
  'stock-splits':          { title: 'Stock Splits',           endpoint: '/stock/splits/{symbol}' },
  'company-filings':       { title: 'SEC Filings',            endpoint: '/stock/filings/{symbol}' },
  'earnings':              { title: 'Earnings',               endpoint: '/stock/earnings/{symbol}' },
  'earnings-history':      { title: 'Earnings History',       endpoint: '/stock/earnings/{symbol}' },
  'insider':               { title: 'Insider Trading',        endpoint: '/stock/insider-trading/{symbol}' },
  'ownership-overview':    { title: 'Ownership Overview',     endpoint: '/stock/holders/{symbol}' },
  'ownership-institutional': { title: 'Institutional Holders', endpoint: '/stock/holders/{symbol}' },
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
};
