/**
 * 거래 추가 모달
 */
import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';

export default function AddTransactionModal({ onClose, onAdd }) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      transaction_type: 'buy',
      commission: 0,
      tax: 0,
    },
  });

  const transactionType = watch('transaction_type');

  const onSubmit = async (data) => {
    // ISO datetime 형식으로 변환
    const transactionData = {
      ...data,
      quantity: parseFloat(data.quantity),
      price: parseFloat(data.price),
      commission: parseFloat(data.commission || 0),
      tax: parseFloat(data.tax || 0),
      transaction_date: new Date(data.transaction_date).toISOString(),
    };

    await onAdd(transactionData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">거래 추가</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* 거래 유형 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">거래 유형 *</label>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex items-center justify-center px-4 py-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="buy"
                  {...register('transaction_type')}
                  className="mr-2"
                />
                <span>매수</span>
              </label>
              <label className="flex items-center justify-center px-4 py-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="sell"
                  {...register('transaction_type')}
                  className="mr-2"
                />
                <span>매도</span>
              </label>
              <label className="flex items-center justify-center px-4 py-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="dividend"
                  {...register('transaction_type')}
                  className="mr-2"
                />
                <span>배당</span>
              </label>
            </div>
          </div>

          {/* 종목 코드 */}
          <div>
            <label htmlFor="ticker_cd" className="block text-sm font-medium text-gray-700 mb-1">
              종목 코드 *
            </label>
            <input
              id="ticker_cd"
              type="text"
              {...register('ticker_cd', {
                required: '종목 코드를 입력해주세요.',
              })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.ticker_cd ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="예: AAPL"
            />
            {errors.ticker_cd && (
              <p className="mt-1 text-sm text-red-600">{errors.ticker_cd.message}</p>
            )}
          </div>

          {/* 수량 */}
          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
              수량 *
            </label>
            <input
              id="quantity"
              type="number"
              step="0.00000001"
              {...register('quantity', {
                required: '수량을 입력해주세요.',
                min: { value: 0.00000001, message: '수량은 0보다 커야 합니다.' },
              })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.quantity ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="예: 10"
            />
            {errors.quantity && (
              <p className="mt-1 text-sm text-red-600">{errors.quantity.message}</p>
            )}
          </div>

          {/* 가격 */}
          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
              {transactionType === 'dividend' ? '배당금 (주당)' : '가격 (주당)'} *
            </label>
            <input
              id="price"
              type="number"
              step="0.0001"
              {...register('price', {
                required: '가격을 입력해주세요.',
                min: { value: 0, message: '가격은 0 이상이어야 합니다.' },
              })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.price ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="예: 150.50"
            />
            {errors.price && <p className="mt-1 text-sm text-red-600">{errors.price.message}</p>}
          </div>

          {/* 수수료 */}
          {transactionType !== 'dividend' && (
            <div>
              <label htmlFor="commission" className="block text-sm font-medium text-gray-700 mb-1">
                수수료
              </label>
              <input
                id="commission"
                type="number"
                step="0.01"
                {...register('commission')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="예: 5.00"
              />
            </div>
          )}

          {/* 세금 */}
          {transactionType !== 'dividend' && (
            <div>
              <label htmlFor="tax" className="block text-sm font-medium text-gray-700 mb-1">
                세금
              </label>
              <input
                id="tax"
                type="number"
                step="0.01"
                {...register('tax')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="예: 2.00"
              />
            </div>
          )}

          {/* 거래 일시 */}
          <div>
            <label
              htmlFor="transaction_date"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              거래 일시 *
            </label>
            <input
              id="transaction_date"
              type="datetime-local"
              {...register('transaction_date', {
                required: '거래 일시를 선택해주세요.',
              })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.transaction_date ? 'border-red-500' : 'border-gray-300'
              }`}
              defaultValue={new Date().toISOString().slice(0, 16)}
            />
            {errors.transaction_date && (
              <p className="mt-1 text-sm text-red-600">{errors.transaction_date.message}</p>
            )}
          </div>

          {/* 메모 */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              메모
            </label>
            <textarea
              id="notes"
              {...register('notes')}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="거래에 대한 메모 (선택)"
            />
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
              {isSubmitting ? '추가 중...' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
