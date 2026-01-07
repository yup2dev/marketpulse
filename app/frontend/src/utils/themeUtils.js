/**
 * Theme utility functions
 * Helper functions for theme-related operations
 */
import { THEMES, getThemeClasses } from '../styles/themeTokens';

/**
 * Get current theme tokens
 * @param {string} theme - 'dark' or 'light'
 * @returns {object} Theme tokens
 */
export const getThemeTokens = (theme = 'dark') => {
  return THEMES[theme] || THEMES.dark;
};

/**
 * Get theme-specific class names
 * @param {string} theme - 'dark' or 'light'
 * @returns {object} Theme-specific class names
 */
export const getThemeClassNames = (theme = 'dark') => {
  return getThemeClasses(theme);
};

/**
 * Build widget container classes based on theme
 * @param {string} theme - 'dark' or 'light'
 * @returns {string} Class names
 */
export const buildWidgetClasses = (theme = 'dark') => {
  const classes = getThemeClasses(theme);
  return `h-full ${classes.widget.container} rounded-lg border flex flex-col overflow-hidden`;
};

/**
 * Build chart theme object for Recharts
 * @param {string} theme - 'dark' or 'light'
 * @returns {object} Chart theme configuration
 */
export const getChartTheme = (theme = 'dark') => {
  const tokens = getThemeTokens(theme);
  return tokens.chart;
};

/**
 * Apply theme to document
 * @param {string} theme - 'dark' or 'light'
 */
export const applyThemeToDocument = (theme) => {
  const root = document.documentElement;

  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Update meta theme-color for mobile browsers
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    const tokens = getThemeTokens(theme);
    metaTheme.setAttribute('content', tokens.bg.primary);
  }
};

export default {
  getThemeTokens,
  getThemeClassNames,
  buildWidgetClasses,
  getChartTheme,
  applyThemeToDocument,
};
