import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, TrendingDown, Target, Users, Star,
  RefreshCw, ChevronUp, ChevronDown, DollarSign, BarChart3
} from 'lucide-react';
import { API_BASE } from '../../config/api';
import { formatCurrency } from '../../utils/widgetUtils';

const EstimatesTab = ({ symbol }) => {
  const [estimatesData, setEstimatesData] = useState(null);
  const [analystData, setAnalystData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(null);

  useEffect(() => {
    if (symbol) {
      loadEstimatesData();
    }
  }, [symbol]);

  const loadEstimatesData = async () => {
    setLoading(true);
    try {
      const [estimatesRes, analystRes, quoteRes] = await Promise.all([
        fetch(`${API_BASE}/stock/estimates/${symbol}`),
        fetch(`${API_BASE}/stock/analyst/${symbol}`),
        fetch(`${API_BASE}/stock/quote/${symbol}`)
      ]);

      if (estimatesRes.ok) {
        const data = await estimatesRes.json();
        setEstimatesData(data);
      }

      if (analystRes.ok) {
        const data = await analystRes.json();
        setAnalystData(data);
      }

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

  const getRatingBgColor = (rating) => {
    const lowerRating = (rating || '').toLowerCase();
    if (lowerRating.includes('buy') || lowerRating.includes('overweight')) return 'bg-green-500/20';
    if (lowerRating.includes('sell') || lowerRating.includes('underweight')) return 'bg-red-500/20';
    return 'bg-yellow-500/20';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  // Use recommendations from estimates data (Yahoo Finance) as primary, fallback to analyst data (FMP)
  const ratings = estimatesData?.recommendations || analystData?.ratings || {};
  const totalRatings = (ratings.strong_buy || 0) + (ratings.buy || 0) +
      (ratings.hold || 0) + (ratings.sell || 0) + (ratings.strong_sell || 0);

  const buyCount = (ratings.strong_buy || 0) + (ratings.buy || 0);
  const sellCount = (ratings.sell || 0) + (ratings.strong_sell || 0);
  const holdCount = ratings.hold || 0;

  // Use price_target from estimates data (Yahoo Finance) as primary
  const priceTarget = estimatesData?.price_target || analystData?.price_target || {};
  const targetPrice = priceTarget.mean || priceTarget.average;

  const upsidePct = currentPrice && targetPrice
    ? ((targetPrice - currentPrice) / currentPrice * 100).toFixed(1)
    : null;

  // Determine consensus rating
  const getConsensusRating = () => {
    if (totalRatings === 0) return analystData?.consensus_rating || 'N/A';
    if (buyCount / totalRatings >= 0.6) return 'Buy';
    if (sellCount / totalRatings >= 0.6) return 'Sell';
    return 'Hold';
  };
  const consensusRating = getConsensusRating();

  // Prepare EPS chart data
  const epsChartData = estimatesData?.eps
    ? Object.entries(estimatesData.eps).map(([period, data]) => ({
        period,
        estimate: data.estimate,
        low: data.low,
        high: data.high
      }))
    : [];

  // Prepare Revenue chart data
  const revenueChartData = estimatesData?.revenue
    ? Object.entries(estimatesData.revenue).map(([period, data]) => ({
        period,
        estimate: data.estimate,
        low: data.low,
        high: data.high
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white flex items-center gap-2">
              <Target className="text-blue-500" size={24} />
              Analyst Estimates - {symbol}
            </h3>
            <p className="text-gray-400 text-sm mt-1">EPS, revenue estimates, and price targets</p>
          </div>
          <button
            onClick={loadEstimatesData}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white text-sm"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Consensus Rating & Price Target */}
      <div className="grid grid-cols-2 gap-6">
        {/* Consensus Rating */}
        <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Star className="text-yellow-500" size={20} />
            Analyst Consensus
          </h4>

          {totalRatings > 0 || analystData ? (
            <>
              <div className="text-center mb-6">
                <div className={`text-4xl font-bold mb-2 ${getRatingColor(consensusRating)}`}>
                  {consensusRating}
                </div>
                <div className="text-gray-400 text-sm">
                  Based on {totalRatings > 0 ? totalRatings : analystData?.number_of_analysts || 0} analysts
                </div>
              </div>

              {/* Rating Bar */}
              {totalRatings > 0 && (
                <div className="mb-4">
                  <div className="flex h-8 rounded-lg overflow-hidden">
                    {buyCount > 0 && (
                      <div
                        className="bg-green-600 flex items-center justify-center text-xs font-medium text-white"
                        style={{ width: `${(buyCount / totalRatings) * 100}%` }}
                      >
                        {buyCount}
                      </div>
                    )}
                    {holdCount > 0 && (
                      <div
                        className="bg-yellow-500 flex items-center justify-center text-xs font-medium text-white"
                        style={{ width: `${(holdCount / totalRatings) * 100}%` }}
                      >
                        {holdCount}
                      </div>
                    )}
                    {sellCount > 0 && (
                      <div
                        className="bg-red-500 flex items-center justify-center text-xs font-medium text-white"
                        style={{ width: `${(sellCount / totalRatings) * 100}%` }}
                      >
                        {sellCount}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-gray-400">
                    <span>Strong Buy / Buy</span>
                    <span>Hold</span>
                    <span>Sell / Strong Sell</span>
                  </div>
                </div>
              )}

              {/* Rating Breakdown */}
              <div className="grid grid-cols-5 gap-2 text-center text-xs">
                <div className="p-2 bg-green-500/10 rounded">
                  <div className="text-green-400 font-bold">{ratings.strong_buy || 0}</div>
                  <div className="text-gray-500">Strong Buy</div>
                </div>
                <div className="p-2 bg-green-500/10 rounded">
                  <div className="text-green-400 font-bold">{ratings.buy || 0}</div>
                  <div className="text-gray-500">Buy</div>
                </div>
                <div className="p-2 bg-yellow-500/10 rounded">
                  <div className="text-yellow-400 font-bold">{ratings.hold || 0}</div>
                  <div className="text-gray-500">Hold</div>
                </div>
                <div className="p-2 bg-red-500/10 rounded">
                  <div className="text-red-400 font-bold">{ratings.sell || 0}</div>
                  <div className="text-gray-500">Sell</div>
                </div>
                <div className="p-2 bg-red-500/10 rounded">
                  <div className="text-red-400 font-bold">{ratings.strong_sell || 0}</div>
                  <div className="text-gray-500">Strong Sell</div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-400">No analyst data available</div>
          )}
        </div>

        {/* Price Target */}
        <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Target className="text-blue-500" size={20} />
            Price Target
          </h4>

          {targetPrice ? (
            <>
              <div className="text-center mb-4">
                <div className="text-gray-400 text-sm mb-1">Average Target</div>
                <div className="text-4xl font-bold text-white">
                  ${targetPrice?.toFixed(2) || '-'}
                </div>
                {upsidePct && (
                  <div className={`text-lg font-medium mt-1 ${parseFloat(upsidePct) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {parseFloat(upsidePct) >= 0 ? '+' : ''}{upsidePct}% upside
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-red-500/10 rounded-lg">
                  <div className="text-red-400 text-sm">Low</div>
                  <div className="text-white font-bold">${priceTarget.low?.toFixed(2) || '-'}</div>
                </div>
                <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                  <div className="text-blue-400 text-sm">Current</div>
                  <div className="text-white font-bold">${currentPrice?.toFixed(2) || '-'}</div>
                </div>
                <div className="text-center p-3 bg-green-500/10 rounded-lg">
                  <div className="text-green-400 text-sm">High</div>
                  <div className="text-white font-bold">${priceTarget.high?.toFixed(2) || '-'}</div>
                </div>
              </div>

              {/* Price Range Visual */}
              {priceTarget.low && priceTarget.high && currentPrice && (
                <div className="relative h-4 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="absolute h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                    style={{ width: '100%' }}
                  />
                  {/* Current price marker */}
                  <div
                    className="absolute top-0 w-1 h-full bg-white"
                    style={{
                      left: `${Math.min(100, Math.max(0,
                        ((currentPrice - priceTarget.low) /
                        (priceTarget.high - priceTarget.low)) * 100
                      ))}%`
                    }}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-400">No price target data available</div>
          )}
        </div>
      </div>

      {/* EPS Estimates */}
      {estimatesData && Object.keys(estimatesData.eps || {}).length > 0 && (
        <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <DollarSign className="text-green-500" size={20} />
            EPS Estimates
          </h4>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Object.entries(estimatesData.eps).map(([period, data]) => (
              <div key={period} className="bg-gray-800/30 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-2">{period}</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">${data.estimate?.toFixed(2) || '-'}</span>
                  {data.growth && (
                    <span className={`text-sm font-medium ${data.growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {data.growth >= 0 ? '+' : ''}{(data.growth * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="text-gray-500 text-xs mt-2">
                  Range: ${data.low?.toFixed(2) || '-'} - ${data.high?.toFixed(2) || '-'}
                </div>
                {data.num_analysts && (
                  <div className="text-gray-500 text-xs">{data.num_analysts} analysts</div>
                )}
              </div>
            ))}
          </div>

          {/* EPS Chart */}
          {epsChartData.length > 0 && (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={epsChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="period" tick={{ fill: '#666' }} />
                  <YAxis tick={{ fill: '#666' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value) => `$${value?.toFixed(2)}`}
                  />
                  <Legend />
                  <Bar dataKey="estimate" fill="#3b82f6" name="Estimate" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Revenue Estimates */}
      {estimatesData && Object.keys(estimatesData.revenue || {}).length > 0 && (
        <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="text-blue-500" size={20} />
            Revenue Estimates
          </h4>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Object.entries(estimatesData.revenue).map(([period, data]) => (
              <div key={period} className="bg-gray-800/30 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-2">{period}</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">{formatCurrency(data.estimate)}</span>
                  {data.growth && (
                    <span className={`text-sm font-medium ${data.growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {data.growth >= 0 ? '+' : ''}{(data.growth * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
                {data.num_analysts && (
                  <div className="text-gray-500 text-xs mt-2">{data.num_analysts} analysts</div>
                )}
              </div>
            ))}
          </div>

          {/* Revenue Chart */}
          {revenueChartData.length > 0 && (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="period" tick={{ fill: '#666' }} />
                  <YAxis tick={{ fill: '#666' }} tickFormatter={(value) => `$${(value / 1e9).toFixed(0)}B`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Legend />
                  <Bar dataKey="estimate" fill="#22c55e" name="Estimate" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* EPS Revisions */}
      {estimatesData?.revisions && Object.keys(estimatesData.revisions).length > 0 && (
        <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
          <h4 className="text-lg font-semibold text-white mb-4">EPS Estimate Revisions</h4>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(estimatesData.revisions).map(([period, data]) => (
              <div key={period} className="bg-gray-800/30 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-3">{period}</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-sm">Last 7 days</span>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-green-400 text-sm">
                        <ChevronUp size={14} />
                        {data.up_last_7_days || 0}
                      </span>
                      <span className="flex items-center gap-1 text-red-400 text-sm">
                        <ChevronDown size={14} />
                        {data.down_last_7_days || 0}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-sm">Last 30 days</span>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-green-400 text-sm">
                        <ChevronUp size={14} />
                        {data.up_last_30_days || 0}
                      </span>
                      <span className="flex items-center gap-1 text-red-400 text-sm">
                        <ChevronDown size={14} />
                        {data.down_last_30_days || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!estimatesData && !analystData && !loading && (
        <div className="bg-[#1a1a1a] rounded-lg p-12 text-center border border-gray-800">
          <Target className="mx-auto mb-4 text-gray-600" size={48} />
          <div className="text-gray-400 text-lg">No estimates data available for {symbol}</div>
        </div>
      )}
    </div>
  );
};

export default EstimatesTab;
