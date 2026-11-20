import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { NotifyHost, DialogHost } from './common';
import ProtectedRoute from './app/ProtectedRoute';
import AppLayout from './app/AppLayout';
import DashboardPage from './pages/dashboard/DashboardPage';
import SettingsPage from './pages/settings/SettingsPage';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ErrorBoundary from './app/ErrorBoundary';
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
      <NotifyHost />
      <DialogHost />

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
          <Route path="quantlib" element={<DashboardPage />} />
          <Route path="backtest" element={<DashboardPage />} />
          <Route path="settings" element={<SettingsPage />} />
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
