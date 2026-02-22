/**
 * Auth 상태 관리 (Zustand)
 *
 * 흐름:
 *  1. 앱 시작 → initializeAuth() → localStorage 토큰 확인 → verify-token 호출
 *  2. access token 만료(401) → apiClient 인터셉터가 자동으로 /auth/refresh 호출
 *  3. refresh token도 만료 → forceLogout 콜백 → 로그인 페이지로 이동
 */
import { create } from 'zustand';
import { authAPI, setForceLogoutCallback } from '../config/api';

const _clearStorage = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
};

const useAuthStore = create((set, get) => {
  // apiClient가 토큰을 모두 소진했을 때 호출하는 강제 로그아웃 콜백 등록
  setForceLogoutCallback(() => {
    _clearStorage();
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.replace('/login');
    }
  });

  return {
    // ── State ─────────────────────────────────────────────────────────────────
    user:            JSON.parse(localStorage.getItem('user') || 'null'),
    accessToken:     localStorage.getItem('access_token')  || null,
    refreshToken:    localStorage.getItem('refresh_token') || null,
    isAuthenticated: !!localStorage.getItem('access_token'),
    isLoading:       false,
    error:           null,

    // ── App startup: verify stored token, auto-refresh if expired ─────────────
    // apiClient의 401 인터셉터가 refresh를 처리하므로 여기선 단순 verify만 수행
    initializeAuth: async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        set({ isAuthenticated: false, user: null });
        return;
      }
      try {
        // 401이 오면 apiClient 인터셉터가 자동으로 refresh → retry
        const response = await authAPI.verifyToken();
        const user = response?.user;
        if (user) {
          localStorage.setItem('user', JSON.stringify(user));
          set({ user, isAuthenticated: true, accessToken: localStorage.getItem('access_token') });
        }
      } catch {
        // forceLogout 콜백이 이미 실행되었거나, 네트워크 오류(서버 다운 등)
        // 서버가 꺼져 있는 경우 로컬 상태는 유지 (오프라인 허용)
        const stillHasToken = !!localStorage.getItem('access_token');
        set({ isAuthenticated: stillHasToken });
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
