/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#00d9ff',
          dark: '#00a6cc',
        },
        background: {
          primary: '#0a0e14',
          secondary: '#1a1f2e',
          tertiary: '#252b3b',
        },
        text: {
          primary: '#e6edf3',
          secondary: '#8b949e',
          tertiary: '#6e7681',
        },
        positive: '#3fb950',
        negative: '#f85149',
      },
    },
  },
  plugins: [],
}
