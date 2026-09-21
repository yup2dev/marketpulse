/**
 * Auth 상태 관리 (Zustand)
 *
 * access token 은 **메모리에만** 둔다(api.js). refresh token 은 httpOnly 쿠키라
 * JS 가 읽을 수 없다 — XSS 로 장기 세션을 통째로 가져가지 못하게 하는 게 목적이다.
 *
 * 흐름:
 *  1. 앱 시작 → initializeAuth() → 메모리에 access token 이 없으므로 항상 refresh 시도
 *     (쿠키가 살아 있으면 복구, 없으면 미인증) → verify-token 으로 사용자 확인
 *  2. access token 만료(401) → apiClient 인터셉터가 자동으로 /auth/refresh 호출
 *  3. refresh 쿠키도 만료 → forceLogout 콜백 → 로그인 페이지로 이동
 */
import { create } from 'zustand';
import { authAPI, apiClient, setForceLogoutCallback, setAccessToken, getAccessToken } from '../config/api';
import { clearFetcherToken, syncFetcherToken } from '../utils/fetcherToken';

const _clearStorage = () => {
  setAccessToken(null);
  // access_token / refresh_token 은 더 이상 저장하지 않는다. 예전 값이 남아 있을 수
  // 있으므로 함께 지운다(전환기 청소).
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('fetcher_token');
  localStorage.removeItem('user');
};

const useAuthStore = create((set) => {
  // apiClient가 토큰을 모두 소진했을 때 호출하는 강제 로그아웃 콜백 등록
  setForceLogoutCallback(() => {
    const fetcherToken = localStorage.getItem('fetcher_token');
    _clearStorage();
    clearFetcherToken(fetcherToken);   // 이 세션의 토큰일 때만 제거 → 워커 접속 보류
    set({ user: null, accessToken: null, isAuthenticated: false, isInitializing: false });
  });

  return {
    // ── State ─────────────────────────────────────────────────────────────────
    user:            JSON.parse(localStorage.getItem('user') || 'null'),
    accessToken:     null,   // 메모리 보관 — 새로고침하면 refresh 로 복구한다
    isAuthenticated: false,  // initializeAuth 가 refresh 로 확정하기 전까지 미인증
    isInitializing:  true,   // 앱 첫 로드 시 인증 확인 완료 전까지 true
    isLoading:       false,
    error:           null,

    // ── App startup: refresh 쿠키로 세션 복구 ────────────────────────────────
    initializeAuth: async () => {
      // access token 은 메모리라 새로고침하면 항상 비어 있다. refresh 쿠키(또는
      // 전환기 legacy localStorage 토큰)로 복구를 시도하는 것이 유일한 출발점이다.
      const refreshed = await apiClient._tryRefresh();
      if (!refreshed) {
        _clearStorage();
        set({ isAuthenticated: false, isInitializing: false, user: null, accessToken: null });
        return;
      }

      try {
        const response = await authAPI.verifyToken();
        const user = response?.user;
        // 저장된 fetcher 토큰(장수명)을 Fetcher에 동기화 (재로그인 없이 워커 합류)
        syncFetcherToken(localStorage.getItem('fetcher_token'));
        if (user) localStorage.setItem('user', JSON.stringify(user));
        set({
          ...(user ? { user } : {}),
          isAuthenticated: true,
          isInitializing: false,
          accessToken: getAccessToken(),
        });
      } catch {
        // refresh 는 됐는데 verify 가 실패 — 서버 오류이거나 계정이 비활성화됐다.
        // 토큰이 유효하지 않은 상태로 화면을 열어 두지 않는다.
        _clearStorage();
        set({ isAuthenticated: false, isInitializing: false, user: null, accessToken: null });
      }
    },

    // ── Login ──────────────────────────────────────────────────────────────────
    login: async (email, password) => {
      set({ isLoading: true, error: null });
      try {
        const response = await authAPI.login({ email, password });
        // refresh token 은 본문에 없다 — 서버가 httpOnly 쿠키로 내려준다.
        const { access_token, fetcher_token, user } = response;

        setAccessToken(access_token);      // 메모리 보관
        if (fetcher_token) localStorage.setItem('fetcher_token', fetcher_token);
        localStorage.setItem('user', JSON.stringify(user));
        syncFetcherToken(fetcher_token);   // Fetcher 워커 전용 장수명 토큰 주입

        set({ user, accessToken: access_token, isAuthenticated: true, isLoading: false, error: null });
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
        // refresh token 은 본문에 없다 — 서버가 httpOnly 쿠키로 내려준다.
        const { access_token, fetcher_token, user } = response;

        setAccessToken(access_token);      // 메모리 보관
        if (fetcher_token) localStorage.setItem('fetcher_token', fetcher_token);
        localStorage.setItem('user', JSON.stringify(user));
        syncFetcherToken(fetcher_token);   // Fetcher 워커 전용 장수명 토큰 주입

        set({ user, accessToken: access_token, isAuthenticated: true, isLoading: false, error: null });
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
      const fetcherToken = localStorage.getItem('fetcher_token');
      _clearStorage();
      clearFetcherToken(fetcherToken);   // 이 세션의 토큰일 때만 제거
      set({ user: null, accessToken: null, isAuthenticated: false, error: null });
    },

    // ── Verify (used externally if needed) ────────────────────────────────────
    verifyToken: async () => {
      if (!getAccessToken()) {
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
