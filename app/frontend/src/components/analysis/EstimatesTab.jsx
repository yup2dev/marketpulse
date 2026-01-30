/**
 * Estimates Tab - WidgetDashboard 기반 동적 레이아웃
 */
import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, TrendingDown, Target, Users, Star,
  RefreshCw, DollarSign, BarChart3, GripVertical
} from 'lucide-react';
import WidgetDashboard from '../WidgetDashboard';
import { API_BASE } from '../../config/api';
import { formatCurrency } from '../../utils/widgetUtils';

function EstimatesTabWidget({ symbol, onRemove }) {
  const [estimatesData, setEstimatesData] = useState(null);
  const [analystData, setAnalystData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(null);

  useEffect(() => {
    if (symbol) loadEstimatesData();
  }, [symbol]);

  const loadEstimatesData = async () => {
    setLoading(true);
    try {
      const [estimatesRes, analystRes, quoteRes] = await Promise.all([
        fetch(`${API_BASE}/stock/estimates/${symbol}`),
        fetch(`${API_BASE}/stock/analyst/${symbol}`),
        fetch(`${API_BASE}/stock/quote/${symbol}`)
      ]);

      if (estimatesRes.ok) setEstimatesData(await estimatesRes.json());
      if (analystRes.ok) setAnalystData(await analystRes.json());
      if (quoteRes.ok) {
        const data = await quoteRes.json();
        setCurrentPrice(data.price);
      }
    } catch (error) {
      console.error('Error loading estimates data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRatingColor = (rating) => {
    const lowerRating = (rating || '').toLowerCase();
    if (lowerRating.includes('buy') || lowerRating.includes('overweight')) return 'text-green-400';
    if (lowerRating.includes('sell') || lowerRating.includes('underweight')) return 'text-red-400';
    return 'text-yellow-400';
  };

  if (loading) {
    return (
      <div className="bg-[#0d0d12] rounded-lg border border-gray-800 h-full flex items-center justify-center">
        <RefreshCw className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  const ratings = estimatesData?.recommendations || analystData?.ratings || {};
  const totalRatings = (ratings.strong_buy || 0) + (ratings.buy || 0) +
      (ratings.hold || 0) + (ratings.sell || 0) + (ratings.strong_sell || 0);

  const buyCount = (ratings.strong_buy || 0) + (ratings.buy || 0);
  const sellCount = (ratings.sell || 0) + (ratings.strong_sell || 0);
  const holdCount = ratings.hold || 0;

  const priceTarget = estimatesData?.price_target || analystData?.price_target || {};
  const targetPrice = priceTarget.mean || priceTarget.average;

  const upsidePct = currentPrice && targetPrice
    ? ((targetPrice - currentPrice) / currentPrice * 100).toFixed(1)
    : null;

  const getConsensusRating = () => {
    if (totalRatings === 0) return analystData?.consensus_rating || 'N/A';
    if (buyCount / totalRatings >= 0.6) return 'Buy';
    if (sellCount / totalRatings >= 0.6) return 'Sell';
    return 'Hold';
  };
  const consensusRating = getConsensusRating();

  return (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="drag-handle-area cursor-move p-1 hover:bg-gray-700 rounded">
            <GripVertical size={14} className="text-gray-500" />
          </div>
          <Target className="text-blue-500" size={24} />
          <div>
            <h3 className="text-lg font-semibold text-white">Analyst Estimates - {symbol}</h3>
            <p className="text-gray-400 text-xs">EPS, revenue estimates, and price targets</p>
          </div>
        </div>
        <button
          onClick={loadEstimatesData}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Consensus Rating & Price Target */}
        <div className="grid grid-cols-2 gap-4">
          {/* Consensus Rating */}
          <div className="bg-gray-800/30 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Star className="text-yellow-500" size={16} />
              Analyst Consensus
            </h4>
            {totalRatings > 0 || analystData ? (
              <div className="space-y-3">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${getRatingColor(consensusRating)}`}>{consensusRating}</div>
                  <div className="text-gray-400 text-xs">
                    Based on {totalRatings > 0 ? totalRatings : analystData?.number_of_analysts || 0} analysts
                  </div>
                </div>
                {totalRatings > 0 && (
                  <div className="flex h-4 rounded overflow-hidden">
                    {buyCount > 0 && (
                      <div className="bg-green-600 flex items-center justify-center text-[10px] text-white"
                        style={{ width: `${(buyCount / totalRatings) * 100}%` }}>{buyCount}</div>
                    )}
                    {holdCount > 0 && (
                      <div className="bg-yellow-500 flex items-center justify-center text-[10px] text-white"
                        style={{ width: `${(holdCount / totalRatings) * 100}%` }}>{holdCount}</div>
                    )}
                    {sellCount > 0 && (
                      <div className="bg-red-500 flex items-center justify-center text-[10px] text-white"
                        style={{ width: `${(sellCount / totalRatings) * 100}%` }}>{sellCount}</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-400 text-sm">No analyst data available</div>
            )}
          </div>

          {/* Price Target */}
          <div className="bg-gray-800/30 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Target className="text-blue-500" size={16} />
              Price Target
            </h4>
            {targetPrice ? (
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">${targetPrice?.toFixed(2) || '-'}</div>
                  {upsidePct && (
                    <div className={`text-sm font-medium ${parseFloat(upsidePct) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {parseFloat(upsidePct) >= 0 ? '+' : ''}{upsidePct}% upside
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-red-500/10 rounded p-2">
                    <div className="text-red-400">Low</div>
                    <div className="text-white font-medium">${priceTarget.low?.toFixed(2) || '-'}</div>
                  </div>
                  <div className="bg-blue-500/10 rounded p-2">
                    <div className="text-blue-400">Current</div>
                    <div className="text-white font-medium">${currentPrice?.toFixed(2) || '-'}</div>
                  </div>
                  <div className="bg-green-500/10 rounded p-2">
                    <div className="text-green-400">High</div>
                    <div className="text-white font-medium">${priceTarget.high?.toFixed(2) || '-'}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-400 text-sm">No price target data available</div>
            )}
          </div>
        </div>

        {/* EPS & Revenue Estimates */}
        <div className="grid grid-cols-2 gap-4">
          {estimatesData && Object.keys(estimatesData.eps || {}).length > 0 && (
            <div className="bg-gray-800/30 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <DollarSign className="text-green-500" size={16} />
                EPS Estimates
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(estimatesData.eps).slice(0, 4).map(([period, data]) => (
                  <div key={period} className="bg-gray-800/50 rounded p-2">
                    <div className="text-gray-400 text-[10px] mb-1">{period}</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-white">${data.estimate?.toFixed(2) || '-'}</span>
                      {data.growth && (
                        <span className={`text-[10px] ${data.growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {data.growth >= 0 ? '+' : ''}{(data.growth * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {estimatesData && Object.keys(estimatesData.revenue || {}).length > 0 && (
            <div className="bg-gray-800/30 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <BarChart3 className="text-blue-500" size={16} />
                Revenue Estimates
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(estimatesData.revenue).slice(0, 4).map(([period, data]) => (
                  <div key={period} className="bg-gray-800/50 rounded p-2">
                    <div className="text-gray-400 text-[10px] mb-1">{period}</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-white">{formatCurrency(data.estimate)}</span>
                      {data.growth && (
                        <span className={`text-[10px] ${data.growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {data.growth >= 0 ? '+' : ''}{(data.growth * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Empty State */}
        {!estimatesData && !analystData && !loading && (
          <div className="bg-gray-800/30 rounded-lg p-8 text-center">
            <Target className="mx-auto mb-3 text-gray-600" size={40} />
            <div className="text-gray-400">No estimates data available for {symbol}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export { EstimatesTabWidget };

const AVAILABLE_WIDGETS = [
  { id: 'estimates-tab', name: 'Estimates', description: 'Analyst estimates', defaultSize: { w: 12, h: 12 } },
];

const EstimatesTab = ({ symbol }) => {
  const DEFAULT_WIDGETS = [
    { id: 'estimates-tab-1', type: 'estimates-tab', symbol },
  ];

  const DEFAULT_LAYOUT = [
    { i: 'estimates-tab-1', x: 0, y: 0, w: 12, h: 12, minW: 6, minH: 8 },
  ];

  return (
    <WidgetDashboard
      dashboardId={`estimates-tab-${symbol}`}
      title="Estimates"
      subtitle={symbol}
      availableWidgets={AVAILABLE_WIDGETS}
      defaultWidgets={DEFAULT_WIDGETS}
      defaultLayout={DEFAULT_LAYOUT}
    />
  );
};

export default EstimatesTab;
