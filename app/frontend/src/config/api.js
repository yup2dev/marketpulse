const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const API_BASE = `${API_BASE_URL}/api`;

export const API_ENDPOINTS = {
  health: `${API_BASE_URL}/health`,
  stock: {
    overview: `${API_BASE_URL}/api/stock/overview`,
    price:   (symbol) => `${API_BASE_URL}/api/stock/${symbol}/price`,
    history: (symbol) => `${API_BASE_URL}/api/stock/${symbol}/history`,
  },
  economic: {
    indicators: `${API_BASE_URL}/api/economic/indicators`,
    overview:   `${API_BASE_URL}/api/economic/overview`,
  },
  news: {
    latest:   `${API_BASE_URL}/api/news/latest`,
    bySymbol: (symbol) => `${API_BASE_URL}/api/news/${symbol}`,
  },
  dashboard: {
    overview: `${API_BASE_URL}/api/dashboard/overview`,
    summary:  `${API_BASE_URL}/api/dashboard/summary`,
  },
};

// ─── Force-logout callback ────────────────────────────────────────────────────
// Set by authStore so apiClient can trigger logout when tokens fully expire
let _forceLogout = null;
export function setForceLogoutCallback(fn) {
  _forceLogout = fn;
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

// ─── Quant API ────────────────────────────────────────────────────────────────
export const quantAPI = {
  strategyTypes:   ()              => apiClient.get(`${API_BASE}/quant/strategy-types`),
  factorCatalog:   ()              => apiClient.get(`${API_BASE}/quant/factor-catalog`),
  analyze:         (payload)       => apiClient.post(`${API_BASE}/quant/analyze`, payload),
  scan:            (payload)       => apiClient.post(`${API_BASE}/quant/scan`, payload),
  factorSeries:    (payload)       => apiClient.post(`${API_BASE}/quant/factor-series`, payload),
  listStrategies:  ()              => apiClient.get(`${API_BASE}/quant/strategies`),
  createStrategy:  (data)          => apiClient.post(`${API_BASE}/quant/strategies`, data),
  updateStrategy:  (id, data)      => apiClient.request(`${API_BASE}/quant/strategies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStrategy:  (id)            => apiClient.request(`${API_BASE}/quant/strategies/${id}`, { method: 'DELETE' }),
  createSamples:   ()              => apiClient.post(`${API_BASE}/quant/strategies/samples`, {}),
  // Factor CRUD
  listFactors:     ()              => apiClient.get(`${API_BASE}/quant/factors`),
  createFactor:    (data)          => apiClient.post(`${API_BASE}/quant/factors`, data),
  deleteFactor:    (id)            => apiClient.request(`${API_BASE}/quant/factors/${id}`, { method: 'DELETE' }),
};

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

// ─── Export API ───────────────────────────────────────────────────────────────
export const exportAPI = {
  portfolioCSV:   (id) => apiClient.get(`${API_BASE}/export/portfolio/${id}/csv`),
  portfolioExcel: (id) => apiClient.get(`${API_BASE}/export/portfolio/${id}/excel`),
  portfolioPDF:   (id) => apiClient.get(`${API_BASE}/export/portfolio/${id}/pdf`),
};

// ─── Dashboard API ────────────────────────────────────────────────────────────
export const dashboardAPI = {
  getWatchlist:        ()       => apiClient.get(`${API_BASE}/dashboard/watchlist`),
  addToWatchlist:      (symbol) => apiClient.post(`${API_BASE}/dashboard/watchlist`, { symbol }),
  removeFromWatchlist: (symbol) => apiClient.request(`${API_BASE}/dashboard/watchlist/${symbol}`, { method: 'DELETE' }),
};

// ─── Workspace API ────────────────────────────────────────────────────────────
export const workspaceAPI = {
  list:       (screen)       => apiClient.get(`${API_BASE}/workspace?screen=${encodeURIComponent(screen)}`),
  create:     (data)         => apiClient.post(`${API_BASE}/workspace`, data),
  update:     (id, data)     => apiClient.request(`${API_BASE}/workspace/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete:     (id)           => apiClient.request(`${API_BASE}/workspace/${id}`, { method: 'DELETE' }),
  setDefault: (id)           => apiClient.post(`${API_BASE}/workspace/${id}/default`),
};
