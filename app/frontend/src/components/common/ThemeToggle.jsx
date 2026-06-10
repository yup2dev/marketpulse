/**
 * Theme Toggle Component
 * Allows users to switch between dark and light themes
 */
import { Sun, Moon } from 'lucide-react';
import useTheme from '../../hooks/useTheme';

const ThemeToggle = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all hover:bg-gray-100 dark:hover:bg-gray-800 ${className}`}
      style={{ color: 'var(--color-text-secondary)' }}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      <span className="text-xs font-medium hidden md:inline">
        {theme === 'dark' ? 'Light' : 'Dark'}
      </span>
    </button>
  );
};

export default ThemeToggle;
