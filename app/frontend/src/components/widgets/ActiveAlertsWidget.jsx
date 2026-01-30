/**
 * Active Alerts Widget - Shows all active alerts
 */
import { useState, useEffect } from 'react';
import { Bell, Power, PowerOff, Trash2, TestTube } from 'lucide-react';
import { WidgetHeader, WIDGET_STYLES, WIDGET_ICON_COLORS } from './common';
import { API_BASE } from '../../config/api';

export default function ActiveAlertsWidget({ onRemove }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/alerts?active=true`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || data || []);
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (alertId, isActive) => {
    try {
      await fetch(`${API_BASE}/alerts/${alertId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive })
      });
      loadAlerts();
    } catch (error) {
      console.error('Error toggling alert:', error);
    }
  };

  const handleDelete = async (alertId) => {
    if (!confirm('이 알림을 삭제하시겠습니까?')) return;
    try {
      await fetch(`${API_BASE}/alerts/${alertId}`, { method: 'DELETE' });
      loadAlerts();
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  };

  const handleTest = async (alertId) => {
    try {
      await fetch(`${API_BASE}/alerts/${alertId}/test`, { method: 'POST' });
    } catch (error) {
      console.error('Error testing alert:', error);
    }
  };

  const getAlertTypeLabel = (type) => {
    const labels = { price: '가격', technical: '기술적', news: '뉴스' };
    return labels[type] || type;
  };

  const getAlertTypeColor = (type) => {
    switch (type) {
      case 'price': return 'text-blue-400 bg-blue-400/20';
      case 'technical': return 'text-purple-400 bg-purple-400/20';
      case 'news': return 'text-green-400 bg-green-400/20';
      default: return 'text-gray-400 bg-gray-400/20';
    }
  };

  return (
    <div className={WIDGET_STYLES.container}>
      <WidgetHeader
        icon={Bell}
        iconColor={WIDGET_ICON_COLORS.info}
        title="활성 알림"
        subtitle={`${alerts.length}개 활성`}
        onRefresh={loadAlerts}
        onRemove={onRemove}
        loading={loading}
      />
      <div className={`${WIDGET_STYLES.content} p-0`}>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Bell size={32} className="mb-2 opacity-50" />
            <p className="text-sm">활성화된 알림이 없습니다</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/50 sticky top-0">
                <tr>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">상태</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">종목</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">유형</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">조건</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">발동</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">작업</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.alert_id} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="py-3 px-4">
                      <span className={`inline-block w-2 h-2 rounded-full ${
                        alert.is_active ? 'bg-green-400' : 'bg-gray-500'
                      }`} />
                    </td>
                    <td className="py-3 px-4 text-white font-medium">
                      {alert.ticker_cd || alert.symbol || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs ${getAlertTypeColor(alert.alert_type)}`}>
                        {getAlertTypeLabel(alert.alert_type)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {alert.condition_type} ${alert.threshold_value}
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-right">
                      {alert.trigger_count || 0}회
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleToggle(alert.alert_id, alert.is_active)}
                          className="p-1.5 rounded hover:bg-gray-700 transition-colors"
                          title={alert.is_active ? '비활성화' : '활성화'}
                        >
                          {alert.is_active ? (
                            <PowerOff size={14} className="text-red-400" />
                          ) : (
                            <Power size={14} className="text-green-400" />
                          )}
                        </button>
                        <button
                          onClick={() => handleTest(alert.alert_id)}
                          className="p-1.5 rounded hover:bg-gray-700 transition-colors"
                          title="테스트"
                        >
                          <TestTube size={14} className="text-blue-400" />
                        </button>
                        <button
                          onClick={() => handleDelete(alert.alert_id)}
                          className="p-1.5 rounded hover:bg-gray-700 transition-colors"
                          title="삭제"
                        >
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
