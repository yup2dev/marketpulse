/**
 * 알림 히스토리 모달
 */
import { useState, useEffect } from 'react';
import { X, Clock, CheckCircle, XCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function AlertHistoryModal({ onClose, alertId = null }) {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [alertId]);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const params = alertId ? { alert_id: alertId, limit: 50 } : { limit: 50 };

      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/alerts/history`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params
        }
      );
      setHistory(response.data.history || []);
    } catch (error) {
      toast.error('히스토리를 불러오지 못했습니다');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Clock className="text-blue-600" size={24} />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">알림 히스토리</h2>
              <p className="text-sm text-gray-600 mt-1">
                {alertId ? '특정 알림의 발생 이력' : '모든 알림의 발생 이력'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Clock size={64} className="mb-4 opacity-50" />
              <p>발생한 알림이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((item) => (
                <div
                  key={item.history_id}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {item.is_sent ? (
                          <CheckCircle size={16} className="text-green-600" />
                        ) : (
                          <XCircle size={16} className="text-red-600" />
                        )}
                        <span className={`text-sm font-medium ${
                          item.is_sent ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {item.is_sent ? '발송 성공' : '발송 실패'}
                        </span>
                      </div>
                      {item.alert_info && (
                        <div className="flex gap-2 text-xs text-gray-600 mb-2">
                          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            {item.alert_info.alert_type}
                          </span>
                          {item.alert_info.ticker_cd && (
                            <span className="bg-gray-200 text-gray-800 px-2 py-0.5 rounded">
                              {item.alert_info.ticker_cd}
                            </span>
                          )}
                          <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                            {item.alert_info.condition_type}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      {new Date(item.triggered_at).toLocaleString('ko-KR')}
                    </div>
                  </div>

                  {item.message && (
                    <div className="bg-white p-3 rounded border border-gray-200 text-sm text-gray-700">
                      {item.message}
                    </div>
                  )}

                  {item.triggered_value !== null && (
                    <div className="mt-2 text-sm text-gray-600">
                      발생 값: <span className="font-semibold">${item.triggered_value}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>총 {history.length}개의 발생 이력</span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
