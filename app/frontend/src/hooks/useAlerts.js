/**
 * 알림 데이터 관리 훅
 * API 호출, 통계 계산, 타입별 필터링 제공
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

export const useAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // API base config
  const getAuthHeader = useCallback(() => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  }, []);

  const apiUrl = import.meta.env.VITE_API_URL;

  // Load all alerts
  const loadAlerts = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${apiUrl}/alerts`, {
        headers: getAuthHeader()
      });
      setAlerts(response.data);
    } catch (error) {
      toast.error('알림 목록을 불러오지 못했습니다');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, getAuthHeader]);

  // Load alert history
  const loadHistory = useCallback(async (alertId = null, limit = 50) => {
    try {
      setIsHistoryLoading(true);
      const params = alertId ? { alert_id: alertId, limit } : { limit };
      const response = await axios.get(`${apiUrl}/alerts/history`, {
        headers: getAuthHeader(),
        params
      });
      setHistory(response.data.history || []);
      return response.data.history || [];
    } catch (error) {
      toast.error('히스토리를 불러오지 못했습니다');
      console.error(error);
      return [];
    } finally {
      setIsHistoryLoading(false);
    }
  }, [apiUrl, getAuthHeader]);

  // Create alert
  const createAlert = useCallback(async (data) => {
    try {
      await axios.post(`${apiUrl}/alerts`, data, {
        headers: getAuthHeader()
      });
      toast.success('알림이 생성되었습니다');
      await loadAlerts();
      return true;
    } catch (error) {
      toast.error('알림 생성 실패');
      console.error(error);
      return false;
    }
  }, [apiUrl, getAuthHeader, loadAlerts]);

  // Update alert
  const updateAlert = useCallback(async (alertId, data) => {
    try {
      await axios.put(`${apiUrl}/alerts/${alertId}`, data, {
        headers: getAuthHeader()
      });
      toast.success('알림이 수정되었습니다');
      await loadAlerts();
      return true;
    } catch (error) {
      toast.error('알림 수정 실패');
      console.error(error);
      return false;
    }
  }, [apiUrl, getAuthHeader, loadAlerts]);

  // Delete alert
  const deleteAlert = useCallback(async (alertId) => {
    try {
      await axios.delete(`${apiUrl}/alerts/${alertId}`, {
        headers: getAuthHeader()
      });
      toast.success('알림이 삭제되었습니다');
      await loadAlerts();
      return true;
    } catch (error) {
      toast.error('알림 삭제 실패');
      console.error(error);
      return false;
    }
  }, [apiUrl, getAuthHeader, loadAlerts]);

  // Toggle alert active status
  const toggleAlert = useCallback(async (alertId, currentStatus) => {
    try {
      await axios.post(`${apiUrl}/alerts/${alertId}/toggle`, {}, {
        headers: getAuthHeader()
      });
      toast.success(currentStatus ? '알림이 비활성화되었습니다' : '알림이 활성화되었습니다');
      await loadAlerts();
      return true;
    } catch (error) {
      toast.error('알림 상태 변경 실패');
      console.error(error);
      return false;
    }
  }, [apiUrl, getAuthHeader, loadAlerts]);

  // Test alert
  const testAlert = useCallback(async (alertId) => {
    try {
      const response = await axios.post(`${apiUrl}/alerts/${alertId}/test`, {}, {
        headers: getAuthHeader()
      });
      toast.success(response.data.message);
      return true;
    } catch (error) {
      toast.error('테스트 발송 실패');
      console.error(error);
      return false;
    }
  }, [apiUrl, getAuthHeader]);

  // Computed statistics
  const statistics = useMemo(() => ({
    total: alerts.length,
    active: alerts.filter(a => a.is_active).length,
    inactive: alerts.filter(a => !a.is_active).length,
    byType: {
      price: alerts.filter(a => a.alert_type === 'price').length,
      technical: alerts.filter(a => a.alert_type === 'technical').length,
      news: alerts.filter(a => a.alert_type === 'news').length
    },
    totalTriggers: alerts.reduce((sum, a) => sum + (a.trigger_count || 0), 0)
  }), [alerts]);

  // Filtered alerts by type
  const priceAlerts = useMemo(() =>
    alerts.filter(a => a.alert_type === 'price'), [alerts]);

  const technicalAlerts = useMemo(() =>
    alerts.filter(a => a.alert_type === 'technical'), [alerts]);

  const newsAlerts = useMemo(() =>
    alerts.filter(a => a.alert_type === 'news'), [alerts]);

  // Active alerts only
  const activeAlerts = useMemo(() =>
    alerts.filter(a => a.is_active), [alerts]);

  // Recent triggers (from history)
  const recentTriggers = useMemo(() =>
    history.slice(0, 10), [history]);

  // Initial load
  useEffect(() => {
    loadAlerts();
    loadHistory();
  }, [loadAlerts, loadHistory]);

  return {
    // Data
    alerts,
    priceAlerts,
    technicalAlerts,
    newsAlerts,
    activeAlerts,
    statistics,
    history,
    recentTriggers,

    // Loading states
    isLoading,
    isHistoryLoading,

    // Actions
    loadAlerts,
    loadHistory,
    createAlert,
    updateAlert,
    deleteAlert,
    toggleAlert,
    testAlert
  };
};

export default useAlerts;
