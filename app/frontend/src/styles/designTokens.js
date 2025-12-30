/**
 * Design Tokens for MarketPulse
 * Based on BacktestingLab's modern design system
 */

export const DESIGN_TOKENS = {
  // Gradient definitions
  gradients: {
    primary: 'from-blue-600 to-purple-600',
    primaryHover: 'from-blue-700 to-purple-700',
    background: 'from-[#0a0e14] via-[#0d1117] to-[#0a0e14]',
    strategyCard: 'from-purple-900/20 to-blue-900/20',
    riskCard: 'from-red-900/20 to-orange-900/20',
    metricCard: 'from-gray-900/50 to-gray-800/30',
  },

  // Background colors
  bg: {
    dark: '#0a0e14',
    darkAlt: '#0d1117',
    panel: '#161b22',
    card: '#1a1f2e',
    input: '#0a0e14',
    hover: '#1e2530',
  },

  // Border colors
  border: {
    default: '#2d3748',
    defaultClass: 'border-gray-800',
    active: '#3b82f6',
    activeClass: 'border-blue-500',
    hover: '#4b5563',
    hoverClass: 'border-gray-600',
  },

  // Text colors
  text: {
    primary: '#ffffff',
    primaryClass: 'text-white',
    secondary: '#9ca3af',
    secondaryClass: 'text-gray-400',
    tertiary: '#6b7280',
    tertiaryClass: 'text-gray-500',
    muted: '#4b5563',
    mutedClass: 'text-gray-600',
  },

  // Shadows
  shadows: {
    card: 'shadow-xl',
    cardHover: 'shadow-2xl',
    button: 'shadow-lg shadow-blue-500/20',
    buttonHover: 'shadow-xl shadow-blue-500/30',
    modal: 'shadow-2xl',
  },

  // Chart colors (from BacktestingLab)
  chart: {
    portfolio: '#3b82f6',
    benchmark: '#8b5cf6',
    positive: '#22c55e',
    negative: '#ef4444',
    neutral: '#6b7280',
  },

  // Status colors
  status: {
    success: '#22c55e',
    successClass: 'text-green-500',
    error: '#ef4444',
    errorClass: 'text-red-500',
    warning: '#f59e0b',
    warningClass: 'text-yellow-500',
    info: '#3b82f6',
    infoClass: 'text-blue-500',
  },
};

// Reusable className strings
export const BUTTON_CLASSES = {
  primary: 'px-6 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-semibold shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30',
  secondary: 'px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg hover:bg-gray-700 transition-all font-medium',
  ghost: 'px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all',
  danger: 'px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-medium',
};

export const CARD_CLASSES = {
  default: 'bg-[#161b22] border border-gray-800 rounded-xl p-6 shadow-xl hover:shadow-2xl transition-shadow',
  compact: 'bg-[#161b22] border border-gray-800 rounded-lg p-4 shadow-lg',
  interactive: 'bg-[#161b22] border border-gray-800 rounded-xl p-6 shadow-xl hover:shadow-2xl hover:border-gray-700 transition-all cursor-pointer',
};

export const INPUT_CLASSES = {
  default: 'w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-all',
  small: 'px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded-md text-sm text-white focus:outline-none focus:border-blue-500 transition-all',
};

export default DESIGN_TOKENS;
