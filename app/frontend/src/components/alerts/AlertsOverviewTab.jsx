/**
 * Alerts Overview Tab - Data-Focused Layout with Standard Widget Controls
 * Standard Controls: Close, Refresh, Corner Resize
 */
import { useState, useRef, useCallback } from 'react';
import {
  Bell, BellOff, Activity, DollarSign, Newspaper, Zap, Clock,
  CheckCircle, XCircle, PowerOff, Trash2, RefreshCw
} from 'lucide-react';
import { useAlertsContext } from '../../contexts/AlertsContext';
import { WidgetHeader, AddWidgetPlaceholder, ResizeHandle } from '../common/WidgetHeader';

// Resizable Widget Wrapper
function ResizableWidgetWrapper({ children, minWidth = 300, minHeight = 200, defaultHeight = 400 }) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 'auto', height: defaultHeight });

  const handleResize = useCallback((deltaX, deltaY) => {
    setSize(prev => ({
      width: prev.width === 'auto' ? 'auto' : Math.max(minWidth, prev.width + deltaX),
      height: Math.max(minHeight, (prev.height || defaultHeight) + deltaY)
    }));
  }, [minWidth, minHeight, defaultHeight]);

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{
        height: size.height === 'auto' ? 'auto' : `${size.height}px`,
        minHeight: `${minHeight}px`,
      }}
    >
      {children}
      <ResizeHandle onResize={handleResize} />
    </div>
  );
}

// Alert Statistics Widget
function AlertStatisticsWidget({ onRefresh, onClose, loading }) {
  const { statistics, isLoading, refreshAlerts } = useAlertsContext();

  const stats = [
    { label: 'Total Alerts', value: statistics.total, icon: Bell, bgColor: 'bg-blue-500/20', textColor: 'text-blue-400' },
    { label: 'Active', value: statistics.active, icon: Activity, bgColor: 'bg-green-500/20', textColor: 'text-green-400' },
    { label: 'Inactive', value: statistics.inactive, icon: BellOff, bgColor: 'bg-gray-700', textColor: 'text-gray-400' },
    { label: 'Total Triggers', value: statistics.totalTriggers, icon: Zap, bgColor: 'bg-yellow-500/20', textColor: 'text-yellow-400' }
  ];

  const typeStats = [
    { label: 'Price', value: statistics.byType.price, icon: DollarSign, color: 'text-blue-400' },
    { label: 'Technical', value: statistics.byType.technical, icon: Activity, color: 'text-purple-400' },
    { label: 'News', value: statistics.byType.news, icon: Newspaper, color: 'text-green-400' }
  ];

  return (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden h-full flex flex-col">
      <WidgetHeader
        title="Alert Statistics"
        icon={Bell}
        iconColor="text-blue-400"
        onRefresh={onRefresh || refreshAlerts}
        onClose={onClose}
        loading={isLoading || loading}
      />
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="h-[150px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : (
          <>
            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {stats.map((stat) => (
                <div key={stat.label} className={`${stat.bgColor} rounded-lg p-3`}>
                  <div className="flex items-center gap-2 mb-1">
                    <stat.icon className={stat.textColor} size={16} />
                    <span className="text-xs text-gray-400">{stat.label}</span>
                  </div>
                  <p className={`text-xl font-bold ${stat.textColor}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Type Distribution */}
            <div className="border-t border-gray-700 pt-4">
              <p className="text-xs text-gray-500 mb-3">By Type</p>
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
          </>
        )}
      </div>
    </div>
  );
}

// Recent Triggers Widget
function RecentTriggersWidget({ onRefresh, onClose, loading }) {
  const { recentTriggers, isHistoryLoading, refreshAlerts } = useAlertsContext();

  return (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden h-full flex flex-col">
      <WidgetHeader
        title="Recent Triggers"
        icon={Clock}
        iconColor="text-purple-400"
        onRefresh={onRefresh || refreshAlerts}
        onClose={onClose}
        loading={isHistoryLoading || loading}
      />
      <div className="flex-1 overflow-auto">
        {isHistoryLoading ? (
          <div className="h-[150px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
          </div>
        ) : recentTriggers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
            <Clock size={40} className="mb-2 opacity-50" />
            <p className="text-sm">No triggered alerts</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {recentTriggers.map((item) => (
              <div key={item.history_id} className="p-3 hover:bg-gray-800/50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {item.is_sent ? (
                        <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
                      ) : (
                        <XCircle size={14} className="text-red-400 flex-shrink-0" />
                      )}
                      <span className={`text-xs font-medium ${item.is_sent ? 'text-green-400' : 'text-red-400'}`}>
                        {item.is_sent ? 'Sent' : 'Failed'}
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
                        Value: <span className="font-semibold text-white">${item.triggered_value}</span>
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {new Date(item.triggered_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
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

// Active Alerts Widget
function ActiveAlertsWidget({ onRefresh, onClose, loading }) {
  const { activeAlerts, toggleAlert, deleteAlert, isLoading, refreshAlerts } = useAlertsContext();

  const AlertTypeLabels = { price: 'Price', news: 'News', technical: 'Technical' };

  const handleToggle = async (alertId) => {
    await toggleAlert(alertId, true);
  };

  const handleDelete = async (alertId) => {
    if (!confirm('Are you sure you want to delete this alert?')) return;
    await deleteAlert(alertId);
  };

  return (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden h-full flex flex-col">
      <WidgetHeader
        title="Active Alerts"
        icon={Bell}
        iconColor="text-green-400"
        subtitle={`${activeAlerts.length} active`}
        onRefresh={onRefresh || refreshAlerts}
        onClose={onClose}
        loading={isLoading || loading}
      />
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="h-[150px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
          </div>
        ) : activeAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
            <Bell size={40} className="mb-2 opacity-50" />
            <p className="text-sm">No active alerts</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {activeAlerts.map((alert) => (
              <div key={alert.alert_id} className="p-3 hover:bg-gray-800/50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                        {AlertTypeLabels[alert.alert_type] || alert.alert_type}
                      </span>
                      {alert.ticker_cd && (
                        <span className="text-sm font-semibold text-white">{alert.ticker_cd}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {alert.condition_type === 'above' && 'Above'}
                      {alert.condition_type === 'below' && 'Below'}
                      {alert.condition_type === 'percent_change' && 'Change'}{' '}
                      {alert.condition_type === 'percent_change'
                        ? `${alert.threshold_value}%`
                        : `$${alert.threshold_value}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Triggers: {alert.trigger_count}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggle(alert.alert_id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors"
                      title="Deactivate"
                    >
                      <PowerOff size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(alert.alert_id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors"
                      title="Delete"
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

// Main AlertsOverviewTab Component
export default function AlertsOverviewTab() {
  const { refreshAlerts, isLoading } = useAlertsContext();
  const [loading, setLoading] = useState(false);

  // Widget visibility state
  const [visibleWidgets, setVisibleWidgets] = useState({
    statistics: true,
    triggers: true,
    active: true
  });

  const handleRefresh = async () => {
    setLoading(true);
    await refreshAlerts();
    setLoading(false);
  };

  const handleCloseWidget = (widgetId) => {
    setVisibleWidgets(prev => ({ ...prev, [widgetId]: false }));
  };

  const handleAddWidget = (widgetId) => {
    setVisibleWidgets(prev => ({ ...prev, [widgetId]: true }));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Alerts Overview</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300"
          >
            <RefreshCw size={14} className={loading || isLoading ? 'animate-spin' : ''} />
            Refresh All
          </button>
        </div>
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Statistics Widget */}
        <div className="col-span-4">
          {visibleWidgets.statistics ? (
            <ResizableWidgetWrapper minHeight={280} defaultHeight={350}>
              <AlertStatisticsWidget
                onRefresh={handleRefresh}
                onClose={() => handleCloseWidget('statistics')}
                loading={loading}
              />
            </ResizableWidgetWrapper>
          ) : (
            <AddWidgetPlaceholder onAdd={() => handleAddWidget('statistics')} widgetType="statistics" label="Add Statistics Widget" />
          )}
        </div>

        {/* Recent Triggers Widget */}
        <div className="col-span-8">
          {visibleWidgets.triggers ? (
            <ResizableWidgetWrapper minHeight={280} defaultHeight={350}>
              <RecentTriggersWidget
                onRefresh={handleRefresh}
                onClose={() => handleCloseWidget('triggers')}
                loading={loading}
              />
            </ResizableWidgetWrapper>
          ) : (
            <AddWidgetPlaceholder onAdd={() => handleAddWidget('triggers')} widgetType="triggers" label="Add Triggers Widget" />
          )}
        </div>

        {/* Active Alerts Widget - Full Width */}
        <div className="col-span-12">
          {visibleWidgets.active ? (
            <ResizableWidgetWrapper minHeight={250} defaultHeight={400}>
              <ActiveAlertsWidget
                onRefresh={handleRefresh}
                onClose={() => handleCloseWidget('active')}
                loading={loading}
              />
            </ResizableWidgetWrapper>
          ) : (
            <AddWidgetPlaceholder onAdd={() => handleAddWidget('active')} widgetType="active" label="Add Active Alerts Widget" />
          )}
        </div>
      </div>
    </div>
  );
}
