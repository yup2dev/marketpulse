/**
 * Theme State Management (Zustand)
 * Manages application theme (dark/light mode)
 */
import { create } from 'zustand';

const THEME_STORAGE_KEY = 'marketpulse-theme';

const useThemeStore = create((set, get) => ({
  // State
  theme: localStorage.getItem(THEME_STORAGE_KEY) || 'dark',
  isInitialized: false,

  // Actions
  setTheme: (theme) => {
    if (!['dark', 'light'].includes(theme)) {
      console.error('Invalid theme:', theme);
      return;
    }

    localStorage.setItem(THEME_STORAGE_KEY, theme);

    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
    }

    set({ theme });
  },

  toggleTheme: () => {
    const currentTheme = get().theme;
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    get().setTheme(newTheme);
  },

  initializeTheme: () => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

    // Check system preference if no saved theme
    if (!savedTheme) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const systemTheme = prefersDark ? 'dark' : 'light';
      get().setTheme(systemTheme);
    } else {
      get().setTheme(savedTheme);
    }

    set({ isInitialized: true });
  },
}));

export default useThemeStore;
