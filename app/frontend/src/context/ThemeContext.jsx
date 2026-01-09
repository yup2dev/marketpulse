/**
 * Theme Context for Dark/Light Mode
 */
import { createContext, useState, useEffect } from 'react';

export const ThemeContext = createContext({
  theme: 'dark',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    // Load theme from localStorage or default to 'dark'
    const savedTheme = localStorage.getItem('marketpulse-theme');
    return savedTheme || 'dark';
  });

  useEffect(() => {
    // Apply theme class to HTML element
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }

    // Save to localStorage
    localStorage.setItem('marketpulse-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
