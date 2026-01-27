import { useState, useCallback } from 'react';
import { calculateIndicator } from '../utils/technicalIndicators';

/**
 * useTechnicalIndicators - Custom hook for managing technical indicators
 * Handles adding, removing, toggling, and calculating technical indicators
 *
 * @param {Object} options
 * @param {Array} options.initialIndicators - Initial technical indicators array
 * @returns {Object} Technical indicator state and handlers
 */
const useTechnicalIndicators = ({ initialIndicators = [] } = {}) => {
  const [technicalIndicators, setTechnicalIndicators] = useState(initialIndicators);
  const [showSelector, setShowSelector] = useState(false);

  // Add technical indicator for a stock symbol
  const addIndicator = useCallback((indicator, symbol) => {
    const exists = technicalIndicators.find(
      ti => ti.indicatorId === indicator.id && ti.symbol === symbol
    );
    if (exists) {
      return { success: false, message: 'Indicator already added for this stock' };
    }

    setTechnicalIndicators(prev => [...prev, {
      indicatorId: indicator.id,
      symbol: symbol,
      name: indicator.name,
      visible: true
    }]);
    setShowSelector(false);
    return { success: true };
  }, [technicalIndicators]);

  // Add technical indicator for a series (series mode)
  const addSeriesIndicator = useCallback((indicator, seriesId) => {
    const exists = technicalIndicators.find(
      ti => ti.indicatorId === indicator.id && ti.seriesId === seriesId
    );
    if (exists) {
      return { success: false, message: 'Indicator already added for this series' };
    }

    setTechnicalIndicators(prev => [...prev, {
      indicatorId: indicator.id,
      seriesId: seriesId,
      name: indicator.name,
      visible: true
    }]);
    setShowSelector(false);
    return { success: true };
  }, [technicalIndicators]);

  // Remove technical indicator
  const removeIndicator = useCallback((indicatorId, symbolOrSeriesId) => {
    setTechnicalIndicators(prev => prev.filter(
      ti => !(ti.indicatorId === indicatorId && (ti.symbol === symbolOrSeriesId || ti.seriesId === symbolOrSeriesId))
    ));
  }, []);

  // Toggle indicator visibility
  const toggleVisibility = useCallback((indicatorId, symbolOrSeriesId) => {
    setTechnicalIndicators(prev => prev.map(ti =>
      ti.indicatorId === indicatorId && (ti.symbol === symbolOrSeriesId || ti.seriesId === symbolOrSeriesId)
        ? { ...ti, visible: !ti.visible }
        : ti
    ));
  }, []);

  // Remove all indicators for a specific symbol
  const removeAllForSymbol = useCallback((symbol) => {
    setTechnicalIndicators(prev => prev.filter(ti => ti.symbol !== symbol));
  }, []);

  // Get visible indicators
  const getVisibleIndicators = useCallback(() => {
    return technicalIndicators.filter(ti => ti.visible);
  }, [technicalIndicators]);

  // Merge indicator data into chart data
  const mergeIndicatorData = useCallback((chartData, indicatorData, indicatorId, symbol) => {
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
  }, []);

  // Calculate and apply indicators to chart data
  const applyIndicators = useCallback((chartData, stockDataMap, normalized = false) => {
    if (technicalIndicators.length === 0 || normalized) {
      return chartData;
    }

    let result = [...chartData];

    technicalIndicators.forEach(({ indicatorId, symbol, seriesId }) => {
      const targetSymbol = symbol || seriesId;
      const stockData = stockDataMap?.[targetSymbol];

      if (stockData && stockData.length > 0) {
        const indicatorData = calculateIndicator(indicatorId, stockData);
        if (indicatorData) {
          result = mergeIndicatorData(result, indicatorData, indicatorId, targetSymbol);
        }
      }
    });

    return result;
  }, [technicalIndicators, mergeIndicatorData]);

  return {
    // State
    technicalIndicators,
    setTechnicalIndicators,
    showSelector,
    setShowSelector,

    // Actions
    addIndicator,
    addSeriesIndicator,
    removeIndicator,
    toggleVisibility,
    removeAllForSymbol,

    // Getters
    getVisibleIndicators,

    // Data processing
    mergeIndicatorData,
    applyIndicators,
  };
};

export default useTechnicalIndicators;
