/**
 * 포트폴리오 생성 모달
 */
import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';

export default function CreatePortfolioModal({ onClose, onCreate }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm();

  const onSubmit = async (data) => {
    await onCreate(data);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">새 포트폴리오</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* 포트폴리오 이름 */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              포트폴리오 이름 *
            </label>
            <input
              id="name"
              type="text"
              {...register('name', {
                required: '포트폴리오 이름을 입력해주세요.',
                minLength: {
                  value: 2,
                  message: '이름은 최소 2자 이상이어야 합니다.',
                },
              })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="예: 성장주 포트폴리오"
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
          </div>

          {/* 설명 */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              설명
            </label>
            <textarea
              id="description"
              {...register('description')}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="포트폴리오에 대한 설명을 입력하세요 (선택)"
            />
          </div>

          {/* 통화 */}
          <div>
            <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1">
              통화 *
            </label>
            <select
              id="currency"
              {...register('currency')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              defaultValue="USD"
            >
              <option value="USD">USD (미국 달러)</option>
              <option value="KRW">KRW (한국 원)</option>
              <option value="EUR">EUR (유로)</option>
              <option value="JPY">JPY (일본 엔)</option>
              <option value="GBP">GBP (영국 파운드)</option>
            </select>
          </div>

          {/* 벤치마크 */}
          <div>
            <label htmlFor="benchmark" className="block text-sm font-medium text-gray-700 mb-1">
              벤치마크 (선택)
            </label>
            <select
              id="benchmark"
              {...register('benchmark')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">선택 안 함</option>
              <option value="SPY">SPY (S&P 500)</option>
              <option value="QQQ">QQQ (NASDAQ 100)</option>
              <option value="DIA">DIA (Dow Jones)</option>
              <option value="IWM">IWM (Russell 2000)</option>
              <option value="VTI">VTI (Total Stock Market)</option>
            </select>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? '생성 중...' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
