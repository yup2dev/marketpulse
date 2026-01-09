/**
 * 알림 생성 모달
 */
import { useState } from 'react';
import { X } from 'lucide-react';

export default function CreateAlertModal({ onClose, onCreate }) {
  const [formData, setFormData] = useState({
    alert_type: 'price',
    ticker_cd: '',
    condition_type: 'above',
    threshold_value: '',
    notification_method: 'email',
    message: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate(formData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">새 알림 만들기</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Alert Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              알림 유형
            </label>
            <select
              name="alert_type"
              value={formData.alert_type}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="price">가격</option>
              <option value="news">뉴스</option>
              <option value="technical">기술적</option>
            </select>
          </div>

          {/* Ticker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              종목 코드
            </label>
            <input
              type="text"
              name="ticker_cd"
              value={formData.ticker_cd}
              onChange={handleChange}
              placeholder="예: AAPL"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Condition Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              조건
            </label>
            <select
              name="condition_type"
              value={formData.condition_type}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="above">이상</option>
              <option value="below">이하</option>
              <option value="percent_change">변동률</option>
            </select>
          </div>

          {/* Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              기준 값
            </label>
            <input
              type="number"
              step="0.01"
              name="threshold_value"
              value={formData.threshold_value}
              onChange={handleChange}
              placeholder="예: 200.00"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Notification Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              알림 방법
            </label>
            <select
              name="notification_method"
              value={formData.notification_method}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="email">이메일</option>
              <option value="push">푸시</option>
              <option value="both">이메일 + 푸시</option>
            </select>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              메시지 (선택사항)
            </label>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows={3}
              placeholder="알림 메시지를 입력하세요"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              생성
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
