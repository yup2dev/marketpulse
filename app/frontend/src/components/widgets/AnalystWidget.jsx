/**
 * AnalystWidget - Displays analyst recommendations and price targets
 */
import { useState, useEffect } from 'react';
import { Users, TrendingUp, TrendingDown, Target } from 'lucide-react';
import {
  WidgetHeader,
  LoadingSpinner,
  NoDataState,
  formatPrice,
  API_BASE,
  WIDGET_STYLES,
} from './common';

const RATING_COLORS = {
  'Buy': 'bg-green-500',
  'Strong Buy': 'bg-green-600',
  'Hold': 'bg-yellow-500',
  'Sell': 'bg-red-500',
  'Strong Sell': 'bg-red-600',
  'N/A': 'bg-gray-500'
};

const RATING_LABELS = {
  'Buy': '매수',
  'Strong Buy': '적극 매수',
  'Hold': '중립',
  'Sell': '매도',
  'Strong Sell': '적극 매도',
  'N/A': 'N/A'
};

const AnalystWidget = ({ symbol, onRemove }) => {
  const [analyst, setAnalyst] = useState(null);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (symbol) {
      loadData();
    }
  }, [symbol]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [analystRes, quoteRes] = await Promise.all([
        fetch(`${API_BASE}/stock/analyst/${symbol}`),
        fetch(`${API_BASE}/stock/quote/${symbol}`)
      ]);

      if (analystRes.ok) {
        setAnalyst(await analystRes.json());
      }
      if (quoteRes.ok) {
        setQuote(await quoteRes.json());
      }
    } catch (error) {
      console.error('Error loading analyst data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateUpside = () => {
    if (!analyst?.price_target?.average || !quote?.price) return null;
    return ((analyst.price_target.average - quote.price) / quote.price * 100);
  };

  const upside = calculateUpside();

  const RatingBar = ({ label, count, total, color }) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-20">{label}</span>
        <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full ${color} transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 w-6 text-right">{count}</span>
      </div>
    );
  };

  return (
    <div className={WIDGET_STYLES.container}>
      <WidgetHeader
        icon={Users}
        iconColor="text-blue-400"
        title={`${symbol} - Analyst`}
        loading={loading}
        onRefresh={loadData}
        onRemove={onRemove}
      />

      <div className={`${WIDGET_STYLES.content} p-3`}>
        {loading ? (
          <LoadingSpinner color="border-blue-500" />
        ) : analyst ? (
          <div className="space-y-4">
            {/* Consensus Badge */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 mb-1">Consensus Rating</div>
                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-white font-semibold ${
                  RATING_COLORS[analyst.consensus_rating] || RATING_COLORS['N/A']
                }`}>
                  {analyst.consensus_rating}
                  <span className="text-sm opacity-80">
                    ({RATING_LABELS[analyst.consensus_rating] || 'N/A'})
                  </span>
                </span>
              </div>
              {analyst.number_of_analysts && (
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">{analyst.number_of_analysts}</div>
                  <div className="text-xs text-gray-500">Analysts</div>
                </div>
              )}
            </div>

            {/* Rating Distribution */}
            {analyst.ratings?.total > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase">Rating Distribution</h4>
                <div className="space-y-1.5">
                  <RatingBar label="Strong Buy" count={analyst.ratings.strong_buy || 0} total={analyst.ratings.total} color="bg-green-600" />
                  <RatingBar label="Buy" count={analyst.ratings.buy || 0} total={analyst.ratings.total} color="bg-green-400" />
                  <RatingBar label="Hold" count={analyst.ratings.hold || 0} total={analyst.ratings.total} color="bg-yellow-500" />
                  <RatingBar label="Sell" count={analyst.ratings.sell || 0} total={analyst.ratings.total} color="bg-red-400" />
                  <RatingBar label="Strong Sell" count={analyst.ratings.strong_sell || 0} total={analyst.ratings.total} color="bg-red-600" />
                </div>
              </div>
            )}

            {/* Price Target */}
            {analyst.price_target?.average && (
              <div className="space-y-3 pt-3 border-t border-gray-800">
                <h4 className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-2">
                  <Target size={14} />
                  Price Target
                </h4>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                    <div className="text-xs text-gray-500 mb-1">Low</div>
                    <div className="text-white font-medium">{formatPrice(analyst.price_target.low)}</div>
                  </div>
                  <div className="bg-blue-500/20 rounded-lg p-2 text-center border border-blue-500/30">
                    <div className="text-xs text-blue-400 mb-1">Average</div>
                    <div className="text-blue-400 font-bold text-lg">{formatPrice(analyst.price_target.average)}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                    <div className="text-xs text-gray-500 mb-1">High</div>
                    <div className="text-white font-medium">{formatPrice(analyst.price_target.high)}</div>
                  </div>
                </div>

                {/* Upside/Downside */}
                {upside !== null && (
                  <div className="flex items-center justify-between py-2 bg-gray-800/30 rounded-lg px-3">
                    <span className="text-gray-400 text-sm">Expected Return</span>
                    <span className={`flex items-center gap-1 font-bold text-lg ${
                      upside > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {upside > 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                      {upside > 0 ? '+' : ''}{upside.toFixed(2)}%
                    </span>
                  </div>
                )}

                {/* Current vs Target Comparison */}
                {quote?.price && (
                  <div className="flex justify-between items-center text-sm">
                    <div>
                      <span className="text-gray-500">Current: </span>
                      <span className="text-white font-medium">{formatPrice(quote.price)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Target: </span>
                      <span className="text-blue-400 font-medium">{formatPrice(analyst.price_target.average)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <NoDataState message="No analyst data available" />
        )}
      </div>
    </div>
  );
};

export default AnalystWidget;
