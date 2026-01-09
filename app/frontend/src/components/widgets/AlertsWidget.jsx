/**
 * 알림 위젯
 */
import { useState, useEffect } from 'react';
import { Bell, BellOff, Plus, Trash2, Edit2, TrendingUp, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { alertsAPI } from '../../lib/api';
import Card from './common/Card';
import WidgetHeader from './common/WidgetHeader';

export default function AlertsWidget({ onRemove }) {
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAlert, setEditingAlert] = useState(null);

  const [formData, setFormData] = useState({
    symbol: '',
    condition_type: 'price_above',
    target_value: '',
    message: '',
    is_active: true,
  });

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      setIsLoading(true);
      const response = await alertsAPI.getAll();
      setAlerts(response.data);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAlert = async () => {
    if (!formData.symbol || !formData.target_value) {
      toast.error('Fill in all required fields');
      return;
    }

    try {
      if (editingAlert) {
        await alertsAPI.update(editingAlert.alert_id, formData);
        toast.success('Alert updated');
      } else {
        await alertsAPI.create(formData);
        toast.success('Alert created');
      }

      setShowCreateModal(false);
      resetForm();
      loadAlerts();
    } catch (error) {
      toast.error('Failed to save alert');
      console.error(error);
    }
  };

  const handleEditAlert = (alert) => {
    setEditingAlert(alert);
    setFormData({
      symbol: alert.symbol,
      condition_type: alert.condition_type,
      target_value: alert.target_value,
      message: alert.message || '',
      is_active: alert.is_active,
    });
    setShowCreateModal(true);
  };

  const handleDeleteAlert = async (alertId) => {
    if (!confirm('Delete this alert?')) return;

    try {
      await alertsAPI.delete(alertId);
      toast.success('Alert deleted');
      loadAlerts();
    } catch (error) {
      toast.error('Failed to delete alert');
      console.error(error);
    }
  };

  const handleToggleActive = async (alert) => {
    try {
      await alertsAPI.update(alert.alert_id, {
        is_active: !alert.is_active,
      });
      loadAlerts();
    } catch (error) {
      toast.error('Failed to update alert');
      console.error(error);
    }
  };

  const resetForm = () => {
    setFormData({
      symbol: '',
      condition_type: 'price_above',
      target_value: '',
      message: '',
      is_active: true,
    });
    setEditingAlert(null);
  };

  const getConditionText = (conditionType) => {
    const conditions = {
      price_above: 'Above',
      price_below: 'Below',
      price_change_up: 'Up',
      price_change_down: 'Down',
      volume_above: 'Vol>',
    };
    return conditions[conditionType] || conditionType;
  };

  return (
    <Card className="h-full flex flex-col">
      <WidgetHeader
        title="Price Alerts"
        icon={Bell}
        onRemove={onRemove}
      >
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="p-1 text-blue-400 hover:text-blue-300 rounded transition-colors"
        >
          <Plus size={16} />
        </button>
      </WidgetHeader>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="mx-auto text-gray-400 mb-2" size={32} />
            <p className="text-sm text-gray-500 mb-3">No alerts yet</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Create Alert
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.alert_id}
                className={`p-3 bg-gray-50 rounded-lg ${!alert.is_active ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-gray-900">
                        {alert.symbol}
                      </span>
                      <span className="text-xs text-gray-600">
                        {getConditionText(alert.condition_type)}
                      </span>
                      <span className="text-xs font-semibold text-gray-900">
                        ${parseFloat(alert.target_value).toFixed(2)}
                      </span>
                    </div>
                    {alert.message && (
                      <p className="text-xs text-gray-600 mb-1">{alert.message}</p>
                    )}
                    <div className="flex items-center gap-2">
                      {alert.is_active ? (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                          Active
                        </span>
                      ) : (
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleActive(alert)}
                      className={`p-1 rounded transition-colors ${
                        alert.is_active
                          ? 'text-green-600 hover:bg-green-50'
                          : 'text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      {alert.is_active ? <Bell size={14} /> : <BellOff size={14} />}
                    </button>
                    <button
                      onClick={() => handleEditAlert(alert)}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteAlert(alert.alert_id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
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

      {/* Create/Edit Alert Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingAlert ? 'Edit Alert' : 'New Alert'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Symbol
                </label>
                <input
                  type="text"
                  placeholder="e.g., AAPL"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Condition
                </label>
                <select
                  value={formData.condition_type}
                  onChange={(e) => setFormData({ ...formData, condition_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="price_above">Price Above</option>
                  <option value="price_below">Price Below</option>
                  <option value="price_change_up">Price Up By (%)</option>
                  <option value="price_change_down">Price Down By (%)</option>
                  <option value="volume_above">Volume Above</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Value
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Enter target"
                  value={formData.target_value}
                  onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message (Optional)
                </label>
                <textarea
                  placeholder="Add a note"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  Active
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateAlert}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
              >
                {editingAlert ? 'Update' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
