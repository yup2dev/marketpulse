/**
 * Factor definitions for the Custom Strategy Builder.
 * Each factor specifies what params it takes and how to render them.
 */

export const FACTORS = {
  // ── Trend ────────────────────────────────────────────────────────────────
  EMA: {
    label: 'EMA', group: 'Trend',
    params: [{ name: 'period', label: 'Period', default: 20, min: 2, max: 500 }],
  },
  SMA: {
    label: 'SMA', group: 'Trend',
    params: [{ name: 'period', label: 'Period', default: 50, min: 2, max: 500 }],
  },
  VWAP: {
    label: 'VWAP', group: 'Trend',
    params: [],
    note: 'Cumulative VWAP (typical price × vol)',
  },

  // ── Momentum ─────────────────────────────────────────────────────────────
  RSI: {
    label: 'RSI', group: 'Momentum',
    params: [{ name: 'period', label: 'Period', default: 14, min: 2, max: 100 }],
  },
  MACD_LINE: {
    label: 'MACD Line', group: 'Momentum',
    params: [
      { name: 'fast',   label: 'Fast',   default: 12, min: 2, max: 100 },
      { name: 'slow',   label: 'Slow',   default: 26, min: 2, max: 200 },
      { name: 'signal', label: 'Signal', default: 9,  min: 2, max: 50  },
    ],
  },
  MACD_SIGNAL: {
    label: 'MACD Signal', group: 'Momentum',
    params: [
      { name: 'fast',   label: 'Fast',   default: 12, min: 2, max: 100 },
      { name: 'slow',   label: 'Slow',   default: 26, min: 2, max: 200 },
      { name: 'signal', label: 'Signal', default: 9,  min: 2, max: 50  },
    ],
  },
  MACD_HIST: {
    label: 'MACD Hist', group: 'Momentum',
    params: [
      { name: 'fast',   label: 'Fast',   default: 12, min: 2, max: 100 },
      { name: 'slow',   label: 'Slow',   default: 26, min: 2, max: 200 },
      { name: 'signal', label: 'Signal', default: 9,  min: 2, max: 50  },
    ],
  },
  STOCH_K: {
    label: 'Stoch %K', group: 'Momentum',
    params: [
      { name: 'k_period', label: 'K Period', default: 14, min: 2, max: 100 },
      { name: 'd_period', label: 'D Period', default: 3,  min: 1, max: 20  },
    ],
  },
  STOCH_D: {
    label: 'Stoch %D', group: 'Momentum',
    params: [
      { name: 'k_period', label: 'K Period', default: 14, min: 2, max: 100 },
      { name: 'd_period', label: 'D Period', default: 3,  min: 1, max: 20  },
    ],
  },

  // ── Volatility ───────────────────────────────────────────────────────────
  BB_UPPER: {
    label: 'BB Upper', group: 'Volatility',
    params: [
      { name: 'period',  label: 'Period',  default: 20,  min: 5, max: 200 },
      { name: 'std_dev', label: 'Std Dev', default: 2.0, min: 0.5, max: 5, step: 0.1 },
    ],
  },
  BB_LOWER: {
    label: 'BB Lower', group: 'Volatility',
    params: [
      { name: 'period',  label: 'Period',  default: 20,  min: 5, max: 200 },
      { name: 'std_dev', label: 'Std Dev', default: 2.0, min: 0.5, max: 5, step: 0.1 },
    ],
  },
  BB_MID: {
    label: 'BB Mid (SMA)', group: 'Volatility',
    params: [
      { name: 'period',  label: 'Period',  default: 20,  min: 5, max: 200 },
      { name: 'std_dev', label: 'Std Dev', default: 2.0, min: 0.5, max: 5, step: 0.1 },
    ],
  },
  ATR: {
    label: 'ATR', group: 'Volatility',
    params: [{ name: 'period', label: 'Period', default: 14, min: 2, max: 100 }],
  },

  // ── Price ────────────────────────────────────────────────────────────────
  CLOSE:  { label: 'Close',  group: 'Price', params: [] },
  OPEN:   { label: 'Open',   group: 'Price', params: [] },
  HIGH:   { label: 'High',   group: 'Price', params: [] },
  LOW:    { label: 'Low',    group: 'Price', params: [] },
  VOLUME: { label: 'Volume', group: 'Volume', params: [] },

  // ── Constant ─────────────────────────────────────────────────────────────
  VALUE: {
    label: 'Value', group: 'Constant',
    params: [{ name: 'value', label: 'Number', default: 0, min: -1e9, max: 1e9, step: 0.1 }],
    isValue: true,
  },
};

export const FACTOR_GROUPS = ['Trend', 'Momentum', 'Volatility', 'Price', 'Volume', 'Constant'];

export const OPERATORS = [
  { id: '>',            label: '>' },
  { id: '<',            label: '<' },
  { id: '>=',           label: '>=' },
  { id: '<=',           label: '<=' },
  { id: '==',           label: '==' },
  { id: 'crosses_above', label: 'crosses above ↑' },
  { id: 'crosses_below', label: 'crosses below ↓' },
];

/** Build default factor state for a given factor ID */
export function defaultFactorState(factorId = 'EMA') {
  const def = FACTORS[factorId];
  if (!def) return { factor: factorId, params: {} };
  const params = {};
  def.params.forEach(p => { params[p.name] = p.default; });
  return { factor: factorId, params, ...(def.isValue ? { value: 0 } : {}) };
}

/** Render factor label with current params */
export function factorLabel({ factor, params = {}, value }) {
  const def = FACTORS[factor];
  if (!def) return factor;
  if (def.isValue) return `${value ?? params.value ?? 0}`;
  if (!def.params.length) return def.label;
  const vals = def.params.map(p => params[p.name] ?? p.default).join(',');
  return `${def.label}(${vals})`;
}
