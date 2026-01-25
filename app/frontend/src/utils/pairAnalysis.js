/**
 * Pair Analysis Utility Functions
 * Functions for Long/Short spread analysis and market regime detection
 */

/**
 * Calculate spread ratio between long and short positions
 * @param {Array} longData - Array of { date, close } for long position
 * @param {Array} shortData - Array of { date, close } for short position
 * @returns {Array} - Array of { date, spread } values
 */
export const calculateSpread = (longData, shortData) => {
  if (!longData?.length || !shortData?.length) return [];

  // Create a map of short data by date for quick lookup
  const shortMap = new Map(shortData.map(item => [item.date, item.close]));

  return longData
    .filter(item => shortMap.has(item.date) && shortMap.get(item.date) > 0)
    .map(item => ({
      date: item.date,
      spread: item.close / shortMap.get(item.date)
    }));
};

/**
 * Normalize spread data with first value as base (1.0)
 * @param {Array} spreadData - Array of { date, spread } values
 * @returns {Array} - Array of { date, normalizedSpread } values
 */
export const normalizeSpread = (spreadData) => {
  if (!spreadData?.length) return [];

  const baseSpread = spreadData[0].spread;
  if (!baseSpread || baseSpread === 0) return [];

  return spreadData.map(item => ({
    date: item.date,
    spread: item.spread,
    normalizedSpread: item.spread / baseSpread
  }));
};

/**
 * Identify periods where long position outperforms short position
 * @param {Array} spreadData - Array of { date, normalizedSpread } values
 * @param {number} threshold - Threshold above 1.0 to consider outperformance (default 0)
 * @returns {Array} - Array of { start, end } date periods
 */
export const identifyOutperformancePeriods = (spreadData, threshold = 0) => {
  if (!spreadData?.length) return [];

  const periods = [];
  let currentPeriod = null;

  spreadData.forEach((item, index) => {
    const isOutperforming = item.normalizedSpread > (1 + threshold);

    if (isOutperforming && !currentPeriod) {
      // Start new outperformance period
      currentPeriod = { start: item.date };
    } else if (!isOutperforming && currentPeriod) {
      // End current outperformance period
      currentPeriod.end = spreadData[index - 1]?.date || item.date;
      periods.push(currentPeriod);
      currentPeriod = null;
    }
  });

  // Close any open period at the end
  if (currentPeriod) {
    currentPeriod.end = spreadData[spreadData.length - 1].date;
    periods.push(currentPeriod);
  }

  return periods;
};

/**
 * Calculate Simple Moving Average
 * @param {Array} data - Array of price values
 * @param {number} period - SMA period
 * @returns {Array} - Array of SMA values (null for insufficient data)
 */
const calculateSMA = (data, period) => {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
};

/**
 * Detect market regime based on price vs moving average
 * @param {Array} indexData - Array of { date, close } for market index
 * @param {number} smaPeriod - SMA period for regime detection (default 50)
 * @returns {Array} - Array of { date, regime, close, sma } values
 */
export const detectRegime = (indexData, smaPeriod = 50) => {
  if (!indexData?.length) return [];

  const closes = indexData.map(item => item.close);
  const smaValues = calculateSMA(closes, smaPeriod);

  // Calculate trend direction using 10-day slope
  const trendPeriod = 10;

  return indexData.map((item, index) => {
    const sma = smaValues[index];

    if (sma === null) {
      return {
        date: item.date,
        close: item.close,
        sma: null,
        regime: 'sideways',
        priceVsSma: null
      };
    }

    const priceVsSma = (item.close - sma) / sma;

    // Calculate trend (slope of SMA)
    let trendUp = false;
    let trendDown = false;

    if (index >= trendPeriod) {
      const prevSma = smaValues[index - trendPeriod];
      if (prevSma !== null) {
        const smaChange = (sma - prevSma) / prevSma;
        trendUp = smaChange > 0.01;  // 1% increase
        trendDown = smaChange < -0.01; // 1% decrease
      }
    }

    // Determine regime
    let regime = 'sideways';
    if (priceVsSma > 0.02 && trendUp) {
      regime = 'bull';
    } else if (priceVsSma < -0.02 && trendDown) {
      regime = 'bear';
    }

    return {
      date: item.date,
      close: item.close,
      sma,
      regime,
      priceVsSma
    };
  });
};

/**
 * Get regime periods for ReferenceArea rendering
 * @param {Array} regimeData - Array from detectRegime
 * @returns {Array} - Array of { start, end, regime } periods
 */
export const getRegimePeriods = (regimeData) => {
  if (!regimeData?.length) return [];

  const periods = [];
  let currentPeriod = null;

  regimeData.forEach((item, index) => {
    if (!currentPeriod) {
      currentPeriod = { start: item.date, regime: item.regime };
    } else if (item.regime !== currentPeriod.regime) {
      currentPeriod.end = regimeData[index - 1].date;
      periods.push(currentPeriod);
      currentPeriod = { start: item.date, regime: item.regime };
    }
  });

  // Close the last period
  if (currentPeriod) {
    currentPeriod.end = regimeData[regimeData.length - 1].date;
    periods.push(currentPeriod);
  }

  return periods;
};

/**
 * Get color for regime background
 * @param {string} regime - 'bull', 'bear', or 'sideways'
 * @returns {string} - RGBA color string
 */
export const getRegimeColor = (regime) => {
  switch (regime) {
    case 'bull':
      return 'rgba(34, 197, 94, 0.08)';  // Green
    case 'bear':
      return 'rgba(239, 68, 68, 0.08)';  // Red
    case 'sideways':
    default:
      return 'rgba(234, 179, 8, 0.05)';  // Yellow
  }
};

/**
 * Get badge style for regime
 * @param {string} regime - 'bull', 'bear', or 'sideways'
 * @returns {object} - { bgColor, textColor, label }
 */
export const getRegimeBadge = (regime) => {
  switch (regime) {
    case 'bull':
      return {
        bgColor: 'bg-green-500/20',
        textColor: 'text-green-400',
        label: 'Bull'
      };
    case 'bear':
      return {
        bgColor: 'bg-red-500/20',
        textColor: 'text-red-400',
        label: 'Bear'
      };
    case 'sideways':
    default:
      return {
        bgColor: 'bg-yellow-500/20',
        textColor: 'text-yellow-400',
        label: 'Sideways'
      };
  }
};

/**
 * Merge spread data into chart data
 * @param {Array} chartData - Existing chart data array
 * @param {Array} spreadData - Normalized spread data array
 * @returns {Array} - Merged chart data with spread values
 */
export const mergeSpreadData = (chartData, spreadData) => {
  if (!chartData?.length || !spreadData?.length) return chartData;

  const spreadMap = new Map(spreadData.map(item => [item.date, item]));

  return chartData.map(item => {
    const spreadItem = spreadMap.get(item.date);
    if (spreadItem) {
      return {
        ...item,
        spread: spreadItem.normalizedSpread
      };
    }
    return item;
  });
};

/**
 * Merge regime data into chart data
 * @param {Array} chartData - Existing chart data array
 * @param {Array} regimeData - Regime data array
 * @returns {Array} - Merged chart data with regime values
 */
export const mergeRegimeData = (chartData, regimeData) => {
  if (!chartData?.length || !regimeData?.length) return chartData;

  const regimeMap = new Map(regimeData.map(item => [item.date, item.regime]));

  return chartData.map(item => {
    const regime = regimeMap.get(item.date);
    return {
      ...item,
      regime: regime || 'sideways'
    };
  });
};
