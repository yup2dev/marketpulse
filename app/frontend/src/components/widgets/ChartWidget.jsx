import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, TrendingUp, Activity, X, TrendingDown, Settings, BarChart2 } from 'lucide-react';
import StockSelectorModal from '../common/StockSelectorModal';
import useTheme from '../../hooks/useTheme';
import useChartZoom from '../../hooks/useChartZoom';
import usePairAnalysis from '../../hooks/usePairAnalysis';
import useTechnicalIndicators from '../../hooks/useTechnicalIndicators';
import {
  WidgetHeader,
  LoadingSpinner,
  WIDGET_STYLES,
  WIDGET_ICON_COLORS,
  LOADING_COLORS,
  CHART_COLORS,
  TECHNICAL_INDICATORS,
  INDICATOR_COLORS,
  WIDGET_CONSTRAINTS,
  CANDLE_COLORS,
} from './constants';
import { calculateIndicator } from '../../utils/technicalIndicators';
import PlotlyStockChart from './chart/PlotlyStockChart';
import {
  resolveInterval,
  resolveFetchStart,
  fetchTickerData,
  collectTickerStats,
  windowToRange,
  mergeData,
  mergeSeriesIndicatorData,
} from './chart/chartData';
import ChartControls from './chart/ChartControls';
import TickerShiftPopover from './chart/TickerShiftPopover';
import ChartTypeDropdown from './chart/ChartTypeDropdown';
import MacroIndicatorDropdown from './chart/MacroIndicatorDropdown';
import TechnicalIndicatorDropdown from './chart/TechnicalIndicatorDropdown';
import PairSettingsPanel from './chart/PairSettingsPanel';
import FcfComparisonPanel from './chart/FcfComparisonPanel';
import OscillatorPanels from './chart/OscillatorPanels';
import {
  shiftDateStr,
  getShiftLabel,
  calculateHeikinAshi,
  defaultDateRange,
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
  const { chartTheme, tokens } = useTheme();
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
  const [chartHeight, setChartHeight] = useState(420);
  const [shiftEditorSymbol, setShiftEditorSymbol] = useState(null); // ticker symbol whose shift popover is open
  const widgetOuterRef = useRef(null);

  // Zoom/Pan functionality via custom hook
  const {
    visibleRange,
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
    showSelector: showTechnicalIndicatorSelector,
    setShowSelector: setShowTechnicalIndicatorSelector,
    addIndicator: addTechnicalIndicator,
    addSeriesIndicator: addSeriesTechnicalIndicator,
    removeIndicator: removeTechnicalIndicator,
    toggleVisibility: toggleTechnicalIndicatorVisibility,
    removeAllForSymbol: removeAllIndicatorsForSymbol,
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
      const interval = resolveInterval(startDate, endDate);
      const fetchStart = resolveFetchStart({
        startDate,
        interval,
        normalized,
        hasTechnicalIndicators: technicalIndicators.length > 0,
        chartType,
      });

      const results = await fetchTickerData(tickers, { fetchStart, endDate, interval, startDate });
      setTickerStats(collectTickerStats(results));

      let mergedData = mergeData(results, normalized);

      // Calculate and add technical indicators for each stock
      if (technicalIndicators.length > 0 && !normalized) {
        technicalIndicators.forEach(({ indicatorId, symbol }) => {
          const stockData = results.find(r => r.symbol === symbol && r.type === 'stock');
          if (stockData && stockData.data && stockData.data.length > 0) {
            const indicatorData = calculateIndicator(indicatorId, stockData.data);
            if (indicatorData) {
              mergedData = mergeIndicatorData(mergedData, indicatorData, indicatorId, symbol);
            }
          }
        });
      }

      // Pair Analysis Mode data loading (using hook functions)
      if (pairMode && pairConfig.longSymbol && pairConfig.shortSymbol) {
        const longStockData = results.find(r => r.symbol === pairConfig.longSymbol && r.type === 'stock');
        const shortStockData = results.find(r => r.symbol === pairConfig.shortSymbol && r.type === 'stock');

        if (longStockData?.data?.length && shortStockData?.data?.length) {
          calculateSpreadData(longStockData.data, shortStockData.data);
        }

        if (pairConfig.showRegime || pairConfig.showIndex) {
          await loadRegimeData(rangeToPeriod(startDate), interval);
        }

        await loadFinancialData();

        mergedData = mergeSpreadToChart(mergedData);
        mergedData = mergeRegimeToChart(mergedData);
        mergedData = mergeIndexToChart(mergedData);
      } else {
        // Reset pair analysis data when mode is off
        resetPairData();
      }

      setChartData(windowToRange(mergedData, startDate, endDate));
    } catch (error) {
      console.error('Error loading chart data:', error);
    } finally {
      setLoading(false);
    }
  }, [tickers, startDate, endDate, normalized, technicalIndicators, chartType, pairMode, pairConfig]);

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

      <ChartTypeDropdown
        show={showChartTypeSelectorDropdown}
        onClose={() => setShowChartTypeSelectorDropdown(false)}
        tokens={tokens}
        chartType={chartType}
        setChartType={setChartType}
      />

      <MacroIndicatorDropdown
        show={showIndicatorSelector}
        onClose={() => setShowIndicatorSelector(false)}
        tokens={tokens}
        tickers={tickers}
        onAdd={handleAddIndicator}
      />

      <TechnicalIndicatorDropdown
        show={showTechnicalIndicatorSelector}
        onClose={() => setShowTechnicalIndicatorSelector(false)}
        tokens={tokens}
        isSeriesMode={isSeriesMode}
        visibleSeries={visibleSeries}
        tickers={tickers}
        technicalIndicators={technicalIndicators}
        onAddSeries={handleAddSeriesTechnicalIndicator}
        onAddSymbol={handleAddTechnicalIndicator}
      />

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

                    <TickerShiftPopover
                      open={shiftEditorSymbol === ticker.symbol}
                      ticker={ticker}
                      tokens={tokens}
                      onClose={() => setShiftEditorSymbol(null)}
                      updateTickerColor={updateTickerColor}
                      updateTickerShift={updateTickerShift}
                    />
                  </div>
                ))}

                {/* Technical Indicator Chips */}
                {technicalIndicators.map((indicator) => {
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

              <ChartControls
                show={{
                  timeRanges: showTimeRanges,
                  chartTypeSelector: showChartTypeSelector,
                  normalize: showNormalize,
                  volumeToggle: showVolumeToggle,
                  pairAnalysis: showPairAnalysis,
                }}
                isSeriesMode={isSeriesMode}
                startDate={startDate}
                endDate={endDate}
                setStartDate={setStartDate}
                setEndDate={setEndDate}
                chartType={chartType}
                setChartType={setChartType}
                normalized={normalized}
                setNormalized={setNormalized}
                showVolume={showVolume}
                setShowVolume={setShowVolume}
                volumeAvailable={isSeriesMode ? hasVolumeInSeries : tickers.some(t => t.type === 'stock')}
                pairMode={pairMode}
                setPairMode={setPairMode}
                showPairSettings={showPairSettings}
                setShowPairSettings={setShowPairSettings}
              />
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
