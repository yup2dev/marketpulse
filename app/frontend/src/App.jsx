import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/common/ProtectedRoute';
import AppLayout from './components/core/AppLayout';
import DashboardPage from './components/core/DashboardPage';
import BacktestPage from './components/core/BacktestPage';
import Login from './components/core/Login';
import Register from './components/core/Register';
import ErrorBoundary from './components/common/ErrorBoundary';
import useAuthStore from './store/authStore';

// 토큰 만료 시 로그인 페이지로 강제 이동하는 가드
function AuthGuard({ children }) {
  const { isAuthenticated, isInitializing } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    // 로그인 중이거나 로그인/회원가입 페이지면 스킵
    if (isInitializing || location.pathname === '/login' || location.pathname === '/register' || location.pathname.startsWith('/signin')) {
      return;
    }

    // 보호된 페이지인데 로그아웃된 경우 → 명시적으로 로그인 페이지로 이동
    if (!isAuthenticated && !location.pathname.startsWith('/login')) {
      window.location.replace('/login');
    }
  }, [isAuthenticated, isInitializing, location.pathname]);

  return children;
}

function App() {
  const initializeAuth = useAuthStore((s) => s.initializeAuth);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <ErrorBoundary>
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { background: '#1a1a1a', color: '#fff', border: '1px solid #333' },
          success: { duration: 3000, iconTheme: { primary: '#22c55e', secondary: '#fff' } },
          error:   { duration: 4000, iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />

      <AuthGuard>
      <Routes>
        {/* Protected Routes with AppLayout */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="stock" element={<DashboardPage />} />
          <Route path="macro" element={<DashboardPage />} />
          <Route path="portfolios" element={<DashboardPage />} />
          <Route path="quantlib" element={<DashboardPage />} />
          <Route path="screener" element={<DashboardPage />} />
          <Route path="backtest" element={<BacktestPage />} />
        </Route>

        {/* Auth */}
        <Route path="login" element={<Login />} />
        <Route path="signin" element={<Register />} />
        <Route path="register" element={<Register />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </AuthGuard>
    </Router>
    </ErrorBoundary>
  );
}

export default App;
