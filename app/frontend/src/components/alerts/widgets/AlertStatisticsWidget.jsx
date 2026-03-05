/**
 * 알림 통계 위젯 (다크 테마)
 */
import { Bell, BellOff, Activity, DollarSign, Newspaper, Zap } from 'lucide-react';
import { useAlertsContext } from '../../../contexts/AlertsContext';

export default function AlertStatisticsWidget({ onRemove }) {
  const { statistics, isLoading } = useAlertsContext();

  if (isLoading) {
    return (
      <div className="h-full bg-[#1a1f2e] rounded-xl shadow-sm border border-gray-700 p-4">
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: '전체 알림',
      value: statistics.total,
      icon: Bell,
      bgColor: 'bg-blue-500/20',
      textColor: 'text-blue-400'
    },
    {
      label: '활성',
      value: statistics.active,
      icon: Activity,
      bgColor: 'bg-green-500/20',
      textColor: 'text-green-400'
    },
    {
      label: '비활성',
      value: statistics.inactive,
      icon: BellOff,
      bgColor: 'bg-gray-700',
      textColor: 'text-gray-400'
    },
    {
      label: '총 트리거',
      value: statistics.totalTriggers,
      icon: Zap,
      bgColor: 'bg-yellow-500/20',
      textColor: 'text-yellow-400'
    }
  ];

  const typeStats = [
    {
      label: '가격',
      value: statistics.byType.price,
      icon: DollarSign,
      color: 'text-blue-400'
    },
    {
      label: '기술적',
      value: statistics.byType.technical,
      icon: Activity,
      color: 'text-purple-400'
    },
    {
      label: '뉴스',
      value: statistics.byType.news,
      icon: Newspaper,
      color: 'text-green-400'
    }
  ];

  return (
    <div className="h-full bg-[#1a1f2e] rounded-xl shadow-sm border border-gray-700 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 drag-handle-area cursor-move">
        <div className="flex items-center gap-2">
          <Bell className="text-blue-500" size={20} />
          <h3 className="font-semibold text-white">알림 통계</h3>
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
      <div className="flex-1 p-4 overflow-auto">
        {/* Main Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`${stat.bgColor} rounded-lg p-3`}
            >
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={stat.textColor} size={16} />
                <span className="text-xs text-gray-400">{stat.label}</span>
              </div>
              <p className={`text-xl font-bold ${stat.textColor}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Type Distribution */}
        <div className="border-t border-gray-700 pt-4">
          <p className="text-xs text-gray-500 mb-3">유형별 분포</p>
          <div className="space-y-2">
            {typeStats.map((type) => (
              <div key={type.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <type.icon className={type.color} size={14} />
                  <span className="text-sm text-gray-300">{type.label}</span>
                </div>
                <span className="text-sm font-semibold text-white">{type.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
