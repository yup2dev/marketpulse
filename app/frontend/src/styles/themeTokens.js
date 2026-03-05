/**
 * Theme-specific design tokens
 * Supports both light and dark modes
 */

export const THEMES = {
  dark: {
    name: 'dark',

    // Background colors
    bg: {
      primary: '#0a0e14',      // Body background
      secondary: '#0d0d0d',    // Secondary backgrounds
      tertiary: '#1a1a1a',     // Widget/card backgrounds
      panel: '#161b22',        // Panel backgrounds
      card: '#1a1f2e',         // Card backgrounds
      input: '#0a0e14',        // Input backgrounds
      hover: '#1e2530',        // Hover states
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

    // Chart colors
    chart: {
      background: '#0d0d0d',
      grid: '#333',
      text: '#666',
      tooltip: {
        background: '#1a1a1a',
        border: '#333',
        text: '#fff',
      },
    },
  },

  light: {
    name: 'light',

    // Background colors
    bg: {
      primary: '#f5f7fa',      // Body background
      secondary: '#ffffff',    // Secondary backgrounds
      tertiary: '#ffffff',     // Widget/card backgrounds
      panel: '#f8fafc',        // Panel backgrounds
      card: '#ffffff',         // Card backgrounds
      input: '#ffffff',        // Input backgrounds
      hover: '#f1f5f9',        // Hover states
    },

    // Border colors
    border: {
      default: '#e2e8f0',
      defaultClass: 'border-gray-300',
      active: '#3b82f6',
      activeClass: 'border-blue-500',
      hover: '#cbd5e1',
      hoverClass: 'border-gray-400',
    },

    // Text colors
    text: {
      primary: '#0f172a',
      primaryClass: 'text-gray-900',
      secondary: '#475569',
      secondaryClass: 'text-gray-600',
      tertiary: '#64748b',
      tertiaryClass: 'text-gray-500',
      muted: '#94a3b8',
      mutedClass: 'text-gray-400',
    },

    // Chart colors
    chart: {
      background: '#ffffff',
      grid: '#e5e7eb',
      text: '#6b7280',
      tooltip: {
        background: '#ffffff',
        border: '#e5e7eb',
        text: '#1f2937',
      },
    },
  },
};

// Export theme-specific classes for Tailwind
export const getThemeClasses = (theme) => {
  const isDark = theme === 'dark';

  return {
    // Base classes
    body: isDark ? 'bg-[#0a0e14] text-white' : 'bg-[#f5f7fa] text-gray-900',

    // Widget/Card classes
    widget: {
      container: isDark
        ? 'bg-[#0d0d12] border-gray-800'
        : 'bg-white border-gray-300 shadow-sm',
      header: isDark
        ? 'border-gray-800'
        : 'border-gray-200',
      content: isDark
        ? 'bg-[#0d0d12]'
        : 'bg-white',
    },

    // Layout classes
    layout: {
      header: isDark
        ? 'bg-[#0d0d12] border-gray-800'
        : 'bg-white border-gray-200 shadow-sm',
      footer: isDark
        ? 'bg-[#0d0d12] border-gray-800'
        : 'bg-white border-gray-200',
    },

    // Interactive elements
    button: {
      ghost: isDark
        ? 'text-gray-400 hover:text-white hover:bg-gray-800'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
      secondary: isDark
        ? 'bg-gray-800 border-gray-700 text-white hover:bg-gray-700'
        : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50',
    },

    // Form elements
    input: isDark
      ? 'bg-gray-900 border-gray-700 text-white focus:border-blue-500'
      : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500',
  };
};

export default THEMES;
