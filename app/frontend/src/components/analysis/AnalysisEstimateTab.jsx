/**
 * Analysis Estimate Tab - WidgetDashboard 기반 동적 레이아웃
 */
import { useState, useEffect } from 'react';
import { Target, TrendingUp, TrendingDown, BarChart3, ArrowUpRight, ArrowDownRight, Minus, GripVertical } from 'lucide-react';
import { useStockContext } from './AnalysisDashboard';
import WidgetDashboard from '../WidgetDashboard';
import { API_BASE } from '../../config/api';

// 추정치 위젯 컴포넌트
function EstimatesContentWidget({ symbol, onRemove }) {
  const [estimatesData, setEstimatesData] = useState(null);
  const [analystData, setAnalystData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (symbol) loadEstimatesData();
  }, [symbol]);

  const loadEstimatesData = async () => {
    setLoading(true);
    try {
      const [estimatesRes, analystRes] = await Promise.all([
        fetch(`${API_BASE}/stock/estimates/${symbol}`),
        fetch(`${API_BASE}/stock/analyst/${symbol}`)
      ]);

      if (estimatesRes.ok) setEstimatesData(await estimatesRes.json());
      if (analystRes.ok) setAnalystData(await analystRes.json());
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
    if (type === 'percent') return `${(value * 100).toFixed(2)}%`;
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
      <div className="bg-[#1a1f2e] rounded-xl border border-gray-700 h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  const priceTarget = estimatesData?.price_target;
  const earningsEstimates = estimatesData?.earnings_estimates || [];
  const revenueEstimates = estimatesData?.revenue_estimates || [];
  const growthEstimate = estimatesData?.growth_estimate;
  const ratings = analystData?.ratings || {};

  const currentPrice = priceTarget?.current;
  const targetPrice = priceTarget?.mean;
  const upside = currentPrice && targetPrice ? ((targetPrice - currentPrice) / currentPrice * 100) : null;

  return (
    <div className="bg-[#1a1f2e] rounded-xl border border-gray-700 h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center gap-3 shrink-0">
        <div className="drag-handle-area cursor-move p-1 hover:bg-gray-700 rounded">
          <GripVertical size={14} className="text-gray-500" />
        </div>
        <Target className="text-purple-500" size={24} />
        <div>
          <h2 className="text-lg font-bold text-white">애널리스트 추정치</h2>
          <p className="text-gray-400 text-xs">목표주가, EPS, 매출 예측</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Price Target & Analyst Rating */}
        <div className="grid grid-cols-2 gap-4">
          {/* Price Target */}
          <div className="bg-gray-800/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="text-purple-400" size={16} />
              <h3 className="text-sm font-semibold text-white">목표주가</h3>
            </div>
            {priceTarget ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <div>
                    <div className="text-xs text-gray-400">현재가</div>
                    <div className="text-lg font-bold text-white">${currentPrice?.toFixed(2) || 'N/A'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">목표가</div>
                    <div className="text-lg font-bold text-purple-400">${targetPrice?.toFixed(2) || 'N/A'}</div>
                  </div>
                </div>
                {upside !== null && (
                  <div className={`text-center py-2 rounded ${upside > 0 ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                    {upside > 0 ? <TrendingUp className="inline mr-1" size={14} /> : <TrendingDown className="inline mr-1" size={14} />}
                    {upside > 0 ? '+' : ''}{upside.toFixed(2)}%
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-400 text-center py-4 text-sm">데이터 없음</div>
            )}
          </div>

          {/* Analyst Rating */}
          <div className="bg-gray-800/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="text-blue-400" size={16} />
              <h3 className="text-sm font-semibold text-white">애널리스트 의견</h3>
            </div>
            {analystData?.consensus_rating && analystData.consensus_rating !== 'N/A' ? (
              <div className="text-center">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${getRatingColor(analystData.consensus_rating)}`}>
                  {analystData.consensus_rating}
                </span>
                <div className="text-xs text-gray-400 mt-2">총 {ratings.total || 0}명</div>
              </div>
            ) : (
              <div className="text-gray-400 text-center py-4 text-sm">데이터 없음</div>
            )}
          </div>
        </div>

        {/* EPS & Revenue Estimates */}
        <div className="grid grid-cols-2 gap-4">
          {earningsEstimates.length > 0 && (
            <div className="bg-gray-800/30 rounded-lg overflow-hidden">
              <div className="p-3 border-b border-gray-700">
                <h3 className="text-sm font-semibold text-white">EPS 추정치</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-700 bg-gray-800/50">
                      <th className="text-left py-2 px-3 text-gray-400">기간</th>
                      <th className="text-center py-2 px-3 text-gray-400">평균</th>
                      <th className="text-center py-2 px-3 text-gray-400">성장률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earningsEstimates.slice(0, 4).map((est, idx) => (
                      <tr key={idx} className="border-b border-gray-800">
                        <td className="py-2 px-3 text-white">{est.period}</td>
                        <td className="text-center py-2 px-3 text-white font-medium">{formatNumber(est.avg)}</td>
                        <td className={`text-center py-2 px-3 ${getGrowthColor(est.growth)}`}>
                          {est.growth != null ? formatNumber(est.growth, 'percent') : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {revenueEstimates.length > 0 && (
            <div className="bg-gray-800/30 rounded-lg overflow-hidden">
              <div className="p-3 border-b border-gray-700">
                <h3 className="text-sm font-semibold text-white">매출 추정치</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-700 bg-gray-800/50">
                      <th className="text-left py-2 px-3 text-gray-400">기간</th>
                      <th className="text-center py-2 px-3 text-gray-400">평균</th>
                      <th className="text-center py-2 px-3 text-gray-400">성장률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueEstimates.slice(0, 4).map((est, idx) => (
                      <tr key={idx} className="border-b border-gray-800">
                        <td className="py-2 px-3 text-white">{est.period}</td>
                        <td className="text-center py-2 px-3 text-white font-medium">{formatNumber(est.avg, 'currency')}</td>
                        <td className={`text-center py-2 px-3 ${getGrowthColor(est.growth)}`}>
                          {est.growth != null ? formatNumber(est.growth, 'percent') : 'N/A'}
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
          <div className="bg-gray-800/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="text-green-400" size={16} />
              <h3 className="text-sm font-semibold text-white">성장 전망</h3>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {[
                { label: '현재 분기', value: growthEstimate.current_quarter },
                { label: '다음 분기', value: growthEstimate.next_quarter },
                { label: '현재 연도', value: growthEstimate.current_year },
                { label: '다음 연도', value: growthEstimate.next_year },
                { label: '향후 5년', value: growthEstimate.next_5_years },
                { label: '과거 5년', value: growthEstimate.past_5_years }
              ].map(({ label, value }, idx) => (
                <div key={idx} className="bg-gray-800 rounded p-2 text-center">
                  <div className="text-[10px] text-gray-400 mb-1">{label}</div>
                  <div className={`text-sm font-bold ${getGrowthColor(value)}`}>
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

export { EstimatesContentWidget };

// 사용 가능한 위젯 목록
const AVAILABLE_WIDGETS = [
  { id: 'estimates-content', name: '추정치', description: '애널리스트 추정치 전체', defaultSize: { w: 12, h: 12 } },
];

export default function AnalysisEstimateTab() {
  const { symbol } = useStockContext();

  const DEFAULT_WIDGETS = [
    { id: 'estimates-content-1', type: 'estimates-content', symbol },
  ];

  const DEFAULT_LAYOUT = [
    { i: 'estimates-content-1', x: 0, y: 0, w: 12, h: 12, minW: 6, minH: 8 },
  ];

  return (
    <WidgetDashboard
      dashboardId={`analysis-estimates-${symbol}`}
      title="추정치"
      subtitle={symbol}
      availableWidgets={AVAILABLE_WIDGETS}
      defaultWidgets={DEFAULT_WIDGETS}
      defaultLayout={DEFAULT_LAYOUT}
    />
  );
}
