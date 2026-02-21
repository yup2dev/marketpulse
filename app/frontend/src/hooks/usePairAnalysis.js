import { useState, useCallback } from 'react';
import {
  calculateSpread,
  normalizeSpread,
  identifyOutperformancePeriods,
  detectRegime,
  getRegimePeriods,
  mergeSpreadData,
  mergeRegimeData,
} from '../utils/pairAnalysis';
import { API_BASE } from '../components/widgets/constants';

/**
 * usePairAnalysis - Custom hook for pair trading analysis
 * Handles spread calculation, regime detection, and financial data
 *
 * @param {Object} options
 * @param {Object} options.initialConfig - Initial pair configuration
 * @returns {Object} Pair analysis state and handlers
 */
const usePairAnalysis = ({
  initialConfig = {
    longSymbol: null,
    shortSymbol: null,
    regimeSymbol: '^KS11',
    showSpread: true,
    showIndex: true,
    showHighlight: true,
    showRegime: true,
    showFCF: true,
  },
  initialMode = false,
} = {}) => {
  // Pair mode state
  const [pairMode, setPairMode] = useState(initialMode);
  const [pairConfig, setPairConfig] = useState(initialConfig);
  const [showSettings, setShowSettings] = useState(false);

  // Analysis data
  const [spreadData, setSpreadData] = useState([]);
  const [regimeData, setRegimeData] = useState([]);
  const [regimePeriods, setRegimePeriods] = useState([]);
  const [outperformPeriods, setOutperformPeriods] = useState([]);
  const [indexData, setIndexData] = useState([]);
  const [financialData, setFinancialData] = useState({ long: null, short: null });
  const [currentRegime, setCurrentRegime] = useState('sideways');

  // Toggle pair mode
  const togglePairMode = useCallback(() => {
    setPairMode(prev => {
      if (!prev) {
        setShowSettings(true);
      }
      return !prev;
    });
  }, []);

  // Update pair config
  const updateConfig = useCallback((updates) => {
    setPairConfig(prev => ({ ...prev, ...updates }));
  }, []);

  // Reset all pair analysis data
  const resetData = useCallback(() => {
    setSpreadData([]);
    setRegimeData([]);
    setRegimePeriods([]);
    setOutperformPeriods([]);
    setFinancialData({ long: null, short: null });
    setIndexData([]);
  }, []);

  // Calculate spread from stock data
  const calculateSpreadData = useCallback((longStockData, shortStockData) => {
    if (!longStockData?.length || !shortStockData?.length) {
      return { spreadData: [], outperformPeriods: [] };
    }

    const rawSpread = calculateSpread(longStockData, shortStockData);
    const normalizedSpreadData = normalizeSpread(rawSpread);
    const outperform = identifyOutperformancePeriods(normalizedSpreadData);

    setSpreadData(normalizedSpreadData);
    setOutperformPeriods(outperform);

    return { spreadData: normalizedSpreadData, outperformPeriods: outperform };
  }, []);

  // Load regime/index data
  const loadRegimeData = useCallback(async (period, interval) => {
    if (!pairConfig.regimeSymbol) return null;

    try {
      const regimeRes = await fetch(
        `${API_BASE}/stock/history/${encodeURIComponent(pairConfig.regimeSymbol)}?period=${period}&interval=${interval}`
      );

      if (!regimeRes.ok) return null;

      const regimeHistory = await regimeRes.json();
      if (!regimeHistory?.data?.length) return null;

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
      }

      return regimeHistory.data;
    } catch (error) {
      console.error('Error loading regime/index data:', error);
      return null;
    }
  }, [pairConfig.regimeSymbol, pairConfig.showRegime]);

  // Load financial data (FCF/CapEx)
  const loadFinancialData = useCallback(async () => {
    if (!pairConfig.showFCF || !pairConfig.longSymbol || !pairConfig.shortSymbol) {
      return;
    }

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
  }, [pairConfig.showFCF, pairConfig.longSymbol, pairConfig.shortSymbol]);

  // Merge spread data into chart data
  const mergeSpreadToChart = useCallback((chartData) => {
    if (!pairConfig.showSpread || spreadData.length === 0) {
      return chartData;
    }
    return mergeSpreadData(chartData, spreadData);
  }, [pairConfig.showSpread, spreadData]);

  // Merge regime data into chart data
  const mergeRegimeToChart = useCallback((chartData) => {
    if (!pairConfig.showRegime || regimeData.length === 0) {
      return chartData;
    }
    return mergeRegimeData(chartData, regimeData);
  }, [pairConfig.showRegime, regimeData]);

  // Merge normalized index data into chart data
  const mergeIndexToChart = useCallback((chartData) => {
    if (!pairConfig.showIndex || indexData.length === 0) {
      return chartData;
    }

    const indexMap = new Map();
    const sortedIndexData = [...indexData].sort((a, b) => new Date(a.date) - new Date(b.date));
    const baseIndexPrice = sortedIndexData[0]?.close || 1;

    sortedIndexData.forEach(item => {
      indexMap.set(item.date, (item.close / baseIndexPrice));
    });

    return chartData.map(item => {
      const indexValue = indexMap.get(item.date);
      return indexValue !== undefined
        ? { ...item, indexNormalized: indexValue }
        : item;
    });
  }, [pairConfig.showIndex, indexData]);

  // Process all pair analysis data for chart
  const processPairData = useCallback(async (stockResults, period, interval) => {
    if (!pairMode || !pairConfig.longSymbol || !pairConfig.shortSymbol) {
      resetData();
      return null;
    }

    const longStockData = stockResults.find(r => r.symbol === pairConfig.longSymbol)?.data;
    const shortStockData = stockResults.find(r => r.symbol === pairConfig.shortSymbol)?.data;

    // Calculate spread
    const { spreadData: newSpreadData } = calculateSpreadData(longStockData, shortStockData);

    // Load regime/index data
    if (pairConfig.showRegime || pairConfig.showIndex) {
      await loadRegimeData(period, interval);
    }

    // Load financial data
    await loadFinancialData();

    return {
      spreadData: newSpreadData,
      regimeData,
      regimePeriods,
      outperformPeriods,
      financialData,
    };
  }, [
    pairMode,
    pairConfig,
    resetData,
    calculateSpreadData,
    loadRegimeData,
    loadFinancialData,
    regimeData,
    regimePeriods,
    outperformPeriods,
    financialData,
  ]);

  return {
    // State
    pairMode,
    setPairMode,
    pairConfig,
    setPairConfig,
    showSettings,
    setShowSettings,

    // Analysis data
    spreadData,
    regimeData,
    regimePeriods,
    outperformPeriods,
    indexData,
    financialData,
    currentRegime,

    // Actions
    togglePairMode,
    updateConfig,
    resetData,

    // Data processing
    calculateSpreadData,
    loadRegimeData,
    loadFinancialData,
    mergeSpreadToChart,
    mergeRegimeToChart,
    mergeIndexToChart,
    processPairData,
  };
};

export default usePairAnalysis;
