import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import { Plus, TrendingUp, Percent, Activity, X, TrendingDown, GitCompare, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import StockSelectorModal from '../StockSelectorModal';
import useTheme from '../../hooks/useTheme';
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
  TIME_RANGES,
  MACRO_INDICATORS,
  TECHNICAL_INDICATORS,
  INDICATOR_COLORS,
  WIDGET_CONSTRAINTS,
  formatCurrency,
} from './common';
import { calculateIndicator } from '../../utils/technicalIndicators';
import {
  calculateSpread,
  normalizeSpread,
  identifyOutperformancePeriods,
  detectRegime,
  getRegimePeriods,
  getRegimeColor,
  getRegimeBadge,
  mergeSpreadData,
  mergeRegimeData,
} from '../../utils/pairAnalysis';

const ChartWidget = ({ widgetId, initialSymbols = ['NVDA'], onRemove }) => {
  const { classes, chartTheme, tokens } = useTheme();
  const storageKey = widgetId ? `chart-widget-${widgetId}` : null;

  // Load saved state or use initial values
  const loadSavedState = () => {
    if (!storageKey) return null;
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error('Error loading widget state:', e);
      return null;
    }
  };

  const savedState = loadSavedState();

  const [tickers, setTickers] = useState(
    savedState?.tickers || initialSymbols.map(symbol => ({ symbol, color: CHART_COLORS[0], visible: true, type: 'stock' }))
  );
  const [chartData, setChartData] = useState([]);
  const [timeRange, setTimeRange] = useState(savedState?.timeRange || '1yr');
  const [loading, setLoading] = useState(false);
  const [normalized, setNormalized] = useState(savedState?.normalized || false);
  const [showVolume, setShowVolume] = useState(savedState?.showVolume !== undefined ? savedState.showVolume : true);
  const [showStockSelector, setShowStockSelector] = useState(false);
  const [showIndicatorSelector, setShowIndicatorSelector] = useState(false);
  const [showTechnicalIndicatorSelector, setShowTechnicalIndicatorSelector] = useState(false);
  const [tickerStats, setTickerStats] = useState({});
  const [technicalIndicators, setTechnicalIndicators] = useState(savedState?.technicalIndicators || []);

  // Pair Analysis Mode states
  const [pairMode, setPairMode] = useState(savedState?.pairMode || false);
  const [pairConfig, setPairConfig] = useState(savedState?.pairConfig || {
    longSymbol: null,
    shortSymbol: null,
    regimeSymbol: '^KS11',
    showSpread: true,
    showIndex: true,      // 코스피 지수 라인 표시
    showHighlight: true,
    showRegime: true,
    showFCF: true,
  });
  const [indexData, setIndexData] = useState([]);
  const [showPairSettings, setShowPairSettings] = useState(false);
  const [spreadData, setSpreadData] = useState([]);
  const [regimeData, setRegimeData] = useState([]);
  const [regimePeriods, setRegimePeriods] = useState([]);
  const [outperformPeriods, setOutperformPeriods] = useState([]);
  const [financialData, setFinancialData] = useState({ long: null, short: null });
  const [currentRegime, setCurrentRegime] = useState('sideways');

  // Save state to localStorage whenever key settings change
  useEffect(() => {
    if (storageKey) {
      const stateToSave = {
        tickers,
        timeRange,
        normalized,
        showVolume,
        technicalIndicators,
        pairMode,
        pairConfig
      };
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    }
  }, [storageKey, tickers, timeRange, normalized, showVolume, technicalIndicators, pairMode, pairConfig]);

  // Load data for all tickers and indicators
  const loadData = useCallback(async () => {
    if (tickers.length === 0) return;

    setLoading(true);
    try {
      const rangeConfig = TIME_RANGES.find(r => r.id === timeRange);
      const period = rangeConfig?.value || '1y';
      const interval = rangeConfig?.interval || '1d';

      // Separate stocks and indicators
      const stocks = tickers.filter(t => t.type === 'stock');
      const indicators = tickers.filter(t => t.type === 'indicator');

      // Load stock data
      const stockPromises = stocks.map(async (ticker) => {
        try {
          const [historyRes, quoteRes, infoRes] = await Promise.all([
            fetch(`${API_BASE}/stock/history/${ticker.symbol}?period=${period}&interval=${interval}`),
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
      let mergedData = mergeData(results, normalized);

      // Calculate and add technical indicators for each stock
      if (technicalIndicators.length > 0 && !normalized) {
        technicalIndicators.forEach(({ indicatorId, symbol }) => {
          const stockData = results.find(r => r.symbol === symbol && r.type === 'stock');
          if (stockData && stockData.data && stockData.data.length > 0) {
            const indicatorData = calculateIndicator(indicatorId, stockData.data);
            if (indicatorData) {
              // Merge indicator data into chart data
              mergedData = mergeIndicatorData(mergedData, indicatorData, indicatorId, symbol);
            }
          }
        });
      }

      // Pair Analysis Mode data loading
      if (pairMode && pairConfig.longSymbol && pairConfig.shortSymbol) {
        const longStockData = results.find(r => r.symbol === pairConfig.longSymbol && r.type === 'stock');
        const shortStockData = results.find(r => r.symbol === pairConfig.shortSymbol && r.type === 'stock');

        if (longStockData?.data?.length && shortStockData?.data?.length) {
          // Calculate spread
          const rawSpread = calculateSpread(longStockData.data, shortStockData.data);
          const normalizedSpreadData = normalizeSpread(rawSpread);
          setSpreadData(normalizedSpreadData);

          // Identify outperformance periods
          const outperform = identifyOutperformancePeriods(normalizedSpreadData);
          setOutperformPeriods(outperform);

          // Merge spread into chart data
          if (pairConfig.showSpread) {
            mergedData = mergeSpreadData(mergedData, normalizedSpreadData);
          }
        }

        // Load KOSPI/Index data for regime and index line
        if ((pairConfig.showRegime || pairConfig.showIndex) && pairConfig.regimeSymbol) {
          try {
            const regimeRes = await fetch(`${API_BASE}/stock/history/${encodeURIComponent(pairConfig.regimeSymbol)}?period=${period}&interval=${interval}`);
            if (regimeRes.ok) {
              const regimeHistory = await regimeRes.json();
              if (regimeHistory?.data?.length) {
                // Store raw index data for display
                setIndexData(regimeHistory.data);

                // Regime detection
                if (pairConfig.showRegime) {
                  const regime = detectRegime(regimeHistory.data);
                  setRegimeData(regime);

                  const periods = getRegimePeriods(regime);
                  setRegimePeriods(periods);

                  // Set current regime from latest data
                  if (regime.length > 0) {
                    setCurrentRegime(regime[regime.length - 1].regime);
                  }

                  // Merge regime into chart data
                  mergedData = mergeRegimeData(mergedData, regime);
                }

                // Merge normalized index data for chart display
                if (pairConfig.showIndex) {
                  const indexMap = new Map();
                  const sortedIndexData = [...regimeHistory.data].sort((a, b) => new Date(a.date) - new Date(b.date));
                  const baseIndexPrice = sortedIndexData[0]?.close || 1;

                  sortedIndexData.forEach(item => {
                    indexMap.set(item.date, (item.close / baseIndexPrice));
                  });

                  mergedData = mergedData.map(item => {
                    const indexValue = indexMap.get(item.date);
                    return indexValue !== undefined
                      ? { ...item, indexNormalized: indexValue }
                      : item;
                  });
                }
              }
            }
          } catch (error) {
            console.error('Error loading regime/index data:', error);
          }
        }

        // Load financial data (FCF/CapEx) for pair analysis
        if (pairConfig.showFCF) {
          const loadFinancials = async (symbol) => {
            try {
              const res = await fetch(`${API_BASE}/stock/financials/${symbol}?freq=quarterly&limit=8`);
              if (res.ok) {
                return await res.json();
              }
            } catch (error) {
              console.error(`Error loading financials for ${symbol}:`, error);
            }
            return null;
          };

          const [longFinancials, shortFinancials] = await Promise.all([
            loadFinancials(pairConfig.longSymbol),
            loadFinancials(pairConfig.shortSymbol)
          ]);

          setFinancialData({
            long: longFinancials,
            short: shortFinancials
          });
        }
      } else {
        // Reset pair analysis data when mode is off
        setSpreadData([]);
        setRegimeData([]);
        setRegimePeriods([]);
        setOutperformPeriods([]);
        setFinancialData({ long: null, short: null });
        setIndexData([]);
      }

      setChartData(mergedData);
    } catch (error) {
      console.error('Error loading chart data:', error);
    } finally {
      setLoading(false);
    }
  }, [tickers, timeRange, normalized, technicalIndicators, pairMode, pairConfig]);

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

  const mergeIndicatorData = (chartData, indicatorData, indicatorId, symbol) => {
    const dataMap = new Map(chartData.map(d => [d.date, { ...d }]));

    if (indicatorData.macd) {
      // MACD has multiple lines
      indicatorData.macd.forEach((item, idx) => {
        if (dataMap.has(item.date)) {
          const entry = dataMap.get(item.date);
          entry[`${symbol}_${indicatorId}_macd`] = item.value;
          entry[`${symbol}_${indicatorId}_signal`] = indicatorData.signal[idx]?.value || null;
          entry[`${symbol}_${indicatorId}_histogram`] = indicatorData.histogram[idx]?.value || null;
        }
      });
    } else if (indicatorData.upper) {
      // Bollinger Bands
      indicatorData.upper.forEach((item, idx) => {
        if (dataMap.has(item.date)) {
          const entry = dataMap.get(item.date);
          entry[`${symbol}_${indicatorId}_upper`] = item.value;
          entry[`${symbol}_${indicatorId}_middle`] = indicatorData.middle[idx]?.value || null;
          entry[`${symbol}_${indicatorId}_lower`] = indicatorData.lower[idx]?.value || null;
        }
      });
    } else if (indicatorData.k) {
      // Stochastic
      indicatorData.k.forEach((item, idx) => {
        if (dataMap.has(item.date)) {
          const entry = dataMap.get(item.date);
          entry[`${symbol}_${indicatorId}_k`] = item.value;
          entry[`${symbol}_${indicatorId}_d`] = indicatorData.d[idx]?.value || null;
        }
      });
    } else {
      // Simple single-line indicator
      indicatorData.forEach(item => {
        if (dataMap.has(item.date)) {
          dataMap.get(item.date)[`${symbol}_${indicatorId}`] = item.value;
        }
      });
    }

    return Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);
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

  const handleAddTechnicalIndicator = (indicator, symbol) => {
    const exists = technicalIndicators.find(
      ti => ti.indicatorId === indicator.id && ti.symbol === symbol
    );
    if (exists) {
      alert('Indicator already added for this stock');
      return;
    }

    setTechnicalIndicators([...technicalIndicators, {
      indicatorId: indicator.id,
      symbol: symbol,
      name: indicator.name,
      visible: true
    }]);
    setShowTechnicalIndicatorSelector(false);
  };

  const handleRemoveTechnicalIndicator = (indicatorId, symbol) => {
    setTechnicalIndicators(technicalIndicators.filter(
      ti => !(ti.indicatorId === indicatorId && ti.symbol === symbol)
    ));
  };

  const toggleTechnicalIndicatorVisibility = (indicatorId, symbol) => {
    setTechnicalIndicators(technicalIndicators.map(ti =>
      ti.indicatorId === indicatorId && ti.symbol === symbol
        ? { ...ti, visible: !ti.visible }
        : ti
    ));
  };

  const handleRemoveTicker = (symbol) => {
    if (tickers.length === WIDGET_CONSTRAINTS.minTickers) {
      alert(`At least ${WIDGET_CONSTRAINTS.minTickers} item required`);
      return;
    }
    // Also remove all technical indicators for this ticker
    setTechnicalIndicators(technicalIndicators.filter(ti => ti.symbol !== symbol));
    setTickers(tickers.filter(t => t.symbol !== symbol));
  };

  const toggleTickerVisibility = (symbol) => {
    setTickers(tickers.map(t =>
      t.symbol === symbol ? { ...t, visible: !t.visible } : t
    ));
  };


  return (
    <div className="bg-[#1a1a1a] rounded-lg flex flex-col h-full border border-gray-800 relative">
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
        {/* Add Macro Indicator Button */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setShowIndicatorSelector(!showIndicatorSelector);
          }}
          className="hover:text-white p-1.5 text-gray-400"
          title="Add Macro Indicator"
        >
          <Activity size={16} />
        </button>
        {/* Add Technical Indicator Button */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setShowTechnicalIndicatorSelector(!showTechnicalIndicatorSelector);
          }}
          className="hover:text-white p-1.5 text-gray-400"
          title="Add Technical Indicator"
        >
          <TrendingDown size={16} />
        </button>
      </WidgetHeader>

      {/* Macro Indicator Selector Dropdown */}
      {showIndicatorSelector && (
        <div className={`absolute top-14 right-4 z-50 ${tokens.bg.tertiary} border border-gray-700 rounded-lg shadow-2xl py-2 min-w-[300px]`} style={{ backgroundColor: tokens.bg.tertiary }}>
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

      {/* Technical Indicator Selector Dropdown */}
      {showTechnicalIndicatorSelector && (
        <div className="absolute top-14 right-4 z-50 border border-gray-700 rounded-lg shadow-2xl py-2 min-w-[350px] max-h-[500px] overflow-y-auto" style={{ backgroundColor: tokens.bg.tertiary }}>
          <div className="px-3 py-2 border-b border-gray-800 sticky top-0" style={{ backgroundColor: tokens.bg.tertiary }}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white">Technical Indicators</div>
              <button
                onClick={() => setShowTechnicalIndicatorSelector(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-1">Select a stock first</div>
          </div>

          {/* Group by type */}
          {['overlay', 'oscillator', 'separate'].map(type => {
            const indicators = TECHNICAL_INDICATORS.filter(ind => ind.type === type);
            if (indicators.length === 0) return null;

            return (
              <div key={type} className="border-b border-gray-800 last:border-0">
                <div className="px-3 py-2 bg-gray-900/50">
                  <div className="text-xs font-semibold text-gray-400 uppercase">
                    {type === 'overlay' ? 'Price Overlays' : type === 'oscillator' ? 'Oscillators' : 'Separate Pane'}
                  </div>
                </div>
                {tickers.filter(t => t.type === 'stock').map(stock => (
                  <div key={stock.symbol}>
                    <div className="px-3 py-1 bg-gray-800/30">
                      <div className="text-xs text-blue-400">{stock.symbol}</div>
                    </div>
                    {indicators.map(indicator => {
                      const exists = technicalIndicators.some(
                        ti => ti.indicatorId === indicator.id && ti.symbol === stock.symbol
                      );
                      return (
                        <button
                          key={`${stock.symbol}-${indicator.id}`}
                          onClick={() => handleAddTechnicalIndicator(indicator, stock.symbol)}
                          className={`w-full px-4 py-2 hover:bg-gray-800 transition-colors text-left ${
                            exists ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          disabled={exists}
                        >
                          <div className="text-sm font-medium text-white">{indicator.name}</div>
                          <div className="text-xs text-gray-400">{indicator.description}</div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })}
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

                {/* Technical Indicator Chips */}
                {technicalIndicators.map((indicator) => {
                  const indicatorConfig = TECHNICAL_INDICATORS.find(ind => ind.id === indicator.indicatorId);
                  return (
                    <div
                      key={`${indicator.symbol}_${indicator.indicatorId}`}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                        !indicator.visible ? 'opacity-40 bg-gray-800/30 border-gray-700' : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div
                        className="w-3 h-3 rounded-full cursor-pointer"
                        style={{ backgroundColor: INDICATOR_COLORS[indicator.indicatorId] || '#888' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTechnicalIndicatorVisibility(indicator.indicatorId, indicator.symbol);
                        }}
                      />
                      <span className="text-sm font-medium flex items-center gap-1">
                        <TrendingDown size={12} />
                        {indicator.symbol} - {indicator.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveTechnicalIndicator(indicator.indicatorId, indicator.symbol);
                        }}
                        className="hover:text-red-400 ml-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Chart Controls */}
              <div className="flex items-center gap-2">
                {/* Time Range Selector */}
                {TIME_RANGES.map((range) => (
                  <button
                    key={range.id}
                    onClick={() => setTimeRange(range.id)}
                    className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                      timeRange === range.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}

                <div className="w-px h-6 bg-gray-700 mx-1"></div>

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

                <div className="w-px h-6 bg-gray-700 mx-1"></div>

                {/* Pair Analysis Mode Toggle */}
                <button
                  onClick={() => {
                    setPairMode(!pairMode);
                    if (!pairMode) {
                      setShowPairSettings(true);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    pairMode ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                  title="Pair Analysis Mode"
                >
                  <GitCompare size={14} />
                  Pair
                </button>

                {/* Pair Settings Toggle */}
                {pairMode && (
                  <button
                    onClick={() => setShowPairSettings(!showPairSettings)}
                    className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors bg-gray-800 text-gray-400 hover:text-white"
                    title="Pair Settings"
                  >
                    <Settings size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Pair Analysis Settings Panel */}
            {pairMode && showPairSettings && (
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <GitCompare size={16} className="text-amber-400" />
                    Pair Analysis Settings
                  </h4>
                  <button
                    onClick={() => setShowPairSettings(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Long Position Selector */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Long Position</label>
                    <select
                      value={pairConfig.longSymbol || ''}
                      onChange={(e) => setPairConfig({ ...pairConfig, longSymbol: e.target.value || null })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="">Select Long</option>
                      {tickers.filter(t => t.type === 'stock' && t.symbol !== pairConfig.shortSymbol).map(t => (
                        <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                      ))}
                    </select>
                  </div>

                  {/* Short Position Selector */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Short Position</label>
                    <select
                      value={pairConfig.shortSymbol || ''}
                      onChange={(e) => setPairConfig({ ...pairConfig, shortSymbol: e.target.value || null })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="">Select Short</option>
                      {tickers.filter(t => t.type === 'stock' && t.symbol !== pairConfig.longSymbol).map(t => (
                        <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                      ))}
                    </select>
                  </div>

                  {/* Regime Index Selector */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Regime Index</label>
                    <select
                      value={pairConfig.regimeSymbol}
                      onChange={(e) => setPairConfig({ ...pairConfig, regimeSymbol: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="^KS11">KOSPI (^KS11)</option>
                      <option value="^GSPC">S&P 500 (^GSPC)</option>
                      <option value="^IXIC">NASDAQ (^IXIC)</option>
                      <option value="^DJI">Dow Jones (^DJI)</option>
                    </select>
                  </div>

                  {/* Current Regime Badge */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Current Regime</label>
                    {(() => {
                      const badge = getRegimeBadge(currentRegime);
                      return (
                        <div className={`${badge.bgColor} ${badge.textColor} px-3 py-1.5 rounded text-sm font-medium text-center`}>
                          {badge.label}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Toggle Options */}
                <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pairConfig.showSpread}
                      onChange={(e) => setPairConfig({ ...pairConfig, showSpread: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-sm text-gray-300">Spread Line</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pairConfig.showIndex}
                      onChange={(e) => setPairConfig({ ...pairConfig, showIndex: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-sm text-gray-300">Index Line (KOSPI)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pairConfig.showHighlight}
                      onChange={(e) => setPairConfig({ ...pairConfig, showHighlight: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-sm text-gray-300">Outperform Highlight</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pairConfig.showRegime}
                      onChange={(e) => setPairConfig({ ...pairConfig, showRegime: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-sm text-gray-300">Regime Background</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pairConfig.showFCF}
                      onChange={(e) => setPairConfig({ ...pairConfig, showFCF: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-sm text-gray-300">FCF/CapEx Panel</span>
                  </label>
                </div>
              </div>
            )}

            {/* Main Chart */}
            <div className="rounded-lg p-4 border border-gray-800" style={{ backgroundColor: chartTheme.background }}>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    {/* Regime Background Areas */}
                    {pairMode && pairConfig.showRegime && regimePeriods.map((period, idx) => (
                      <ReferenceArea
                        key={`regime-${idx}`}
                        x1={period.start}
                        x2={period.end}
                        yAxisId="price"
                        fill={getRegimeColor(period.regime)}
                        fillOpacity={1}
                      />
                    ))}

                    {/* Outperform Highlight Areas */}
                    {pairMode && pairConfig.showHighlight && outperformPeriods.map((period, idx) => (
                      <ReferenceArea
                        key={`outperform-${idx}`}
                        x1={period.start}
                        x2={period.end}
                        yAxisId="price"
                        fill="rgba(34, 197, 94, 0.15)"
                        fillOpacity={1}
                        stroke="rgba(34, 197, 94, 0.3)"
                        strokeDasharray="3 3"
                      />
                    ))}

                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: chartTheme.text, fontSize: 11 }}
                      tickFormatter={(date) => formatDate(date)}
                      type="category"
                      allowDuplicatedCategory={false}
                    />
                    <YAxis
                      yAxisId="price"
                      orientation="right"
                      tick={{ fill: chartTheme.text, fontSize: 11 }}
                      tickFormatter={(value) => normalized ? `${value.toFixed(0)}%` : `${value.toFixed(0)}`}
                      domain={['auto', 'auto']}
                    />
                    {showVolume && tickers.some(t => t.type === 'stock' && t.visible) && (
                      <YAxis
                        yAxisId="volume"
                        orientation="left"
                        tick={{ fill: chartTheme.text, fontSize: 11 }}
                        tickFormatter={(value) => formatNumber(value)}
                        domain={[0, 'auto']}
                      />
                    )}
                    {/* Spread/Index Y-Axis (left side) - normalized to 1.0 base */}
                    {pairMode && ((pairConfig.showSpread && spreadData.length > 0) || (pairConfig.showIndex && indexData.length > 0)) && (
                      <YAxis
                        yAxisId="spread"
                        orientation="left"
                        tick={{ fill: '#f59e0b', fontSize: 11 }}
                        tickFormatter={(value) => value?.toFixed(2)}
                        domain={['auto', 'auto']}
                        label={{
                          value: 'Normalized (1.0 = Base)',
                          angle: -90,
                          position: 'insideLeft',
                          fill: '#9ca3af',
                          fontSize: 10
                        }}
                      />
                    )}
                    <Tooltip
                      contentStyle={{ backgroundColor: chartTheme.tooltip.background, border: `1px solid ${chartTheme.tooltip.border}` }}
                      labelStyle={{ color: chartTheme.tooltip.text }}
                      formatter={(value, name) => {
                        if (name === 'Spread') return [value?.toFixed(3) || 'N/A', 'L/S Spread'];
                        if (name === 'KOSPI' || name === pairConfig.regimeSymbol) {
                          return [value?.toFixed(3) || 'N/A', `${name} (Norm)`];
                        }
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

                    {/* Technical Indicators */}
                    {!normalized && technicalIndicators.filter(ti => ti.visible).map((indicator) => {
                      const { indicatorId, symbol } = indicator;

                      // Bollinger Bands
                      if (indicatorId === 'BBANDS') {
                        return (
                          <React.Fragment key={`${symbol}_${indicatorId}`}>
                            <Line
                              yAxisId="price"
                              type="monotone"
                              dataKey={`${symbol}_${indicatorId}_upper`}
                              stroke={INDICATOR_COLORS.BBANDS_upper}
                              strokeWidth={1}
                              strokeDasharray="2 2"
                              dot={false}
                              connectNulls={true}
                              name={`${symbol} BB Upper`}
                            />
                            <Line
                              yAxisId="price"
                              type="monotone"
                              dataKey={`${symbol}_${indicatorId}_middle`}
                              stroke={INDICATOR_COLORS.BBANDS_middle}
                              strokeWidth={1.5}
                              dot={false}
                              connectNulls={true}
                              name={`${symbol} BB Middle`}
                            />
                            <Line
                              yAxisId="price"
                              type="monotone"
                              dataKey={`${symbol}_${indicatorId}_lower`}
                              stroke={INDICATOR_COLORS.BBANDS_lower}
                              strokeWidth={1}
                              strokeDasharray="2 2"
                              dot={false}
                              connectNulls={true}
                              name={`${symbol} BB Lower`}
                            />
                          </React.Fragment>
                        );
                      }

                      // Simple overlay indicators (SMA, EMA)
                      if (['SMA_20', 'SMA_50', 'SMA_200', 'EMA_12', 'EMA_26'].includes(indicatorId)) {
                        return (
                          <Line
                            key={`${symbol}_${indicatorId}`}
                            yAxisId="price"
                            type="monotone"
                            dataKey={`${symbol}_${indicatorId}`}
                            stroke={INDICATOR_COLORS[indicatorId]}
                            strokeWidth={1.5}
                            dot={false}
                            connectNulls={true}
                            name={`${symbol} ${indicator.name}`}
                          />
                        );
                      }

                      return null;
                    })}

                    {normalized && <ReferenceLine yAxisId="price" y={0} stroke={chartTheme.text} strokeDasharray="3 3" />}

                    {/* Pair Analysis Index Line (KOSPI) */}
                    {pairMode && pairConfig.showIndex && indexData.length > 0 && (
                      <Line
                        yAxisId="spread"
                        type="monotone"
                        dataKey="indexNormalized"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="4 2"
                        dot={false}
                        connectNulls={true}
                        name={pairConfig.regimeSymbol === '^KS11' ? 'KOSPI' : pairConfig.regimeSymbol}
                      />
                    )}

                    {/* Pair Analysis Spread Line */}
                    {pairMode && pairConfig.showSpread && spreadData.length > 0 && (
                      <>
                        <Line
                          yAxisId="spread"
                          type="monotone"
                          dataKey="spread"
                          stroke="#f59e0b"
                          strokeWidth={2.5}
                          dot={false}
                          connectNulls={true}
                          name="Spread"
                        />
                        <ReferenceLine
                          yAxisId="spread"
                          y={1}
                          stroke="#f59e0b"
                          strokeDasharray="5 5"
                          strokeOpacity={0.7}
                          label={{
                            value: 'Base (1.0)',
                            fill: '#f59e0b',
                            fontSize: 10,
                            position: 'left'
                          }}
                        />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* FCF/CapEx Comparison Panel */}
            {pairMode && pairConfig.showFCF && pairConfig.longSymbol && pairConfig.shortSymbol && (
              <div className="rounded-lg p-4 border border-gray-800" style={{ backgroundColor: chartTheme.background }}>
                <h4 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                  <GitCompare size={14} className="text-amber-400" />
                  FCF / CapEx Comparison
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {/* Long Position Financials */}
                  <div className="bg-gray-800/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-green-400 bg-green-400/20 px-2 py-0.5 rounded">LONG</span>
                      <span className="text-sm font-semibold text-white">{pairConfig.longSymbol}</span>
                    </div>
                    {financialData.long?.data ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Free Cash Flow</span>
                          <span className="text-white font-medium">
                            {formatCurrency(financialData.long.data[0]?.free_cash_flow)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">CapEx</span>
                          <span className="text-white font-medium">
                            {formatCurrency(financialData.long.data[0]?.capital_expenditures)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Operating CF</span>
                          <span className="text-white font-medium">
                            {formatCurrency(financialData.long.data[0]?.operating_cash_flow)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">No financial data available</div>
                    )}
                  </div>

                  {/* Short Position Financials */}
                  <div className="bg-gray-800/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-red-400 bg-red-400/20 px-2 py-0.5 rounded">SHORT</span>
                      <span className="text-sm font-semibold text-white">{pairConfig.shortSymbol}</span>
                    </div>
                    {financialData.short?.data ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Free Cash Flow</span>
                          <span className="text-white font-medium">
                            {formatCurrency(financialData.short.data[0]?.free_cash_flow)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">CapEx</span>
                          <span className="text-white font-medium">
                            {formatCurrency(financialData.short.data[0]?.capital_expenditures)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Operating CF</span>
                          <span className="text-white font-medium">
                            {formatCurrency(financialData.short.data[0]?.operating_cash_flow)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">No financial data available</div>
                    )}
                  </div>
                </div>

                {/* Spread & Index Summary */}
                {(spreadData.length > 0 || indexData.length > 0) && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      {spreadData.length > 0 && (
                        <>
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Current Spread</div>
                            <div className="text-lg font-bold text-amber-400">
                              {spreadData[spreadData.length - 1]?.normalizedSpread?.toFixed(3) || 'N/A'}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Spread Range</div>
                            <div className="text-sm font-bold">
                              <span className="text-red-400">{Math.min(...spreadData.map(d => d.normalizedSpread))?.toFixed(3)}</span>
                              <span className="text-gray-500 mx-1">~</span>
                              <span className="text-green-400">{Math.max(...spreadData.map(d => d.normalizedSpread))?.toFixed(3)}</span>
                            </div>
                          </div>
                        </>
                      )}
                      {indexData.length > 0 && (
                        <>
                          <div>
                            <div className="text-xs text-gray-400 mb-1">{pairConfig.regimeSymbol === '^KS11' ? 'KOSPI' : pairConfig.regimeSymbol} Change</div>
                            <div className={`text-lg font-bold ${
                              indexData[indexData.length - 1]?.close > indexData[0]?.close ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {(((indexData[indexData.length - 1]?.close / indexData[0]?.close) - 1) * 100).toFixed(2)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Current Regime</div>
                            {(() => {
                              const badge = getRegimeBadge(currentRegime);
                              return (
                                <div className={`${badge.bgColor} ${badge.textColor} px-2 py-1 rounded text-sm font-medium inline-block`}>
                                  {badge.label}
                                </div>
                              );
                            })()}
                          </div>
                        </>
                      )}
                    </div>
                    {/* Legend */}
                    <div className="flex justify-center gap-6 mt-3 text-xs text-gray-500">
                      {pairConfig.showSpread && <div className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500 inline-block"></span> L/S Spread</div>}
                      {pairConfig.showIndex && <div className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block" style={{borderTop: '2px dashed'}}></span> {pairConfig.regimeSymbol === '^KS11' ? 'KOSPI' : pairConfig.regimeSymbol}</div>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* RSI Oscillator */}
            {!normalized && technicalIndicators.some(ti => ti.indicatorId === 'RSI' && ti.visible) && (
              <div className="rounded-lg p-4 border border-gray-800" style={{ backgroundColor: chartTheme.background }}>
                <div className="mb-2">
                  <h4 className="text-sm font-semibold text-gray-400">RSI (Relative Strength Index)</h4>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: chartTheme.text, fontSize: 11 }}
                        tickFormatter={(date) => formatDate(date)}
                        type="category"
                      />
                      <YAxis
                        tick={{ fill: chartTheme.text, fontSize: 11 }}
                        domain={[0, 100]}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: chartTheme.tooltip.background, border: `1px solid ${chartTheme.tooltip.border}` }}
                        labelStyle={{ color: chartTheme.tooltip.text }}
                        labelFormatter={(date) => formatDate(date)}
                      />
                      <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Overbought', fill: '#ef4444', fontSize: 10 }} />
                      <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="3 3" label={{ value: 'Oversold', fill: '#22c55e', fontSize: 10 }} />
                      {technicalIndicators.filter(ti => ti.indicatorId === 'RSI' && ti.visible).map(indicator => (
                        <Line
                          key={`${indicator.symbol}_RSI`}
                          type="monotone"
                          dataKey={`${indicator.symbol}_RSI`}
                          stroke={INDICATOR_COLORS.RSI}
                          strokeWidth={2}
                          dot={false}
                          connectNulls={true}
                          name={`${indicator.symbol} RSI`}
                        />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* MACD Oscillator */}
            {!normalized && technicalIndicators.some(ti => ti.indicatorId === 'MACD' && ti.visible) && (
              <div className="rounded-lg p-4 border border-gray-800" style={{ backgroundColor: chartTheme.background }}>
                <div className="mb-2">
                  <h4 className="text-sm font-semibold text-gray-400">MACD (Moving Average Convergence Divergence)</h4>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: chartTheme.text, fontSize: 11 }}
                        tickFormatter={(date) => formatDate(date)}
                        type="category"
                      />
                      <YAxis
                        tick={{ fill: chartTheme.text, fontSize: 11 }}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: chartTheme.tooltip.background, border: `1px solid ${chartTheme.tooltip.border}` }}
                        labelStyle={{ color: chartTheme.tooltip.text }}
                        labelFormatter={(date) => formatDate(date)}
                      />
                      <ReferenceLine y={0} stroke={chartTheme.text} strokeDasharray="3 3" />
                      {technicalIndicators.filter(ti => ti.indicatorId === 'MACD' && ti.visible).map(indicator => (
                        <React.Fragment key={`${indicator.symbol}_MACD`}>
                          <Bar
                            dataKey={`${indicator.symbol}_MACD_histogram`}
                            fill={INDICATOR_COLORS.MACD}
                            opacity={0.3}
                            name={`${indicator.symbol} Histogram`}
                          />
                          <Line
                            type="monotone"
                            dataKey={`${indicator.symbol}_MACD_macd`}
                            stroke={INDICATOR_COLORS.MACD}
                            strokeWidth={2}
                            dot={false}
                            connectNulls={true}
                            name={`${indicator.symbol} MACD`}
                          />
                          <Line
                            type="monotone"
                            dataKey={`${indicator.symbol}_MACD_signal`}
                            stroke={INDICATOR_COLORS.MACD_signal}
                            strokeWidth={2}
                            dot={false}
                            connectNulls={true}
                            name={`${indicator.symbol} Signal`}
                          />
                        </React.Fragment>
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Stochastic Oscillator */}
            {!normalized && technicalIndicators.some(ti => ti.indicatorId === 'STOCH' && ti.visible) && (
              <div className="rounded-lg p-4 border border-gray-800" style={{ backgroundColor: chartTheme.background }}>
                <div className="mb-2">
                  <h4 className="text-sm font-semibold text-gray-400">Stochastic Oscillator</h4>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: chartTheme.text, fontSize: 11 }}
                        tickFormatter={(date) => formatDate(date)}
                        type="category"
                      />
                      <YAxis
                        tick={{ fill: chartTheme.text, fontSize: 11 }}
                        domain={[0, 100]}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: chartTheme.tooltip.background, border: `1px solid ${chartTheme.tooltip.border}` }}
                        labelStyle={{ color: chartTheme.tooltip.text }}
                        labelFormatter={(date) => formatDate(date)}
                      />
                      <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Overbought', fill: '#ef4444', fontSize: 10 }} />
                      <ReferenceLine y={20} stroke="#22c55e" strokeDasharray="3 3" label={{ value: 'Oversold', fill: '#22c55e', fontSize: 10 }} />
                      {technicalIndicators.filter(ti => ti.indicatorId === 'STOCH' && ti.visible).map(indicator => (
                        <React.Fragment key={`${indicator.symbol}_STOCH`}>
                          <Line
                            type="monotone"
                            dataKey={`${indicator.symbol}_STOCH_k`}
                            stroke={INDICATOR_COLORS.STOCH_k}
                            strokeWidth={2}
                            dot={false}
                            connectNulls={true}
                            name={`${indicator.symbol} %K`}
                          />
                          <Line
                            type="monotone"
                            dataKey={`${indicator.symbol}_STOCH_d`}
                            stroke={INDICATOR_COLORS.STOCH_d}
                            strokeWidth={2}
                            dot={false}
                            connectNulls={true}
                            name={`${indicator.symbol} %D`}
                          />
                        </React.Fragment>
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ATR (Average True Range) */}
            {!normalized && technicalIndicators.some(ti => ti.indicatorId === 'ATR' && ti.visible) && (
              <div className="rounded-lg p-4 border border-gray-800" style={{ backgroundColor: chartTheme.background }}>
                <div className="mb-2">
                  <h4 className="text-sm font-semibold text-gray-400">ATR (Average True Range)</h4>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: chartTheme.text, fontSize: 11 }}
                        tickFormatter={(date) => formatDate(date)}
                        type="category"
                      />
                      <YAxis
                        tick={{ fill: chartTheme.text, fontSize: 11 }}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: chartTheme.tooltip.background, border: `1px solid ${chartTheme.tooltip.border}` }}
                        labelStyle={{ color: chartTheme.tooltip.text }}
                        labelFormatter={(date) => formatDate(date)}
                      />
                      {technicalIndicators.filter(ti => ti.indicatorId === 'ATR' && ti.visible).map(indicator => (
                        <Line
                          key={`${indicator.symbol}_ATR`}
                          type="monotone"
                          dataKey={`${indicator.symbol}_ATR`}
                          stroke={INDICATOR_COLORS.ATR}
                          strokeWidth={2}
                          dot={false}
                          connectNulls={true}
                          name={`${indicator.symbol} ATR`}
                        />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* OBV (On-Balance Volume) */}
            {!normalized && technicalIndicators.some(ti => ti.indicatorId === 'OBV' && ti.visible) && (
              <div className="rounded-lg p-4 border border-gray-800" style={{ backgroundColor: chartTheme.background }}>
                <div className="mb-2">
                  <h4 className="text-sm font-semibold text-gray-400">OBV (On-Balance Volume)</h4>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: chartTheme.text, fontSize: 11 }}
                        tickFormatter={(date) => formatDate(date)}
                        type="category"
                      />
                      <YAxis
                        tick={{ fill: chartTheme.text, fontSize: 11 }}
                        domain={['auto', 'auto']}
                        tickFormatter={(value) => formatNumber(value)}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: chartTheme.tooltip.background, border: `1px solid ${chartTheme.tooltip.border}` }}
                        labelStyle={{ color: chartTheme.tooltip.text }}
                        labelFormatter={(date) => formatDate(date)}
                        formatter={(value) => [formatNumber(value), 'OBV']}
                      />
                      {technicalIndicators.filter(ti => ti.indicatorId === 'OBV' && ti.visible).map(indicator => (
                        <Line
                          key={`${indicator.symbol}_OBV`}
                          type="monotone"
                          dataKey={`${indicator.symbol}_OBV`}
                          stroke={INDICATOR_COLORS.OBV}
                          strokeWidth={2}
                          dot={false}
                          connectNulls={true}
                          name={`${indicator.symbol} OBV`}
                        />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
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
