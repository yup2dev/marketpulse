/**
 * 스크리너 결과 테이블
 * 스크리닝 결과를 테이블 형식으로 표시
 */
import { useState } from 'react';
import { ArrowUpDown, Star, TrendingUp, TrendingDown, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ScreenerResults({ results, preset }) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  if (!results || results.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
        <div className="text-gray-400 mb-4">
          <TrendingUp size={64} className="mx-auto" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          검색 결과가 없습니다
        </h3>
        <p className="text-gray-600">
          다른 필터 조건으로 다시 시도해보세요
        </p>
      </div>
    );
  }

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedResults = [...results].sort((a, b) => {
    if (!sortConfig.key) return 0;

    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];

    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    if (sortConfig.direction === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const handleAddToWatchlist = (ticker) => {
    // TODO: Implement add to watchlist
    toast.success(`${ticker}를 관심종목에 추가했습니다`);
  };

  const SortButton = ({ column, label }) => (
    <button
      onClick={() => handleSort(column)}
      className="flex items-center gap-1 hover:text-blue-600 transition-colors"
    >
      {label}
      <ArrowUpDown size={14} />
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            검색 결과 ({results.length}개 종목)
          </h2>
          {preset && (
            <p className="text-sm text-gray-600 mt-1">
              프리셋: {preset.name}
            </p>
          )}
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <SortButton column="stk_cd" label="종목코드" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  종목명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <SortButton column="sector" label="섹터" />
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <SortButton column="close_price" label="현재가" />
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <SortButton column="change_rate" label="등락률" />
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <SortButton column="market_cap" label="시가총액" />
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <SortButton column="pe_ratio" label="PER" />
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <SortButton column="roe" label="ROE" />
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedResults.map((stock) => {
                const isPositive = (stock.change_rate || 0) >= 0;
                return (
                  <tr key={stock.stk_cd} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-gray-900">{stock.stk_cd}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {stock.stk_nm || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{stock.sector || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-900">
                      ${stock.close_price ? stock.close_price.toFixed(2) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`flex items-center justify-end gap-1 font-medium ${
                        isPositive ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {stock.change_rate ? `${stock.change_rate.toFixed(2)}%` : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-700">
                      {stock.market_cap ? `$${(stock.market_cap / 1e9).toFixed(2)}B` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-700">
                      {stock.pe_ratio ? stock.pe_ratio.toFixed(2) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-700">
                      {stock.roe ? `${stock.roe.toFixed(2)}%` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => handleAddToWatchlist(stock.stk_cd)}
                        className="p-2 hover:bg-yellow-50 rounded-lg transition-colors"
                        title="관심종목에 추가"
                      >
                        <Star size={16} className="text-gray-400 hover:text-yellow-500" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
