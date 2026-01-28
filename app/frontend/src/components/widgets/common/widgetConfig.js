/**
 * Common widget configuration and constants
 */

// API Configuration
import { API_BASE } from '../../../config/api';
export { API_BASE };

// Theme utilities
import { getThemeClassNames, getChartTheme as getChartThemeUtil } from '../../../utils/themeUtils';

// Widget Styles (theme-aware)
export const getWidgetStyles = (theme = 'dark') => {
  const classes = getThemeClassNames(theme);

  return {
    container: `h-full ${classes.widget.container} rounded-lg border flex flex-col overflow-hidden`,
    content: 'flex-1 overflow-auto',
    contentPadding: 'p-4',
  };
};

// Legacy Widget Styles (deprecated - kept for backward compatibility)
export const WIDGET_STYLES = {
  container: 'h-full bg-[#0d0d12] rounded-lg border border-gray-800 flex flex-col overflow-hidden',
  content: 'flex-1 overflow-auto',
  contentPadding: 'p-4',
};

// Chart Configuration
export const CHART_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

export const TIME_RANGES = [
  { id: '1wk', label: '1W', period: '5d' },
  { id: '1mo', label: '1M', period: '1mo' },
  { id: '3mo', label: '3M', period: '3mo' },
  { id: '6mo', label: '6M', period: '6mo' },
  { id: '1yr', label: '1Y', period: '1y' },
  { id: '3yr', label: '3Y', period: '3y' },
  { id: '5yr', label: '5Y', period: '5y' },
  { id: 'max', label: 'Max', period: 'max' },
];

// Macro Economic Indicators
export const MACRO_INDICATORS = [
  { id: 'GDP', name: 'GDP', description: 'Gross Domestic Product', unit: 'Billions' },
  { id: 'UNEMPLOYMENT', name: 'Unemployment Rate', description: 'U.S. Unemployment Rate', unit: '%' },
  { id: 'CPI', name: 'CPI (Inflation)', description: 'Consumer Price Index', unit: 'Index' },
  { id: 'INTEREST_RATE', name: 'Fed Funds Rate', description: 'Federal Funds Interest Rate', unit: '%' },
];

// Technical Indicators
export const TECHNICAL_INDICATORS = [
  {
    id: 'SMA_20',
    name: 'SMA (20)',
    description: 'Simple Moving Average (20 periods)',
    type: 'overlay',
    params: { period: 20 }
  },
  {
    id: 'SMA_50',
    name: 'SMA (50)',
    description: 'Simple Moving Average (50 periods)',
    type: 'overlay',
    params: { period: 50 }
  },
  {
    id: 'SMA_200',
    name: 'SMA (200)',
    description: 'Simple Moving Average (200 periods)',
    type: 'overlay',
    params: { period: 200 }
  },
  {
    id: 'EMA_12',
    name: 'EMA (12)',
    description: 'Exponential Moving Average (12 periods)',
    type: 'overlay',
    params: { period: 12 }
  },
  {
    id: 'EMA_26',
    name: 'EMA (26)',
    description: 'Exponential Moving Average (26 periods)',
    type: 'overlay',
    params: { period: 26 }
  },
  {
    id: 'BBANDS',
    name: 'Bollinger Bands',
    description: 'Bollinger Bands (20, 2)',
    type: 'overlay',
    params: { period: 20, stddev: 2 }
  },
  {
    id: 'RSI',
    name: 'RSI',
    description: 'Relative Strength Index (14)',
    type: 'oscillator',
    params: { period: 14 },
    range: [0, 100]
  },
  {
    id: 'MACD',
    name: 'MACD',
    description: 'Moving Average Convergence Divergence',
    type: 'oscillator',
    params: { fast: 12, slow: 26, signal: 9 }
  },
  {
    id: 'STOCH',
    name: 'Stochastic',
    description: 'Stochastic Oscillator (14, 3, 3)',
    type: 'oscillator',
    params: { k_period: 14, d_period: 3 },
    range: [0, 100]
  },
  {
    id: 'ATR',
    name: 'ATR',
    description: 'Average True Range (14)',
    type: 'separate',
    params: { period: 14 }
  },
  {
    id: 'OBV',
    name: 'OBV',
    description: 'On-Balance Volume',
    type: 'separate'
  },
];

// Widget Type Icons (for consistent icon colors)
export const WIDGET_ICON_COLORS = {
  chart: 'text-blue-400',
  financial: 'text-purple-400',
  metrics: 'text-green-400',
  info: 'text-blue-400',
  default: 'text-gray-400',
};

// Loading Spinner Colors
export const LOADING_COLORS = {
  chart: 'text-blue-500',
  financial: 'text-purple-500',
  metrics: 'text-green-500',
  info: 'text-blue-500',
  default: 'text-gray-500',
};

// Chart Theme Colors (theme-aware)
export const getChartConfig = (theme = 'dark') => {
  return getChartThemeUtil(theme);
};

// Legacy Chart Theme Colors (deprecated - kept for backward compatibility)
export const CHART_THEME = {
  background: '#0d0d0d',
  grid: '#333',
  text: '#666',
  tooltip: {
    background: '#1a1a1a',
    border: '#333',
    text: '#fff',
  },
};

// Technical Indicator Colors
export const INDICATOR_COLORS = {
  SMA_20: '#fbbf24',    // amber
  SMA_50: '#a855f7',    // purple
  SMA_200: '#06b6d4',   // cyan
  EMA_12: '#34d399',    // emerald
  EMA_26: '#f472b6',    // pink
  BBANDS_upper: '#60a5fa',  // blue
  BBANDS_middle: '#a78bfa', // violet
  BBANDS_lower: '#60a5fa',  // blue
  RSI: '#f59e0b',       // amber
  MACD: '#10b981',      // green
  MACD_signal: '#ef4444', // red
  STOCH_k: '#3b82f6',   // blue
  STOCH_d: '#f59e0b',   // amber
  ATR: '#8b5cf6',       // violet
  OBV: '#ec4899',       // pink
};

// Widget Constraints
export const WIDGET_CONSTRAINTS = {
  maxTickers: 8,
  minTickers: 1,
};

// Default Export
export default {
  API_BASE,
  WIDGET_STYLES,
  CHART_COLORS,
  TIME_RANGES,
  MACRO_INDICATORS,
  TECHNICAL_INDICATORS,
  WIDGET_ICON_COLORS,
  LOADING_COLORS,
  CHART_THEME,
  INDICATOR_COLORS,
  WIDGET_CONSTRAINTS,
};
