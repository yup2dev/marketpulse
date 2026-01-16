/**
 * 최근 트리거 위젯 (다크 테마)
 */
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { useAlertsContext } from '../../../contexts/AlertsContext';

export default function RecentTriggersWidget({ onRemove }) {
  const { recentTriggers, isHistoryLoading } = useAlertsContext();

  if (isHistoryLoading) {
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
          <Clock className="text-blue-500" size={20} />
          <h3 className="font-semibold text-white">최근 트리거</h3>
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
        {recentTriggers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
            <Clock size={40} className="mb-2 opacity-50" />
            <p className="text-sm">트리거된 알림이 없습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {recentTriggers.map((item) => (
              <div
                key={item.history_id}
                className="p-3 hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {item.is_sent ? (
                        <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
                      ) : (
                        <XCircle size={14} className="text-red-400 flex-shrink-0" />
                      )}
                      <span className={`text-xs font-medium ${
                        item.is_sent ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {item.is_sent ? '발송 성공' : '발송 실패'}
                      </span>
                    </div>

                    {item.alert_info && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                          {item.alert_info.alert_type}
                        </span>
                        {item.alert_info.ticker_cd && (
                          <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
                            {item.alert_info.ticker_cd}
                          </span>
                        )}
                      </div>
                    )}

                    {item.triggered_value !== null && (
                      <p className="text-xs text-gray-400">
                        값: <span className="font-semibold text-white">${item.triggered_value}</span>
                      </p>
                    )}
                  </div>

                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {new Date(item.triggered_at).toLocaleDateString('ko-KR', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
