/**
 * Recent Triggers Widget - Shows recently triggered alerts
 */
import { useState, useEffect } from 'react';
import { AlertTriangle, Bell, Clock } from 'lucide-react';
import { WidgetHeader, WIDGET_STYLES, WIDGET_ICON_COLORS, formatDate } from './common';
import { API_BASE } from '../../config/api';

export default function RecentTriggersWidget({ onRemove }) {
  const [triggers, setTriggers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTriggers();
  }, []);

  const loadTriggers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/alerts/triggers?limit=10`);
      if (res.ok) {
        const data = await res.json();
        setTriggers(data.triggers || []);
      }
    } catch (error) {
      console.error('Error loading triggers:', error);
    } finally {
      setLoading(false);
    }
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
        icon={AlertTriangle}
        iconColor={WIDGET_ICON_COLORS.chart}
        title="최근 발동된 알림"
        onRefresh={loadTriggers}
        onRemove={onRemove}
        loading={loading}
      />
      <div className={`${WIDGET_STYLES.content} p-0`}>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : triggers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Bell size={32} className="mb-2 opacity-50" />
            <p className="text-sm">최근 발동된 알림이 없습니다</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/50 sticky top-0">
                <tr>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">종목</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">유형</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">조건</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">시간</th>
                </tr>
              </thead>
              <tbody>
                {triggers.map((trigger, idx) => (
                  <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="py-3 px-4 text-white font-medium">
                      {trigger.ticker_cd || trigger.symbol || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs ${getAlertTypeColor(trigger.alert_type)}`}>
                        {trigger.alert_type || 'alert'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {trigger.condition || trigger.message || '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Clock size={12} />
                        {trigger.triggered_at ? formatDate(trigger.triggered_at) : '-'}
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
