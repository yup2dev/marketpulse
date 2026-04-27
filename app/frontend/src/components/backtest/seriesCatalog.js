/**
 * seriesCatalog — curated time-series sources for the backtest chart.
 *
 * Each entry describes how to fetch + extract a { x, y } sequence:
 *   id:        unique key
 *   label:     display name (template can use {symbol})
 *   group:     'price' | 'fundamental' | 'macro' | 'quant'
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
];

export const GROUP_LABELS = {
  price:       'Price',
  fundamental: 'Fundamentals',
  quant:       'Quant',
  macro:       'Macro',
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
