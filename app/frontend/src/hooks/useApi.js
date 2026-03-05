import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../config/api';
import { useLoading } from '../contexts/LoadingContext';

export const useApi = (url, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showLoading, hideLoading } = useLoading();

  // Use refs for stable references to avoid infinite loops
  const showLoadingRef = useRef(showLoading);
  const hideLoadingRef = useRef(hideLoading);
  showLoadingRef.current = showLoading;
  hideLoadingRef.current = hideLoading;

  const {
    manual = false,
    useGlobalLoading = false,
    loadingMessage = '데이터를 불러오는 중...'
  } = options;

  const fetchData = useCallback(async () => {
    if (!url) return;

    setLoading(true);
    setError(null);

    if (useGlobalLoading) {
      showLoadingRef.current(loadingMessage);
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
        hideLoadingRef.current();
      }
    }
  }, [url, useGlobalLoading, loadingMessage]);

  useEffect(() => {
    if (manual) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, manual]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
};

export const useApiMutation = (options = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { showLoading, hideLoading } = useLoading();

  // Use refs for stable references
  const showLoadingRef = useRef(showLoading);
  const hideLoadingRef = useRef(hideLoading);
  showLoadingRef.current = showLoading;
  hideLoadingRef.current = hideLoading;

  const {
    useGlobalLoading = false,
    loadingMessage = '처리 중...'
  } = options;

  const mutate = useCallback(async (url, data) => {
    setLoading(true);
    setError(null);

    if (useGlobalLoading) {
      showLoadingRef.current(loadingMessage);
    }

    try {
      const result = await apiClient.post(url, data);
      setLoading(false);
      if (useGlobalLoading) {
        hideLoadingRef.current();
      }
      return result;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      if (useGlobalLoading) {
        hideLoadingRef.current();
      }
      throw err;
    }
  }, [useGlobalLoading, loadingMessage]);

  return { mutate, loading, error };
};
