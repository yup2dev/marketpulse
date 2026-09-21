import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, TrendingUp, Percent, Activity, X, TrendingDown, GitCompare, Settings, BarChart2, Layers, ArrowRightLeft } from 'lucide-react';
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
  MACRO_INDICATORS,
  TECHNICAL_INDICATORS,
  INDICATOR_COLORS,
  WIDGET_CONSTRAINTS,
  CHART_TYPES,
  CANDLE_COLORS,
} from './constants';
import { calculateIndicator } from '../../utils/technicalIndicators';
import { getRegimeColor } from '../../utils/pairAnalysis';
import { apiClient } from '../../config/api';
import PlotlyStockChart from './chart/PlotlyStockChart';
import PairSettingsPanel from './chart/PairSettingsPanel';
import FcfComparisonPanel from './chart/FcfComparisonPanel';
import OscillatorPanels from './chart/OscillatorPanels';
import {
  SHIFT_UNITS,
  shiftDateStr,
  getShiftLabel,
  calculateHeikinAshi,
  fmtDate,
  defaultDateRange,
  DATE_RANGE_PRESETS,
  presetDateRange,
  rangeToPeriod,
} from './chart/chartHelpers';

const ChartWidget = ({
  widgetId,
  symbol,                          // Single seed symbol (widget grid injects this)
  initialSymbols,
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

  const seedSymbols = initialSymbols || (symbol ? [symbol] : ['NVDA']);
  const [tickers, setTickers] = useState(
    savedState?.tickers || seedSymbols.map(sym => ({ symbol: sym, color: CHART_COLORS[0], visible: true, type: 'stock' }))
  );
  const [chartData, setChartData] = useState([]);
  const [startDate, setStartDate] = useState(savedState?.startDate || defaultDateRange().start);
  const [endDate, setEndDate]     = useState(savedState?.endDate || defaultDateRange().end);
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
  const [chartHeight, setChartHeight] = useState(420);
  const [shiftEditorSymbol, setShiftEditorSymbol] = useState(null); // ticker symbol whose shift popover is open
  const widgetOuterRef = useRef(null);

  // Zoom/Pan functionality via custom hook
  const {
    visibleRange,
    setVisibleRange,
    isZoomed,
    chartContainerRef,
    handleMouseDown,
    resetZoom,
  } = useChartZoom();

  // Responsive chart height — fills widget minus header + controls
  useEffect(() => {
    const el = widgetOuterRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const h = entry.contentRect.height;
      setChartHeight(Math.max(200, h - 200));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  // Reset visible range when date range changes
  useEffect(() => {
    resetZoom();
  }, [startDate, endDate, resetZoom]);

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

  // Apply per-ticker time shift (lead/lag) — move a ticker's dates by calendar D/W/M
  // so e.g. SIL shifted +4M overlays SOX 4 months ahead (leading indicator analysis)
  const shiftedChartData = useMemo(() => {
    if (isSeriesMode || !chartData || chartData.length === 0) return chartData;
    const shiftedTickers = tickers.filter(t => t.shift?.value);
    if (shiftedTickers.length === 0) return chartData;

    const isTickerKey = (key, symbol) => key === symbol || key.startsWith(`${symbol}_`);

    // Rebuild rows without the shifted tickers' columns
    const map = new Map();
    chartData.forEach(row => {
      const rest = {};
      Object.keys(row).forEach(k => {
        if (!shiftedTickers.some(t => isTickerKey(k, t.symbol))) rest[k] = row[k];
      });
      map.set(row.date, rest);
    });

    // Re-insert shifted tickers' columns at their shifted dates
    shiftedTickers.forEach(t => {
      chartData.forEach(row => {
        const keys = Object.keys(row).filter(k => isTickerKey(k, t.symbol));
        if (keys.length === 0) return;
        const newDate = shiftDateStr(row.date, t.shift.value, t.shift.unit || 'M');
        if (!map.has(newDate)) {
          map.set(newDate, { date: newDate, timestamp: new Date(newDate).getTime() });
        }
        const entry = map.get(newDate);
        keys.forEach(k => { entry[k] = row[k]; });
      });
    });

    return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [chartData, tickers, isSeriesMode]);

  // Full chart data with Heikin-Ashi transformation if needed
  const fullChartData = useMemo(() => {
    if (chartType !== 'heikinashi' || !shiftedChartData || shiftedChartData.length === 0) {
      return shiftedChartData;
    }

    // Apply Heikin-Ashi transformation for each stock ticker
    let transformedData = [...shiftedChartData];
    tickers.filter(t => t.type === 'stock').forEach(ticker => {
      transformedData = calculateHeikinAshi(transformedData, ticker.symbol);
    });

    return transformedData;
  }, [shiftedChartData, chartType, tickers]);

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
        startDate,
        endDate,
        normalized,
        showVolume,
        technicalIndicators,
        chartType,
        pairMode,
        pairConfig
      };
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    }
  }, [storageKey, tickers, startDate, endDate, normalized, showVolume, technicalIndicators, chartType, pairMode, pairConfig]);

  // Load data for all tickers and indicators
  const loadData = useCallback(async () => {
    // Skip API loading in series mode - data is provided via props
    if (isSeriesMode) return;

    if (tickers.length === 0) return;
    if (!startDate || !endDate || startDate > endDate) return;

    setLoading(true);
    try {
      const spanDays = Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000));
      const startAgeDays = Math.round((Date.now() - new Date(startDate).getTime()) / 86400000);
      // Intraday intervals are only available from the provider for recent data (~60 days)
      const canIntraday = startAgeDays <= 55;
      let interval;
      if (spanDays <= 2)        interval = canIntraday ? '5m'  : '1d';
      else if (spanDays <= 7)   interval = canIntraday ? '15m' : '1d';
      else if (spanDays <= 32)  interval = canIntraday ? '30m' : '1d';
      else if (spanDays <= 730) interval = '1d';
      else if (spanDays <= 1830) interval = '1wk';
      else interval = '1mo';

      // Extend fetch start so technical indicators have warm-up history
      // (~200 extra trading days for SMA200); trimmed back before display.
      // Skipped for intraday (provider limit) and normalized mode (rebase point).
      const needsExtendedData = !normalized && !interval.endsWith('m') &&
        (technicalIndicators.length > 0 || ['candlestick', 'ohlc', 'heikinashi'].includes(chartType));
      let fetchStart = startDate;
      if (needsExtendedData) {
        const d = new Date(startDate);
        d.setDate(d.getDate() - 300);
        fetchStart = fmtDate(d);
      }

      // Separate stocks and indicators
      const stocks = tickers.filter(t => t.type === 'stock');
      const indicators = tickers.filter(t => t.type === 'indicator');

      // Load stock data — apiClient(인증 헤더) + OBBject({results}) 응답 형태
      const stockPromises = stocks.map(async (ticker) => {
        try {
          const [history, quote, info] = await Promise.all([
            apiClient.get(`${API_BASE}/stock/history/${ticker.symbol}?start_date=${fetchStart}&end_date=${endDate}&interval=${interval}`).catch(() => null),
            apiClient.get(`${API_BASE}/stock/quote/${ticker.symbol}`).catch(() => null),
            apiClient.get(`${API_BASE}/stock/info/${ticker.symbol}`).catch(() => null),
          ]);

          return {
            symbol: ticker.symbol,
            type: 'stock',
            data: history?.results || [],
            quote: quote?.results?.[0] || null,
            info: info?.results?.[0] || null,
          };
        } catch (error) {
          console.error(`Error loading ${ticker.symbol}:`, error);
          return { symbol: ticker.symbol, type: 'stock', data: [], quote: null, info: null };
        }
      });

      // Load indicator data
      const indicatorPromises = indicators.map(async (indicator) => {
        try {
          const indicatorData = await apiClient.get(`${API_BASE}/stock/indicator/${indicator.symbol}?period=${rangeToPeriod(startDate)}`);

          return {
            symbol: indicator.symbol,
            type: 'indicator',
            data: indicatorData?.results || [],
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
          await loadRegimeData(rangeToPeriod(startDate), interval);
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

      // Window to the selected range: drops the technical-indicator warm-up
      // buffer and trims macro-indicator series (fetched period-anchored to today)
      const startTs = new Date(startDate).getTime();
      const endTs = new Date(endDate).getTime() + 86400000; // include the end day
      mergedData = mergedData.filter(d => d.timestamp >= startTs && d.timestamp < endTs);

      setChartData(mergedData);
    } catch (error) {
      console.error('Error loading chart data:', error);
    } finally {
      setLoading(false);
    }
  }, [tickers, startDate, endDate, normalized, technicalIndicators, chartType, pairMode, pairConfig]);

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
        // Indicator data — 일부 fetcher는 value 대신 rate 필드를 쓴다(fed_funds_rate 등)
        const numOf = (item) => item.value ?? item.rate ?? null;
        const sortedData = [...filteredData].sort((a, b) => new Date(a.date) - new Date(b.date));
        const baseValue = normalize && sortedData.length > 0 ? numOf(sortedData[0]) : 1;

        sortedData.forEach(item => {
          const v = numOf(item);
          if (v == null) return;
          if (!dateMap.has(item.date)) {
            dateMap.set(item.date, { date: item.date, timestamp: new Date(item.date).getTime() });
          }
          const entry = dateMap.get(item.date);
          entry[symbol] = normalize && baseValue ? ((v / baseValue - 1) * 100) : v;
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
  }, [tickers.length, startDate, endDate, chartType, pairMode]);

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

  // Time shift (lead/lag): shift = { value, unit } or null to clear
  const updateTickerShift = (symbol, shift) => {
    setTickers(tickers.map(t =>
      t.symbol === symbol ? { ...t, shift: shift?.value ? shift : null } : t
    ));
  };

  const updateTickerColor = (symbol, color) => {
    setTickers(tickers.map(t =>
      t.symbol === symbol ? { ...t, color } : t
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
    <div ref={widgetOuterRef} className={WIDGET_STYLES.container}>
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
                    className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
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
                    {/* Series Settings (Color / Time Shift) toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShiftEditorSymbol(shiftEditorSymbol === ticker.symbol ? null : ticker.symbol);
                      }}
                      className={`flex items-center gap-1 ${
                        ticker.shift?.value ? 'text-amber-400 hover:text-amber-300' : 'text-gray-500 hover:text-white'
                      }`}
                      title="Series Settings (Color / Time Shift)"
                    >
                      <Settings size={12} />
                      {ticker.shift?.value && (
                        <span className="text-xs font-semibold">{getShiftLabel(ticker.shift)}</span>
                      )}
                    </button>
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

                    {/* Time Shift Editor Popover */}
                    {shiftEditorSymbol === ticker.symbol && (
                      <div
                        className="absolute top-full left-0 mt-2 z-50 border border-gray-700 rounded-lg shadow-2xl p-3 w-64"
                        style={{ backgroundColor: tokens.bg.tertiary }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                            <Settings size={12} className="text-amber-400" />
                            {ticker.name || ticker.symbol}
                          </span>
                          <button
                            onClick={() => setShiftEditorSymbol(null)}
                            className="text-gray-400 hover:text-white"
                          >
                            <X size={12} />
                          </button>
                        </div>

                        {/* Color picker */}
                        <div className="text-[11px] text-gray-400 mb-1.5">Color</div>
                        <div className="flex items-center gap-1.5 mb-3">
                          {CHART_COLORS.map((color) => (
                            <button
                              key={color}
                              onClick={() => updateTickerColor(ticker.symbol, color)}
                              className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${
                                ticker.color === color ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900' : ''
                              }`}
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                          <label
                            className="w-5 h-5 rounded-full cursor-pointer border border-dashed border-gray-500 hover:border-white flex items-center justify-center overflow-hidden relative"
                            title="Custom color"
                          >
                            <span
                              className="absolute inset-0.5 rounded-full"
                              style={{
                                background: CHART_COLORS.includes(ticker.color)
                                  ? 'conic-gradient(#ef4444, #f59e0b, #10b981, #06b6d4, #8b5cf6, #ec4899, #ef4444)'
                                  : ticker.color,
                              }}
                            />
                            <input
                              type="color"
                              value={ticker.color || '#3b82f6'}
                              onChange={(e) => updateTickerColor(ticker.symbol, e.target.value)}
                              className="opacity-0 absolute inset-0 cursor-pointer"
                            />
                          </label>
                        </div>

                        {/* Time shift */}
                        <div className="text-[11px] text-gray-400 mb-1.5 flex items-center gap-1">
                          <ArrowRightLeft size={10} />
                          Time Shift (Lead/Lag)
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={ticker.shift?.value ?? 0}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              updateTickerShift(ticker.symbol, {
                                value: isNaN(v) ? 0 : v,
                                unit: ticker.shift?.unit || 'M',
                              });
                            }}
                            className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-amber-500"
                          />
                          <div className="flex items-center bg-gray-800 rounded overflow-hidden">
                            {SHIFT_UNITS.map((u) => (
                              <button
                                key={u.id}
                                onClick={() =>
                                  updateTickerShift(ticker.symbol, {
                                    value: ticker.shift?.value || 0,
                                    unit: u.id,
                                  })
                                }
                                className={`px-2 py-1 text-xs font-medium transition-colors ${
                                  (ticker.shift?.unit || 'M') === u.id
                                    ? 'bg-amber-600 text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                                }`}
                                title={u.label}
                              >
                                {u.id}
                              </button>
                            ))}
                          </div>
                          {ticker.shift?.value ? (
                            <button
                              onClick={() => updateTickerShift(ticker.symbol, null)}
                              className="ml-auto text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                            >
                              Reset
                            </button>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                          +N = 선행(Lead): 이 시리즈를 오른쪽으로 N만큼 이동시켜 다른 종목과 겹쳐 봅니다.
                          −N = 후행(Lag). 예: SIL에 +4M → 반도체보다 4개월 선행 비교.
                        </div>
                      </div>
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
                {/* Date Range Selector (symbol mode; series mode range comes from parent) */}
                {showTimeRanges && !isSeriesMode && (
                  <>
                    <input
                      type="date"
                      value={startDate}
                      max={endDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-2 py-1.5 rounded text-xs font-medium bg-gray-800 text-gray-300 outline-none focus:text-white tabular-nums [color-scheme:dark]"
                    />
                    <span className="text-gray-600 text-xs">~</span>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-2 py-1.5 rounded text-xs font-medium bg-gray-800 text-gray-300 outline-none focus:text-white tabular-nums [color-scheme:dark]"
                    />
                    {DATE_RANGE_PRESETS.map((preset) => {
                      const r = presetDateRange(preset.months);
                      const active = startDate === r.start && endDate === r.end;
                      return (
                        <button
                          key={preset.label}
                          onClick={() => { setStartDate(r.start); setEndDate(r.end); }}
                          className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                            active
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </>
                )}

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

            <PairSettingsPanel
              isSeriesMode={isSeriesMode}
              pairMode={pairMode}
              showPairSettings={showPairSettings}
              setShowPairSettings={setShowPairSettings}
              pairConfig={pairConfig}
              setPairConfig={setPairConfig}
              tickers={tickers}
              currentRegime={currentRegime}
            />

            {/* Main Chart */}
            <div className="rounded-lg p-4 border border-gray-800" style={{ backgroundColor: chartTheme.background }}>
              <div
                ref={chartContainerRef}
                className="cursor-grab active:cursor-grabbing select-none"
                style={{ height: chartHeight }}
                onMouseDown={handleMouseDown}
              >
                <PlotlyStockChart
                  chartData={displayChartData}
                  tickers={tickers}
                  chartType={chartType}
                  normalized={normalized}
                  showVolume={showVolume}
                  technicalIndicators={technicalIndicators}
                  pairMode={pairMode}
                  pairConfig={pairConfig}
                  spreadData={spreadData}
                  indexData={indexData}
                  regimePeriods={regimePeriods}
                  outperformPeriods={outperformPeriods}
                  externalReferenceLines={externalReferenceLines}
                  externalReferencePoints={externalReferencePoints}
                  chartTheme={chartTheme}
                  isSeriesMode={isSeriesMode}
                  visibleSeries={visibleSeries}
                  hasVolumeInSeries={hasVolumeInSeries}
                  formatPrice={formatPrice}
                  formatDate={formatDate}
                  formatNumber={formatNumber}
                  INDICATOR_COLORS={INDICATOR_COLORS}
                  CANDLE_COLORS={CANDLE_COLORS}
                  getRegimeColor={getRegimeColor}
                  selectedDot={selectedDot}
                  setSelectedDot={setSelectedDot}
                />
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

            <FcfComparisonPanel
              pairMode={pairMode}
              pairConfig={pairConfig}
              chartTheme={chartTheme}
              financialData={financialData}
              spreadData={spreadData}
              indexData={indexData}
              currentRegime={currentRegime}
            />

            <OscillatorPanels
              technicalIndicators={technicalIndicators}
              normalized={normalized}
              displayChartData={displayChartData}
              chartTheme={chartTheme}
            />
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
