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
  async request(url, options = {}) {
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
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
