const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const API_BASE = `${API_BASE_URL}/api`;

export const API_ENDPOINTS = {
  // Health
  health: `${API_BASE_URL}/health`,

  // Stock endpoints
  stock: {
    overview: `${API_BASE_URL}/api/stock/overview`,
    price: (symbol) => `${API_BASE_URL}/api/stock/${symbol}/price`,
    history: (symbol) => `${API_BASE_URL}/api/stock/${symbol}/history`,
  },

  // Economic endpoints
  economic: {
    indicators: `${API_BASE_URL}/api/economic/indicators`,
    overview: `${API_BASE_URL}/api/economic/overview`,
  },

  // News endpoints
  news: {
    latest: `${API_BASE_URL}/api/news/latest`,
    bySymbol: (symbol) => `${API_BASE_URL}/api/news/${symbol}`,
  },

  // Dashboard endpoints
  dashboard: {
    overview: `${API_BASE_URL}/api/dashboard/overview`,
    summary: `${API_BASE_URL}/api/dashboard/summary`,
  },
};

class ApiClient {
  getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  async request(url, options = {}) {
    try {
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
        const error = new Error(data.detail || `HTTP error! status: ${response.status}`);
        error.status = response.status;
        error.detail = data.detail;
        throw error;
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async get(url) {
    return this.request(url, { method: 'GET' });
  }

  async post(url, data) {
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const apiClient = new ApiClient();
export default API_BASE_URL;

// Auth API
export const authAPI = {
  login: (data) => apiClient.post(`${API_BASE}/auth/login`, data),
  register: (data) => apiClient.post(`${API_BASE}/auth/register`, data),
  logout: () => apiClient.post(`${API_BASE}/auth/logout`),
  verifyToken: () => apiClient.get(`${API_BASE}/auth/verify`),
};

// Portfolio API (user-portfolio)
const UP = `${API_BASE}/user-portfolio`;
export const portfolioAPI = {
  getAll: () => apiClient.get(`${UP}/portfolios`),
  getById: (id) => apiClient.get(`${UP}/portfolios/${id}`),
  create: (data) => apiClient.post(`${UP}/portfolios`, data),
  update: (id, data) => apiClient.request(`${UP}/portfolios/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiClient.request(`${UP}/portfolios/${id}`, { method: 'DELETE' }),
  getHoldings: (id) => apiClient.get(`${UP}/portfolios/${id}/holdings`),
  getTransactions: (id) => apiClient.get(`${UP}/portfolios/${id}/transactions`),
  addTransaction: (id, data) => apiClient.post(`${UP}/portfolios/${id}/transactions`, data),
  getSummary: (id) => apiClient.get(`${UP}/portfolios/${id}/summary`),
  getPerformance: (id, period = '1M') => apiClient.get(`${UP}/portfolios/${id}/performance?period=${period}`),
  getAllocation: (id) => apiClient.get(`${UP}/portfolios/${id}/allocation`),
  refreshPrices: (id) => apiClient.post(`${UP}/portfolios/${id}/refresh-prices`),
};

// Export API
export const exportAPI = {
  portfolioCSV: (id) => apiClient.get(`${API_BASE}/export/portfolio/${id}/csv`),
  portfolioExcel: (id) => apiClient.get(`${API_BASE}/export/portfolio/${id}/excel`),
  portfolioPDF: (id) => apiClient.get(`${API_BASE}/export/portfolio/${id}/pdf`),
};

// Dashboard API
export const dashboardAPI = {
  getWatchlist: () => apiClient.get(`${API_BASE}/dashboard/watchlist`),
  addToWatchlist: (symbol) => apiClient.post(`${API_BASE}/dashboard/watchlist`, { symbol }),
  removeFromWatchlist: (symbol) => apiClient.request(`${API_BASE}/dashboard/watchlist/${symbol}`, { method: 'DELETE' }),
};
