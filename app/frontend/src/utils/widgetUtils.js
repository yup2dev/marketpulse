/**
 * Common utility functions for widgets
 */

/**
 * Format a number with appropriate suffix (K, M, B, T)
 * @param {number} num - The number to format
 * @param {boolean} includeDecimals - Whether to include decimals (default: true)
 * @returns {string} Formatted number string
 */
export const formatNumber = (num, includeDecimals = true) => {
  if (num === null || num === undefined || isNaN(num)) return 'N/A';

  const decimals = includeDecimals ? 2 : 0;

  if (num >= 1e12) return (num / 1e12).toFixed(decimals) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(decimals) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(decimals) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(decimals) + 'K';

  return num.toFixed(decimals);
};

/**
 * Format a number as a price with dollar sign
 * @param {number} price - The price to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted price string
 */
export const formatPrice = (price, decimals = 2) => {
  if (price === null || price === undefined || isNaN(price)) return 'N/A';
  return '$' + price.toFixed(decimals);
};

/**
 * Format a number as currency with appropriate suffix
 * @param {number} num - The number to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (num) => {
  if (num === null || num === undefined || isNaN(num)) return 'N/A';
  return '$' + formatNumber(num);
};

/**
 * Format a percentage value
 * @param {number} value - The percentage value (0.05 = 5%)
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted percentage string
 */
export const formatPercent = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return value.toFixed(decimals) + '%';
};

/**
 * Format a percentage value from decimal (0.05 = 5%)
 * @param {number} value - The decimal value (0.05 = 5%)
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted percentage string
 */
export const formatPercentFromDecimal = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return (value * 100).toFixed(decimals) + '%';
};

/**
 * Format a date string for display
 * @param {string|Date} date - The date to format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatDate = (date, options = { month: 'short', day: 'numeric', year: '2-digit' }) => {
  if (!date) return 'N/A';

  try {
    return new Date(date).toLocaleDateString('en-US', options);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
};

/**
 * Get color class based on numeric value (positive/negative)
 * @param {number} value - The value to check
 * @param {boolean} inverse - Whether to inverse the color logic (default: false)
 * @returns {string} Tailwind color class
 */
export const getChangeColorClass = (value, inverse = false) => {
  if (value === null || value === undefined || isNaN(value)) return 'text-gray-400';

  const isPositive = value >= 0;

  if (inverse) {
    return isPositive ? 'text-red-500' : 'text-green-500';
  }

  return isPositive ? 'text-green-500' : 'text-red-500';
};

/**
 * Safely access nested object properties
 * @param {object} obj - The object to access
 * @param {string} path - Dot-notation path (e.g., 'income_statement.revenue')
 * @param {any} defaultValue - Default value if path doesn't exist
 * @returns {any} The value at the path or default value
 */
export const getNestedValue = (obj, path, defaultValue = null) => {
  return path.split('.').reduce((current, key) => current?.[key], obj) ?? defaultValue;
};

/**
 * Debounce a function call
 * @param {Function} func - The function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait = 300) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Check if a value is valid and not empty
 * @param {any} value - The value to check
 * @returns {boolean} True if valid
 */
export const isValidValue = (value) => {
  return value !== null && value !== undefined && value !== '' && !isNaN(value);
};

/**
 * Calculate percentage change between two values
 * @param {number} current - Current value
 * @param {number} previous - Previous value
 * @returns {number} Percentage change
 */
export const calculatePercentChange = (current, previous) => {
  if (!previous || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};
