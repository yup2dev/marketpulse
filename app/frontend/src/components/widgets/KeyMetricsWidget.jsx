import { useState, useEffect } from 'react';
import { BarChart2 } from 'lucide-react';
import {
  WidgetHeader,
  LoadingSpinner,
  NoDataState,
  formatNumber,
  formatPrice,
  API_BASE,
  WIDGET_STYLES,
  WIDGET_ICON_COLORS,
  LOADING_COLORS,
} from './common';

const KeyMetricsWidget = ({ symbol, onRemove }) => {
  const [quote, setQuote] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (symbol) {
      loadData();
    }
  }, [symbol]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [quoteRes, infoRes] = await Promise.all([
        fetch(`${API_BASE}/stock/quote/${symbol}`),
        fetch(`${API_BASE}/stock/info/${symbol}`)
      ]);

      if (quoteRes.ok) {
        setQuote(await quoteRes.json());
      }
      if (infoRes.ok) {
        setInfo(await infoRes.json());
      }
    } catch (error) {
      console.error('Error loading key metrics:', error);
    } finally {
      setLoading(false);
    }
  };


  const MetricRow = ({ label, value, highlight = false }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`font-medium ${highlight ? 'text-blue-400 text-lg' : 'text-white'}`}>
        {value}
      </span>
    </div>
  );

  return (
    <div className={WIDGET_STYLES.container}>
      <WidgetHeader
        icon={BarChart2}
        iconColor={WIDGET_ICON_COLORS.metrics}
        title={`${symbol} - Metrics`}
        loading={loading}
        onRefresh={loadData}
        onRemove={onRemove}
      />

      <div className={`${WIDGET_STYLES.content} ${WIDGET_STYLES.contentPadding}`}>
        {loading ? (
          <LoadingSpinner color={LOADING_COLORS.metrics} />
        ) : quote && info ? (
          <div className="space-y-6">
            {/* Price Ranges */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Price Ranges</h4>
              <div className="space-y-1">
                <MetricRow
                  label="Day Range"
                  value={`${formatPrice(quote.low)} - ${formatPrice(quote.high)}`}
                />
                <MetricRow
                  label="52-Week High"
                  value={formatPrice(quote.year_high)}
                  highlight={quote.price >= quote.year_high * 0.95}
                />
                <MetricRow
                  label="52-Week Low"
                  value={formatPrice(quote.year_low)}
                />
                <MetricRow
                  label="52-Week Range"
                  value={`${formatPrice(quote.year_low)} - ${formatPrice(quote.year_high)}`}
                />
              </div>
            </div>

            {/* Valuation Metrics */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Valuation</h4>
              <div className="space-y-1">
                <MetricRow
                  label="Market Cap"
                  value={formatNumber(info.market_cap)}
                />
                <MetricRow
                  label="P/E Ratio"
                  value={info.pe_ratio?.toFixed(2) || 'N/A'}
                  highlight={info.pe_ratio && info.pe_ratio < 15}
                />
                <MetricRow
                  label="EPS (TTM)"
                  value={info.eps ? formatPrice(info.eps) : 'N/A'}
                />
                <MetricRow
                  label="Dividend Yield"
                  value={info.dividend_yield ? (info.dividend_yield * 100).toFixed(2) + '%' : 'N/A'}
                  highlight={info.dividend_yield && info.dividend_yield > 0.03}
                />
              </div>
            </div>

            {/* Trading Metrics */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Trading</h4>
              <div className="space-y-1">
                <MetricRow
                  label="Volume"
                  value={formatNumber(quote.volume)}
                />
                <MetricRow
                  label="Avg Volume"
                  value={info.avg_volume ? formatNumber(info.avg_volume) : 'N/A'}
                />
                <MetricRow
                  label="Beta"
                  value={info.beta?.toFixed(2) || 'N/A'}
                />
              </div>
            </div>

            {/* Company Info */}
            {info.sector && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Company</h4>
                <div className="space-y-1">
                  <MetricRow
                    label="Sector"
                    value={info.sector}
                  />
                  <MetricRow
                    label="Industry"
                    value={info.industry}
                  />
                  {info.country && (
                    <MetricRow
                      label="Country"
                      value={info.country}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <NoDataState />
        )}
      </div>
    </div>
  );
};

export default KeyMetricsWidget;
