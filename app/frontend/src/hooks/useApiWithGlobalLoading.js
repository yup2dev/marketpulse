import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../config/api';
import { useLoading } from '../contexts/LoadingContext';

/**
 * useApi hook with global loading overlay support
 * @param {string} url - API endpoint URL
 * @param {object} options - Configuration options
 * @param {boolean} options.manual - If true, won't fetch automatically on mount
 * @param {boolean} options.useGlobalLoading - If true, shows global loading overlay (default: false)
 * @param {string} options.loadingMessage - Custom loading message for global overlay
 */
export const useApiWithGlobalLoading = (url, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showLoading, hideLoading } = useLoading();

  const {
    useGlobalLoading = false,
    loadingMessage = '데이터를 불러오는 중...',
    manual = false
  } = options;

  const fetchData = useCallback(async () => {
    if (!url) return;

    setLoading(true);
    setError(null);

    if (useGlobalLoading) {
      showLoading(loadingMessage);
    }

    try {
      const result = await apiClient.get(url);
      setData(result);
    } catch (err) {
      setError(err.message);
      console.error('API Error:', err);
    } finally {
      setLoading(false);
      if (useGlobalLoading) {
        hideLoading();
      }
    }
  }, [url, useGlobalLoading, loadingMessage, showLoading, hideLoading]);

  useEffect(() => {
    if (manual) return;
    fetchData();
  }, [fetchData, manual]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
};

/**
 * useApiMutation hook with global loading overlay support
 */
export const useApiMutationWithGlobalLoading = (options = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { showLoading, hideLoading } = useLoading();

  const {
    useGlobalLoading = false,
    loadingMessage = '처리 중...'
  } = options;

  const mutate = useCallback(async (url, data) => {
    setLoading(true);
    setError(null);

    if (useGlobalLoading) {
      showLoading(loadingMessage);
    }

    try {
      const result = await apiClient.post(url, data);
      setLoading(false);
      if (useGlobalLoading) {
        hideLoading();
      }
      return result;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      if (useGlobalLoading) {
        hideLoading();
      }
      throw err;
    }
  }, [useGlobalLoading, loadingMessage, showLoading, hideLoading]);

  return { mutate, loading, error };
};
