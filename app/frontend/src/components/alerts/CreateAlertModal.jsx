/**
 * 알림 생성 모달 - 개선된 버전
 */
import { useState } from 'react';
import { X, Bell, TrendingUp, TrendingDown, Percent, DollarSign, Activity } from 'lucide-react';
import StockSelector from '../common/StockSelector';
import { TECHNICAL_INDICATORS } from '../widgets/common/widgetConfig';

export default function CreateAlertModal({ onClose, onCreate, initialAlertType = null }) {
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

  const getAlertTypeIcon = (type) => {
    switch(type) {
      case 'price': return DollarSign;
      case 'news': return Bell;
      case 'technical': return Activity;
      default: return Bell;
    }
  };

  const getConditionIcon = (condition) => {
    switch(condition) {
      case 'above': return TrendingUp;
      case 'below': return TrendingDown;
      case 'percent_change': return Percent;
      default: return TrendingUp;
    }
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
