/**
 * Analysis Estimate Tab - 애널리스트 추정치
 */
import { useState, useEffect } from 'react';
import { Target, TrendingUp, TrendingDown, BarChart3, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { useStockContext } from './AnalysisDashboard';
import { API_BASE } from '../../config/api';

export default function AnalysisEstimateTab() {
  const { symbol } = useStockContext();
  const [estimatesData, setEstimatesData] = useState(null);
  const [analystData, setAnalystData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEstimatesData();
  }, [symbol]);

  const loadEstimatesData = async () => {
    setLoading(true);
    try {
      const [estimatesRes, analystRes] = await Promise.all([
        fetch(`${API_BASE}/stock/estimates/${symbol}`),
        fetch(`${API_BASE}/stock/analyst/${symbol}`)
      ]);

      if (estimatesRes.ok) {
        const data = await estimatesRes.json();
        setEstimatesData(data);
      }

      if (analystRes.ok) {
        const data = await analystRes.json();
        setAnalystData(data);
      }
    } catch (error) {
      console.error('Error loading estimates data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (value, type = 'number') => {
    if (value === null || value === undefined) return 'N/A';
    if (type === 'currency') {
      if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
      if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
      if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
      return `$${value.toFixed(2)}`;
    }
    if (type === 'percent') {
      return `${(value * 100).toFixed(2)}%`;
    }
    return value.toFixed(2);
  };

  const getGrowthColor = (value) => {
    if (value === null || value === undefined) return 'text-gray-400';
    if (value > 0) return 'text-green-400';
    if (value < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  const getGrowthIcon = (value) => {
    if (value === null || value === undefined) return <Minus size={14} />;
    if (value > 0) return <ArrowUpRight size={14} />;
    if (value < 0) return <ArrowDownRight size={14} />;
    return <Minus size={14} />;
  };

  const getRatingColor = (rating) => {
    const r = rating?.toLowerCase() || '';
    if (r.includes('buy') || r.includes('outperform')) return 'text-green-400 bg-green-400/20';
    if (r.includes('sell') || r.includes('underperform')) return 'text-red-400 bg-red-400/20';
    return 'text-yellow-400 bg-yellow-400/20';
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      </div>
    );
  }

  const priceTarget = estimatesData?.price_target;
  const earningsEstimates = estimatesData?.earnings_estimates || [];
  const revenueEstimates = estimatesData?.revenue_estimates || [];
  const growthEstimate = estimatesData?.growth_estimate;
  const ratings = analystData?.ratings || {};

  // Calculate upside/downside potential
  const currentPrice = priceTarget?.current;
  const targetPrice = priceTarget?.mean;
  const upside = currentPrice && targetPrice ? ((targetPrice - currentPrice) / currentPrice * 100) : null;

  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Target className="text-purple-500" size={28} />
          <div>
            <h2 className="text-xl font-bold text-white">애널리스트 추정치</h2>
            <p className="text-gray-400 text-sm mt-0.5">목표주가, EPS, 매출 예측을 확인하세요</p>
          </div>
        </div>

        {/* Price Target & Rating Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Price Target Card */}
          <div className="bg-[#1a1f2e] rounded-xl border border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-600/20 rounded-lg">
                <Target className="text-purple-400" size={20} />
              </div>
              <h3 className="text-lg font-semibold text-white">목표주가</h3>
            </div>

            {priceTarget ? (
              <div className="space-y-4">
                {/* Current vs Target */}
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-sm text-gray-400">현재가</div>
                    <div className="text-2xl font-bold text-white">
                      ${currentPrice?.toFixed(2) || 'N/A'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">평균 목표가</div>
                    <div className="text-2xl font-bold text-purple-400">
                      ${targetPrice?.toFixed(2) || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Upside/Downside */}
                {upside !== null && (
                  <div className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg ${
                    upside > 0 ? 'bg-green-600/20' : upside < 0 ? 'bg-red-600/20' : 'bg-gray-800'
                  }`}>
                    {upside > 0 ? (
                      <TrendingUp className="text-green-400" size={20} />
                    ) : upside < 0 ? (
                      <TrendingDown className="text-red-400" size={20} />
                    ) : null}
                    <span className={`text-lg font-bold ${upside > 0 ? 'text-green-400' : upside < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {upside > 0 ? '+' : ''}{upside.toFixed(2)}% {upside > 0 ? 'Upside' : 'Downside'}
                    </span>
                  </div>
                )}

                {/* Price Range */}
                <div className="border-t border-gray-700 pt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Low</span>
                    <span className="text-gray-400">High</span>
                  </div>
                  <div className="relative h-2 bg-gray-700 rounded-full">
                    {priceTarget.low && priceTarget.high && currentPrice && (
                      <div
                        className="absolute h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full"
                        style={{ width: '100%' }}
                      />
                    )}
                    {currentPrice && priceTarget.low && priceTarget.high && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-purple-500"
                        style={{
                          left: `${Math.min(100, Math.max(0, ((currentPrice - priceTarget.low) / (priceTarget.high - priceTarget.low)) * 100))}%`,
                          transform: 'translateX(-50%) translateY(-50%)'
                        }}
                      />
                    )}
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-white font-medium">${priceTarget.low?.toFixed(2) || 'N/A'}</span>
                    <span className="text-white font-medium">${priceTarget.high?.toFixed(2) || 'N/A'}</span>
                  </div>
                </div>

                {/* Analyst Count */}
                {priceTarget.number_of_analysts && (
                  <div className="text-center text-gray-400 text-sm">
                    {priceTarget.number_of_analysts}명의 애널리스트 의견
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-400 text-center py-4">
                목표주가 데이터가 없습니다
              </div>
            )}
          </div>

          {/* Analyst Rating Card */}
          <div className="bg-[#1a1f2e] rounded-xl border border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-600/20 rounded-lg">
                <BarChart3 className="text-blue-400" size={20} />
              </div>
              <h3 className="text-lg font-semibold text-white">애널리스트 의견</h3>
            </div>

            {analystData?.consensus_rating && analystData.consensus_rating !== 'N/A' ? (
              <div className="space-y-4">
                {/* Consensus Rating */}
                <div className="text-center">
                  <span className={`inline-block px-4 py-2 rounded-full text-lg font-bold ${getRatingColor(analystData.consensus_rating)}`}>
                    {analystData.consensus_rating}
                  </span>
                </div>

                {/* Rating Distribution */}
                {ratings.total > 0 && (
                  <div className="space-y-2">
                    {[
                      { key: 'strong_buy', label: 'Strong Buy', color: 'bg-green-500' },
                      { key: 'buy', label: 'Buy', color: 'bg-green-400' },
                      { key: 'hold', label: 'Hold', color: 'bg-yellow-400' },
                      { key: 'sell', label: 'Sell', color: 'bg-red-400' },
                      { key: 'strong_sell', label: 'Strong Sell', color: 'bg-red-500' }
                    ].map(({ key, label, color }) => {
                      const count = ratings[key] || 0;
                      const percent = (count / ratings.total) * 100;
                      return (
                        <div key={key} className="flex items-center gap-3">
                          <span className="text-gray-400 text-sm w-24">{label}</span>
                          <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${color} rounded-full transition-all`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="text-white text-sm w-8 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Total Analysts */}
                <div className="text-center text-gray-400 text-sm pt-2 border-t border-gray-700">
                  총 {ratings.total || 0}명의 애널리스트
                </div>
              </div>
            ) : (
              <div className="text-gray-400 text-center py-4">
                애널리스트 의견 데이터가 없습니다
              </div>
            )}
          </div>
        </div>

        {/* Earnings & Revenue Estimates */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* EPS Estimates */}
          {earningsEstimates.length > 0 && (
            <div className="bg-[#1a1f2e] rounded-xl border border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">EPS 추정치</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 bg-gray-800/50">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">기간</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">평균</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">범위</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">성장률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earningsEstimates.map((est, index) => (
                      <tr key={index} className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="py-3 px-4 text-white font-medium">{est.period}</td>
                        <td className="text-center py-3 px-4 text-white font-bold">
                          {formatNumber(est.avg)}
                        </td>
                        <td className="text-center py-3 px-4 text-gray-400">
                          {est.low != null && est.high != null
                            ? `${formatNumber(est.low)} - ${formatNumber(est.high)}`
                            : 'N/A'}
                        </td>
                        <td className={`text-center py-3 px-4 font-medium ${getGrowthColor(est.growth)}`}>
                          <span className="flex items-center justify-center gap-1">
                            {getGrowthIcon(est.growth)}
                            {est.growth != null ? formatNumber(est.growth, 'percent') : 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Revenue Estimates */}
          {revenueEstimates.length > 0 && (
            <div className="bg-[#1a1f2e] rounded-xl border border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">매출 추정치</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 bg-gray-800/50">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">기간</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">평균</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">범위</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">성장률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueEstimates.map((est, index) => (
                      <tr key={index} className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="py-3 px-4 text-white font-medium">{est.period}</td>
                        <td className="text-center py-3 px-4 text-white font-bold">
                          {formatNumber(est.avg, 'currency')}
                        </td>
                        <td className="text-center py-3 px-4 text-gray-400 text-xs">
                          {est.low != null && est.high != null
                            ? `${formatNumber(est.low, 'currency')} - ${formatNumber(est.high, 'currency')}`
                            : 'N/A'}
                        </td>
                        <td className={`text-center py-3 px-4 font-medium ${getGrowthColor(est.growth)}`}>
                          <span className="flex items-center justify-center gap-1">
                            {getGrowthIcon(est.growth)}
                            {est.growth != null ? formatNumber(est.growth, 'percent') : 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Growth Estimates */}
        {growthEstimate && (
          <div className="bg-[#1a1f2e] rounded-xl border border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-600/20 rounded-lg">
                <TrendingUp className="text-green-400" size={20} />
              </div>
              <h3 className="text-lg font-semibold text-white">성장 전망</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: '현재 분기', value: growthEstimate.current_quarter },
                { label: '다음 분기', value: growthEstimate.next_quarter },
                { label: '현재 연도', value: growthEstimate.current_year },
                { label: '다음 연도', value: growthEstimate.next_year },
                { label: '향후 5년 (연평균)', value: growthEstimate.next_5_years },
                { label: '과거 5년 (연평균)', value: growthEstimate.past_5_years }
              ].map(({ label, value }, index) => (
                <div key={index} className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-xs text-gray-400 mb-2">{label}</div>
                  <div className={`text-lg font-bold flex items-center justify-center gap-1 ${getGrowthColor(value)}`}>
                    {getGrowthIcon(value)}
                    {value != null ? formatNumber(value, 'percent') : 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
