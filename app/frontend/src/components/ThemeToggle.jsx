/**
 * Theme Toggle Component
 * Allows users to switch between dark and light themes
 */
import { Sun, Moon } from 'lucide-react';
import useTheme from '../hooks/useTheme';

const ThemeToggle = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
        theme === 'dark'
          ? 'text-gray-300 hover:text-white hover:bg-gray-800'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      } ${className}`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <>
          <Sun size={18} />
          <span className="text-sm font-medium">Light</span>
        </>
      ) : (
        <>
          <Moon size={18} />
          <span className="text-sm font-medium">Dark</span>
        </>
      )}
    </button>
  );
};

export default ThemeToggle;
