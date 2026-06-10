/**
 * Protected Route 컴포넌트
 * - 인증 확인 중(isInitializing): 로딩 화면 표시 → API 요청 차단
 * - 토큰 없음 / 만료: /login 리다이렉트
 * - 인증됨: children 렌더링
 */
import { Navigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isInitializing } = useAuthStore();

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ background: 'var(--color-bg-primary)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
