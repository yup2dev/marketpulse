import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { LoadingProvider } from './contexts/LoadingContext'
import GlobalLoadingOverlay from './components/common/GlobalLoadingOverlay'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LoadingProvider>
      <App />
      <GlobalLoadingOverlay />
    </LoadingProvider>
  </StrictMode>,
)
