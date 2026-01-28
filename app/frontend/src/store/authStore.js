/**
 * Auth 상태 관리 (Zustand)
 */
import { create } from 'zustand';
import { authAPI } from '../config/api';

const useAuthStore = create((set, get) => ({
  // State
  user: JSON.parse(localStorage.getItem('user')) || null,
  accessToken: localStorage.getItem('access_token') || null,
  refreshToken: localStorage.getItem('refresh_token') || null,
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: false,
  error: null,

  // Actions
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.login({ email, password });
      const { access_token, refresh_token, user } = response;

      // 로컬스토리지에 저장
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('user', JSON.stringify(user));

      set({
        user,
        accessToken: access_token,
        refreshToken: refresh_token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error.detail || error.message || '로그인에 실패했습니다.';
      set({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  register: async (email, username, password, full_name) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.register({
        email,
        username,
        password,
        full_name,
      });
      const { access_token, refresh_token, user } = response;

      // 로컬스토리지에 저장
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('user', JSON.stringify(user));

      set({
        user,
        accessToken: access_token,
        refreshToken: refresh_token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error.detail || error.message || '회원가입에 실패했습니다.';
      set({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  logout: async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // 로컬스토리지 클리어
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');

      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        error: null,
      });
    }
  },

  verifyToken: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      set({ isAuthenticated: false, user: null });
      return false;
    }

    try {
      const response = await authAPI.verifyToken();
      const { user } = response;

      localStorage.setItem('user', JSON.stringify(user));
      set({ user, isAuthenticated: true });
      return true;
    } catch (error) {
      // 토큰 무효
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      set({ isAuthenticated: false, user: null, accessToken: null, refreshToken: null });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
