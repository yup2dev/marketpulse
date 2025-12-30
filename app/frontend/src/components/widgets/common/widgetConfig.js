/**
 * Common widget configuration and constants
 */

// API Configuration
import { API_BASE } from '../../../config/api';
export { API_BASE };

// Widget Styles
export const WIDGET_STYLES = {
  container: 'h-full bg-[#1a1a1a] rounded-lg border border-gray-800 flex flex-col overflow-hidden',
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

// Chart Theme Colors
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
  WIDGET_ICON_COLORS,
  LOADING_COLORS,
  CHART_THEME,
  WIDGET_CONSTRAINTS,
};
