/**
 * EarningsWidget - Displays quarterly earnings data with EPS beat/miss
 */
import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import {
  WidgetHeader,
  LoadingSpinner,
  NoDataState,
  formatNumber,
  formatPrice,
  API_BASE,
  WIDGET_STYLES,
} from './common';

const EarningsWidget = ({ symbol, onRemove }) => {
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (symbol) {
      loadData();
    }
  }, [symbol]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/earnings/${symbol}`);
      if (res.ok) {
        setEarnings(await res.json());
      }
    } catch (error) {
      console.error('Error loading earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSurpriseColor = (surprise) => {
    if (surprise === null || surprise === undefined) return 'text-gray-400';
    if (surprise > 0) return 'text-green-400';
    if (surprise < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  const getSurpriseBadge = (surprise) => {
    if (surprise === null || surprise === undefined) return null;
    const isPositive = surprise > 0;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
        isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
      }`}>
        {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {isPositive ? '+' : ''}{surprise?.toFixed(2)}%
      </span>
    );
  };

  return (
    <div className={WIDGET_STYLES.container}>
      <WidgetHeader
        icon={Calendar}
        iconColor="text-amber-400"
        title={`${symbol} - Earnings`}
        loading={loading}
        onRefresh={loadData}
        onRemove={onRemove}
      />

      <div className={`${WIDGET_STYLES.content} p-3`}>
        {loading ? (
          <LoadingSpinner color="border-amber-500" />
        ) : earnings?.earnings?.length > 0 ? (
          <div className="space-y-3">
            {/* Header */}
            <div className="grid grid-cols-4 gap-2 text-xs text-gray-500 font-medium pb-2 border-b border-gray-800">
              <div>Period</div>
              <div className="text-right">EPS Actual</div>
              <div className="text-right">EPS Est.</div>
              <div className="text-right">Surprise</div>
            </div>

            {/* Earnings List */}
            {earnings.earnings.slice(0, 8).map((item, idx) => (
              <div
                key={idx}
                className="grid grid-cols-4 gap-2 py-2 border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30 rounded transition-colors"
              >
                <div>
                  <div className="text-white text-sm font-medium">
                    {item.fiscal_period || `Q${item.fiscal_quarter}`}
                  </div>
                  <div className="text-xs text-gray-500">{item.fiscal_year}</div>
                </div>
                <div className="text-right">
                  <span className="text-white font-medium">
                    {item.eps_actual !== null ? formatPrice(item.eps_actual) : 'N/A'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-gray-400">
                    {item.eps_estimated !== null ? formatPrice(item.eps_estimated) : 'N/A'}
                  </span>
                </div>
                <div className="text-right">
                  {getSurpriseBadge(item.eps_surprise_percent)}
                </div>
              </div>
            ))}

            {/* Revenue Summary */}
            {earnings.earnings[0]?.revenue_actual && (
              <div className="mt-4 pt-3 border-t border-gray-700">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Latest Revenue</h4>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Revenue</span>
                  <span className="text-white font-medium">
                    {formatNumber(earnings.earnings[0].revenue_actual)}
                  </span>
                </div>
                {earnings.earnings[0].net_income && (
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-gray-400 text-sm">Net Income</span>
                    <span className="text-white font-medium">
                      {formatNumber(earnings.earnings[0].net_income)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <NoDataState message="No earnings data available" />
        )}
      </div>
    </div>
  );
};

export default EarningsWidget;
