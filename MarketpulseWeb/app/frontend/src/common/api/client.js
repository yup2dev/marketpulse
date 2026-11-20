/**
 * 백엔드 요청 클라이언트 — 백엔드 호출은 전부 apiClient 를 거친다 (fetch 직접 호출 금지).
 *   - access token 을 붙이고, 401/403 이면 refresh 한 번 → 재시도, 실패하면 강제 로그아웃
 *   - 오류는 Error 에 status · detail · code · provider · candidates 를 실어 던진다
 *   - JSON 이 아닌 응답(SSE 스트림 등)은 stream() — 같은 인증·재시도를 거치고 Response 를 돌려준다
 * 로컬 Fetcher(127.0.0.1:8765)는 백엔드가 아니다 — localFetcher.js 를 쓴다.
 */
import { API_BASE } from './base';
import { syncFetcherToken } from './localFetcher';

// ─── Access token (메모리 보관) ───────────────────────────────────────────────
// localStorage 에 두지 않는다 — XSS 스크립트가 바로 읽어간다. 탭을 새로고침하면
// 사라지지만, refresh token 이 httpOnly 쿠키로 남아 있어 /auth/refresh 로 즉시 복구된다.
let _accessToken = null;
export function setAccessToken(token) { _accessToken = token || null; }
export function getAccessToken() { return _accessToken; }

// 전환기: 예전 프론트가 localStorage 에 남겨 둔 refresh token 을 한 번만 써서
// 쿠키로 갈아탄 뒤 지운다. 이게 없으면 기존 로그인 사용자가 전부 로그아웃된다.
function takeLegacyRefreshToken() {
  try {
    const t = localStorage.getItem('refresh_token');
    if (t) localStorage.removeItem('refresh_token');
    return t;
  } catch {
    return null;
  }
}

// ─── Force-logout callback ────────────────────────────────────────────────────
// Set by authStore so apiClient can trigger logout when tokens fully expire
let _forceLogout = null;
export function setForceLogoutCallback(fn) {
  _forceLogout = fn;
}
export function getForceLogout() {
  return _forceLogout;
}

// ─── API Client ───────────────────────────────────────────────────────────────
class ApiClient {
  // Shared refresh promise — prevents duplicate refresh calls when multiple
  // requests fail with 401 simultaneously
  _refreshPromise = null;

  getAuthHeaders() {
    return _accessToken ? { Authorization: `Bearer ${_accessToken}` } : {};
  }

  // Try to refresh access token using stored refresh token.
  // Returns true on success, false on failure.
  async _tryRefresh() {
    if (this._refreshPromise) return this._refreshPromise;

    // refresh token 은 httpOnly 쿠키에 있으므로 여기서 읽을 수 없다 — credentials 로 보낸다.
    // 구 사용자는 legacy 토큰을 본문에 한 번 실어 보내 쿠키로 전환한다.
    const legacy = takeLegacyRefreshToken();

    this._refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(legacy ? { refresh_token: legacy } : {}),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = await res.json().catch(() => null);
        if (!data?.access_token) return false;
        setAccessToken(data.access_token);
        if (data.fetcher_token) localStorage.setItem('fetcher_token', data.fetcher_token);
        if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
        // 갱신 시 fetcher 토큰도 새로 받아 Fetcher에 반영 (장수명 토큰 시계 리셋)
        if (data.fetcher_token) syncFetcherToken(data.fetcher_token);
        return true;
      })
      .catch(() => false)
      .finally(() => { this._refreshPromise = null; });

    return this._refreshPromise;
  }

  _fetch(url, options) {
    return fetch(url, {
      ...options,
      // refresh 쿠키가 실려야 한다 — 쿠키 인증의 전제.
      credentials: 'include',
      // headers 는 ...options 뒤에 둔다. 앞에 두면 options.headers 가 통째로
      // 덮어써서 Authorization 이 사라진다.
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    });
  }

  // ── 401/403: refresh 한 번 → 재시도. 살릴 수 없으면 강제 로그아웃 ───────────────
  // 백엔드는 만료·자격증명 누락을 401로 통일했지만, 권한 부족(admin 등)은 403.
  // 403도 refresh를 한 번 시도해 보고, 세션이 살아 있으면(refresh 성공) retry에서
  // 다시 403이 나도 _isRetry 가드로 로그아웃 없이 throw → admin 케이스를 보호한다.
  // 돌려주는 값: true = 재시도하라, 아니면 던질 Error
  async _handleAuthFailure(status, data, isRetry) {
    if ((status !== 401 && status !== 403) || isRetry) return null;
    if (await this._tryRefresh()) return true;
    _forceLogout?.();
    const err = new Error(data.detail || 'Session expired');
    err.status = status;
    return err;
  }

  _httpError(status, data) {
    const err = new Error(data.detail || `HTTP ${status}`);
    err.status  = status;
    err.detail  = data.detail;
    // 구조화된 오류(예: 424 code=missing_key, provider=fred) — 위젯이 '키 등록' 안내로 바꾼다
    err.code     = data.code;
    err.provider = data.provider;
    // 고를 수 있는 데이터 소스 — 실패해도 위젯이 다른 소스로 바꿀 수 있게 (예: /stock/ranking/live)
    err.candidates = data.candidates;
    return err;
  }

  // Core request method with automatic 401 → refresh → retry
  async request(url, options = {}, _isRetry = false) {
    const response = await this._fetch(url, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const auth = await this._handleAuthFailure(response.status, data, _isRetry);
      if (auth === true) return this.request(url, options, true);
      throw auth || this._httpError(response.status, data);
    }
    return data;
  }

  /**
   * 본문을 읽지 않은 Response 를 돌려준다 (SSE·파일 등). 인증·재시도·오류 형식은 request 와 같다.
   * body 는 문자열로 넘긴다 — 재시도할 때 다시 보내야 한다.
   */
  async stream(url, options = {}, _isRetry = false) {
    const response = await this._fetch(url, options);
    if (response.ok) return response;

    const data = await response.json().catch(() => ({}));
    const auth = await this._handleAuthFailure(response.status, data, _isRetry);
    if (auth === true) return this.stream(url, options, true);
    throw auth || this._httpError(response.status, data);
  }

  get(url)         { return this.request(url, { method: 'GET' }); }
  post(url, body)  { return this.request(url, { method: 'POST',   body: JSON.stringify(body) }); }
  put(url, body)   { return this.request(url, { method: 'PUT',    body: JSON.stringify(body) }); }
  del(url)         { return this.request(url, { method: 'DELETE' }); }
}

export const apiClient = new ApiClient();
