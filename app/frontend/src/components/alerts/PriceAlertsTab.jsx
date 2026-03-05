/**
 * Price Alerts Tab - Data-Focused Layout with Standard Widget Controls
 * Standard Controls: Close, Refresh, Corner Resize
 */
import { useState, useRef, useCallback } from 'react';
import { DollarSign, Bell, Plus, PowerOff, Power, Trash2, Play, RefreshCw } from 'lucide-react';
import { useAlertsContext } from '../../contexts/AlertsContext';
import CreateAlertModal from './CreateAlertModal';
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

// Price Alerts List Widget
function PriceAlertsListWidget({ alerts, onToggle, onDelete, onTest, onCreateClick, loading, onRefresh, onClose }) {
  return (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden h-full flex flex-col">
      <WidgetHeader
        title="Price Alerts"
        icon={DollarSign}
        iconColor="text-blue-400"
        subtitle={`${alerts.length} alerts`}
        onRefresh={onRefresh}
        onClose={onClose}
        loading={loading}
      />
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
            <DollarSign size={48} className="mb-3 opacity-50" />
            <p className="text-sm mb-1">No price alerts</p>
            <p className="text-xs text-gray-600 mb-4">Get notified when stocks reach your target price</p>
            <button
              onClick={onCreateClick}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white"
            >
              <Plus size={16} />
              Create Alert
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#0a0a0f]">
              <tr className="border-b border-gray-800">
                <th className="text-left py-2 px-4 text-gray-400 text-xs font-medium">Symbol</th>
                <th className="text-left py-2 px-4 text-gray-400 text-xs font-medium">Condition</th>
                <th className="text-right py-2 px-4 text-gray-400 text-xs font-medium">Target</th>
                <th className="text-center py-2 px-4 text-gray-400 text-xs font-medium">Status</th>
                <th className="text-right py-2 px-4 text-gray-400 text-xs font-medium">Triggers</th>
                <th className="text-right py-2 px-4 text-gray-400 text-xs font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.alert_id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-3 px-4">
                    <span className="font-semibold text-white">{alert.ticker_cd || '-'}</span>
                  </td>
                  <td className="py-3 px-4 text-gray-400">
                    {alert.condition_type === 'above' && 'Price Above'}
                    {alert.condition_type === 'below' && 'Price Below'}
                    {alert.condition_type === 'percent_change' && 'Change %'}
                  </td>
                  <td className="py-3 px-4 text-right text-white font-medium">
                    {alert.condition_type === 'percent_change'
                      ? `${alert.threshold_value}%`
                      : `$${alert.threshold_value}`}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                      alert.is_active
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-gray-700 text-gray-400'
                    }`}>
                      {alert.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-400">{alert.trigger_count || 0}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onTest(alert.alert_id)}
                        className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                        title="Test Alert"
                      >
                        <Play size={14} />
                      </button>
                      <button
                        onClick={() => onToggle(alert.alert_id, alert.is_active)}
                        className={`p-1.5 rounded transition-colors ${
                          alert.is_active
                            ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/20'
                            : 'text-gray-500 hover:text-green-400 hover:bg-green-500/20'
                        }`}
                        title={alert.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {alert.is_active ? <PowerOff size={14} /> : <Power size={14} />}
                      </button>
                      <button
                        onClick={() => onDelete(alert.alert_id)}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {alerts.length > 0 && (
        <div className="p-3 border-t border-gray-800 shrink-0">
          <button
            onClick={onCreateClick}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white"
          >
            <Plus size={14} />
            Create Alert
          </button>
        </div>
      )}
    </div>
  );
}

// Main PriceAlertsTab Component
export default function PriceAlertsTab() {
  const { priceAlerts, toggleAlert, deleteAlert, testAlert, createAlert, refreshAlerts, isLoading } = useAlertsContext();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Widget visibility state
  const [visibleWidgets, setVisibleWidgets] = useState({
    alertsList: true
  });

  const handleToggle = async (alertId, currentStatus) => {
    await toggleAlert(alertId, currentStatus);
  };

  const handleDelete = async (alertId) => {
    if (!confirm('Are you sure you want to delete this alert?')) return;
    await deleteAlert(alertId);
  };

  const handleTest = async (alertId) => {
    await testAlert(alertId);
  };

  const handleCreate = async (data) => {
    const success = await createAlert(data);
    if (success) {
      setShowCreateModal(false);
    }
  };

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
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Price Alerts</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300"
            >
              <RefreshCw size={14} className={loading || isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Widget Grid */}
        <div className="grid grid-cols-12 gap-4">
          {/* Price Alerts List Widget - Full Width */}
          <div className="col-span-12">
            {visibleWidgets.alertsList ? (
              <ResizableWidgetWrapper minHeight={300} defaultHeight={500}>
                <PriceAlertsListWidget
                  alerts={priceAlerts}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onTest={handleTest}
                  onCreateClick={() => setShowCreateModal(true)}
                  loading={loading || isLoading}
                  onRefresh={handleRefresh}
                  onClose={() => handleCloseWidget('alertsList')}
                />
              </ResizableWidgetWrapper>
            ) : (
              <AddWidgetPlaceholder onAdd={() => handleAddWidget('alertsList')} widgetType="alertsList" label="Add Price Alerts Widget" />
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateAlertModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
          initialAlertType="price"
        />
      )}
    </>
  );
}
