import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/common/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import ProfessionalDashboard from './components/dashboard/ProfessionalDashboard';
import StockDashboard from './components/analysis/StockDashboard';
import MacroDashboard from './components/macro/MacroDashboard';
import UnifiedBacktest from './components/backtest/UnifiedBacktest';
import PortfolioDashboard from './pages/PortfolioDashboard';
import PortfolioDetail from './pages/PortfolioDetail';
import AlertsPage from './pages/AlertsPage';
import ScreenerPage from './pages/ScreenerPage';
import WatchlistPage from './pages/WatchlistPage';
import ErrorBoundary from './components/common/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1a1a1a',
            color: '#fff',
            border: '1px solid #333',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#22c55e',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />

      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Routes with AppLayout */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ProfessionalDashboard />} />
          <Route path="stock" element={<StockDashboard />} />
          <Route path="macro" element={<MacroDashboard />} />
          <Route path="backtest" element={<UnifiedBacktest />} />
          <Route path="portfolios" element={<PortfolioDashboard />} />
          <Route path="portfolio/:portfolioId" element={<PortfolioDetail />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="screener" element={<ScreenerPage />} />
          <Route path="watchlist" element={<WatchlistPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
    </ErrorBoundary>
  );
}

export default App;
