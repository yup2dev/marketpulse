/**
 * 거래 내역 테이블
 */
import { ArrowUpCircle, ArrowDownCircle, DollarSign } from 'lucide-react';

export default function TransactionsTable({ transactions }) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">거래 내역이 없습니다.</p>
      </div>
    );
  }

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'buy':
        return <ArrowUpCircle className="text-green-600" size={20} />;
      case 'sell':
        return <ArrowDownCircle className="text-red-600" size={20} />;
      case 'dividend':
        return <DollarSign className="text-blue-600" size={20} />;
      default:
        return null;
    }
  };

  const getTransactionTypeText = (type) => {
    switch (type) {
      case 'buy':
        return '매수';
      case 'sell':
        return '매도';
      case 'dividend':
        return '배당';
      default:
        return type;
    }
  };

  const getTransactionTypeClass = (type) => {
    switch (type) {
      case 'buy':
        return 'bg-green-100 text-green-800';
      case 'sell':
        return 'bg-red-100 text-red-800';
      case 'dividend':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-semibold text-gray-700">일시</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700">유형</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700">종목</th>
            <th className="text-right py-3 px-4 font-semibold text-gray-700">수량</th>
            <th className="text-right py-3 px-4 font-semibold text-gray-700">가격</th>
            <th className="text-right py-3 px-4 font-semibold text-gray-700">수수료</th>
            <th className="text-right py-3 px-4 font-semibold text-gray-700">총액</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700">메모</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr
              key={transaction.transaction_id}
              className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <td className="py-3 px-4 text-sm text-gray-600">
                {new Date(transaction.transaction_date).toLocaleString('ko-KR', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  {getTransactionIcon(transaction.transaction_type)}
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${getTransactionTypeClass(
                      transaction.transaction_type
                    )}`}
                  >
                    {getTransactionTypeText(transaction.transaction_type)}
                  </span>
                </div>
              </td>
              <td className="py-3 px-4 font-semibold text-gray-900">
                {transaction.ticker_cd}
              </td>
              <td className="text-right py-3 px-4 text-gray-900">
                {parseFloat(transaction.quantity).toFixed(8)}
              </td>
              <td className="text-right py-3 px-4 text-gray-900">
                ${parseFloat(transaction.price).toFixed(2)}
              </td>
              <td className="text-right py-3 px-4 text-gray-600">
                ${parseFloat(transaction.commission || 0).toFixed(2)}
              </td>
              <td className="text-right py-3 px-4 font-semibold text-gray-900">
                ${parseFloat(transaction.total_amount).toFixed(2)}
              </td>
              <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">
                {transaction.notes || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
