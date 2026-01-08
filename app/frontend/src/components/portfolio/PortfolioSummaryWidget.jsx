/**
 * 포트폴리오 요약 위젯
 * 총 자산, 비용, 손익, 수익률 표시
 */
import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, PieChart } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function PortfolioSummaryWidget({ portfolioId }) {
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (portfolioId) {
      loadSummary();
    }
  }, [portfolioId]);

  const loadSummary = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/user-portfolio/portfolios/${portfolioId}/summary`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setSummary(response.data);
    } catch (error) {
      toast.error('요약 정보를 불러오지 못했습니다');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-3"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!summary) return null;

  const isProfit = summary.total_unrealized_pnl >= 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      {/* Total Holdings */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">보유 종목</span>
          <PieChart className="text-blue-600" size={20} />
        </div>
        <p className="text-2xl font-bold text-gray-900">{summary.total_holdings}</p>
        <p className="text-xs text-gray-500 mt-1">{summary.name}</p>
      </div>

      {/* Total Cost */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">총 투자액</span>
          <DollarSign className="text-gray-600" size={20} />
        </div>
        <p className="text-2xl font-bold text-gray-900">
          ${summary.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-gray-500 mt-1">{summary.currency}</p>
      </div>

      {/* Market Value */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">현재 자산</span>
          <DollarSign className="text-blue-600" size={20} />
        </div>
        <p className="text-2xl font-bold text-gray-900">
          ${summary.total_market_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {new Date(summary.last_updated).toLocaleString('ko-KR')}
        </p>
      </div>

      {/* Profit/Loss */}
      <div className={`bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow ${
        isProfit ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">손익</span>
          {isProfit ? (
            <TrendingUp className="text-green-600" size={20} />
          ) : (
            <TrendingDown className="text-red-600" size={20} />
          )}
        </div>
        <p className={`text-2xl font-bold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
          {isProfit ? '+' : ''}${summary.total_unrealized_pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className={`text-sm font-semibold mt-1 ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
          {isProfit ? '+' : ''}{summary.total_return_pct.toFixed(2)}%
        </p>
      </div>
    </div>
  );
}
