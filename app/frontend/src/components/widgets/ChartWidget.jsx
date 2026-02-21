import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceArea, ReferenceDot, Cell, Rectangle, Customized } from 'recharts';
import { Plus, TrendingUp, Percent, Activity, X, TrendingDown, GitCompare, Settings, ChevronDown, ChevronUp, BarChart2, Layers, Target } from 'lucide-react';
import StockSelectorModal from '../common/StockSelectorModal';
import useTheme from '../../hooks/useTheme';
import useChartZoom from '../../hooks/useChartZoom';
import usePairAnalysis from '../../hooks/usePairAnalysis';
import useTechnicalIndicators from '../../hooks/useTechnicalIndicators';
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
  CHART_TYPES,
  CANDLE_COLORS,
} from './constants';
import { calculateIndicator } from '../../utils/technicalIndicators';
import {
  getRegimeColor,
  getRegimeBadge,
} from '../../utils/pairAnalysis';

// Custom Candlestick Bar Shape
const CandlestickBar = (props) => {
  const { x, y, width, height, payload, dataKey } = props;
  const symbol = dataKey?.replace('_candleBody', '') || '';

  const open = payload?.[`${symbol}_open`];
  const high = payload?.[`${symbol}_high`];
  const low = payload?.[`${symbol}_low`];
  const close = payload?.[`${symbol}_close`];

  if (open === undefined || close === undefined || high === undefined || low === undefined) {
    return null;
  }

  const isBullish = close >= open;
  const color = isBullish ? CANDLE_COLORS.up : CANDLE_COLORS.down;

  // Calculate wick positions relative to body
  const bodyTop = y;
  const bodyBottom = y + height;
  const bodyMid = x + width / 2;

  // Calculate wick heights based on price ratios
  const priceRange = Math.abs(open - close) || 0.01;
  const highExtend = ((Math.max(open, close) - low) / priceRange) * height;
  const lowExtend = ((high - Math.max(open, close)) / priceRange) * height;

  return (
    <g>
      {/* Upper wick */}
      <line
        x1={bodyMid}
        y1={bodyTop - lowExtend}
        x2={bodyMid}
        y2={bodyTop}
        stroke={color}
        strokeWidth={1}
      />
      {/* Lower wick */}
      <line
        x1={bodyMid}
        y1={bodyBottom}
        x2={bodyMid}
        y2={bodyBottom + highExtend}
        stroke={color}
        strokeWidth={1}
      />
      {/* Body */}
      <rect
        x={x}
        y={y}
        width={width}
        height={Math.max(height, 1)}
        fill={isBullish ? '#1a1a1a' : color}
        stroke={color}
        strokeWidth={1}
      />
    </g>
  );
};

// Custom OHLC Bar Shape
const OHLCBar = (props) => {
  const { x, y, width, height, payload, dataKey } = props;
  const symbol = dataKey?.replace('_candleBody', '') || '';

  const open = payload?.[`${symbol}_open`];
  const high = payload?.[`${symbol}_high`];
  const low = payload?.[`${symbol}_low`];
  const close = payload?.[`${symbol}_close`];

  if (open === undefined || close === undefined || high === undefined || low === undefined) {
    return null;
  }

  const isBullish = close >= open;
  const color = isBullish ? CANDLE_COLORS.up : CANDLE_COLORS.down;

  const bodyMid = x + width / 2;
  const tickWidth = Math.max(width * 0.4, 3);

  // Calculate positions
  const priceRange = Math.abs(open - close) || 0.01;
  const highExtend = ((Math.max(open, close) - low) / priceRange) * height;
  const lowExtend = ((high - Math.max(open, close)) / priceRange) * height;

  const topY = y - lowExtend;
  const bottomY = y + height + highExtend;
  const openY = isBullish ? y + height : y;
  const closeY = isBullish ? y : y + height;

  return (
    <g>
      {/* Vertical line (high to low) */}
      <line x1={bodyMid} y1={topY} x2={bodyMid} y2={bottomY} stroke={color} strokeWidth={1.5} />
      {/* Open tick (left) */}
      <line x1={bodyMid - tickWidth} y1={openY} x2={bodyMid} y2={openY} stroke={color} strokeWidth={1.5} />
      {/* Close tick (right) */}
      <line x1={bodyMid} y1={closeY} x2={bodyMid + tickWidth} y2={closeY} stroke={color} strokeWidth={1.5} />
    </g>
  );
};

// Calculate Heikin-Ashi values
const calculateHeikinAshi = (data, symbol) => {
  if (!data || data.length === 0) return data;

  const result = [...data];
  let prevHA = null;

  for (let i = 0; i < result.length; i++) {
    const item = result[i];
    const open = item[`${symbol}_open`];
    const high = item[`${symbol}_high`];
    const low = item[`${symbol}_low`];
    const close = item[`${symbol}_close`];

    if (open === undefined || close === undefined) continue;

    const haClose = (open + high + low + close) / 4;
    const haOpen = prevHA ? (prevHA.open + prevHA.close) / 2 : (open + close) / 2;
    const haHigh = Math.max(high || haClose, haOpen, haClose);
    const haLow = Math.min(low || haClose, haOpen, haClose);

    result[i] = {
      ...item,
      [`${symbol}_open`]: haOpen,
      [`${symbol}_high`]: haHigh,
      [`${symbol}_low`]: haLow,
      [`${symbol}_close`]: haClose,
    };

    prevHA = { open: haOpen, close: haClose };
  }

  return result;
};

const ChartWidget = ({
  widgetId,
  initialSymbols = ['NVDA'],
  onRemove,
  // Series mode props (for external data charts)
  series,                          // Array<{id, name, data, color, visible}>
  title,                           // Chart title (series mode)
  subtitle,                        // Subtitle (series mode)
  // Feature toggles
  showTimeRanges = true,           // Show time range selector
  showChartTypeSelector = true,    // Show chart type selector
  showAddStock = true,             // Show add stock button
  showPairAnalysis = true,         // Show pair analysis mode
  showNormalize = true,            // Show normalize button
  showVolume: showVolumeToggle = true, // Show volume toggle
  showTechnicalIndicators = true,  // Show technical indicators
  // Callbacks
  onPeriodChange,                  // Period change callback (series mode)
  onAddSeries,                     // Add series callback (series mode)
  // External state
  loading: externalLoading = false, // External loading state
  // Custom reference lines (array of { y, color, label, dashed })
  referenceLines: externalReferenceLines,
  // Custom reference points (array of { x, y, color, label, tooltip })
  referencePoints: externalReferencePoints,
}) => {
  // Detect series mode: when series prop is provided and has data
  const isSeriesMode = series && series.length > 0;
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
  const [tickerStats, setTickerStats] = useState({});
  const [chartType, setChartType] = useState(savedState?.chartType || 'line');
  const [showChartTypeSelectorDropdown, setShowChartTypeSelectorDropdown] = useState(false);
  const [showTargets, setShowTargets] = useState(savedState?.showTargets || false);
  const [priceTargets, setPriceTargets] = useState(null);
  const [selectedDot, setSelectedDot] = useState(null); // { x, y, ...analyst info }

  // Zoom/Pan functionality via custom hook
  const {
    visibleRange,
    setVisibleRange,
    isZoomed,
    chartContainerRef,
    handleMouseDown,
    resetZoom,
  } = useChartZoom();

  // Technical Indicators via custom hook
  const {
    technicalIndicators,
    setTechnicalIndicators,
    showSelector: showTechnicalIndicatorSelector,
    setShowSelector: setShowTechnicalIndicatorSelector,
    addIndicator: addTechnicalIndicator,
    addSeriesIndicator: addSeriesTechnicalIndicator,
    removeIndicator: removeTechnicalIndicator,
    toggleVisibility: toggleTechnicalIndicatorVisibility,
    removeAllForSymbol: removeAllIndicatorsForSymbol,
    applyIndicators,
    mergeIndicatorData,
  } = useTechnicalIndicators({ initialIndicators: savedState?.technicalIndicators || [] });

  // Reset visible range when time range changes
  useEffect(() => {
    resetZoom();
  }, [timeRange, resetZoom]);

  // Pair Analysis via custom hook
  const {
    pairMode,
    setPairMode,
    pairConfig,
    setPairConfig,
    showSettings: showPairSettings,
    setShowSettings: setShowPairSettings,
    spreadData,
    regimeData,
    regimePeriods,
    outperformPeriods,
    indexData,
    financialData,
    currentRegime,
    calculateSpreadData,
    loadRegimeData,
    loadFinancialData,
    mergeSpreadToChart,
    mergeRegimeToChart,
    mergeIndexToChart,
    resetData: resetPairData,
  } = usePairAnalysis({
    initialConfig: savedState?.pairConfig,
    initialMode: savedState?.pairMode || false,
  });

  // Series mode: Transform series data to chartData format
  useEffect(() => {
    if (!isSeriesMode || !series || series.length === 0) return;

    // Collect all unique dates
    const dateMap = new Map();

    series.forEach(s => {
      if (!s.data || !Array.isArray(s.data)) return;

      s.data.forEach(point => {
        const date = point.date;
        if (!dateMap.has(date)) {
          dateMap.set(date, { date, timestamp: new Date(date).getTime() });
        }

        const entry = dateMap.get(date);

        // Add main value
        entry[s.id] = point.value !== undefined ? point.value : point.close;

        // Add volume if exists
        if (point.volume !== undefined) {
          entry[`${s.id}_volume`] = point.volume;
        }

        // Add OHLC if exists
        if (point.high !== undefined) entry[`${s.id}_high`] = point.high;
        if (point.low !== undefined) entry[`${s.id}_low`] = point.low;
        if (point.open !== undefined) entry[`${s.id}_open`] = point.open;
      });
    });

    let data = Array.from(dateMap.values()).sort((a, b) => a.timestamp - b.timestamp);

    // Apply normalization for series mode
    if (normalized && data.length > 0) {
      const normalizedData = data.map((d) => {
        const newPoint = { ...d };

        series.forEach(s => {
          if (s.visible !== false && d[s.id] !== undefined) {
            // Find first non-null value as base
            let baseValue = null;
            for (let i = 0; i < data.length; i++) {
              if (data[i][s.id] !== null && data[i][s.id] !== undefined) {
                baseValue = data[i][s.id];
                break;
              }
            }

            if (baseValue && baseValue !== 0) {
              newPoint[s.id] = ((d[s.id] / baseValue - 1) * 100);
            }
          }
        });

        return newPoint;
      });

      data = normalizedData;
    }

    // Calculate technical indicators for series mode
    if (technicalIndicators.length > 0 && !normalized) {
      technicalIndicators.forEach(({ indicatorId, seriesId }) => {
        const targetSeries = series.find(s => s.id === seriesId);
        if (!targetSeries || !targetSeries.data) return;

        // Convert to stock-like format
        const stockData = targetSeries.data.map(d => ({
          date: d.date,
          close: d.value !== undefined ? d.value : d.close || 0,
          high: d.high || d.value || d.close || 0,
          low: d.low || d.value || d.close || 0,
          volume: d.volume || 0,
        }));

        const indicatorData = calculateIndicator(indicatorId, stockData);
        if (indicatorData) {
          data = mergeSeriesIndicatorData(data, indicatorData, indicatorId, seriesId);
        }
      });
    }

    setChartData(data);
  }, [isSeriesMode, series, normalized, technicalIndicators]);

  // Helper to merge indicator data in series mode
  const mergeSeriesIndicatorData = (chartData, indicatorData, indicatorId, seriesId) => {
    const dataMap = new Map(chartData.map(d => [d.date, { ...d }]));

    if (indicatorData.macd) {
      indicatorData.macd.forEach((item, idx) => {
        if (dataMap.has(item.date)) {
          const entry = dataMap.get(item.date);
          entry[`${seriesId}_${indicatorId}_macd`] = item.value;
          entry[`${seriesId}_${indicatorId}_signal`] = indicatorData.signal[idx]?.value || null;
          entry[`${seriesId}_${indicatorId}_histogram`] = indicatorData.histogram[idx]?.value || null;
        }
      });
    } else if (indicatorData.upper) {
      indicatorData.upper.forEach((item, idx) => {
        if (dataMap.has(item.date)) {
          const entry = dataMap.get(item.date);
          entry[`${seriesId}_${indicatorId}_upper`] = item.value;
          entry[`${seriesId}_${indicatorId}_middle`] = indicatorData.middle[idx]?.value || null;
          entry[`${seriesId}_${indicatorId}_lower`] = indicatorData.lower[idx]?.value || null;
        }
      });
    } else if (indicatorData.k) {
      indicatorData.k.forEach((item, idx) => {
        if (dataMap.has(item.date)) {
          const entry = dataMap.get(item.date);
          entry[`${seriesId}_${indicatorId}_k`] = item.value;
          entry[`${seriesId}_${indicatorId}_d`] = indicatorData.d[idx]?.value || null;
        }
      });
    } else {
      indicatorData.forEach(item => {
        if (dataMap.has(item.date)) {
          dataMap.get(item.date)[`${seriesId}_${indicatorId}`] = item.value;
        }
      });
    }

    return Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  };

  // Full chart data with Heikin-Ashi transformation if needed
  const fullChartData = useMemo(() => {
    if (chartType !== 'heikinashi' || !chartData || chartData.length === 0) {
      return chartData;
    }

    // Apply Heikin-Ashi transformation for each stock ticker
    let transformedData = [...chartData];
    tickers.filter(t => t.type === 'stock').forEach(ticker => {
      transformedData = calculateHeikinAshi(transformedData, ticker.symbol);
    });

    return transformedData;
  }, [chartData, chartType, tickers]);

  // Slice data based on visible range for zoom/pan
  const displayChartData = useMemo(() => {
    if (!fullChartData || fullChartData.length === 0) return fullChartData;

    const totalLen = fullChartData.length;
    const startIdx = Math.floor((visibleRange.start / 100) * totalLen);
    const endIdx = Math.ceil((visibleRange.end / 100) * totalLen);

    return fullChartData.slice(startIdx, endIdx);
  }, [fullChartData, visibleRange]);

  // Add candleBody data for candlestick/OHLC charts
  const chartDataWithCandles = useMemo(() => {
    if (!displayChartData || displayChartData.length === 0) return displayChartData;

    const isOHLCChart = ['candlestick', 'ohlc', 'heikinashi'].includes(chartType) && !normalized;
    if (!isOHLCChart) return displayChartData;

    return displayChartData.map(item => {
      const newItem = { ...item };
      tickers.filter(t => t.type === 'stock' && t.visible).forEach(ticker => {
        const open = item[`${ticker.symbol}_open`];
        const close = item[`${ticker.symbol}_close`];
        if (open !== undefined && close !== undefined) {
          // candleBody represents the body range (from min(open,close) to max(open,close))
          newItem[`${ticker.symbol}_candleBody`] = [Math.min(open, close), Math.max(open, close)];
        }
      });
      return newItem;
    });
  }, [displayChartData, chartType, normalized, tickers]);

  // Calculate Y-axis domain — include reference lines so target prices are always visible
  const priceYDomain = useMemo(() => {
    if (!displayChartData || displayChartData.length === 0) return ['auto', 'auto'];

    const isOHLCChart = ['candlestick', 'ohlc', 'heikinashi'].includes(chartType) && !normalized;
    const hasRefLines = !normalized && externalReferenceLines?.length > 0;

    if (!isOHLCChart && !hasRefLines) return ['auto', 'auto'];

    let minPrice = Infinity;
    let maxPrice = -Infinity;

    displayChartData.forEach(item => {
      tickers.filter(t => t.type === 'stock' && t.visible).forEach(ticker => {
        if (isOHLCChart) {
          const high = item[`${ticker.symbol}_high`];
          const low = item[`${ticker.symbol}_low`];
          if (high !== undefined && high > maxPrice) maxPrice = high;
          if (low !== undefined && low < minPrice) minPrice = low;
        } else {
          const val = item[ticker.symbol];
          if (val !== undefined && val !== null) {
            if (val > maxPrice) maxPrice = val;
            if (val < minPrice) minPrice = val;
          }
        }
      });
    });

    // Extend domain to include external reference lines (analyst targets)
    // Cap expansion so extreme targets don't squash the stock price chart
    if (hasRefLines) {
      const priceRange = maxPrice - minPrice;
      const maxExpansion = priceRange * 0.5; // allow up to 50% extension
      externalReferenceLines.forEach(line => {
        if (line.y != null) {
          const cappedHigh = Math.min(line.y, maxPrice + maxExpansion);
          const cappedLow = Math.max(line.y, minPrice - maxExpansion);
          if (cappedHigh > maxPrice) maxPrice = cappedHigh;
          if (cappedLow < minPrice) minPrice = cappedLow;
        }
      });
    }

    if (minPrice === Infinity || maxPrice === -Infinity) return ['auto', 'auto'];

    // Add some padding (2%)
    const padding = (maxPrice - minPrice) * 0.02;
    return [minPrice - padding, maxPrice + padding];
  }, [displayChartData, chartType, normalized, tickers, externalReferenceLines]);

  // Save state to localStorage whenever key settings change
  useEffect(() => {
    if (storageKey) {
      const stateToSave = {
        tickers,
        timeRange,
        normalized,
        showVolume,
        technicalIndicators,
        chartType,
        pairMode,
        pairConfig
      };
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    }
  }, [storageKey, tickers, timeRange, normalized, showVolume, technicalIndicators, chartType, pairMode, pairConfig]);

  // Load data for all tickers and indicators
  const loadData = useCallback(async () => {
    // Skip API loading in series mode - data is provided via props
    if (isSeriesMode) return;

    if (tickers.length === 0) return;

    setLoading(true);
    try {
      const rangeConfig = TIME_RANGES.find(r => r.id === timeRange);
      let period = rangeConfig?.value || '1y';
      const interval = rangeConfig?.interval || '1d';

      // Extend period to load extra data for technical indicators (need ~200 extra days for SMA200)
      // This ensures indicators don't get cut off at the start
      const extendedPeriodMap = {
        '1d': '5d',      // 1d -> 5d for some buffer
        '5d': '1mo',     // 5d -> 1mo
        '1mo': '3mo',    // 1mo -> 3mo
        '3mo': '6mo',    // 3mo -> 6mo (includes ~200 trading days buffer)
        '6mo': '1y',     // 6mo -> 1y
        '1y': '2y',      // 1y -> 2y
        '5y': '10y',     // 5y -> 10y
        'max': 'max',    // max stays max
      };

      // Use extended period if we have technical indicators that need historical data
      const needsExtendedData = technicalIndicators.length > 0 ||
        ['candlestick', 'ohlc', 'heikinashi'].includes(chartType);
      const fetchPeriod = needsExtendedData ? (extendedPeriodMap[period] || period) : period;

      // Separate stocks and indicators
      const stocks = tickers.filter(t => t.type === 'stock');
      const indicators = tickers.filter(t => t.type === 'indicator');

      // Load stock data
      const stockPromises = stocks.map(async (ticker) => {
        try {
          const [historyRes, quoteRes, infoRes] = await Promise.all([
            fetch(`${API_BASE}/stock/history/${ticker.symbol}?period=${fetchPeriod}&interval=${interval}`),
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

      // Pair Analysis Mode data loading (using hook functions)
      if (pairMode && pairConfig.longSymbol && pairConfig.shortSymbol) {
        const longStockData = results.find(r => r.symbol === pairConfig.longSymbol && r.type === 'stock');
        const shortStockData = results.find(r => r.symbol === pairConfig.shortSymbol && r.type === 'stock');

        // Calculate spread using hook function
        if (longStockData?.data?.length && shortStockData?.data?.length) {
          calculateSpreadData(longStockData.data, shortStockData.data);
        }

        // Load regime/index data using hook function
        if (pairConfig.showRegime || pairConfig.showIndex) {
          await loadRegimeData(period, interval);
        }

        // Load financial data using hook function
        await loadFinancialData();

        // Merge pair analysis data into chart data
        mergedData = mergeSpreadToChart(mergedData);
        mergedData = mergeRegimeToChart(mergedData);
        mergedData = mergeIndexToChart(mergedData);
      } else {
        // Reset pair analysis data when mode is off
        resetPairData();
      }

      setChartData(mergedData);
    } catch (error) {
      console.error('Error loading chart data:', error);
    } finally {
      setLoading(false);
    }
  }, [tickers, timeRange, normalized, technicalIndicators, chartType, pairMode, pairConfig]);

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
          // Store OHLC data for candlestick/OHLC charts
          if (!normalize) {
            entry[`${symbol}_open`] = item.open;
            entry[`${symbol}_high`] = item.high;
            entry[`${symbol}_low`] = item.low;
            entry[`${symbol}_close`] = item.close;
          }
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

  // Load data when key dependencies change (not on every loadData reference change)
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers.length, timeRange, chartType, pairMode]);

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

  // Wrapper functions for technical indicators (using hook functions)
  const handleAddTechnicalIndicator = (indicator, symbol) => {
    const result = addTechnicalIndicator(indicator, symbol);
    if (!result.success) {
      alert(result.message);
    }
  };

  const handleAddSeriesTechnicalIndicator = (indicator, seriesId) => {
    const result = addSeriesTechnicalIndicator(indicator, seriesId);
    if (!result.success) {
      alert(result.message);
    }
  };

  const handleRemoveTechnicalIndicator = (indicatorId, symbolOrSeriesId) => {
    removeTechnicalIndicator(indicatorId, symbolOrSeriesId);
  };

  const handleToggleTechnicalIndicatorVisibility = (indicatorId, symbolOrSeriesId) => {
    toggleTechnicalIndicatorVisibility(indicatorId, symbolOrSeriesId);
  };

  const handleRemoveTicker = (symbol) => {
    if (tickers.length === WIDGET_CONSTRAINTS.minTickers) {
      alert(`At least ${WIDGET_CONSTRAINTS.minTickers} item required`);
      return;
    }
    // Also remove all technical indicators for this ticker
    removeAllIndicatorsForSymbol(symbol);
    setTickers(tickers.filter(t => t.symbol !== symbol));
  };

  const toggleTickerVisibility = (symbol) => {
    setTickers(tickers.map(t =>
      t.symbol === symbol ? { ...t, visible: !t.visible } : t
    ));
  };


  // Determine visible series for series mode
  const visibleSeries = useMemo(() =>
    isSeriesMode ? series.filter(s => s.visible !== false) : [],
    [isSeriesMode, series]
  );

  // Check if any series has volume data
  const hasVolumeInSeries = useMemo(() =>
    visibleSeries.some(s => s.data?.some(d => d.volume !== undefined)),
    [visibleSeries]
  );

  // Determine effective loading state
  const effectiveLoading = isSeriesMode ? externalLoading : loading;

  // Determine chart title and subtitle
  const chartTitle = isSeriesMode ? (title || 'Chart') : 'Advanced Chart';
  const chartSubtitle = isSeriesMode
    ? subtitle
    : `${tickers.filter(t => t.visible).length} item${tickers.filter(t => t.visible).length !== 1 ? 's' : ''}`;

  return (
    <div className={WIDGET_STYLES.container}>
      <WidgetHeader
        icon={TrendingUp}
        iconColor={WIDGET_ICON_COLORS.chart}
        title={chartTitle}
        subtitle={chartSubtitle}
        loading={effectiveLoading}
        onRefresh={isSeriesMode ? undefined : loadData}
        onRemove={onRemove}
      >
        {/* Add Series Button (series mode only) */}
        {isSeriesMode && onAddSeries && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onAddSeries();
            }}
            className="hover:text-white p-1.5 text-gray-400"
            title="Add Series"
          >
            <Plus size={16} />
          </button>
        )}

        {/* Chart Type Selector Button */}
        {showChartTypeSelector && !isSeriesMode && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setShowChartTypeSelectorDropdown(!showChartTypeSelectorDropdown);
            }}
            className={`hover:text-white p-1.5 ${showChartTypeSelectorDropdown ? 'text-blue-400' : 'text-gray-400'}`}
            title="Chart Type"
          >
            <BarChart2 size={16} />
          </button>
        )}

        {/* Add Stock Button (symbol mode only) */}
        {showAddStock && !isSeriesMode && (
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
        )}

        {/* Add Macro Indicator Button (symbol mode only) */}
        {!isSeriesMode && (
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
        )}

        {/* Add Technical Indicator Button */}
        {showTechnicalIndicators && (
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
        )}
      </WidgetHeader>

      {/* Chart Type Selector Dropdown */}
      {showChartTypeSelectorDropdown && (
        <div className="absolute top-14 right-4 z-50 border border-gray-700 rounded-lg shadow-2xl py-2 min-w-[200px]" style={{ backgroundColor: tokens.bg.tertiary }}>
          <div className="px-3 py-2 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white">Chart Type</div>
              <button
                onClick={() => setShowChartTypeSelectorDropdown(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="py-1">
            {CHART_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => {
                  setChartType(type.id);
                  setShowChartTypeSelectorDropdown(false);
                }}
                className={`w-full px-3 py-2 hover:bg-gray-800 transition-colors text-left flex items-center gap-3 ${
                  chartType === type.id ? 'bg-blue-600/20 border-l-2 border-blue-500' : ''
                }`}
              >
                <div className={`w-8 h-8 rounded flex items-center justify-center ${
                  chartType === type.id ? 'bg-blue-600' : 'bg-gray-700'
                }`}>
                  {type.id === 'line' && <TrendingUp size={16} />}
                  {type.id === 'area' && <Activity size={16} />}
                  {type.id === 'candlestick' && <BarChart2 size={16} />}
                  {type.id === 'ohlc' && <BarChart2 size={16} />}
                  {type.id === 'heikinashi' && <Layers size={16} />}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{type.name}</div>
                  <div className="text-xs text-gray-400">{type.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

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
            <div className="text-xs text-gray-500 mt-1">{isSeriesMode ? 'Select a series' : 'Select a stock first'}</div>
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
                {/* Series mode: show visible series */}
                {isSeriesMode && visibleSeries.map(s => (
                  <div key={s.id}>
                    <div className="px-3 py-1 bg-gray-800/30">
                      <div className="text-xs text-blue-400">{s.name}</div>
                    </div>
                    {indicators.map(indicator => {
                      const exists = technicalIndicators.some(
                        ti => ti.indicatorId === indicator.id && ti.seriesId === s.id
                      );
                      return (
                        <button
                          key={`${s.id}-${indicator.id}`}
                          onClick={() => handleAddSeriesTechnicalIndicator(indicator, s.id)}
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
                {/* Symbol mode: show stock tickers */}
                {!isSeriesMode && tickers.filter(t => t.type === 'stock').map(stock => (
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
        {effectiveLoading && (isSeriesMode ? series.length === 0 : tickers.length === 0) ? (
          <LoadingSpinner size={32} color={LOADING_COLORS.chart} message="Loading chart data..." />
        ) : (
          <div className="space-y-4">
            {/* Ticker/Series Selection and Controls */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* Series Chips (series mode) */}
              {isSeriesMode && (
                <div className="flex items-center gap-2 flex-wrap">
                  {visibleSeries.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-gray-800/50 border-gray-700"
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color || CHART_COLORS[0] }} />
                      <span className="text-sm font-medium">{s.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Ticker Chips (symbol mode) */}
              {!isSeriesMode && (
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
                          handleToggleTechnicalIndicatorVisibility(indicator.indicatorId, indicator.symbol);
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
              )}

              {/* Chart Controls */}
              <div className="flex items-center gap-2">
                {/* Time Range Selector */}
                {showTimeRanges && TIME_RANGES.map((range) => (
                  <button
                    key={range.id}
                    onClick={() => {
                      setTimeRange(range.id);
                      // Call onPeriodChange callback for series mode
                      if (isSeriesMode && onPeriodChange) {
                        const rangeConfig = TIME_RANGES.find(r => r.id === range.id);
                        onPeriodChange(rangeConfig?.period || range.id);
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                      timeRange === range.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}

                {showTimeRanges && showChartTypeSelector && !isSeriesMode && (
                  <div className="w-px h-6 bg-gray-700 mx-1"></div>
                )}

                {/* Chart Type Quick Selector (symbol mode only) */}
                {showChartTypeSelector && !isSeriesMode && (
                  <div className="flex items-center bg-gray-800 rounded overflow-hidden">
                    {CHART_TYPES.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setChartType(type.id)}
                        className={`px-2 py-1.5 text-xs font-medium transition-colors ${
                          chartType === type.id
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                        }`}
                        title={type.description}
                      >
                        {type.name}
                      </button>
                    ))}
                  </div>
                )}

                {((showTimeRanges || (showChartTypeSelector && !isSeriesMode)) && (showNormalize || showVolumeToggle)) && (
                  <div className="w-px h-6 bg-gray-700 mx-1"></div>
                )}

                {showNormalize && (
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
                )}

                {showVolumeToggle && (isSeriesMode ? hasVolumeInSeries : tickers.some(t => t.type === 'stock')) && (
                  <button
                    onClick={() => setShowVolume(!showVolume)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      showVolume ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                    title="Show volume"
                  >
                    Volume
                  </button>
                )}

                {/* Pair Analysis Mode Toggle (symbol mode only) */}
                {showPairAnalysis && !isSeriesMode && (
                  <>
                    <div className="w-px h-6 bg-gray-700 mx-1"></div>

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
                  </>
                )}
              </div>
            </div>

            {/* Pair Analysis Settings Panel (symbol mode only) */}
            {!isSeriesMode && pairMode && showPairSettings && (
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
              <div
                ref={chartContainerRef}
                className="h-[420px] cursor-grab active:cursor-grabbing select-none"
                onMouseDown={handleMouseDown}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartDataWithCandles} onClick={() => setSelectedDot(null)}>
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
                      domain={priceYDomain}
                    />
                    {showVolume && (isSeriesMode ? hasVolumeInSeries : tickers.some(t => t.type === 'stock' && t.visible)) && (
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
                      content={({ active, payload, label }) => {
                        if (!active || !payload || payload.length === 0) return null;

                        const data = payload[0]?.payload;
                        const showOHLC = ['candlestick', 'ohlc', 'heikinashi'].includes(chartType) && !normalized;

                        return (
                          <div style={{
                            backgroundColor: chartTheme.tooltip.background,
                            border: `1px solid ${chartTheme.tooltip.border}`,
                            padding: '8px 12px',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}>
                            <div style={{ color: chartTheme.tooltip.text, marginBottom: '6px', fontWeight: 600 }}>
                              {formatDate(label)}
                            </div>
                            {/* Series mode tooltip */}
                            {isSeriesMode && visibleSeries.map(s => {
                              const val = data[s.id];
                              return val !== undefined ? (
                                <div key={s.id} style={{ color: s.color || CHART_COLORS[0] }}>
                                  {s.name}: {normalized ? `${val?.toFixed(2)}%` : formatPrice(val)}
                                </div>
                              ) : null;
                            })}
                            {/* Symbol mode tooltip */}
                            {!isSeriesMode && tickers.filter(t => t.visible && t.type === 'stock').map(ticker => {
                              const sym = ticker.symbol;
                              if (showOHLC && data[`${sym}_open`] !== undefined) {
                                const o = data[`${sym}_open`];
                                const h = data[`${sym}_high`];
                                const l = data[`${sym}_low`];
                                const c = data[`${sym}_close`];
                                const change = o ? ((c - o) / o * 100).toFixed(2) : 0;
                                const isUp = c >= o;
                                return (
                                  <div key={sym} style={{ marginBottom: '4px' }}>
                                    <div style={{ color: ticker.color, fontWeight: 600 }}>{sym}</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', color: '#9ca3af' }}>
                                      <span>O: {formatPrice(o)}</span>
                                      <span>H: {formatPrice(h)}</span>
                                      <span>C: <span style={{ color: isUp ? CANDLE_COLORS.up : CANDLE_COLORS.down }}>{formatPrice(c)}</span></span>
                                      <span>L: {formatPrice(l)}</span>
                                    </div>
                                    <div style={{ color: isUp ? CANDLE_COLORS.up : CANDLE_COLORS.down, fontSize: '11px' }}>
                                      {isUp ? '+' : ''}{change}%
                                    </div>
                                  </div>
                                );
                              } else {
                                const val = data[sym];
                                return val !== undefined ? (
                                  <div key={sym} style={{ color: ticker.color }}>
                                    {sym}: {normalized ? `${val?.toFixed(2)}%` : formatPrice(val)}
                                  </div>
                                ) : null;
                              }
                            })}
                            {tickers.filter(t => t.visible && t.type === 'indicator').map(ticker => {
                              const val = data[ticker.symbol];
                              return val !== undefined ? (
                                <div key={ticker.symbol} style={{ color: ticker.color }}>
                                  {ticker.name || ticker.symbol}: {val?.toFixed(2)}
                                </div>
                              ) : null;
                            })}
                            {pairMode && pairConfig.showSpread && data.spread !== undefined && (
                              <div style={{ color: '#f59e0b' }}>
                                Spread: {data.spread?.toFixed(3)}
                              </div>
                            )}
                          </div>
                        );
                      }}
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

                    {/* Series mode: render lines for each series */}
                    {isSeriesMode && visibleSeries.map((s) => (
                      <Line
                        key={s.id}
                        yAxisId="price"
                        type="monotone"
                        dataKey={s.id}
                        stroke={s.color || CHART_COLORS[0]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={true}
                        name={s.name}
                      />
                    ))}

                    {/* Series mode: volume bars */}
                    {isSeriesMode && showVolume && hasVolumeInSeries && visibleSeries.map((s) => (
                      <Bar
                        key={`${s.id}_volume`}
                        yAxisId="volume"
                        dataKey={`${s.id}_volume`}
                        fill={s.color || CHART_COLORS[0]}
                        opacity={0.3}
                        name={`${s.name} Vol`}
                      />
                    ))}

                    {/* Symbol mode: Chart rendering based on chart type */}
                    {!isSeriesMode && tickers.filter(t => t.visible).map((ticker) => {
                      // For indicators, always use line chart
                      if (ticker.type === 'indicator') {
                        return (
                          <Line
                            key={ticker.symbol}
                            yAxisId="price"
                            type="monotone"
                            dataKey={ticker.symbol}
                            stroke={ticker.color}
                            strokeWidth={3}
                            strokeDasharray="5 5"
                            dot={false}
                            connectNulls={true}
                            name={ticker.name || ticker.symbol}
                          />
                        );
                      }

                      // For stocks, render based on chart type
                      switch (chartType) {
                        case 'area':
                          return (
                            <Area
                              key={ticker.symbol}
                              yAxisId="price"
                              type="monotone"
                              dataKey={ticker.symbol}
                              stroke={ticker.color}
                              strokeWidth={2}
                              fill={ticker.color}
                              fillOpacity={0.1}
                              dot={false}
                              connectNulls={true}
                              name={ticker.name || ticker.symbol}
                            />
                          );

                        case 'candlestick':
                        case 'heikinashi':
                          // Render candlestick using Bar with custom shape + invisible line for tooltip
                          return !normalized ? (
                            <React.Fragment key={ticker.symbol}>
                              <Bar
                                yAxisId="price"
                                dataKey={`${ticker.symbol}_candleBody`}
                                shape={(props) => <CandlestickBar {...props} dataKey={`${ticker.symbol}_candleBody`} />}
                                name={ticker.name || ticker.symbol}
                                isAnimationActive={false}
                              />
                              {/* Invisible line overlay for tooltip triggering */}
                              <Line
                                yAxisId="price"
                                type="monotone"
                                dataKey={`${ticker.symbol}_close`}
                                stroke="transparent"
                                strokeWidth={20}
                                dot={false}
                                activeDot={{ r: 4, fill: ticker.color, stroke: '#fff', strokeWidth: 2 }}
                                connectNulls={true}
                                name=""
                                legendType="none"
                              />
                            </React.Fragment>
                          ) : (
                            <Line
                              key={ticker.symbol}
                              yAxisId="price"
                              type="monotone"
                              dataKey={ticker.symbol}
                              stroke={ticker.color}
                              strokeWidth={2}
                              dot={false}
                              connectNulls={true}
                              name={ticker.name || ticker.symbol}
                            />
                          );

                        case 'ohlc':
                          // Render OHLC using Bar with custom shape + invisible line for tooltip
                          return !normalized ? (
                            <React.Fragment key={ticker.symbol}>
                              <Bar
                                yAxisId="price"
                                dataKey={`${ticker.symbol}_candleBody`}
                                shape={(props) => <OHLCBar {...props} dataKey={`${ticker.symbol}_candleBody`} />}
                                name={ticker.name || ticker.symbol}
                                isAnimationActive={false}
                              />
                              {/* Invisible line overlay for tooltip triggering */}
                              <Line
                                yAxisId="price"
                                type="monotone"
                                dataKey={`${ticker.symbol}_close`}
                                stroke="transparent"
                                strokeWidth={20}
                                dot={false}
                                activeDot={{ r: 4, fill: ticker.color, stroke: '#fff', strokeWidth: 2 }}
                                connectNulls={true}
                                name=""
                                legendType="none"
                              />
                            </React.Fragment>
                          ) : (
                            <Line
                              key={ticker.symbol}
                              yAxisId="price"
                              type="monotone"
                              dataKey={ticker.symbol}
                              stroke={ticker.color}
                              strokeWidth={2}
                              dot={false}
                              connectNulls={true}
                              name={ticker.name || ticker.symbol}
                            />
                          );

                        case 'line':
                        default:
                          return (
                            <Line
                              key={ticker.symbol}
                              yAxisId="price"
                              type="monotone"
                              dataKey={ticker.symbol}
                              stroke={ticker.color}
                              strokeWidth={2}
                              dot={false}
                              connectNulls={true}
                              name={ticker.name || ticker.symbol}
                            />
                          );
                      }
                    })}

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

                    {/* External Reference Lines */}
                    {!normalized && externalReferenceLines?.map((line, idx) => (
                      <ReferenceLine
                        key={`ext-ref-${idx}`}
                        yAxisId="price"
                        y={line.y}
                        stroke={line.color}
                        strokeDasharray={line.dashed ? '6 3' : '0'}
                        strokeWidth={line.dashed ? 1 : 1.5}
                        strokeOpacity={line.dashed ? 0.6 : 0.8}
                        label={{ value: line.label, fill: line.color, fontSize: 10, position: 'right' }}
                      />
                    ))}

                    {/* External Reference Points (analyst dots) */}
                    {!normalized && externalReferencePoints?.length > 0 && (
                      <Customized component={(props) => {
                        const { xAxisMap, yAxisMap } = props;
                        const yAxis = yAxisMap && (yAxisMap.price || yAxisMap[0] || Object.values(yAxisMap)[0]);
                        const xAxis = xAxisMap && (xAxisMap[0] || Object.values(xAxisMap)[0]);
                        if (!yAxis || !xAxis) return null;

                        const yScale = yAxis.scale;
                        const xScale = xAxis.scale;
                        if (!yScale || !xScale) return null;

                        // Build date→data lookup from chart data
                        const dataByDate = {};
                        (chartDataWithCandles || []).forEach(d => {
                          if (d.date) dataByDate[d.date] = d;
                        });
                        const chartDates = Object.keys(dataByDate);
                        if (chartDates.length === 0) return null;

                        // Find the primary stock symbol for price lookup
                        const primarySymbol = tickers.find(t => t.type === 'stock')?.symbol;

                        const findClosestDate = (targetDate) => {
                          if (!targetDate) return chartDates[chartDates.length - 1];
                          const target = new Date(targetDate).getTime();
                          let closest = chartDates[0];
                          let minDiff = Math.abs(new Date(closest).getTime() - target);
                          for (const d of chartDates) {
                            const diff = Math.abs(new Date(d).getTime() - target);
                            if (diff < minDiff) { minDiff = diff; closest = d; }
                          }
                          return closest;
                        };

                        return (
                          <g className="analyst-dots">
                            {externalReferencePoints.map((pt, idx) => {
                              const snappedDate = findClosestDate(pt.x);
                              const px = xScale(snappedDate);

                              // Resolve y: use pt.y if given, otherwise look up stock price at that date
                              let yVal = pt.y;
                              if (yVal == null && primarySymbol && dataByDate[snappedDate]) {
                                yVal = dataByDate[snappedDate][primarySymbol];
                              }
                              if (yVal == null) return null;
                              const py = yScale(yVal);

                              if (py == null || px == null || isNaN(py) || isNaN(px)) return null;
                              const isSelected = selectedDot && selectedDot._idx === idx;
                              return (
                                <g key={`ref-pt-${idx}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDot(isSelected ? null : { ...pt, _idx: idx, _px: px, _py: py });
                                  }}
                                >
                                  <circle
                                    cx={px}
                                    cy={py}
                                    r={isSelected ? 7 : 5}
                                    fill={pt.color || '#a78bfa'}
                                    fillOpacity={isSelected ? 1 : 0.85}
                                    stroke={isSelected ? '#fff' : '#1a1a2e'}
                                    strokeWidth={isSelected ? 2 : 1.5}
                                    style={{ cursor: 'pointer' }}
                                  />
                                  {isSelected && (
                                    <foreignObject
                                      x={px + 12}
                                      y={py - 50}
                                      width={200}
                                      height={80}
                                      style={{ overflow: 'visible' }}
                                    >
                                      <div xmlns="http://www.w3.org/1999/xhtml"
                                        className="bg-[#1a1a2e] border border-gray-600 rounded-lg px-3 py-2 text-xs shadow-xl"
                                        style={{ whiteSpace: 'nowrap' }}
                                      >
                                        {(pt.tooltip || pt.label || '').split('\n').map((line, i) => (
                                          <div key={i} className={i === 0 ? 'text-white font-medium' : 'text-gray-400'}>{line}</div>
                                        ))}
                                      </div>
                                    </foreignObject>
                                  )}
                                </g>
                              );
                            })}
                          </g>
                        );
                      }} />
                    )}

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

              {/* Zoom/Pan Controls */}
              <div className="flex items-center justify-between mt-2 px-1">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Drag to pan, Scroll to zoom</span>
                  {isZoomed && (
                    <span className="text-blue-400">
                      ({Math.round(visibleRange.end - visibleRange.start)}% visible)
                    </span>
                  )}
                </div>
                {isZoomed && (
                  <button
                    onClick={resetZoom}
                    className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                  >
                    Reset Zoom
                  </button>
                )}
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

      {/* Stock Selector Modal (symbol mode only) */}
      {!isSeriesMode && (
        <StockSelectorModal
          isOpen={showStockSelector}
          title="Add Stock to Chart"
          onSelect={handleAddTicker}
          onClose={() => setShowStockSelector(false)}
        />
      )}
    </div>
  );
};

export default ChartWidget;
