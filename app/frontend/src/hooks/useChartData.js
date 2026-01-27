import { useState, useCallback, useEffect, useMemo } from 'react';
import { API_BASE, TIME_RANGES, CHART_COLORS } from '../components/widgets/common';

/**
 * useChartData - Custom hook for chart data loading and transformation
 * Handles fetching stock/indicator data, merging, and normalization
 *
 * @param {Object} options
 * @returns {Object} Chart data state and handlers
 */
const useChartData = ({
  initialSymbols = [],
  storageKey = null,
  isSeriesMode = false,
  series = null,
  normalized = false,
  chartType = 'line',
  technicalIndicators = [],
  onTechnicalIndicatorsApply = null, // callback to apply technical indicators
  onPairAnalysisProcess = null, // callback to process pair analysis data
}) => {
  // Load saved state
  const loadSavedState = useCallback(() => {
    if (!storageKey) return null;
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error('Error loading widget state:', e);
      return null;
    }
  }, [storageKey]);

  const savedState = loadSavedState();

  // State
  const [tickers, setTickers] = useState(
    savedState?.tickers ||
    initialSymbols.map((symbol, idx) => ({
      symbol,
      color: CHART_COLORS[idx % CHART_COLORS.length],
      visible: true,
      type: 'stock'
    }))
  );
  const [chartData, setChartData] = useState([]);
  const [timeRange, setTimeRange] = useState(savedState?.timeRange || '1yr');
  const [loading, setLoading] = useState(false);
  const [tickerStats, setTickerStats] = useState({});
  const [stockDataMap, setStockDataMap] = useState({}); // Raw stock data for indicators

  // Extended period map for technical indicators
  const extendedPeriodMap = {
    '1d': '5d',
    '5d': '1mo',
    '1mo': '3mo',
    '3mo': '6mo',
    '6mo': '1y',
    '1y': '2y',
    '5y': '10y',
    'max': 'max',
  };

  // Merge data from multiple sources by date
  const mergeData = useCallback((results, normalize) => {
    if (results.length === 0) return [];

    // Find date range
    let minDate = null;
    let maxDate = null;

    const stockResults = results.filter(r => r.type === 'stock');
    const indicatorResults = results.filter(r => r.type === 'indicator');

    // Determine date range from stocks, or from all data if no stocks
    const dateSource = stockResults.length > 0 ? stockResults : results;
    dateSource.forEach(({ data }) => {
      if (data && data.length > 0) {
        const dates = data.map(d => new Date(d.date));
        const localMin = new Date(Math.min(...dates));
        const localMax = new Date(Math.max(...dates));
        if (!minDate || localMin < minDate) minDate = localMin;
        if (!maxDate || localMax > maxDate) maxDate = localMax;
      }
    });

    const dateMap = new Map();

    results.forEach(({ symbol, type, data }) => {
      if (!data || data.length === 0) return;

      // Filter data to match date range
      let filteredData = data;
      if (minDate && maxDate) {
        filteredData = data.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate >= minDate && itemDate <= maxDate;
        });
      }

      if (type === 'stock') {
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

    return Array.from(dateMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, []);

  // Load data for all tickers and indicators
  const loadData = useCallback(async () => {
    // Skip API loading in series mode
    if (isSeriesMode) return;
    if (tickers.length === 0) return;

    setLoading(true);
    try {
      const rangeConfig = TIME_RANGES.find(r => r.id === timeRange);
      let period = rangeConfig?.value || '1y';
      const interval = rangeConfig?.interval || '1d';

      // Use extended period if we have technical indicators
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

      // Store raw stock data for indicator calculations
      const newStockDataMap = {};
      results.filter(r => r.type === 'stock').forEach(r => {
        newStockDataMap[r.symbol] = r.data;
      });
      setStockDataMap(newStockDataMap);

      // Store stats for stocks
      const stats = {};
      results.filter(r => r.type === 'stock').forEach(({ symbol, quote, info }) => {
        if (quote && info) {
          stats[symbol] = { quote, info };
        }
      });
      setTickerStats(stats);

      // Merge data from all sources
      let mergedData = mergeData(results, normalized);

      // Apply technical indicators
      if (onTechnicalIndicatorsApply && technicalIndicators.length > 0 && !normalized) {
        mergedData = onTechnicalIndicatorsApply(mergedData, newStockDataMap, normalized);
      }

      // Process pair analysis data
      if (onPairAnalysisProcess) {
        await onPairAnalysisProcess(results, period, interval);
      }

      setChartData(mergedData);
    } catch (error) {
      console.error('Error loading chart data:', error);
    } finally {
      setLoading(false);
    }
  }, [
    isSeriesMode,
    tickers,
    timeRange,
    normalized,
    chartType,
    technicalIndicators,
    mergeData,
    onTechnicalIndicatorsApply,
    onPairAnalysisProcess,
  ]);

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
      data = data.map((d) => {
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
    }

    setChartData(data);
  }, [isSeriesMode, series, normalized]);

  // Ticker management
  const addTicker = useCallback((stock, maxTickers = 10) => {
    if (tickers.length >= maxTickers) {
      return { success: false, message: `Maximum ${maxTickers} items allowed` };
    }
    if (tickers.find(t => t.symbol === stock.symbol)) {
      return { success: false, message: 'Ticker already added' };
    }

    const color = CHART_COLORS[tickers.length % CHART_COLORS.length];
    setTickers(prev => [...prev, { symbol: stock.symbol, color, visible: true, type: 'stock' }]);
    return { success: true };
  }, [tickers]);

  const addIndicator = useCallback((indicator, maxTickers = 10) => {
    if (tickers.length >= maxTickers) {
      return { success: false, message: `Maximum ${maxTickers} items allowed` };
    }
    if (tickers.find(t => t.symbol === indicator.id)) {
      return { success: false, message: 'Indicator already added' };
    }

    const color = CHART_COLORS[tickers.length % CHART_COLORS.length];
    setTickers(prev => [...prev, {
      symbol: indicator.id,
      name: indicator.name,
      color,
      visible: true,
      type: 'indicator'
    }]);
    return { success: true };
  }, [tickers]);

  const removeTicker = useCallback((symbol, minTickers = 1) => {
    if (tickers.length <= minTickers) {
      return { success: false, message: `At least ${minTickers} item required` };
    }
    setTickers(prev => prev.filter(t => t.symbol !== symbol));
    return { success: true };
  }, [tickers]);

  const toggleTickerVisibility = useCallback((symbol) => {
    setTickers(prev => prev.map(t =>
      t.symbol === symbol ? { ...t, visible: !t.visible } : t
    ));
  }, []);

  // Visible series for series mode
  const visibleSeries = useMemo(() =>
    isSeriesMode && series ? series.filter(s => s.visible !== false) : [],
    [isSeriesMode, series]
  );

  // Check if any series has volume data
  const hasVolumeInSeries = useMemo(() =>
    visibleSeries.some(s => s.data?.some(d => d.volume !== undefined)),
    [visibleSeries]
  );

  return {
    // State
    tickers,
    setTickers,
    chartData,
    setChartData,
    timeRange,
    setTimeRange,
    loading,
    tickerStats,
    stockDataMap,

    // Series mode
    visibleSeries,
    hasVolumeInSeries,

    // Actions
    loadData,
    addTicker,
    addIndicator,
    removeTicker,
    toggleTickerVisibility,

    // Utilities
    mergeData,
  };
};

export default useChartData;
