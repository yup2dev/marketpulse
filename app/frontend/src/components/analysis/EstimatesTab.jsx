/**
 * Estimates Tab - Data-Focused Layout with Standard Widget Controls
 * Standard Controls: Close, Refresh, Symbol Selector, Corner Resize
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, TrendingDown, Target, Users, Star,
  RefreshCw, DollarSign, BarChart3
} from 'lucide-react';
import { API_BASE } from '../../config/api';
import { formatCurrency } from '../../utils/widgetUtils';
import { WidgetHeader, AddWidgetPlaceholder, ResizeHandle } from '../common/WidgetHeader';

// Resizable Widget Wrapper
function ResizableWidgetWrapper({ children, minWidth = 300, minHeight = 200, defaultHeight = 400 }) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 'auto', height: defaultHeight });

  const handleResize = useCallback((deltaX, deltaY) => {
    setSize(prev => ({
      width: prev.width === 'auto' ? 'auto' : Math.max(minWidth, prev.width + deltaX),
      height: Math.max(minHeight, (prev.height || defaultHeight) + deltaY)
    }));
  }, [minWidth, minHeight, defaultHeight]);

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{
        height: size.height === 'auto' ? 'auto' : `${size.height}px`,
        minHeight: `${minHeight}px`,
      }}
    >
      {children}
      <ResizeHandle onResize={handleResize} />
    </div>
  );
}

const getRatingColor = (rating) => {
  const lowerRating = (rating || '').toLowerCase();
  if (lowerRating.includes('buy') || lowerRating.includes('overweight')) return 'text-green-400';
  if (lowerRating.includes('sell') || lowerRating.includes('underweight')) return 'text-red-400';
  return 'text-yellow-400';
};

// Consensus Rating Widget
function ConsensusRatingWidget({ estimatesData, analystData, totalRatings, buyCount, sellCount, holdCount, consensusRating, loading, symbol, onSymbolChange, onRefresh, onClose }) {
  return (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden h-full flex flex-col">
      <WidgetHeader
        title="Analyst Consensus"
        icon={Star}
        iconColor="text-yellow-400"
        symbol={symbol}
        onSymbolChange={onSymbolChange}
        onRefresh={onRefresh}
        onClose={onClose}
        loading={loading}
      />
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500" />
          </div>
        ) : totalRatings > 0 || analystData ? (
          <div className="space-y-4">
            <div className="text-center">
              <div className={`text-3xl font-bold ${getRatingColor(consensusRating)}`}>{consensusRating}</div>
              <div className="text-gray-400 text-sm mt-1">
                Based on {totalRatings > 0 ? totalRatings : analystData?.number_of_analysts || 0} analysts
              </div>
            </div>
            {totalRatings > 0 && (
              <>
                <div className="flex h-6 rounded-lg overflow-hidden">
                  {buyCount > 0 && (
                    <div className="bg-green-600 flex items-center justify-center text-xs text-white font-medium"
                      style={{ width: `${(buyCount / totalRatings) * 100}%` }}>{buyCount}</div>
                  )}
                  {holdCount > 0 && (
                    <div className="bg-yellow-500 flex items-center justify-center text-xs text-white font-medium"
                      style={{ width: `${(holdCount / totalRatings) * 100}%` }}>{holdCount}</div>
                  )}
                  {sellCount > 0 && (
                    <div className="bg-red-500 flex items-center justify-center text-xs text-white font-medium"
                      style={{ width: `${(sellCount / totalRatings) * 100}%` }}>{sellCount}</div>
                  )}
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Buy ({buyCount})</span>
                  <span>Hold ({holdCount})</span>
                  <span>Sell ({sellCount})</span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 text-sm">No analyst data available</div>
        )}
      </div>
    </div>
  );
}

// Price Target Widget
function PriceTargetWidget({ priceTarget, currentPrice, upsidePct, loading, symbol, onSymbolChange, onRefresh, onClose }) {
  const targetPrice = priceTarget?.mean || priceTarget?.average;

  return (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden h-full flex flex-col">
      <WidgetHeader
        title="Price Target"
        icon={Target}
        iconColor="text-blue-400"
        symbol={symbol}
        onSymbolChange={onSymbolChange}
        onRefresh={onRefresh}
        onClose={onClose}
        loading={loading}
      />
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : targetPrice ? (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">${targetPrice?.toFixed(2) || '-'}</div>
              {upsidePct && (
                <div className={`text-lg font-medium mt-1 ${parseFloat(upsidePct) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {parseFloat(upsidePct) >= 0 ? '+' : ''}{upsidePct}% upside
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-red-500/10 rounded-lg p-3">
                <div className="text-red-400 text-xs mb-1">Low</div>
                <div className="text-white font-bold">${priceTarget?.low?.toFixed(2) || '-'}</div>
              </div>
              <div className="bg-blue-500/10 rounded-lg p-3">
                <div className="text-blue-400 text-xs mb-1">Current</div>
                <div className="text-white font-bold">${currentPrice?.toFixed(2) || '-'}</div>
              </div>
              <div className="bg-green-500/10 rounded-lg p-3">
                <div className="text-green-400 text-xs mb-1">High</div>
                <div className="text-white font-bold">${priceTarget?.high?.toFixed(2) || '-'}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 text-sm">No price target data available</div>
        )}
      </div>
    </div>
  );
}

// EPS Estimates Widget
function EPSEstimatesWidget({ epsEstimates, loading, symbol, onSymbolChange, onRefresh, onClose }) {
  return (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden h-full flex flex-col">
      <WidgetHeader
        title="EPS Estimates"
        icon={DollarSign}
        iconColor="text-green-400"
        symbol={symbol}
        onSymbolChange={onSymbolChange}
        onRefresh={onRefresh}
        onClose={onClose}
        loading={loading}
      />
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
          </div>
        ) : epsEstimates && Object.keys(epsEstimates).length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(epsEstimates).slice(0, 4).map(([period, data]) => (
              <div key={period} className="bg-gray-800/30 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-1">{period}</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-white">${data.estimate?.toFixed(2) || '-'}</span>
                  {data.growth && (
                    <span className={`text-xs ${data.growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {data.growth >= 0 ? '+' : ''}{(data.growth * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 text-sm">No EPS estimates available</div>
        )}
      </div>
    </div>
  );
}

// Revenue Estimates Widget
function RevenueEstimatesWidget({ revenueEstimates, loading, symbol, onSymbolChange, onRefresh, onClose }) {
  return (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden h-full flex flex-col">
      <WidgetHeader
        title="Revenue Estimates"
        icon={BarChart3}
        iconColor="text-blue-400"
        symbol={symbol}
        onSymbolChange={onSymbolChange}
        onRefresh={onRefresh}
        onClose={onClose}
        loading={loading}
      />
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : revenueEstimates && Object.keys(revenueEstimates).length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(revenueEstimates).slice(0, 4).map(([period, data]) => (
              <div key={period} className="bg-gray-800/30 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-1">{period}</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-white">{formatCurrency(data.estimate)}</span>
                  {data.growth && (
                    <span className={`text-xs ${data.growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {data.growth >= 0 ? '+' : ''}{(data.growth * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 text-sm">No revenue estimates available</div>
        )}
      </div>
    </div>
  );
}

// Main EstimatesTab Component
const EstimatesTab = ({ symbol: initialSymbol }) => {
  const [symbol, setSymbol] = useState(initialSymbol || 'AAPL');
  const [estimatesData, setEstimatesData] = useState(null);
  const [analystData, setAnalystData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(null);

  // Widget visibility state
  const [visibleWidgets, setVisibleWidgets] = useState({
    consensus: true,
    priceTarget: true,
    eps: true,
    revenue: true
  });

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

  const handleSymbolChange = (newSymbol) => {
    setSymbol(newSymbol);
  };

  const handleCloseWidget = (widgetId) => {
    setVisibleWidgets(prev => ({ ...prev, [widgetId]: false }));
  };

  const handleAddWidget = (widgetId) => {
    setVisibleWidgets(prev => ({ ...prev, [widgetId]: true }));
  };

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Analyst Estimates - {symbol}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={loadEstimatesData}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh All
          </button>
        </div>
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Consensus Rating Widget */}
        <div className="col-span-6">
          {visibleWidgets.consensus ? (
            <ResizableWidgetWrapper minHeight={200} defaultHeight={280}>
              <ConsensusRatingWidget
                estimatesData={estimatesData}
                analystData={analystData}
                totalRatings={totalRatings}
                buyCount={buyCount}
                sellCount={sellCount}
                holdCount={holdCount}
                consensusRating={consensusRating}
                loading={loading}
                symbol={symbol}
                onSymbolChange={handleSymbolChange}
                onRefresh={loadEstimatesData}
                onClose={() => handleCloseWidget('consensus')}
              />
            </ResizableWidgetWrapper>
          ) : (
            <AddWidgetPlaceholder onAdd={() => handleAddWidget('consensus')} widgetType="consensus" label="Add Consensus Widget" />
          )}
        </div>

        {/* Price Target Widget */}
        <div className="col-span-6">
          {visibleWidgets.priceTarget ? (
            <ResizableWidgetWrapper minHeight={200} defaultHeight={280}>
              <PriceTargetWidget
                priceTarget={priceTarget}
                currentPrice={currentPrice}
                upsidePct={upsidePct}
                loading={loading}
                symbol={symbol}
                onSymbolChange={handleSymbolChange}
                onRefresh={loadEstimatesData}
                onClose={() => handleCloseWidget('priceTarget')}
              />
            </ResizableWidgetWrapper>
          ) : (
            <AddWidgetPlaceholder onAdd={() => handleAddWidget('priceTarget')} widgetType="priceTarget" label="Add Price Target Widget" />
          )}
        </div>

        {/* EPS Estimates Widget */}
        <div className="col-span-6">
          {visibleWidgets.eps ? (
            <ResizableWidgetWrapper minHeight={200} defaultHeight={250}>
              <EPSEstimatesWidget
                epsEstimates={estimatesData?.eps}
                loading={loading}
                symbol={symbol}
                onSymbolChange={handleSymbolChange}
                onRefresh={loadEstimatesData}
                onClose={() => handleCloseWidget('eps')}
              />
            </ResizableWidgetWrapper>
          ) : (
            <AddWidgetPlaceholder onAdd={() => handleAddWidget('eps')} widgetType="eps" label="Add EPS Widget" />
          )}
        </div>

        {/* Revenue Estimates Widget */}
        <div className="col-span-6">
          {visibleWidgets.revenue ? (
            <ResizableWidgetWrapper minHeight={200} defaultHeight={250}>
              <RevenueEstimatesWidget
                revenueEstimates={estimatesData?.revenue}
                loading={loading}
                symbol={symbol}
                onSymbolChange={handleSymbolChange}
                onRefresh={loadEstimatesData}
                onClose={() => handleCloseWidget('revenue')}
              />
            </ResizableWidgetWrapper>
          ) : (
            <AddWidgetPlaceholder onAdd={() => handleAddWidget('revenue')} widgetType="revenue" label="Add Revenue Widget" />
          )}
        </div>
      </div>
    </div>
  );
};

export default EstimatesTab;

// Export for backward compatibility
export { EstimatesTab as EstimatesTabWidget };
