/**
 * 알림 관리 컴포넌트
 * 알림 생성, 조회, 수정, 삭제 및 히스토리 관리
 */
import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, Power, PowerOff, TestTube, History } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import CreateAlertModal from './CreateAlertModal';
import AlertHistoryModal from './AlertHistoryModal';

export default function AlertsManager() {
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/alerts`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setAlerts(response.data);
    } catch (error) {
      toast.error('알림 목록을 불러오지 못했습니다');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAlert = async (data) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${import.meta.env.VITE_API_URL}/alerts`,
        data,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('알림이 생성되었습니다');
      setShowCreateModal(false);
      loadAlerts();
    } catch (error) {
      toast.error('알림 생성 실패');
      console.error(error);
    }
  };

  const handleToggleAlert = async (alertId, currentStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${import.meta.env.VITE_API_URL}/alerts/${alertId}/toggle`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success(currentStatus ? '알림이 비활성화되었습니다' : '알림이 활성화되었습니다');
      loadAlerts();
    } catch (error) {
      toast.error('알림 상태 변경 실패');
      console.error(error);
    }
  };

  const handleDeleteAlert = async (alertId) => {
    if (!confirm('정말 이 알림을 삭제하시겠습니까?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/alerts/${alertId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('알림이 삭제되었습니다');
      loadAlerts();
    } catch (error) {
      toast.error('알림 삭제 실패');
      console.error(error);
    }
  };

  const handleTestAlert = async (alertId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/alerts/${alertId}/test`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success(response.data.message);
    } catch (error) {
      toast.error('테스트 발송 실패');
      console.error(error);
    }
  };

  const getAlertTypeLabel = (type) => {
    const types = {
      price: '가격',
      news: '뉴스',
      technical: '기술적'
    };
    return types[type] || type;
  };

  const getConditionLabel = (condition) => {
    const conditions = {
      above: '이상',
      below: '이하',
      percent_change: '변동률'
    };
    return conditions[condition] || condition;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="text-blue-600" size={32} />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">알림 관리</h2>
            <p className="text-gray-600 mt-1">
              가격, 뉴스, 기술적 지표 알림을 설정하세요
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <History size={18} />
            <span>히스토리</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            <span>새 알림</span>
          </button>
        </div>
      </div>

      {/* Alerts List */}
      {alerts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
          <Bell className="mx-auto text-gray-400 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            알림이 없습니다
          </h3>
          <p className="text-gray-600 mb-6">
            첫 번째 알림을 만들어 중요한 변화를 놓치지 마세요
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            알림 만들기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {alerts.map((alert) => (
            <div
              key={alert.alert_id}
              className={`bg-white rounded-xl shadow-sm p-6 border-2 transition-all ${
                alert.is_active
                  ? 'border-blue-200 hover:shadow-md'
                  : 'border-gray-200 opacity-60'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium mb-2 ${
                    alert.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {alert.is_active ? '활성' : '비활성'}
                  </span>
                  <h3 className="font-semibold text-gray-900">
                    {getAlertTypeLabel(alert.alert_type)} 알림
                  </h3>
                </div>
                <button
                  onClick={() => handleToggleAlert(alert.alert_id, alert.is_active)}
                  className={`p-2 rounded-lg transition-colors ${
                    alert.is_active
                      ? 'hover:bg-red-50 text-red-600'
                      : 'hover:bg-green-50 text-green-600'
                  }`}
                  title={alert.is_active ? '비활성화' : '활성화'}
                >
                  {alert.is_active ? <PowerOff size={18} /> : <Power size={18} />}
                </button>
              </div>

              {/* Content */}
              <div className="space-y-2 mb-4">
                {alert.ticker_cd && (
                  <p className="text-sm text-gray-600">
                    종목: <span className="font-semibold text-gray-900">{alert.ticker_cd}</span>
                  </p>
                )}
                <p className="text-sm text-gray-600">
                  조건: <span className="font-semibold text-gray-900">
                    {getConditionLabel(alert.condition_type)} ${alert.threshold_value}
                  </span>
                </p>
                <p className="text-sm text-gray-600">
                  발송: <span className="font-semibold text-gray-900">{alert.notification_method}</span>
                </p>
                {alert.message && (
                  <p className="text-sm text-gray-600 mt-2 p-2 bg-gray-50 rounded">
                    {alert.message}
                  </p>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs text-gray-500">
                <span>발생: {alert.trigger_count}회</span>
                {alert.last_triggered && (
                  <span>{new Date(alert.last_triggered).toLocaleDateString('ko-KR')}</span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleTestAlert(alert.alert_id)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <TestTube size={14} />
                  <span>테스트</span>
                </button>
                <button
                  onClick={() => handleDeleteAlert(alert.alert_id)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} />
                  <span>삭제</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateAlertModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateAlert}
        />
      )}

      {showHistoryModal && (
        <AlertHistoryModal
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  );
}
