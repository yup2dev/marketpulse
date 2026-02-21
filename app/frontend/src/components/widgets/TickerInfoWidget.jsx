import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Building2 } from 'lucide-react';
import useTheme from '../../hooks/useTheme';
import {
  WidgetHeader,
  LoadingSpinner,
  NoDataState,
  formatNumber,
  formatPrice,
  API_BASE,
  WIDGET_STYLES,
  LOADING_COLORS,
} from './constants';
import useRefreshStore from '../../store/refreshStore';

const TickerInfoWidget = ({ symbol, onRemove }) => {
  const { classes } = useTheme();
  const [quote, setQuote] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const { refreshKey } = useRefreshStore();

  useEffect(() => {
    if (symbol) {
      loadData();
    }
  }, [symbol, refreshKey]);

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
      console.error('Error loading ticker info:', error);
    } finally {
      setLoading(false);
    }
  };


  const isPositive = quote?.change >= 0;

  return (
    <div className={WIDGET_STYLES.container}>
      <WidgetHeader
        icon={Building2}
        title={`${symbol} - Info`}
        loading={loading}
        onRefresh={loadData}
        onRemove={onRemove}
      />

      <div className={`${WIDGET_STYLES.content} ${WIDGET_STYLES.contentPadding}`}>
        {loading ? (
          <LoadingSpinner color={LOADING_COLORS.info} />
        ) : quote && info ? (
          <div className="space-y-4">
            {/* Company Header */}
            <div className="pb-4 border-b border-gray-800">
              <h4 className="text-lg font-bold text-white mb-1">{info.name}</h4>
              <div className="text-sm text-gray-400">{info.sector} • {info.industry}</div>
            </div>

            {/* Price Information */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Current Price</span>
                <span className="text-2xl font-bold text-white">{formatPrice(quote.price)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Day's Change</span>
                <div className="text-right">
                  <div className={`text-lg font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                    {isPositive ? <TrendingUp className="inline mr-1" size={18} /> : <TrendingDown className="inline mr-1" size={18} />}
                    {isPositive ? '+' : ''}{formatPrice(quote.change)}
                  </div>
                  <div className={`text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    ({isPositive ? '+' : ''}{quote.change_percent?.toFixed(2)}%)
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-800"></div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Volume</span>
                <div className="text-right">
                  <span className="text-white font-medium">{formatNumber(quote.volume)}</span>
                  {info.avg_volume && quote.volume && (
                    <div className={`text-xs ${
                      (quote.volume / info.avg_volume) >= 1.5 ? 'text-green-400' :
                      (quote.volume / info.avg_volume) <= 0.5 ? 'text-red-400' :
                      'text-gray-400'
                    }`}>
                      {((quote.volume / info.avg_volume) * 100).toFixed(0)}% of avg
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Avg Volume</span>
                <span className="text-white font-medium">{info.avg_volume ? formatNumber(info.avg_volume) : 'N/A'}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Market Cap</span>
                <span className="text-white font-medium">{formatNumber(info.market_cap)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Open</span>
                <span className="text-white">{formatPrice(quote.open)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Previous Close</span>
                <span className="text-white">{formatPrice(quote.price - quote.change)}</span>
              </div>

              <div className="pt-3 border-t border-gray-800"></div>

              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Day Range</span>
                <span className="text-white text-sm">
                  {formatPrice(quote.low)} - {formatPrice(quote.high)}
                </span>
              </div>
            </div>

            {/* Company Details */}
            {info.website && (
              <div className="pt-3 border-t border-gray-800">
                <div className="text-xs text-gray-500 mb-2">Company</div>
                <a
                  href={info.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
                >
                  {info.website}
                </a>
                {info.employees && (
                  <div className="text-sm text-gray-400 mt-2">
                    Employees: {info.employees.toLocaleString()}
                  </div>
                )}
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

export default TickerInfoWidget;
