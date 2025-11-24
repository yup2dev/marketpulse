import { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Plus, TrendingUp, Percent, Activity, X } from 'lucide-react';
import StockSelectorModal from '../StockSelectorModal';
import {
  WidgetHeader,
  LoadingSpinner,
  formatNumber,
  formatPrice,
  formatDate,
  API_BASE,
  WIDGET_STYLES,
  WIDGET_ICON_COLORS,
  LOADING_COLORS,
  CHART_COLORS,
  CHART_THEME,
  TIME_RANGES,
  MACRO_INDICATORS,
  WIDGET_CONSTRAINTS,
} from './common';

const ChartWidget = ({ initialSymbols = ['NVDA'], onRemove }) => {
  const [tickers, setTickers] = useState(initialSymbols.map(symbol => ({ symbol, color: CHART_COLORS[0], visible: true, type: 'stock' })));
  const [chartData, setChartData] = useState([]);
  const [timeRange, setTimeRange] = useState('1yr');
  const [loading, setLoading] = useState(false);
  const [normalized, setNormalized] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [showStockSelector, setShowStockSelector] = useState(false);
  const [showIndicatorSelector, setShowIndicatorSelector] = useState(false);
  const [tickerStats, setTickerStats] = useState({});

  // Load data for all tickers and indicators
  const loadData = useCallback(async () => {
    if (tickers.length === 0) return;

    setLoading(true);
    try {
      const period = TIME_RANGES.find(r => r.id === timeRange)?.period || '1y';

      // Separate stocks and indicators
      const stocks = tickers.filter(t => t.type === 'stock');
      const indicators = tickers.filter(t => t.type === 'indicator');

      // Load stock data
      const stockPromises = stocks.map(async (ticker) => {
        try {
          const [historyRes, quoteRes, infoRes] = await Promise.all([
            fetch(`${API_BASE}/stock/history/${ticker.symbol}?period=${period}`),
            fetch(`${API_BASE}/stock/quote/${ticker.symbol}`),
            fetch(`${API_BASE}/stock/info/${ticker.symbol}`)
          ]);

          const history = historyRes.ok ? await historyRes.json() : null;
          const quote = quoteRes.ok ? await quoteRes.json() : null;
          const info = infoRes.ok ? await infoRes.json() : null;

          return {
            symbol: ticker.symbol,
            type: 'stock',
            data: history?.data || [],
            quote,
            info
          };
        } catch (error) {
          console.error(`Error loading ${ticker.symbol}:`, error);
          return { symbol: ticker.symbol, type: 'stock', data: [], quote: null, info: null };
        }
      });

      // Load indicator data
      const indicatorPromises = indicators.map(async (indicator) => {
        try {
          const res = await fetch(`${API_BASE}/stock/indicator/${indicator.symbol}`);
          const indicatorData = res.ok ? await res.json() : null;

          return {
            symbol: indicator.symbol,
            type: 'indicator',
            data: indicatorData?.data || [],
            name: indicator.name
          };
        } catch (error) {
          console.error(`Error loading indicator ${indicator.symbol}:`, error);
          return { symbol: indicator.symbol, type: 'indicator', data: [], name: indicator.name };
        }
      });

      const results = await Promise.all([...stockPromises, ...indicatorPromises]);

      // Store stats for stocks
      const stats = {};
      results.filter(r => r.type === 'stock').forEach(({ symbol, quote, info }) => {
        if (quote && info) {
          stats[symbol] = { quote, info };
        }
      });
      setTickerStats(stats);

      // Merge data from all sources by date
      const mergedData = mergeData(results, normalized);
      setChartData(mergedData);
    } catch (error) {
      console.error('Error loading chart data:', error);
    } finally {
      setLoading(false);
    }
  }, [tickers, timeRange, normalized]);

  const mergeData = (results, normalize) => {
    if (results.length === 0) return [];

    // Find the date range from stock data (if any)
    let minDate = null;
    let maxDate = null;

    const stockResults = results.filter(r => r.type === 'stock');
    const indicatorResults = results.filter(r => r.type === 'indicator');

    // Determine date range from stocks, or from all data if no stocks
    if (stockResults.length > 0) {
      stockResults.forEach(({ data }) => {
        if (data && data.length > 0) {
          const dates = data.map(d => new Date(d.date));
          const localMin = new Date(Math.min(...dates));
          const localMax = new Date(Math.max(...dates));
          if (!minDate || localMin < minDate) minDate = localMin;
          if (!maxDate || localMax > maxDate) maxDate = localMax;
        }
      });
    } else {
      // If no stocks, use indicator date range
      results.forEach(({ data }) => {
        if (data && data.length > 0) {
          const dates = data.map(d => new Date(d.date));
          const localMin = new Date(Math.min(...dates));
          const localMax = new Date(Math.max(...dates));
          if (!minDate || localMin < minDate) minDate = localMin;
          if (!maxDate || localMax > maxDate) maxDate = localMax;
        }
      });
    }

    const dateMap = new Map();

    results.forEach(({ symbol, type, data }) => {
      if (!data || data.length === 0) return;

      // Filter data to match date range if we have a range
      let filteredData = data;
      if (minDate && maxDate) {
        filteredData = data.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate >= minDate && itemDate <= maxDate;
        });
      }

      if (type === 'stock') {
        // Sort by date and use first item as base for normalization
        const sortedData = [...filteredData].sort((a, b) => new Date(a.date) - new Date(b.date));
        const basePrice = normalize && sortedData.length > 0 ? sortedData[0].close : 1;

        sortedData.forEach(item => {
          if (!dateMap.has(item.date)) {
            dateMap.set(item.date, { date: item.date, timestamp: new Date(item.date).getTime() });
          }
          const entry = dateMap.get(item.date);
          entry[symbol] = normalize ? ((item.close / basePrice - 1) * 100) : item.close;
          entry[`${symbol}_volume`] = item.volume;
        });
      } else {
        // Indicator data
        const sortedData = [...filteredData].sort((a, b) => new Date(a.date) - new Date(b.date));
        const baseValue = normalize && sortedData.length > 0 ? sortedData[0].value : 1;

        sortedData.forEach(item => {
          if (!dateMap.has(item.date)) {
            dateMap.set(item.date, { date: item.date, timestamp: new Date(item.date).getTime() });
          }
          const entry = dateMap.get(item.date);
          entry[symbol] = normalize ? ((item.value / baseValue - 1) * 100) : item.value;
        });
      }
    });

    // Sort by timestamp to ensure proper ordering
    return Array.from(dateMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddTicker = (stock) => {
    if (tickers.length >= WIDGET_CONSTRAINTS.maxTickers) {
      alert(`Maximum ${WIDGET_CONSTRAINTS.maxTickers} items allowed`);
      return;
    }
    if (tickers.find(t => t.symbol === stock.symbol)) {
      alert('Ticker already added');
      return;
    }

    const color = CHART_COLORS[tickers.length % CHART_COLORS.length];
    setTickers([...tickers, { symbol: stock.symbol, color, visible: true, type: 'stock' }]);
    setShowStockSelector(false);
  };

  const handleAddIndicator = (indicator) => {
    if (tickers.length >= WIDGET_CONSTRAINTS.maxTickers) {
      alert(`Maximum ${WIDGET_CONSTRAINTS.maxTickers} items allowed`);
      return;
    }
    if (tickers.find(t => t.symbol === indicator.id)) {
      alert('Indicator already added');
      return;
    }

    const color = CHART_COLORS[tickers.length % CHART_COLORS.length];
    setTickers([...tickers, {
      symbol: indicator.id,
      name: indicator.name,
      color,
      visible: true,
      type: 'indicator'
    }]);
    setShowIndicatorSelector(false);
  };

  const handleRemoveTicker = (symbol) => {
    if (tickers.length === WIDGET_CONSTRAINTS.minTickers) {
      alert(`At least ${WIDGET_CONSTRAINTS.minTickers} item required`);
      return;
    }
    setTickers(tickers.filter(t => t.symbol !== symbol));
  };

  const toggleTickerVisibility = (symbol) => {
    setTickers(tickers.map(t =>
      t.symbol === symbol ? { ...t, visible: !t.visible } : t
    ));
  };


  return (
    <div className={WIDGET_STYLES.container}>
      <WidgetHeader
        icon={TrendingUp}
        iconColor={WIDGET_ICON_COLORS.chart}
        title="Advanced Chart"
        subtitle={`${tickers.filter(t => t.visible).length} item${tickers.filter(t => t.visible).length !== 1 ? 's' : ''}`}
        loading={loading}
        onRefresh={loadData}
        onRemove={onRemove}
      >
        {/* Add Stock Button */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setShowStockSelector(true);
          }}
          className="hover:text-white p-1.5 text-gray-400"
          title="Add Stock"
        >
          <Plus size={16} />
        </button>
        {/* Add Indicator Button */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setShowIndicatorSelector(!showIndicatorSelector);
          }}
          className="hover:text-white p-1.5 text-gray-400"
          title="Add Indicator"
        >
          <Activity size={16} />
        </button>
      </WidgetHeader>

      {/* Indicator Selector Dropdown */}
      {showIndicatorSelector && (
        <div className="absolute top-14 right-4 z-50 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-2xl py-2 min-w-[300px]">
          <div className="px-3 py-2 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white">Macro Indicators</div>
              <button
                onClick={() => setShowIndicatorSelector(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="py-1">
            {MACRO_INDICATORS.map((indicator) => (
              <button
                key={indicator.id}
                onClick={() => handleAddIndicator(indicator)}
                className="w-full px-3 py-2 hover:bg-gray-800 transition-colors text-left"
                disabled={tickers.some(t => t.symbol === indicator.id)}
              >
                <div className="text-sm font-medium text-white">{indicator.name}</div>
                <div className="text-xs text-gray-400">{indicator.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`${WIDGET_STYLES.content} ${WIDGET_STYLES.contentPadding}`}>
        {loading && tickers.length === 0 ? (
          <LoadingSpinner size={32} color={LOADING_COLORS.chart} message="Loading chart data..." />
        ) : (
          <div className="space-y-4">
            {/* Ticker Selection and Controls */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* Ticker Chips */}
              <div className="flex items-center gap-2 flex-wrap">
                {tickers.map((ticker) => (
                  <div
                    key={ticker.symbol}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                      !ticker.visible ? 'opacity-40 bg-gray-800/30 border-gray-700' : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full cursor-pointer"
                      style={{ backgroundColor: ticker.color }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTickerVisibility(ticker.symbol);
                      }}
                    />
                    <span className="text-sm font-medium flex items-center gap-1">
                      {ticker.type === 'indicator' && <Activity size={12} />}
                      {ticker.name || ticker.symbol}
                    </span>
                    {ticker.type === 'stock' && tickerStats[ticker.symbol]?.quote && (
                      <span className={`text-xs ${tickerStats[ticker.symbol].quote.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {tickerStats[ticker.symbol].quote.change >= 0 ? '+' : ''}
                        {tickerStats[ticker.symbol].quote.change_percent?.toFixed(2)}%
                      </span>
                    )}
                    {tickers.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveTicker(ticker.symbol);
                        }}
                        className="hover:text-red-400 ml-1"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Chart Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setNormalized(!normalized)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    normalized ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                  title="Normalize to percentage change"
                >
                  <Percent size={14} />
                  Normalize
                </button>
                <button
                  onClick={() => setShowVolume(!showVolume)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    showVolume ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                  title="Show volume"
                >
                  Volume
                </button>
              </div>
            </div>

            {/* Main Chart */}
            <div className="rounded-lg p-4 border border-gray-800" style={{ backgroundColor: CHART_THEME.background }}>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                      tickFormatter={(date) => formatDate(date)}
                      type="category"
                      allowDuplicatedCategory={false}
                    />
                    <YAxis
                      yAxisId="price"
                      orientation="right"
                      tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                      tickFormatter={(value) => normalized ? `${value.toFixed(0)}%` : `${value.toFixed(0)}`}
                      domain={['auto', 'auto']}
                    />
                    {showVolume && tickers.some(t => t.type === 'stock' && t.visible) && (
                      <YAxis
                        yAxisId="volume"
                        orientation="left"
                        tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                        tickFormatter={(value) => formatNumber(value)}
                        domain={[0, 'auto']}
                      />
                    )}
                    <Tooltip
                      contentStyle={{ backgroundColor: CHART_THEME.tooltip.background, border: `1px solid ${CHART_THEME.tooltip.border}` }}
                      labelStyle={{ color: CHART_THEME.tooltip.text }}
                      formatter={(value, name) => {
                        if (name.includes('_volume')) return [formatNumber(value), 'Volume'];
                        const ticker = tickers.find(t => t.symbol === name);
                        if (ticker?.type === 'indicator') {
                          return [value?.toFixed(2) || 'N/A', ticker.name || name];
                        }
                        return [normalized ? `${value?.toFixed(2) || 'N/A'}%` : formatPrice(value), name];
                      }}
                      labelFormatter={(date) => formatDate(date)}
                    />
                    <Legend />

                    {/* Volume bars for stocks only */}
                    {showVolume && tickers.filter(t => t.type === 'stock' && t.visible).map((ticker) => (
                      <Bar
                        key={`${ticker.symbol}_volume`}
                        yAxisId="volume"
                        dataKey={`${ticker.symbol}_volume`}
                        fill={ticker.color}
                        opacity={0.3}
                        name={`${ticker.symbol} Vol`}
                      />
                    ))}

                    {/* Lines for all visible items */}
                    {tickers.filter(t => t.visible).map((ticker) => (
                      <Line
                        key={ticker.symbol}
                        yAxisId="price"
                        type="monotone"
                        dataKey={ticker.symbol}
                        stroke={ticker.color}
                        strokeWidth={ticker.type === 'indicator' ? 3 : 2}
                        strokeDasharray={ticker.type === 'indicator' ? '5 5' : '0'}
                        dot={false}
                        connectNulls={true}
                        name={ticker.name || ticker.symbol}
                      />
                    ))}

                    {normalized && <ReferenceLine yAxisId="price" y={0} stroke={CHART_THEME.text} strokeDasharray="3 3" />}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Time Range Selector */}
              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-gray-800">
                {TIME_RANGES.map((range) => (
                  <button
                    key={range.id}
                    onClick={() => setTimeRange(range.id)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      timeRange === range.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stock Selector Modal */}
      <StockSelectorModal
        isOpen={showStockSelector}
        title="Add Stock to Chart"
        onSelect={handleAddTicker}
        onClose={() => setShowStockSelector(false)}
      />
    </div>
  );
};

export default ChartWidget;
