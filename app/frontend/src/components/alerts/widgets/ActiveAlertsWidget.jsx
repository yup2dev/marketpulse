/**
 * 활성 알림 위젯 (다크 테마)
 */
import { Bell, PowerOff, Trash2 } from 'lucide-react';
import { useAlertsContext } from '../../../contexts/AlertsContext';

const AlertTypeLabels = {
  price: '가격',
  news: '뉴스',
  technical: '기술적'
};

export default function ActiveAlertsWidget({ onRemove }) {
  const { activeAlerts, toggleAlert, deleteAlert, isLoading } = useAlertsContext();

  const handleToggle = async (alertId) => {
    await toggleAlert(alertId, true);
  };

  const handleDelete = async (alertId) => {
    if (!confirm('정말 이 알림을 삭제하시겠습니까?')) return;
    await deleteAlert(alertId);
  };

  if (isLoading) {
    return (
      <div className="h-full bg-[#1a1f2e] rounded-xl shadow-sm border border-gray-700 p-4">
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#1a1f2e] rounded-xl shadow-sm border border-gray-700 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 drag-handle-area cursor-move">
        <div className="flex items-center gap-2">
          <Bell className="text-green-500" size={20} />
          <h3 className="font-semibold text-white">활성 알림</h3>
          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
            {activeAlerts.length}
          </span>
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-gray-500 hover:text-gray-300 text-lg leading-none"
          >
            &times;
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
            <Bell size={40} className="mb-2 opacity-50" />
            <p className="text-sm">활성화된 알림이 없습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {activeAlerts.map((alert) => (
              <div
                key={alert.alert_id}
                className="p-3 hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                        {AlertTypeLabels[alert.alert_type] || alert.alert_type}
                      </span>
                      {alert.ticker_cd && (
                        <span className="text-sm font-semibold text-white">
                          {alert.ticker_cd}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-400">
                      {alert.condition_type === 'above' && '이상'}
                      {alert.condition_type === 'below' && '이하'}
                      {alert.condition_type === 'percent_change' && '변동률'}
                      {' '}
                      {alert.condition_type === 'percent_change'
                        ? `${alert.threshold_value}%`
                        : `$${alert.threshold_value}`}
                    </p>

                    <p className="text-xs text-gray-500 mt-1">
                      발생: {alert.trigger_count}회
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggle(alert.alert_id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors"
                      title="비활성화"
                    >
                      <PowerOff size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(alert.alert_id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors"
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
