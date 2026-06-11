// 데스크탑·웹 모두 클라우드 백엔드를 사용한다.
// (데스크탑의 번들 Fetcher는 로컬에서 돌지만, 백엔드는 클라우드 → /ws/fetcher 워커풀에 합류)
const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://api.finance.dns-co.kr';
export const API_BASE = `${API_BASE_URL}/api`;

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
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // Try to refresh access token using stored refresh token.
  // Returns true on success, false on failure.
  async _tryRefresh() {
    if (this._refreshPromise) return this._refreshPromise;

    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return false;

    this._refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = await res.json().catch(() => null);
        if (!data?.access_token) return false;
        localStorage.setItem('access_token',  data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
        // 데스크톱: 갱신된 토큰을 Fetcher에 반영 (다음 워커 재접속에 사용)
        import('./../utils/fetcherToken').then((m) => m.syncFetcherToken(data.access_token));
        return true;
      })
      .catch(() => false)
      .finally(() => { this._refreshPromise = null; });

    return this._refreshPromise;
  }

  // Core request method with automatic 401 → refresh → retry
  async request(url, options = {}, _isRetry = false) {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // ── 401: try to refresh once, then retry ──────────────────────────────
      if (response.status === 401 && !_isRetry) {
        const refreshed = await this._tryRefresh();
        if (refreshed) {
          return this.request(url, options, true); // retry with new token
        }
        // Both tokens exhausted → force logout
        _forceLogout?.();
        const err = new Error(data.detail || 'Session expired');
        err.status = 401;
        throw err;
      }

      const err = new Error(data.detail || `HTTP ${response.status}`);
      err.status  = response.status;
      err.detail  = data.detail;
      throw err;
    }

    return data;
  }

  get(url)         { return this.request(url, { method: 'GET' }); }
  post(url, body)  { return this.request(url, { method: 'POST',   body: JSON.stringify(body) }); }
}

export const apiClient = new ApiClient();
export default API_BASE_URL;

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authAPI = {
  login:       (data)  => apiClient.post(`${API_BASE}/auth/login`, data),
  register:    (data)  => apiClient.post(`${API_BASE}/auth/register`, data),
  logout:      ()      => apiClient.post(`${API_BASE}/auth/logout`),
  verifyToken: ()      => apiClient.get(`${API_BASE}/auth/verify-token`),  // was /auth/verify (bug)
  refreshTokens: (refreshToken) =>
    apiClient.post(`${API_BASE}/auth/refresh`, { refresh_token: refreshToken }),
};

// ─── Portfolio API ────────────────────────────────────────────────────────────
const UP = `${API_BASE}/user-portfolio`;
export const portfolioAPI = {
  getAll:          ()            => apiClient.get(`${UP}/portfolios`),
  getById:         (id)          => apiClient.get(`${UP}/portfolios/${id}`),
  create:          (data)        => apiClient.post(`${UP}/portfolios`, data),
  update:          (id, data)    => apiClient.request(`${UP}/portfolios/${id}`, { method: 'PUT',    body: JSON.stringify(data) }),
  delete:          (id)          => apiClient.request(`${UP}/portfolios/${id}`, { method: 'DELETE' }),
  getHoldings:     (id)          => apiClient.get(`${UP}/portfolios/${id}/holdings`),
  getTransactions: (id)          => apiClient.get(`${UP}/portfolios/${id}/transactions`),
  addTransaction:  (id, data)    => apiClient.post(`${UP}/portfolios/${id}/transactions`, data),
  updateTransaction: (pId, tId, data) =>
    apiClient.request(`${UP}/portfolios/${pId}/transactions/${tId}`, { method: 'PUT',    body: JSON.stringify(data) }),
  deleteTransaction: (pId, tId)  =>
    apiClient.request(`${UP}/portfolios/${pId}/transactions/${tId}`, { method: 'DELETE' }),
  getSummary:      (id)          => apiClient.get(`${UP}/portfolios/${id}/summary`),
  getPerformance:  (id, p = '1M')=> apiClient.get(`${UP}/portfolios/${id}/performance?period=${p}`),
  getAllocation:   (id)          => apiClient.get(`${UP}/portfolios/${id}/allocation`),
  refreshPrices:   (id)          => apiClient.post(`${UP}/portfolios/${id}/refresh-prices`),
  getPriceAtDate:  (ticker, date)=>
    apiClient.get(`${UP}/price-at-date?ticker=${encodeURIComponent(ticker)}&date=${date}`),
};

// ─── API Keys API ─────────────────────────────────────────────────────────────
// 키는 백엔드에 저장되지 않고 '내 Fetcher 워커(WS)'로 위임되어 내 PC keystore에 적용된다.
export const keysAPI = {
  list:   ()              => apiClient.get(`${API_BASE}/keys`),
  set:    (data)          => apiClient.post(`${API_BASE}/keys`, data),
  delete: (provider)      => apiClient.request(`${API_BASE}/keys/${provider}`, { method: 'DELETE' }),
};

// ─── Export API ───────────────────────────────────────────────────────────────
export const exportAPI = {
  portfolioCSV:   (id) => apiClient.get(`${API_BASE}/export/portfolio/${id}/csv`),
  portfolioExcel: (id) => apiClient.get(`${API_BASE}/export/portfolio/${id}/excel`),
  portfolioPDF:   (id) => apiClient.get(`${API_BASE}/export/portfolio/${id}/pdf`),
};

// ─── Workspace API ────────────────────────────────────────────────────────────
export const workspaceAPI = {
  list:       (screen)       => apiClient.get(`${API_BASE}/workspace?screen=${encodeURIComponent(screen)}`),
  create:     (data)         => apiClient.post(`${API_BASE}/workspace`, data),
  update:     (id, data)     => apiClient.request(`${API_BASE}/workspace/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete:     (id)           => apiClient.request(`${API_BASE}/workspace/${id}`, { method: 'DELETE' }),
  setDefault: (id)           => apiClient.post(`${API_BASE}/workspace/${id}/default`),
};

// ─── Watchlist API ───────────────────────────────────────────────────────────
const WL = `${API_BASE}/watchlist`;
export const watchlistAPI = {
  // 그룹 관리
  getAll:       ()              => apiClient.get(WL),
  create:       (data)          => apiClient.post(WL, data),
  getById:      (id)            => apiClient.get(`${WL}/${id}`),
  update:       (id, data)      => apiClient.request(`${WL}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete:       (id)            => apiClient.request(`${WL}/${id}`, { method: 'DELETE' }),
  getItems:     (id)            => apiClient.get(`${WL}/${id}/items`),
  addTicker:    (id, data)      => apiClient.post(`${WL}/${id}/items`, data),
  removeTicker: (id, ticker)    => apiClient.request(`${WL}/${id}/items/${encodeURIComponent(ticker)}`, { method: 'DELETE' }),
  reorder:      (id, orders)    => apiClient.request(`${WL}/${id}/items/reorder`, { method: 'PUT', body: JSON.stringify({ ticker_orders: orders }) }),
  // 빠른 추가/제거 (그룹 선택 없이)
  getMyTickers: ()              => apiClient.get(`${WL}/my-tickers`),
  quickAdd:     (ticker_cd)     => apiClient.post(`${WL}/quick-add`, { ticker_cd }),
  quickRemove:  (ticker_cd)     => apiClient.request(`${WL}/quick-remove/${encodeURIComponent(ticker_cd)}`, { method: 'DELETE' }),
};

// ─── Screener API ────────────────────────────────────────────────────────────
// ─── Ranking API ─────────────────────────────────────────────────────────────
export const rankingAPI = {
  get: ({ market = 'all', sortBy = 'gainers', period = '1d', limit = 50 } = {}) =>
    apiClient.get(`${API_BASE}/stock/ranking?market=${market}&sort_by=${sortBy}&period=${period}&limit=${limit}`),
  getLive: ({ market = 'all', sortBy = 'gainers', limit = 50 } = {}) =>
    apiClient.get(`${API_BASE}/stock/ranking/live?market=${market}&sort_by=${sortBy}&limit=${limit}`),
};

const SC = `${API_BASE}/screener`;
export const screenerAPI = {
  screen:       (filters, limit = 100) => apiClient.post(`${SC}/screen`, { filters, limit }),
  getPresets:   ()                     => apiClient.get(`${SC}/presets`),
  runPreset:    (id, limit = 100)      => apiClient.post(`${SC}/presets/${id}/run?limit=${limit}`),
  getSectors:   ()                     => apiClient.get(`${SC}/sectors`),
  save:         (data)                 => apiClient.post(`${SC}/save`, data),
  update:       (id, data)             => apiClient.request(`${SC}/saved/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getSaved:     ()                     => apiClient.get(`${SC}/saved`),
  runSaved:     (id, limit = 100)      => apiClient.post(`${SC}/saved/${id}/run?limit=${limit}`),
  deleteSaved:  (id)                   => apiClient.request(`${SC}/saved/${id}`, { method: 'DELETE' }),
};

// ─── Alert API ───────────────────────────────────────────────────────────────
const AL = `${API_BASE}/alerts`;
export const alertAPI = {
  getAll:       (isActive)     => apiClient.get(`${AL}${isActive != null ? `?is_active=${isActive}` : ''}`),
  create:       (data)         => apiClient.post(`${AL}/`, data),
  update:       (id, data)     => apiClient.request(`${AL}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggle:       (id)           => apiClient.post(`${AL}/${id}/toggle`),
  delete:       (id)           => apiClient.request(`${AL}/${id}`, { method: 'DELETE' }),
  getHistory:   (alertId, limit = 50) => apiClient.get(`${AL}/history${alertId ? `?alert_id=${alertId}&` : '?'}limit=${limit}`),
  test:         (id)           => apiClient.post(`${AL}/${id}/test`),
};

// ─── Notes API ──────────────────────────────────────────────────────────────
const NT = `${API_BASE}/notes`;
export const notesAPI = {
  getAll:   (ticker)       => apiClient.get(`${NT}${ticker ? `?ticker_cd=${encodeURIComponent(ticker)}` : ''}`),
  create:   (data)         => apiClient.post(NT, data),
  update:   (id, data)     => apiClient.request(`${NT}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete:   (id)           => apiClient.request(`${NT}/${id}`, { method: 'DELETE' }),
};

// ─── News API ────────────────────────────────────────────────────────────────
export const newsAPI = {
  get: (symbol, limit = 20) => apiClient.get(`${API_BASE}/news${symbol ? `?symbol=${encodeURIComponent(symbol)}&` : '?'}limit=${limit}`),
};

// ─── Universal Data Gateway ──────────────────────────────────────────────────
// 새 Fetcher 추가 시 이 파일 수정 불필요.
// 사용: dataAPI.fetch('fred', 'yield_curve')
//       dataAPI.fetch('yahoo', 'quote', { symbol: 'AAPL' })
//       dataAPI.fetch('fmp', 'income_statement', { symbol: 'AAPL' })
export const dataAPI = {
  fetch: (provider, model, params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    ).toString();
    const url = `${API_BASE}/data/${provider}/${model}${qs ? `?${qs}` : ''}`;
    return apiClient.get(url);
  },

  // 자주 쓰는 단축키 — provider:model 쌍을 기억하지 않아도 됨
  stock: {
    quote:        (symbol, provider = 'yahoo')         => dataAPI.fetch(provider, 'quote', { symbol }),
    history:      (symbol, params = {}, prov = 'yahoo')=> dataAPI.fetch(prov, 'stock_price', { symbol, ...params }),
    profile:      (symbol)                             => dataAPI.fetch('fmp', 'company_profile', { symbol }),
    income:       (symbol)                             => dataAPI.fetch('fmp', 'income_statement', { symbol }),
    estimates:    (symbol)                             => dataAPI.fetch('fmp', 'analyst_estimates', { symbol }),
    gainers:      ()                                   => dataAPI.fetch('fmp', 'gainers', {}),
    losers:       ()                                   => dataAPI.fetch('fmp', 'losers', {}),
    mostActives:  ()                                   => dataAPI.fetch('fmp', 'most_actives', {}),
  },

  macro: {
    yieldCurve:          ()                  => dataAPI.fetch('fred', 'yield_curve', {}),
    yieldHistory:        (period = '5y')     => dataAPI.fetch('fred', 'yield_curve_history', { period }),
    gdp:                 (period = '5y')     => dataAPI.fetch('fred', 'gdp', { period }),
    cpi:                 (period = '5y')     => dataAPI.fetch('fred', 'cpi', { period }),
    unemployment:        (period = '5y')     => dataAPI.fetch('fred', 'unemployment', { period }),
    interestRate:        (period = '5y')     => dataAPI.fetch('fred', 'interest_rate', { period }),
    laborDashboard:      ()                  => dataAPI.fetch('fred', 'labor_dashboard', {}),
    financialConditions: ()                  => dataAPI.fetch('fred', 'financial_conditions', {}),
    sentimentComposite:  ()                  => dataAPI.fetch('fred', 'sentiment_composite', {}),
    inflationMomentum:   (period = '3y')     => dataAPI.fetch('fred', 'inflation_momentum', { period }),
    pmi:                 (period = '5y')     => dataAPI.fetch('fred', 'pmi', { period }),
    fedBalanceSheet:     (period = '10y')    => dataAPI.fetch('fred', 'fed_balance_sheet', { period }),
    realRates:           (period = '5y')     => dataAPI.fetch('fred', 'real_rates', { period }),
    jobsBreakdown:       (period = '5y')     => dataAPI.fetch('fred', 'jobs_breakdown', { period }),
    initialClaims:       (period = '2y')     => dataAPI.fetch('fred', 'initial_claims', { period }),
    inflationSector:     (period = '5y')     => dataAPI.fetch('fred', 'inflation_sector', { period }),
  },
};
