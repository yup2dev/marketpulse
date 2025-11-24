import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../config/api';

export const useApi = (url, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!url) return;

    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.get(url);
      setData(result);
    } catch (err) {
      setError(err.message);
      console.error('API Error:', err);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (options.manual) return;
    fetchData();
  }, [fetchData, options.manual]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
};

export const useApiMutation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutate = useCallback(async (url, data) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.post(url, data);
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, []);

  return { mutate, loading, error };
};
