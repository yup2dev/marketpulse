/**
 * Protected Route 컴포넌트
 * 인증되지 않은 사용자는 로그인 페이지로 리다이렉트
 */
import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
