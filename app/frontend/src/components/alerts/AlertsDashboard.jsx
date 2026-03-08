/**
 * Alerts Management Dashboard
 * (All sub-components inlined: AlertHistoryModal, CreateAlertModal,
 *  AlertsOverviewTab, PriceAlertsTab, TechnicalAlertsTab, NewsAlertsTab)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, BellOff, LayoutDashboard, DollarSign, Activity, Newspaper,
  History, Zap, Clock, CheckCircle, XCircle, PowerOff, Trash2,
  RefreshCw, Plus, Power, Play, TrendingUp, TrendingDown, Percent, X
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { AlertsProvider } from '../../contexts/AlertsContext';
import { useAlertsContext } from '../../contexts/AlertsContext';
import StockSelector from '../common/StockSelector';
import { TECHNICAL_INDICATORS } from '../widgets/common/widgetConfig';
import { WidgetHeader, AddWidgetPlaceholder, ResizeHandle } from '../common/WidgetHeader';

// ─── Tab config ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', name: 'Overview', icon: LayoutDashboard },
  { id: 'price', name: 'Price Alerts', icon: DollarSign },
  { id: 'technical', name: 'Technical Alerts', icon: Activity },
  { id: 'news', name: 'News Alerts', icon: Newspaper }
];

// ─── Shared: ResizableWidgetWrapper ────────────────────────────────────────────

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

// ─── AlertHistoryModal ──────────────────────────────────────────────────────────

function AlertHistoryModal({ onClose, alertId = null }) {
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

// ─── CreateAlertModal ───────────────────────────────────────────────────────────

function CreateAlertModal({ onClose, onCreate, initialAlertType = null }) {
  // initialAlertType이 제공되면 step 1을 건너뜀
  const [step, setStep] = useState(initialAlertType ? 2 : 1);
  const [formData, setFormData] = useState({
    alert_type: initialAlertType || 'price',
    ticker_cd: '',
    ticker_name: '',
    condition_type: 'above',
    threshold_value: '',
    notification_method: 'email',
    message: '',
    technical_indicator: '' // 기술지표용
  });

  const handleStockSelect = (stock) => {
    setFormData(prev => ({
      ...prev,
      ticker_cd: stock.symbol,
      ticker_name: stock.name
    }));
    setStep(3);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // 기술지표 알림의 경우 메시지에 지표 정보 추가
    const submitData = { ...formData };
    if (formData.alert_type === 'technical' && formData.technical_indicator) {
      const indicator = TECHNICAL_INDICATORS.find(ind => ind.id === formData.technical_indicator);
      submitData.message = `${indicator?.name} ${formData.condition_type === 'above' ? '상승' : '하락'} - ${submitData.message}`;
    }

    onCreate(submitData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 기술지표 타입별 필터링
  const technicalIndicatorsByType = {
    overlay: TECHNICAL_INDICATORS.filter(ind => ind.type === 'overlay'),
    oscillator: TECHNICAL_INDICATORS.filter(ind => ind.type === 'oscillator'),
    separate: TECHNICAL_INDICATORS.filter(ind => ind.type === 'separate')
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Bell className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">새 알림 만들기</h2>
              <p className="text-sm text-gray-600">
                {step === 1 && '알림 유형을 선택하세요'}
                {step === 2 && '종목을 선택하세요'}
                {step === 3 && '알림 조건을 설정하세요'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 py-4 px-6 bg-gray-50 border-b border-gray-200">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                step >= s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {s}
              </div>
              {s < 3 && (
                <div className={`w-12 h-1 mx-2 rounded transition-all ${
                  step > s ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Step 1: Alert Type Selection */}
            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">알림 유형 선택</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      type: 'price',
                      label: '가격 알림',
                      description: '특정 가격 도달 시',
                      icon: DollarSign,
                      color: 'blue'
                    },
                    {
                      type: 'technical',
                      label: '기술적 알림',
                      description: '기술지표 조건 충족 시',
                      icon: Activity,
                      color: 'purple'
                    },
                    {
                      type: 'news',
                      label: '뉴스 알림',
                      description: '중요 뉴스 발생 시',
                      icon: Bell,
                      color: 'green'
                    }
                  ].map(({ type, label, description, icon: Icon, color }) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, alert_type: type }));
                        setStep(2);
                      }}
                      className={`p-6 rounded-xl border-2 transition-all hover:scale-105 ${
                        formData.alert_type === type
                          ? `border-${color}-500 bg-${color}-50`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Icon className={`mx-auto mb-3 text-${color}-600`} size={32} />
                      <h4 className="font-semibold text-gray-900 mb-1">{label}</h4>
                      <p className="text-sm text-gray-600">{description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Stock Selection */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">종목 선택</h3>
                  {!initialAlertType && (
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      ← 이전
                    </button>
                  )}
                </div>

                {formData.ticker_cd ? (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{formData.ticker_cd}</p>
                        <p className="text-sm text-gray-600">{formData.ticker_name}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, ticker_cd: '', ticker_name: '' }))}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        변경
                      </button>
                    </div>
                  </div>
                ) : (
                  <StockSelector onSelect={handleStockSelect} />
                )}

                {formData.alert_type === 'news' && (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      💡 뉴스 알림은 종목 선택 없이도 설정 가능합니다
                    </p>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="mt-3 text-sm text-amber-700 hover:text-amber-800 font-medium"
                    >
                      종목 없이 계속 →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Condition Settings */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">알림 조건 설정</h3>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    ← 이전
                  </button>
                </div>

                {/* Selected Stock Info */}
                {formData.ticker_cd && (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">선택한 종목</p>
                    <p className="font-semibold text-gray-900">{formData.ticker_cd} - {formData.ticker_name}</p>
                  </div>
                )}

                {/* Technical Indicator Selection (only for technical type) */}
                {formData.alert_type === 'technical' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      기술 지표
                    </label>
                    <select
                      name="technical_indicator"
                      value={formData.technical_indicator}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">지표를 선택하세요</option>

                      <optgroup label="오버레이 지표">
                        {technicalIndicatorsByType.overlay.map(ind => (
                          <option key={ind.id} value={ind.id}>
                            {ind.name} - {ind.description}
                          </option>
                        ))}
                      </optgroup>

                      <optgroup label="오실레이터">
                        {technicalIndicatorsByType.oscillator.map(ind => (
                          <option key={ind.id} value={ind.id}>
                            {ind.name} - {ind.description}
                          </option>
                        ))}
                      </optgroup>

                      <optgroup label="기타 지표">
                        {technicalIndicatorsByType.separate.map(ind => (
                          <option key={ind.id} value={ind.id}>
                            {ind.name} - {ind.description}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                )}

                {/* Condition Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    알림 조건
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'above', label: '이상', icon: TrendingUp, color: 'green' },
                      { value: 'below', label: '이하', icon: TrendingDown, color: 'red' },
                      { value: 'percent_change', label: '변동률', icon: Percent, color: 'blue' }
                    ].map(({ value, label, icon: Icon, color }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, condition_type: value }))}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          formData.condition_type === value
                            ? `border-${color}-500 bg-${color}-50`
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className={`mx-auto mb-2 ${
                          formData.condition_type === value ? `text-${color}-600` : 'text-gray-400'
                        }`} size={24} />
                        <p className={`text-sm font-medium ${
                          formData.condition_type === value ? 'text-gray-900' : 'text-gray-600'
                        }`}>
                          {label}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Threshold Value */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    기준 값
                    {formData.condition_type === 'percent_change' && ' (%)'}
                  </label>
                  <div className="relative">
                    {formData.condition_type !== 'percent_change' && (
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    )}
                    <input
                      type="number"
                      step="0.01"
                      name="threshold_value"
                      value={formData.threshold_value}
                      onChange={handleChange}
                      placeholder={formData.condition_type === 'percent_change' ? '예: 5.0' : '예: 200.00'}
                      className={`w-full ${formData.condition_type !== 'percent_change' ? 'pl-10' : 'pl-4'} pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                      required
                    />
                    {formData.condition_type === 'percent_change' && (
                      <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    )}
                  </div>
                  {formData.condition_type === 'percent_change' && (
                    <p className="mt-2 text-xs text-gray-500">
                      하루 기준 변동률입니다 (예: 5% 상승/하락)
                    </p>
                  )}
                </div>

                {/* Notification Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    알림 방법
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'email', label: '이메일' },
                      { value: 'push', label: '푸시' },
                      { value: 'both', label: '이메일 + 푸시' }
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, notification_method: value }))}
                        className={`p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                          formData.notification_method === value
                            ? 'border-blue-500 bg-blue-50 text-blue-900'
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    커스텀 메시지 (선택사항)
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    rows={3}
                    placeholder="알림과 함께 표시될 메시지를 입력하세요"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Preview */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-2">📋 알림 미리보기</p>
                  <p className="text-sm text-gray-900">
                    <span className="font-semibold">{formData.ticker_cd || '전체'}</span>
                    {formData.alert_type === 'technical' && formData.technical_indicator && (
                      <span> {TECHNICAL_INDICATORS.find(ind => ind.id === formData.technical_indicator)?.name}</span>
                    )}
                    {' '}
                    {formData.condition_type === 'above' && '가격이'}
                    {formData.condition_type === 'below' && '가격이'}
                    {formData.condition_type === 'percent_change' && '변동률이'}
                    {' '}
                    {formData.condition_type === 'above' && '이상'}
                    {formData.condition_type === 'below' && '이하'}
                    {formData.condition_type === 'percent_change' && '이상'}
                    {' '}
                    {formData.condition_type === 'percent_change' ? `${formData.threshold_value}%` : `$${formData.threshold_value}`}
                    {' '}
                    일 때 <span className="font-semibold">{formData.notification_method === 'email' ? '이메일' : formData.notification_method === 'push' ? '푸시' : '이메일+푸시'}</span>로 알림
                  </p>
                  {formData.message && (
                    <p className="text-sm text-gray-600 mt-2 italic">"{formData.message}"</p>
                  )}
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-white transition-colors font-medium text-gray-700"
          >
            취소
          </button>
          {step === 3 && (
            <button
              type="submit"
              onClick={handleSubmit}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg shadow-blue-500/30"
            >
              알림 생성
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AlertsOverviewTab sub-widgets ─────────────────────────────────────────────

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

// ─── AlertsOverviewTab ──────────────────────────────────────────────────────────

function AlertsOverviewTab() {
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

// ─── PriceAlertsTab ─────────────────────────────────────────────────────────────

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

function PriceAlertsTab() {
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

// ─── TechnicalAlertsTab ─────────────────────────────────────────────────────────

function TechnicalAlertsListWidget({ alerts, onToggle, onDelete, onTest, onCreateClick, loading, onRefresh, onClose }) {
  return (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden h-full flex flex-col">
      <WidgetHeader
        title="Technical Alerts"
        icon={Activity}
        iconColor="text-purple-400"
        subtitle={`${alerts.length} alerts`}
        onRefresh={onRefresh}
        onClose={onClose}
        loading={loading}
      />
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
            <Activity size={48} className="mb-3 opacity-50" />
            <p className="text-sm mb-1">No technical alerts</p>
            <p className="text-xs text-gray-600 mb-4">Set up alerts based on RSI, MACD, and other indicators</p>
            <button
              onClick={onCreateClick}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded text-sm text-white"
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
                <th className="text-left py-2 px-4 text-gray-400 text-xs font-medium">Indicator</th>
                <th className="text-left py-2 px-4 text-gray-400 text-xs font-medium">Condition</th>
                <th className="text-right py-2 px-4 text-gray-400 text-xs font-medium">Value</th>
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
                  <td className="py-3 px-4">
                    <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                      {alert.indicator || 'RSI'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-400">
                    {alert.condition_type === 'above' && 'Above'}
                    {alert.condition_type === 'below' && 'Below'}
                    {alert.condition_type === 'crosses_above' && 'Crosses Above'}
                    {alert.condition_type === 'crosses_below' && 'Crosses Below'}
                  </td>
                  <td className="py-3 px-4 text-right text-white font-medium">
                    {alert.threshold_value}
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
                        className="p-1.5 text-gray-500 hover:text-purple-400 hover:bg-purple-500/20 rounded transition-colors"
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
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-sm text-white"
          >
            <Plus size={14} />
            Create Alert
          </button>
        </div>
      )}
    </div>
  );
}

function TechnicalAlertsTab() {
  const { technicalAlerts, toggleAlert, deleteAlert, testAlert, createAlert, refreshAlerts, isLoading } = useAlertsContext();
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
          <h3 className="text-lg font-semibold text-white">Technical Alerts</h3>
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
          {/* Technical Alerts List Widget - Full Width */}
          <div className="col-span-12">
            {visibleWidgets.alertsList ? (
              <ResizableWidgetWrapper minHeight={300} defaultHeight={500}>
                <TechnicalAlertsListWidget
                  alerts={technicalAlerts}
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
              <AddWidgetPlaceholder onAdd={() => handleAddWidget('alertsList')} widgetType="alertsList" label="Add Technical Alerts Widget" />
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateAlertModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
          initialAlertType="technical"
        />
      )}
    </>
  );
}

// ─── NewsAlertsTab ──────────────────────────────────────────────────────────────

function NewsAlertsListWidget({ alerts, onToggle, onDelete, onTest, onCreateClick, loading, onRefresh, onClose }) {
  return (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden h-full flex flex-col">
      <WidgetHeader
        title="News Alerts"
        icon={Newspaper}
        iconColor="text-green-400"
        subtitle={`${alerts.length} alerts`}
        onRefresh={onRefresh}
        onClose={onClose}
        loading={loading}
      />
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
            <Newspaper size={48} className="mb-3 opacity-50" />
            <p className="text-sm mb-1">No news alerts</p>
            <p className="text-xs text-gray-600 mb-4">Get notified when important news breaks</p>
            <button
              onClick={onCreateClick}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-sm text-white"
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
                <th className="text-left py-2 px-4 text-gray-400 text-xs font-medium">Keywords</th>
                <th className="text-left py-2 px-4 text-gray-400 text-xs font-medium">Sentiment</th>
                <th className="text-center py-2 px-4 text-gray-400 text-xs font-medium">Status</th>
                <th className="text-right py-2 px-4 text-gray-400 text-xs font-medium">Triggers</th>
                <th className="text-right py-2 px-4 text-gray-400 text-xs font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.alert_id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-3 px-4">
                    <span className="font-semibold text-white">{alert.ticker_cd || 'All'}</span>
                  </td>
                  <td className="py-3 px-4 text-gray-400">
                    {alert.keywords ? (
                      <div className="flex flex-wrap gap-1">
                        {alert.keywords.split(',').slice(0, 3).map((kw, idx) => (
                          <span key={idx} className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
                            {kw.trim()}
                          </span>
                        ))}
                        {alert.keywords.split(',').length > 3 && (
                          <span className="text-xs text-gray-500">+{alert.keywords.split(',').length - 3}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500">Any</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      alert.sentiment_filter === 'positive' ? 'bg-green-500/20 text-green-400' :
                      alert.sentiment_filter === 'negative' ? 'bg-red-500/20 text-red-400' :
                      'bg-gray-700 text-gray-400'
                    }`}>
                      {alert.sentiment_filter || 'Any'}
                    </span>
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
                        className="p-1.5 text-gray-500 hover:text-green-400 hover:bg-green-500/20 rounded transition-colors"
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
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-sm text-white"
          >
            <Plus size={14} />
            Create Alert
          </button>
        </div>
      )}
    </div>
  );
}

function NewsAlertsTab() {
  const { newsAlerts, toggleAlert, deleteAlert, testAlert, createAlert, refreshAlerts, isLoading } = useAlertsContext();
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
          <h3 className="text-lg font-semibold text-white">News Alerts</h3>
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
          {/* News Alerts List Widget - Full Width */}
          <div className="col-span-12">
            {visibleWidgets.alertsList ? (
              <ResizableWidgetWrapper minHeight={300} defaultHeight={500}>
                <NewsAlertsListWidget
                  alerts={newsAlerts}
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
              <AddWidgetPlaceholder onAdd={() => handleAddWidget('alertsList')} widgetType="alertsList" label="Add News Alerts Widget" />
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateAlertModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
          initialAlertType="news"
        />
      )}
    </>
  );
}

// ─── Main AlertsDashboard export ────────────────────────────────────────────────

export default function AlertsDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Get tab from URL
  const searchParams = new URLSearchParams(location.search);
  const tabFromUrl = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  // Sync tab state with URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab') || 'overview';
    setActiveTab(tab);
  }, [location.search]);

  // Tab change handler
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    navigate(`?tab=${tabId}`);
  };

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <AlertsOverviewTab />;
      case 'price':
        return <PriceAlertsTab />;
      case 'technical':
        return <TechnicalAlertsTab />;
      case 'news':
        return <NewsAlertsTab />;
      default:
        return <AlertsOverviewTab />;
    }
  };

  return (
    <AlertsProvider>
      <div className="text-white">
        {/* Page Header */}
        <div className="border-b border-gray-800">
          <div className="w-full px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600/20 rounded-lg">
                  <Bell className="text-blue-400" size={20} />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">Alerts</h1>
                  <p className="text-gray-500 text-xs mt-0.5">
                    Manage price, technical, and news alerts
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 border border-gray-700 hover:border-gray-600 rounded-lg transition-colors text-gray-400 hover:text-white text-sm"
              >
                <History size={16} />
                <span>History</span>
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-0.5 mt-4 -mb-px">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-cyan-400 border-b-2 border-cyan-400'
                        : 'text-gray-400 hover:text-white border-b-2 border-transparent'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="py-4">
          {renderTabContent()}
        </div>

        {/* History Modal */}
        {showHistoryModal && (
          <AlertHistoryModal onClose={() => setShowHistoryModal(false)} />
        )}
      </div>
    </AlertsProvider>
  );
}
