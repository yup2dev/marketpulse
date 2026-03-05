/**
 * Technical Indicator Calculation Utilities
 */

/**
 * Calculate Simple Moving Average (SMA)
 */
export const calculateSMA = (data, period) => {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push({ date: data[i].date, value: null });
      continue;
    }
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, d) => acc + d.close, 0);
    result.push({ date: data[i].date, value: sum / period });
  }
  return result;
};

/**
 * Calculate Exponential Moving Average (EMA)
 */
export const calculateEMA = (data, period) => {
  const result = [];
  const multiplier = 2 / (period + 1);

  // First EMA is SMA
  let ema = data.slice(0, period).reduce((acc, d) => acc + d.close, 0) / period;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push({ date: data[i].date, value: null });
      continue;
    }

    if (i === period - 1) {
      result.push({ date: data[i].date, value: ema });
    } else {
      ema = (data[i].close - ema) * multiplier + ema;
      result.push({ date: data[i].date, value: ema });
    }
  }
  return result;
};

/**
 * Calculate Bollinger Bands
 */
export const calculateBollingerBands = (data, period, stdDev) => {
  const sma = calculateSMA(data, period);
  const result = {
    upper: [],
    middle: [],
    lower: []
  };

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.upper.push({ date: data[i].date, value: null });
      result.middle.push({ date: data[i].date, value: null });
      result.lower.push({ date: data[i].date, value: null });
      continue;
    }

    const slice = data.slice(i - period + 1, i + 1);
    const avg = sma[i].value;
    const squaredDiffs = slice.map(d => Math.pow(d.close - avg, 2));
    const variance = squaredDiffs.reduce((acc, d) => acc + d, 0) / period;
    const standardDeviation = Math.sqrt(variance);

    result.upper.push({ date: data[i].date, value: avg + (stdDev * standardDeviation) });
    result.middle.push({ date: data[i].date, value: avg });
    result.lower.push({ date: data[i].date, value: avg - (stdDev * standardDeviation) });
  }

  return result;
};

/**
 * Calculate Relative Strength Index (RSI)
 */
export const calculateRSI = (data, period) => {
  const result = [];
  const gains = [];
  const losses = [];

  for (let i = 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      result.push({ date: data[i].date, value: null });
      continue;
    }

    const avgGain = gains.slice(i - period, i).reduce((acc, g) => acc + g, 0) / period;
    const avgLoss = losses.slice(i - period, i).reduce((acc, l) => acc + l, 0) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    result.push({ date: data[i].date, value: rsi });
  }

  return result;
};

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export const calculateMACD = (data, fastPeriod, slowPeriod, signalPeriod) => {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);

  const macdLine = [];
  for (let i = 0; i < data.length; i++) {
    if (fastEMA[i].value === null || slowEMA[i].value === null) {
      macdLine.push({ date: data[i].date, value: null });
    } else {
      macdLine.push({
        date: data[i].date,
        value: fastEMA[i].value - slowEMA[i].value
      });
    }
  }

  // Calculate signal line (EMA of MACD)
  const validMacd = macdLine.filter(m => m.value !== null);
  const signalData = validMacd.map(m => ({ close: m.value, date: m.date }));
  const signalEMA = calculateEMA(signalData, signalPeriod);

  // Merge signal back with full dataset
  const signal = [];
  let signalIndex = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i].value === null) {
      signal.push({ date: data[i].date, value: null });
    } else {
      signal.push({
        date: data[i].date,
        value: signalEMA[signalIndex]?.value || null
      });
      signalIndex++;
    }
  }

  const histogram = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i].value === null || signal[i].value === null) {
      histogram.push({ date: data[i].date, value: null });
    } else {
      histogram.push({
        date: data[i].date,
        value: macdLine[i].value - signal[i].value
      });
    }
  }

  return {
    macd: macdLine,
    signal: signal,
    histogram: histogram
  };
};

/**
 * Calculate Stochastic Oscillator
 */
export const calculateStochastic = (data, kPeriod, dPeriod) => {
  const kValues = [];

  for (let i = 0; i < data.length; i++) {
    if (i < kPeriod - 1) {
      kValues.push({ date: data[i].date, value: null });
      continue;
    }

    const slice = data.slice(i - kPeriod + 1, i + 1);
    const high = Math.max(...slice.map(d => d.high));
    const low = Math.min(...slice.map(d => d.low));
    const close = data[i].close;

    const k = ((close - low) / (high - low)) * 100;
    kValues.push({ date: data[i].date, value: k });
  }

  // Calculate %D (SMA of %K)
  const dValues = [];
  for (let i = 0; i < kValues.length; i++) {
    if (i < kPeriod - 1 + dPeriod - 1) {
      dValues.push({ date: data[i].date, value: null });
      continue;
    }

    const slice = kValues.slice(i - dPeriod + 1, i + 1);
    const validValues = slice.filter(v => v.value !== null);
    if (validValues.length === 0) {
      dValues.push({ date: data[i].date, value: null });
      continue;
    }

    const avg = validValues.reduce((acc, v) => acc + v.value, 0) / validValues.length;
    dValues.push({ date: data[i].date, value: avg });
  }

  return {
    k: kValues,
    d: dValues
  };
};

/**
 * Calculate Average True Range (ATR)
 */
export const calculateATR = (data, period) => {
  const trueRanges = [];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      trueRanges.push(data[i].high - data[i].low);
    } else {
      const tr = Math.max(
        data[i].high - data[i].low,
        Math.abs(data[i].high - data[i - 1].close),
        Math.abs(data[i].low - data[i - 1].close)
      );
      trueRanges.push(tr);
    }
  }

  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push({ date: data[i].date, value: null });
      continue;
    }

    const atr = trueRanges.slice(i - period + 1, i + 1).reduce((acc, tr) => acc + tr, 0) / period;
    result.push({ date: data[i].date, value: atr });
  }

  return result;
};

/**
 * Calculate On-Balance Volume (OBV)
 */
export const calculateOBV = (data) => {
  const result = [];
  let obv = 0;

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      obv = data[i].volume;
    } else {
      if (data[i].close > data[i - 1].close) {
        obv += data[i].volume;
      } else if (data[i].close < data[i - 1].close) {
        obv -= data[i].volume;
      }
    }
    result.push({ date: data[i].date, value: obv });
  }

  return result;
};

/**
 * Main function to calculate indicator based on ID
 */
export const calculateIndicator = (indicatorId, data, params = {}) => {
  if (!data || data.length === 0) return null;

  switch (indicatorId) {
    case 'SMA_20':
      return calculateSMA(data, 20);
    case 'SMA_50':
      return calculateSMA(data, 50);
    case 'SMA_200':
      return calculateSMA(data, 200);
    case 'EMA_12':
      return calculateEMA(data, 12);
    case 'EMA_26':
      return calculateEMA(data, 26);
    case 'BBANDS':
      return calculateBollingerBands(data, 20, 2);
    case 'RSI':
      return calculateRSI(data, 14);
    case 'MACD':
      return calculateMACD(data, 12, 26, 9);
    case 'STOCH':
      return calculateStochastic(data, 14, 3);
    case 'ATR':
      return calculateATR(data, 14);
    case 'OBV':
      return calculateOBV(data);
    default:
      return null;
  }
};
