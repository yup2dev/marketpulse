/**
 * Common Widget Components and Utilities
 * Shared components for all widgets to ensure consistent UI/UX
 */
import { API_BASE } from '../../config/api';

// ============================================================================
// STYLES AND CONSTANTS
// ============================================================================

export { API_BASE };

export const WIDGET_STYLES = {
  container: 'bg-[#0d0d12] rounded-lg overflow-hidden flex flex-col h-full border border-gray-800',
  header: 'flex items-center justify-between p-3 border-b border-gray-800',
  content: 'flex-1 overflow-auto',
  title: 'text-sm font-semibold text-white',
};

export const WIDGET_ICON_COLORS = {
  financial: 'text-blue-400',
  chart: 'text-emerald-400',
  metric: 'text-purple-400',
  info: 'text-cyan-400',
  macro: 'text-orange-400',
  sentiment: 'text-pink-400',
  labor: 'text-yellow-400',
  banking: 'text-indigo-400',
};

export const LOADING_COLORS = {
  financial: 'border-blue-500',
  chart: 'border-emerald-500',
  metric: 'border-purple-500',
  info: 'border-cyan-500',
  macro: 'border-orange-500',
  sentiment: 'border-pink-500',
  labor: 'border-yellow-500',
  banking: 'border-indigo-500',
};

export const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

// TIME_RANGES with intervals to maintain ~250 bars (same as 1Y daily)
// Note: Yahoo Finance limits intraday data (< 1d intervals) to last 60 days
export const MACRO_INDICATORS = [
  { id: 'gdp',                   name: 'GDP',                   description: 'Gross Domestic Product' },
  { id: 'unemployment',          name: 'Unemployment',          description: 'Unemployment Rate' },
  { id: 'cpi',                   name: 'CPI',                   description: 'Consumer Price Index' },
  { id: 'fed_funds_rate',        name: 'Fed Funds',             description: 'Federal Funds Rate' },
  { id: 'retail_sales',          name: 'Retail Sales',          description: 'Advance Retail Sales' },
  { id: 'consumer_sentiment',    name: 'Consumer Sentiment',    description: 'UMich Consumer Sentiment' },
  { id: 'nonfarm_payroll',       name: 'Nonfarm Payroll',       description: 'Total Nonfarm Payrolls' },
  { id: 'housing_starts',        name: 'Housing Starts',        description: 'New Housing Starts' },
  { id: 'industrial_production', name: 'Industrial Production', description: 'Industrial Production Index' },
  // 섹터별 수지 비교 — 정부 적자(음수)와 기업이익이 거울처럼 움직인다 (Kalecki)
  { id: 'fiscal_balance',        name: 'Fiscal Balance (%GDP)', description: 'Federal Surplus/Deficit as % of GDP (deficit = negative)' },
  { id: 'corp_profits_gdp',      name: 'Corp Profits (%GDP)',   description: 'Corporate Profits After Tax as % of GDP' },
];

export const TECHNICAL_INDICATORS = [
  // Overlay indicators (price chart)
  { id: 'SMA_20', name: 'SMA 20', description: '20-day Simple Moving Average', type: 'overlay' },
  { id: 'SMA_50', name: 'SMA 50', description: '50-day Simple Moving Average', type: 'overlay' },
  { id: 'SMA_200', name: 'SMA 200', description: '200-day Simple Moving Average', type: 'overlay' },
  { id: 'EMA_12', name: 'EMA 12', description: '12-day Exponential Moving Average', type: 'overlay' },
  { id: 'EMA_26', name: 'EMA 26', description: '26-day Exponential Moving Average', type: 'overlay' },
  { id: 'BBANDS', name: 'Bollinger Bands', description: 'Bollinger Bands (20, 2)', type: 'overlay' },
  // Oscillators (separate pane)
  { id: 'RSI', name: 'RSI', description: 'Relative Strength Index (14)', type: 'oscillator' },
  { id: 'MACD', name: 'MACD', description: 'Moving Average Convergence Divergence', type: 'oscillator' },
  { id: 'STOCH', name: 'Stochastic', description: 'Stochastic Oscillator (14, 3)', type: 'oscillator' },
  // Separate pane indicators
  { id: 'ATR', name: 'ATR', description: 'Average True Range (14)', type: 'separate' },
  { id: 'OBV', name: 'OBV', description: 'On-Balance Volume', type: 'separate' },
];

export const INDICATOR_COLORS = {
  SMA_20: '#3b82f6',
  SMA_50: '#10b981',
  SMA_200: '#f59e0b',
  EMA_12: '#8b5cf6',
  EMA_26: '#ec4899',
  BBANDS: '#06b6d4',
  BBANDS_upper: '#06b6d4',
  BBANDS_middle: '#a855f7',
  BBANDS_lower: '#06b6d4',
  RSI: '#f97316',
  MACD: '#ef4444',
  MACD_signal: '#22c55e',
  STOCH_k: '#3b82f6',
  STOCH_d: '#ef4444',
  ATR: '#8b5cf6',
  OBV: '#10b981',
};

// Chart type options for easy switching
export const CHART_TYPES = [
  { id: 'line', name: 'Line', icon: 'TrendingUp', description: 'Simple line chart' },
  { id: 'area', name: 'Area', icon: 'Activity', description: 'Area chart with gradient fill' },
  { id: 'candlestick', name: 'Candle', icon: 'BarChart2', description: 'Japanese candlestick chart' },
  { id: 'ohlc', name: 'OHLC', icon: 'BarChart', description: 'Open-High-Low-Close bars' },
  { id: 'heikinashi', name: 'Heikin-Ashi', icon: 'Layers', description: 'Smoothed candlestick' },
];

// Candlestick colors
export const CANDLE_COLORS = {
  up: '#22c55e',      // green for bullish
  down: '#ef4444',    // red for bearish
  upWick: '#22c55e',
  downWick: '#ef4444',
  doji: '#9ca3af',    // gray for doji
};

export const WIDGET_CONSTRAINTS = {
  minW: 3,
  minH: 2,
  maxW: 12,
  maxH: 6,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const formatNumber = (num, includeDecimals = true) => {
  if (num === null || num === undefined || isNaN(num)) return 'N/A';

  const decimals = includeDecimals ? 2 : 0;

  if (num >= 1e12) return (num / 1e12).toFixed(decimals) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(decimals) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(decimals) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(decimals) + 'K';

  return num.toFixed(decimals);
};

export const formatCurrency = (num) => {
  if (num === null || num === undefined || isNaN(num)) return 'N/A';
  return '$' + formatNumber(num);
};

export { WidgetHeader } from './common/WidgetHeader';

// ============================================================================
// LOADING SPINNER COMPONENT
// ============================================================================

/**
 * LoadingSpinner - Standard loading indicator for widgets
 * @param {string} color - Tailwind border color class (default: border-blue-500)
 * @param {string} size - Size variant: 'sm', 'md', 'lg' (default: 'md')
 */
export const LoadingSpinner = ({ color = 'border-blue-500', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-16 h-16 border-4',
  };

  return (
    <div className="flex items-center justify-center h-full w-full">
      <div
        className={`${sizeClasses[size]} ${color} border-t-transparent rounded-full animate-spin`}
      />
    </div>
  );
};

// ============================================================================
// NO DATA STATE COMPONENT
// ============================================================================

/**
 * NoDataState - Standard empty state for widgets
 * @param {string} message - Message to display
 * @param {node} icon - Optional icon to display
 */
