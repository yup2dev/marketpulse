/**
 * seriesCatalog — curated time-series sources for the backtest chart.
 *
 * Each entry describes how to fetch + extract a { x, y } sequence:
 *   id:        unique key
 *   label:     display name (template can use {symbol})
 *   group:     'price' | 'fundamental' | 'quant' | 'macro' | ...
 *   endpoint:  URL template (supports {symbol}, {period})
 *   dataPath:  dotted path into response → array of rows
 *   xKey:      row field for date/time
 *   yKey:      row field for numeric value
 *   needsSymbol: requires a stock symbol
 *   defaultPane: 0 (top) | 1 (bottom)
 */
export const SERIES_CATALOG = [
  // ── Price ─────────────────────────────────────────────────────────────────
  {
    id: 'price-close',
    label: '{symbol} Close',
    group: 'price',
    endpoint: '/stock/history/{symbol}?period={period}',
    dataPath: 'data',
    xKey: 'date',
    yKey: 'close',
    needsSymbol: true,
    defaultPane: 0,
  },
  {
    id: 'price-volume',
    label: '{symbol} Volume',
    group: 'price',
    endpoint: '/stock/history/{symbol}?period={period}',
    dataPath: 'data',
    xKey: 'date',
    yKey: 'volume',
    needsSymbol: true,
    defaultPane: 1,
  },

  // ── Fundamentals ──────────────────────────────────────────────────────────
  {
    id: 'dividends',
    label: '{symbol} Dividends',
    group: 'fundamental',
    endpoint: '/stock/dividends/{symbol}',
    dataPath: '',
    xKey: 'date',
    yKey: 'amount',
    needsSymbol: true,
    defaultPane: 1,
  },
  {
    id: 'earnings-surprise',
    label: '{symbol} EPS Surprise %',
    group: 'fundamental',
    endpoint: '/stock/earnings/{symbol}',
    dataPath: '',
    xKey: 'report_date',
    yKey: 'eps_surprise_percent',
    needsSymbol: true,
    defaultPane: 1,
  },

  // ── Quant rolling stats ───────────────────────────────────────────────────
  {
    id: 'quant-rolling-sharpe',
    label: '{symbol} Rolling Sharpe',
    group: 'quant',
    endpoint: '/quantitative/rolling?symbol={symbol}&metric=sharpe&window=21&target=return&start_date={startDate}&end_date={endDate}',
    dataPath: 'result.points',
    xKey: 'date',
    yKey: 'value',
    needsSymbol: true,
    defaultPane: 1,
  },
  {
    id: 'quant-rolling-stdev',
    label: '{symbol} Rolling Stdev',
    group: 'quant',
    endpoint: '/quantitative/rolling?symbol={symbol}&metric=stdev&window=21&target=return&start_date={startDate}&end_date={endDate}',
    dataPath: 'result.points',
    xKey: 'date',
    yKey: 'value',
    needsSymbol: true,
    defaultPane: 1,
  },
  {
    id: 'quant-rolling-sortino',
    label: '{symbol} Rolling Sortino',
    group: 'quant',
    endpoint: '/quantitative/rolling?symbol={symbol}&metric=sortino&window=21&target=return&start_date={startDate}&end_date={endDate}',
    dataPath: 'result.points',
    xKey: 'date',
    yKey: 'value',
    needsSymbol: true,
    defaultPane: 1,
  },
  {
    id: 'quant-rolling-skew',
    label: '{symbol} Rolling Skew',
    group: 'quant',
    endpoint: '/quantitative/rolling?symbol={symbol}&metric=skew&window=21&target=return&start_date={startDate}&end_date={endDate}',
    dataPath: 'result.points',
    xKey: 'date',
    yKey: 'value',
    needsSymbol: true,
    defaultPane: 1,
  },
  {
    id: 'quant-rolling-kurtosis',
    label: '{symbol} Rolling Kurtosis',
    group: 'quant',
    endpoint: '/quantitative/rolling?symbol={symbol}&metric=kurtosis&window=21&target=return&start_date={startDate}&end_date={endDate}',
    dataPath: 'result.points',
    xKey: 'date',
    yKey: 'value',
    needsSymbol: true,
    defaultPane: 1,
  },

  // ── Rates & Yields ────────────────────────────────────────────────────────
  {
    id: 'yield-spread-2y10y',
    label: 'Yield Spread (2Y10Y)',
    group: 'rates',
    endpoint: '/macro/yield-curve/history?period={period}',
    dataPath: 'spreads_history',
    xKey: 'date',
    yKey: '2y10y',
    needsSymbol: false,
    defaultPane: 1,
  },
  {
    id: 'yield-spread-3m10y',
    label: 'Yield Spread (3M10Y)',
    group: 'rates',
    endpoint: '/macro/yield-curve/history?period={period}',
    dataPath: 'spreads_history',
    xKey: 'date',
    yKey: '3m10y',
    needsSymbol: false,
    defaultPane: 1,
  },
  {
    id: 'treasury-10y',
    label: '10Y Treasury Yield',
    group: 'rates',
    endpoint: '/macro/yield-curve/history?period={period}',
    dataPath: 'yields_history',
    xKey: 'date',
    yKey: '10y',
    needsSymbol: false,
    defaultPane: 1,
  },

  // ── Sentiment ─────────────────────────────────────────────────────────────
  {
    id: 'vix',
    label: 'VIX',
    group: 'sentiment',
    endpoint: '/macro/sentiment/history?period={period}',
    dataPath: 'vix_history',
    xKey: 'date',
    yKey: 'vix',
    needsSymbol: false,
    defaultPane: 1,
  },
  {
    id: 'fear-greed',
    label: 'Fear & Greed Score',
    group: 'sentiment',
    endpoint: '/macro/sentiment/history?period={period}',
    dataPath: 'sentiment_history',
    xKey: 'date',
    yKey: 'fear_greed_score',
    needsSymbol: false,
    defaultPane: 1,
  },
  {
    id: 'hy-spread-sentiment',
    label: 'HY Spread (Sentiment)',
    group: 'sentiment',
    endpoint: '/macro/sentiment/history?period={period}',
    dataPath: 'sentiment_history',
    xKey: 'date',
    yKey: 'hy_spread',
    needsSymbol: false,
    defaultPane: 1,
  },

  // ── Financial Conditions ──────────────────────────────────────────────────
  {
    id: 'nfci',
    label: 'Financial Conditions (NFCI)',
    group: 'conditions',
    endpoint: '/macro/financial-conditions/history?period={period}',
    dataPath: 'fci_history',
    xKey: 'date',
    yKey: 'value',
    needsSymbol: false,
    defaultPane: 1,
  },
  {
    id: 'credit-spread-hy',
    label: 'HY Credit Spread',
    group: 'conditions',
    endpoint: '/macro/financial-conditions/history?period={period}',
    dataPath: 'credit_spread_history',
    xKey: 'date',
    yKey: 'high_yield_spread',
    needsSymbol: false,
    defaultPane: 1,
  },

  // ── Labor Market ──────────────────────────────────────────────────────────
  {
    id: 'initial-claims',
    label: 'Initial Claims',
    group: 'labor',
    endpoint: '/macro/overview/initial-claims?period={period}',
    dataPath: 'history',
    xKey: 'date',
    yKey: 'claims',
    needsSymbol: false,
    defaultPane: 1,
  },
  {
    id: 'initial-claims-ma',
    label: 'Initial Claims 4W MA',
    group: 'labor',
    endpoint: '/macro/overview/initial-claims?period={period}',
    dataPath: 'history',
    xKey: 'date',
    yKey: 'ma_4w',
    needsSymbol: false,
    defaultPane: 1,
  },
  {
    id: 'jobs-private',
    label: 'Jobs: Private Sector',
    group: 'labor',
    endpoint: '/macro/overview/jobs-breakdown?period={period}',
    dataPath: 'history',
    xKey: 'date',
    yKey: 'private',
    needsSymbol: false,
    defaultPane: 1,
  },

  // ── Business Cycle ────────────────────────────────────────────────────────
  {
    id: 'cfnai',
    label: 'CFNAI (Activity Index)',
    group: 'cycle',
    endpoint: '/macro/business-cycle/pmi?period={period}',
    dataPath: 'cfnai.series',
    xKey: 'date',
    yKey: 'value',
    needsSymbol: false,
    defaultPane: 1,
  },
  {
    id: 'sahm-rule',
    label: 'Sahm Rule',
    group: 'cycle',
    endpoint: '/macro/business-cycle/pmi?period={period}',
    dataPath: 'sahm.series',
    xKey: 'date',
    yKey: 'value',
    needsSymbol: false,
    defaultPane: 1,
  },
  {
    id: 'regime-growth',
    label: 'Regime Growth Score',
    group: 'cycle',
    endpoint: '/macro/regime/history?period={period}',
    dataPath: 'history',
    xKey: 'date',
    yKey: 'growth_score',
    needsSymbol: false,
    defaultPane: 1,
  },
  {
    id: 'regime-inflation',
    label: 'Regime Inflation Score',
    group: 'cycle',
    endpoint: '/macro/regime/history?period={period}',
    dataPath: 'history',
    xKey: 'date',
    yKey: 'inflation_score',
    needsSymbol: false,
    defaultPane: 1,
  },
  {
    id: 'gdp-forecast',
    label: 'GDP Growth (Real)',
    group: 'cycle',
    endpoint: '/macro/overview/gdp-forecast?period={period}',
    dataPath: 'history',
    xKey: 'date',
    yKey: 'value',
    needsSymbol: false,
    defaultPane: 1,
  },

  // ── Macro ─────────────────────────────────────────────────────────────────
  {
    id: 'real-rates',
    label: 'Real Rates (10Y TIPS)',
    group: 'macro',
    endpoint: '/macro/real-rates?period={period}',
    dataPath: '',
    xKey: 'date',
    yKey: 'real_rate',
    needsSymbol: false,
    defaultPane: 1,
  },
  {
    id: 'fed-balance-sheet',
    label: 'Fed Balance Sheet',
    group: 'macro',
    endpoint: '/macro/fed-balance-sheet?period={period}',
    dataPath: '',
    xKey: 'date',
    yKey: 'value',
    needsSymbol: false,
    defaultPane: 1,
  },
  {
    id: 'inflation-momentum',
    label: 'Inflation Momentum',
    group: 'macro',
    endpoint: '/macro/overview/inflation-momentum?period={period}',
    dataPath: '',
    xKey: 'date',
    yKey: 'value',
    needsSymbol: false,
    defaultPane: 1,
  },
  {
    id: 'inflation-headline',
    label: 'CPI Headline YoY',
    group: 'macro',
    endpoint: '/macro/inflation/sector-history?period={period}',
    dataPath: 'history',
    xKey: 'date',
    yKey: 'headline',
    needsSymbol: false,
    defaultPane: 1,
  },
  {
    id: 'inflation-core',
    label: 'CPI Core YoY',
    group: 'macro',
    endpoint: '/macro/inflation/sector-history?period={period}',
    dataPath: 'history',
    xKey: 'date',
    yKey: 'core',
    needsSymbol: false,
    defaultPane: 1,
  },
  {
    id: 'fred-money-m2',
    label: 'M2 Money Supply',
    group: 'macro',
    endpoint: '/macro/fred/series/money_supply_m2?period={period}',
    dataPath: 'data',
    xKey: 'date',
    yKey: 'value',
    needsSymbol: false,
    defaultPane: 1,
  },

  // ── Commodities ───────────────────────────────────────────────────────────
  {
    id: 'fred-crude-oil',
    label: 'Crude Oil (WTI)',
    group: 'commodities',
    endpoint: '/macro/fred/series/crude_oil_wti?period={period}',
    dataPath: 'data',
    xKey: 'date',
    yKey: 'value',
    needsSymbol: false,
    defaultPane: 1,
  },
  {
    id: 'fred-natural-gas',
    label: 'Natural Gas',
    group: 'commodities',
    endpoint: '/macro/fred/series/natural_gas?period={period}',
    dataPath: 'data',
    xKey: 'date',
    yKey: 'value',
    needsSymbol: false,
    defaultPane: 1,
  },
  {
    id: 'fred-copper',
    label: 'Copper',
    group: 'commodities',
    endpoint: '/macro/fred/series/copper?period={period}',
    dataPath: 'data',
    xKey: 'date',
    yKey: 'value',
    needsSymbol: false,
    defaultPane: 1,
  },
];

export const GROUP_LABELS = {
  price:        'Price',
  fundamental:  'Fundamentals',
  quant:        'Quant',
  rates:        'Rates & Yields',
  sentiment:    'Sentiment',
  conditions:   'Financial Conditions',
  labor:        'Labor Market',
  cycle:        'Business Cycle',
  macro:        'Macro',
  commodities:  'Commodities',
};

// Apply {symbol} / {period} / {startDate} / {endDate} to label/endpoint
export function resolveTemplate(tmpl, ctx) {
  return (tmpl || '').replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? '');
}

// Walk dotted path: 'result.points' → response.result.points
export function getByPath(obj, path) {
  if (!path) return obj;
  return path.split('.').reduce((acc, k) => (acc != null ? acc[k] : undefined), obj);
}

// Extract { date, value }[] from response per catalog entry.
// Shape matches ChartWidget series-mode expectation.
export function extractPoints(response, entry) {
  const arr = getByPath(response, entry.dataPath);
  if (!Array.isArray(arr)) return [];
  return arr
    .map(row => ({
      date:  row?.[entry.xKey],
      value: typeof row?.[entry.yKey] === 'number' ? row[entry.yKey] : Number(row?.[entry.yKey]),
    }))
    .filter(p => p.date != null && Number.isFinite(p.value));
}
