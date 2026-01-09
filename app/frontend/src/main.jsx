import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { LoadingProvider } from './contexts/LoadingContext'
import GlobalLoadingOverlay from './components/common/GlobalLoadingOverlay'
import useThemeStore from './store/themeStore'

// Theme initializer component
const ThemeInitializer = () => {
  const initializeTheme = useThemeStore((state) => state.initializeTheme);

  useEffect(() => {
    initializeTheme();
  }, [initializeTheme]);

  return null;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LoadingProvider>
      <ThemeInitializer />
      <App />
      <GlobalLoadingOverlay />
    </LoadingProvider>
  </StrictMode>,
)
