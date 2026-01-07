/**
 * Custom hook for theme access
 * Convenience hook that combines theme store and utilities
 */
import useThemeStore from '../store/themeStore';
import { getThemeTokens, getThemeClassNames, getChartTheme } from '../utils/themeUtils';

const useTheme = () => {
  const { theme, setTheme, toggleTheme } = useThemeStore();

  return {
    theme,
    setTheme,
    toggleTheme,
    tokens: getThemeTokens(theme),
    classes: getThemeClassNames(theme),
    chartTheme: getChartTheme(theme),
    isDark: theme === 'dark',
    isLight: theme === 'light',
  };
};

export default useTheme;
