import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/common/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import TabDashboard from './components/core/TabDashboard';
import UnifiedBacktest from './components/backtest/UnifiedBacktest';
import PortfolioDetail from './components/portfolio/PortfolioDetail';
import AlertsDashboard from './components/alerts/AlertsDashboard';
import ScreenerDashboard from './components/screener/ScreenerDashboard';
import WatchlistDashboard from './components/watchlist/WatchlistDashboard';
import QuantResearchDashboard from './components/quant/QuantResearchDashboard';
import StrategyBuilderDashboard from './components/strategy/StrategyBuilderDashboard';
import TradingTerminal from './components/trading/TradingTerminal';
import ErrorBoundary from './components/common/ErrorBoundary';
import useAuthStore from './store/authStore';

function App() {
  const initializeAuth = useAuthStore((s) => s.initializeAuth);

  // 앱 최초 마운트 시 저장된 토큰 유효성 확인
  // access token 만료 → apiClient가 자동으로 refresh → 문제 없음
  // refresh token도 만료 → forceLogout 콜백 → /login 리다이렉트
  useEffect(() => {
    initializeAuth();
  }, []);

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
          <Route index element={<TabDashboard screen="dashboard" />} />
          <Route path="stock" element={<TabDashboard screen="stock" />} />
          <Route path="macro" element={<TabDashboard screen="macro" />} />
          <Route path="backtest" element={<UnifiedBacktest />} />
          <Route path="portfolios" element={<TabDashboard screen="portfolio" />} />
          <Route path="portfolio/:portfolioId" element={<PortfolioDetail />} />
          <Route path="alerts" element={<AlertsDashboard />} />
          <Route path="screener" element={<ScreenerDashboard />} />
          <Route path="watchlist" element={<WatchlistDashboard />} />
          <Route path="quant" element={<QuantResearchDashboard />} />
          <Route path="strategy" element={<StrategyBuilderDashboard />} />
          <Route path="trading" element={<TradingTerminal />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
    </ErrorBoundary>
  );
}

export default App;
