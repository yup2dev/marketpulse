/**
 * Alert Statistics Widget - Shows alert summary statistics
 */
import { useState, useEffect } from 'react';
import { BarChart3, Bell, BellOff, AlertTriangle } from 'lucide-react';
import { WidgetHeader, WIDGET_STYLES, WIDGET_ICON_COLORS } from './common';
import { API_BASE } from '../../config/api';

export default function AlertStatisticsWidget({ onRemove }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/alerts/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading alert stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statItems = stats ? [
    { label: '전체 알림', value: stats.total || 0, icon: Bell, color: 'text-blue-400' },
    { label: '활성 알림', value: stats.active || 0, icon: Bell, color: 'text-green-400' },
    { label: '비활성 알림', value: stats.inactive || 0, icon: BellOff, color: 'text-gray-400' },
    { label: '발동 횟수', value: stats.triggered || 0, icon: AlertTriangle, color: 'text-yellow-400' },
  ] : [];

  return (
    <div className={WIDGET_STYLES.container}>
      <WidgetHeader
        icon={BarChart3}
        iconColor={WIDGET_ICON_COLORS.metrics}
        title="알림 통계"
        onRefresh={loadStats}
        onRemove={onRemove}
        loading={loading}
      />
      <div className={`${WIDGET_STYLES.content} p-4`}>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {statItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={16} className={item.color} />
                    <span className="text-gray-400 text-sm">{item.label}</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{item.value}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
