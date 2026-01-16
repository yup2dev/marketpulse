/**
 * 알림 리스트 뷰 컴포넌트
 * 재사용 가능한 알림 카드 그리드 (다크 테마)
 */
import { Bell, Plus, Trash2, Power, PowerOff, TestTube } from 'lucide-react';

const AlertTypeLabels = {
  price: '가격',
  news: '뉴스',
  technical: '기술적'
};

const ConditionLabels = {
  above: '이상',
  below: '이하',
  percent_change: '변동률'
};

export default function AlertsListView({
  alerts,
  onToggle,
  onDelete,
  onTest,
  onCreateClick,
  title,
  subtitle,
  emptyMessage = '알림이 없습니다',
  emptySubMessage = '첫 번째 알림을 만들어 중요한 변화를 놓치지 마세요',
  showCreateButton = true
}) {
  const getAlertTypeLabel = (type) => AlertTypeLabels[type] || type;
  const getConditionLabel = (condition) => ConditionLabels[condition] || condition;

  return (
    <div className="space-y-6">
      {/* Header */}
      {(title || showCreateButton) && (
        <div className="flex items-center justify-between">
          {title && (
            <div className="flex items-center gap-3">
              <Bell className="text-blue-500" size={28} />
              <div>
                <h2 className="text-xl font-bold text-white">{title}</h2>
                {subtitle && (
                  <p className="text-gray-400 text-sm mt-0.5">{subtitle}</p>
                )}
              </div>
            </div>
          )}
          {showCreateButton && (
            <button
              onClick={onCreateClick}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              <span>새 알림</span>
            </button>
          )}
        </div>
      )}

      {/* Alerts List */}
      {alerts.length === 0 ? (
        <div className="bg-[#1a1f2e] rounded-xl shadow-sm p-12 text-center border border-gray-700">
          <Bell className="mx-auto text-gray-500 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-white mb-2">
            {emptyMessage}
          </h3>
          <p className="text-gray-400 mb-6">{emptySubMessage}</p>
          {showCreateButton && (
            <button
              onClick={onCreateClick}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              알림 만들기
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {alerts.map((alert) => (
            <div
              key={alert.alert_id}
              className={`bg-[#1a1f2e] rounded-xl shadow-sm p-6 border-2 transition-all ${
                alert.is_active
                  ? 'border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10'
                  : 'border-gray-700 opacity-60'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium mb-2 ${
                    alert.is_active
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-gray-700 text-gray-400'
                  }`}>
                    {alert.is_active ? '활성' : '비활성'}
                  </span>
                  <h3 className="font-semibold text-white">
                    {getAlertTypeLabel(alert.alert_type)} 알림
                  </h3>
                </div>
                <button
                  onClick={() => onToggle(alert.alert_id, alert.is_active)}
                  className={`p-2 rounded-lg transition-colors ${
                    alert.is_active
                      ? 'hover:bg-red-500/20 text-red-400'
                      : 'hover:bg-green-500/20 text-green-400'
                  }`}
                  title={alert.is_active ? '비활성화' : '활성화'}
                >
                  {alert.is_active ? <PowerOff size={18} /> : <Power size={18} />}
                </button>
              </div>

              {/* Content */}
              <div className="space-y-2 mb-4">
                {alert.ticker_cd && (
                  <p className="text-sm text-gray-400">
                    종목: <span className="font-semibold text-white">{alert.ticker_cd}</span>
                  </p>
                )}
                <p className="text-sm text-gray-400">
                  조건: <span className="font-semibold text-white">
                    {getConditionLabel(alert.condition_type)} ${alert.threshold_value}
                  </span>
                </p>
                <p className="text-sm text-gray-400">
                  발송: <span className="font-semibold text-white">{alert.notification_method}</span>
                </p>
                {alert.message && (
                  <p className="text-sm text-gray-400 mt-2 p-2 bg-gray-800 rounded">
                    {alert.message}
                  </p>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-700 text-xs text-gray-500">
                <span>발생: {alert.trigger_count}회</span>
                {alert.last_triggered && (
                  <span>{new Date(alert.last_triggered).toLocaleDateString('ko-KR')}</span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => onTest(alert.alert_id)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <TestTube size={14} />
                  <span>테스트</span>
                </button>
                <button
                  onClick={() => onDelete(alert.alert_id)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 size={14} />
                  <span>삭제</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
