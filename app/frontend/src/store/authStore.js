/**
 * Auth 상태 관리 (Zustand)
 *
 * 흐름:
 *  1. 앱 시작 → initializeAuth() → 클라이언트 측 JWT 만료 확인 → verify-token 호출
 *  2. access token 만료(401) → apiClient 인터셉터가 자동으로 /auth/refresh 호출
 *  3. refresh token도 만료 → forceLogout 콜백 → 로그인 페이지로 이동
 */
import { create } from 'zustand';
import { authAPI, apiClient, setForceLogoutCallback } from '../config/api';

const _clearStorage = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
};

// JWT payload를 파싱해 만료 여부를 반환 (서명 검증 없음 — 서버 검증은 별도로 수행)
const _isJwtExpired = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
};

const useAuthStore = create((set, get) => {
  // apiClient가 토큰을 모두 소진했을 때 호출하는 강제 로그아웃 콜백 등록
  setForceLogoutCallback(() => {
    _clearStorage();
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, isInitializing: false });
  });

  return {
    // ── State ─────────────────────────────────────────────────────────────────
    user:            JSON.parse(localStorage.getItem('user') || 'null'),
    accessToken:     localStorage.getItem('access_token')  || null,
    refreshToken:    localStorage.getItem('refresh_token') || null,
    isAuthenticated: !!localStorage.getItem('access_token'),
    isInitializing:  true,   // 앱 첫 로드 시 인증 확인 완료 전까지 true
    isLoading:       false,
    error:           null,

    // ── App startup: verify stored token, auto-refresh if expired ─────────────
    initializeAuth: async () => {
      const token = localStorage.getItem('access_token');

      // 토큰 없음 → 즉시 미인증 처리 (ProtectedRoute가 /login으로 리다이렉트)
      if (!token) {
        set({ isAuthenticated: false, isInitializing: false, user: null });
        return;
      }

      // 클라이언트 측 JWT 만료 확인 — 만료됐으면 refresh 먼저 시도
      if (_isJwtExpired(token)) {
        const refreshToken = localStorage.getItem('refresh_token');
        const refreshExpired = !refreshToken || _isJwtExpired(refreshToken);

        if (refreshExpired) {
          // 양쪽 토큰 모두 만료 → 바로 로그아웃
          _clearStorage();
          set({ isAuthenticated: false, isInitializing: false, user: null });
          return;
        }

        // refresh token이 살아 있으면 갱신 시도
        const refreshed = await apiClient._tryRefresh();
        if (!refreshed) {
          _clearStorage();
          set({ isAuthenticated: false, isInitializing: false, user: null });
          return;
        }
      }

      try {
        // 401이 오면 apiClient 인터셉터가 자동으로 refresh → retry
        // refresh도 실패하면 forceLogout 콜백 → _redirectToLogin()
        const response = await authAPI.verifyToken();
        const user = response?.user;
        if (user) {
          localStorage.setItem('user', JSON.stringify(user));
          set({ user, isAuthenticated: true, isInitializing: false, accessToken: localStorage.getItem('access_token') });
        } else {
          set({ isAuthenticated: true, isInitializing: false });
        }
      } catch {
        // forceLogout이 이미 실행해 리다이렉트 중이거나 네트워크 오류(서버 다운)
        const currentToken = localStorage.getItem('access_token');
        if (!currentToken) {
          // 토큰이 지워진 경우 (forceLogout 실행됨) → 리다이렉트 대기
          set({ isAuthenticated: false, isInitializing: false });
        } else if (_isJwtExpired(currentToken)) {
          // 토큰이 남아 있지만 만료됨 → 로그아웃
          _clearStorage();
          set({ isAuthenticated: false, isInitializing: false, user: null });
        } else {
          // 서버 다운 등 네트워크 오류 + 토큰이 아직 유효 → 오프라인 허용
          set({ isAuthenticated: true, isInitializing: false });
        }
      }
    },

    // ── Login ──────────────────────────────────────────────────────────────────
    login: async (email, password) => {
      set({ isLoading: true, error: null });
      try {
        const response = await authAPI.login({ email, password });
        const { access_token, refresh_token, user } = response;

        localStorage.setItem('access_token',  access_token);
        localStorage.setItem('refresh_token', refresh_token);
        localStorage.setItem('user', JSON.stringify(user));

        set({ user, accessToken: access_token, refreshToken: refresh_token, isAuthenticated: true, isLoading: false, error: null });
        return { success: true };
      } catch (error) {
        const msg = error.detail || error.message || '로그인 실패';
        set({ isLoading: false, error: msg });
        return { success: false, error: msg };
      }
    },

    // ── Register ───────────────────────────────────────────────────────────────
    register: async (email, username, password, full_name) => {
      set({ isLoading: true, error: null });
      try {
        const response = await authAPI.register({ email, username, password, full_name });
        const { access_token, refresh_token, user } = response;

        localStorage.setItem('access_token',  access_token);
        localStorage.setItem('refresh_token', refresh_token);
        localStorage.setItem('user', JSON.stringify(user));

        set({ user, accessToken: access_token, refreshToken: refresh_token, isAuthenticated: true, isLoading: false, error: null });
        return { success: true };
      } catch (error) {
        const msg = error.detail || error.message || '회원가입 실패';
        set({ isLoading: false, error: msg });
        return { success: false, error: msg };
      }
    },

    // ── Logout ─────────────────────────────────────────────────────────────────
    logout: async () => {
      try { await authAPI.logout(); } catch { /* ignore */ }
      _clearStorage();
      set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, error: null });
    },

    // ── Verify (used externally if needed) ────────────────────────────────────
    verifyToken: async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        set({ isAuthenticated: false, user: null });
        return false;
      }
      try {
        const response = await authAPI.verifyToken();
        const user = response?.user;
        if (user) {
          localStorage.setItem('user', JSON.stringify(user));
          set({ user, isAuthenticated: true });
        }
        return true;
      } catch {
        return false;
      }
    },

    clearError: () => set({ error: null }),
  };
});

export default useAuthStore;
