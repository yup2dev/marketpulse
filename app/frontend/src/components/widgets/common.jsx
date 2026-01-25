/**
 * Common Widget Components and Utilities
 * Shared components for all widgets to ensure consistent UI/UX
 */
import { RefreshCw, X, Maximize2 } from 'lucide-react';
import { API_BASE } from '../../config/api';

// ============================================================================
// STYLES AND CONSTANTS
// ============================================================================

export { API_BASE };

export const WIDGET_STYLES = {
  container: 'bg-[#1a1a1a] rounded-lg overflow-hidden flex flex-col h-full border border-gray-800',
  header: 'flex items-center justify-between p-2.5 border-b border-gray-800 bg-gradient-to-b from-gray-800/50 to-transparent',
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
export const TIME_RANGES = [
  { id: '1d', label: '1D', value: '1d', interval: '2m' },     // ~195 bars (390min / 2)
  { id: '5d', label: '5D', value: '5d', interval: '5m' },     // ~390 bars
  { id: '1mo', label: '1M', value: '1mo', interval: '30m' },  // ~273 bars (21days * 13)
  { id: '3mo', label: '3M', value: '3mo', interval: '1d' },   // ~63 bars (daily)
  { id: '6mo', label: '6M', value: '6mo', interval: '1d' },   // ~126 bars (daily)
  { id: '1y', label: '1Y', value: '1y', interval: '1d' },     // ~252 bars (baseline)
  { id: '5y', label: '5Y', value: '5y', interval: '1wk' },    // ~260 bars
  { id: 'max', label: 'MAX', value: 'max', interval: '1mo' }, // variable
];

export const MACRO_INDICATORS = [
  { id: 'gdp', label: 'GDP', description: 'Gross Domestic Product' },
  { id: 'unemployment', label: 'Unemployment', description: 'Unemployment Rate' },
  { id: 'cpi', label: 'CPI', description: 'Consumer Price Index' },
  { id: 'ppi', label: 'PPI', description: 'Producer Price Index' },
  { id: 'fed_funds', label: 'Fed Funds', description: 'Federal Funds Rate' },
  { id: 'treasury_10y', label: '10Y Treasury', description: '10-Year Treasury Yield' },
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

export const formatPercent = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return value.toFixed(decimals) + '%';
};

export const formatPrice = (price, decimals = 2) => {
  if (price === null || price === undefined || isNaN(price)) return 'N/A';
  return '$' + price.toFixed(decimals);
};

export const formatDate = (date, options = null) => {
  if (!date) return 'N/A';
  try {
    const d = new Date(date);

    // If date string contains time info (has 'T' or includes time), show time for intraday
    const hasTime = typeof date === 'string' && (date.includes('T') || date.includes(':'));

    if (options) {
      return d.toLocaleDateString('en-US', options);
    }

    // For intraday data with time, show shorter format with time
    if (hasTime) {
      const hours = d.getHours();
      const minutes = d.getMinutes();
      // If time is not midnight, it's likely intraday data
      if (hours !== 0 || minutes !== 0) {
        return d.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      }
    }

    // Default date-only format
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
};

// ============================================================================
// WIDGET HEADER COMPONENT
// ============================================================================

/**
 * WidgetHeader - Standard header for all widgets
 * @param {object} icon - Lucide icon component
 * @param {string} iconColor - Tailwind color class for icon
 * @param {string} title - Widget title
 * @param {boolean} loading - Loading state
 * @param {function} onRefresh - Refresh handler
 * @param {function} onRemove - Remove handler (optional)
 * @param {function} onMaximize - Maximize handler (optional)
 * @param {node} children - Additional header controls
 */
export const WidgetHeader = ({
  icon: Icon,
  iconColor,
  title,
  loading = false,
  onRefresh,
  onRemove,
  onMaximize,
  children,
}) => {
  return (
    <div className={WIDGET_STYLES.header}>
      {/* Left side - Icon and Title */}
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon size={16} className={`${iconColor} flex-shrink-0`} />}
        <h3 className={`${WIDGET_STYLES.title} truncate`}>{title}</h3>
      </div>

      {/* Right side - Controls */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {children}

        {/* Refresh Button */}
        {onRefresh && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRefresh();
            }}
            disabled={loading}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        )}

        {/* Maximize Button */}
        {onMaximize && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onMaximize();
            }}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition-colors"
            title="Maximize"
          >
            <Maximize2 size={14} />
          </button>
        )}

        {/* Remove Button */}
        {onRemove && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
            title="Remove"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

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
export const NoDataState = ({ message = 'No data available', icon: Icon }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
      {Icon && <Icon size={32} className="mb-2 opacity-50" />}
      <p className="text-sm">{message}</p>
    </div>
  );
};

// ============================================================================
// SKELETON LOADER COMPONENT
// ============================================================================

/**
 * SkeletonLoader - Animated placeholder for loading content
 * @param {string} variant - 'text', 'card', 'chart', 'table' (default: 'card')
 * @param {number} count - Number of skeleton items (default: 1)
 */
export const SkeletonLoader = ({ variant = 'card', count = 1 }) => {
  const skeletons = Array.from({ length: count });

  const renderSkeleton = () => {
    switch (variant) {
      case 'text':
        return (
          <div className="space-y-2">
            {skeletons.map((_, i) => (
              <div
                key={i}
                className="h-4 bg-gray-800 rounded animate-pulse"
                style={{ width: `${80 + Math.random() * 20}%` }}
              />
            ))}
          </div>
        );

      case 'chart':
        return (
          <div className="h-full w-full bg-gray-800/30 rounded animate-pulse flex items-end justify-around p-4 gap-2">
            {[0.6, 0.8, 0.5, 0.9, 0.7, 0.4, 0.6, 0.8].map((height, i) => (
              <div
                key={i}
                className="bg-gray-700 rounded-t w-full"
                style={{ height: `${height * 100}%` }}
              />
            ))}
          </div>
        );

      case 'table':
        return (
          <div className="space-y-2">
            <div className="h-8 bg-gray-800 rounded animate-pulse" />
            {skeletons.map((_, i) => (
              <div key={i} className="h-12 bg-gray-800/50 rounded animate-pulse" />
            ))}
          </div>
        );

      case 'card':
      default:
        return (
          <div className="space-y-4">
            {skeletons.map((_, i) => (
              <div key={i} className="bg-gray-800/30 rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-1/3 mb-3" />
                <div className="h-8 bg-gray-700 rounded w-2/3" />
              </div>
            ))}
          </div>
        );
    }
  };

  return <div className="p-4 h-full">{renderSkeleton()}</div>;
};

// ============================================================================
// METRIC CARD COMPONENT
// ============================================================================

/**
 * MetricCard - Standard card for displaying a single metric
 * @param {string} label - Metric label
 * @param {string|number} value - Metric value
 * @param {string|number} change - Change value (optional)
 * @param {node} icon - Optional icon
 * @param {string} iconColor - Icon color class
 * @param {boolean} loading - Loading state
 */
export const MetricCard = ({
  label,
  value,
  change,
  icon: Icon,
  iconColor = 'text-blue-400',
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="bg-gray-800/30 rounded-lg p-3">
        <SkeletonLoader variant="card" count={1} />
      </div>
    );
  }

  const changeColor =
    change > 0 ? 'text-green-500' : change < 0 ? 'text-red-500' : 'text-gray-400';
  const changeIcon = change > 0 ? '↑' : change < 0 ? '↓' : '';

  return (
    <div className="bg-gray-800/30 rounded-lg p-3 hover:bg-gray-800/50 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
        {Icon && <Icon size={16} className={iconColor} />}
      </div>
      <div className="text-xl font-bold text-white mb-1">{value}</div>
      {change !== undefined && change !== null && (
        <div className={`text-xs font-medium ${changeColor}`}>
          {changeIcon} {Math.abs(change)}%
        </div>
      )}
    </div>
  );
};

// ============================================================================
// ERROR STATE COMPONENT
// ============================================================================

/**
 * ErrorState - Standard error display for widgets
 * @param {string} message - Error message
 * @param {function} onRetry - Retry handler (optional)
 */
export const ErrorState = ({ message = 'Failed to load data', onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-red-400 p-4">
      <p className="text-sm mb-3">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded text-sm transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
};
