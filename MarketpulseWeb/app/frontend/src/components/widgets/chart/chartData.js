import { apiClient } from '../../../config/api';
import { API_BASE } from '../constants';
import { fmtDate, rangeToPeriod } from './chartHelpers';

/**
 * 차트 데이터 조회·병합 — React 상태에 의존하지 않는 부분.
 *
 * ChartWidget 의 loadData 가 인터벌 산정, 네트워크 호출, 날짜 병합, 범위 트림까지
 * 한 함수에 담고 있어 145줄이었다. 상태를 쓰지 않는 조각을 여기로 옮겨 컴포넌트에는
 * React 배선(상태 갱신, 훅 연동)만 남긴다. 여기 있는 함수는 전부 단독 호출·검증이 가능하다.
 */

/** 조회 구간 길이로 봉 간격을 고른다. 분봉은 provider 가 최근(~60일)만 준다. */
export const resolveInterval = (startDate, endDate) => {
  const spanDays = Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000));
  const startAgeDays = Math.round((Date.now() - new Date(startDate).getTime()) / 86400000);
  const canIntraday = startAgeDays <= 55;

  if (spanDays <= 2)    return canIntraday ? '5m' : '1d';
  if (spanDays <= 7)    return canIntraday ? '15m' : '1d';
  if (spanDays <= 32)   return canIntraday ? '30m' : '1d';
  if (spanDays <= 730)  return '1d';
  if (spanDays <= 1830) return '1wk';
  return '1mo';
};

/**
 * 기술 지표 워밍업(SMA200 등)을 위해 조회 시작일을 앞으로 당긴다(~300일).
 * 표시 전에 windowToRange 로 다시 잘라낸다.
 * 분봉(provider 제한)과 정규화 모드(리베이스 기준점이 달라진다)에서는 당기지 않는다.
 */
export const resolveFetchStart = ({ startDate, interval, normalized, hasTechnicalIndicators, chartType }) => {
  const needsExtended = !normalized && !interval.endsWith('m') &&
    (hasTechnicalIndicators || ['candlestick', 'ohlc', 'heikinashi'].includes(chartType));
  if (!needsExtended) return startDate;

  const d = new Date(startDate);
  d.setDate(d.getDate() - 300);
  return fmtDate(d);
};

/** 종목·매크로지표를 한 번에 조회한다. 개별 실패는 빈 데이터로 흡수해 차트 전체를 막지 않는다. */
export const fetchTickerData = async (tickers, { fetchStart, endDate, interval, startDate }) => {
  const stocks = tickers.filter(t => t.type === 'stock');
  const indicators = tickers.filter(t => t.type === 'indicator');

  // apiClient(인증 헤더) + OBBject({results}) 응답 형태
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

  const indicatorPromises = indicators.map(async (indicator) => {
    try {
      const indicatorData = await apiClient.get(`${API_BASE}/stock/indicator/${indicator.symbol}?period=${rangeToPeriod(startDate)}`);

      return {
        symbol: indicator.symbol,
        type: 'indicator',
        data: indicatorData?.results || [],
        name: indicator.name,
      };
    } catch (error) {
      console.error(`Error loading indicator ${indicator.symbol}:`, error);
      return { symbol: indicator.symbol, type: 'indicator', data: [], name: indicator.name };
    }
  });

  return Promise.all([...stockPromises, ...indicatorPromises]);
};

/** 종목 칩에 띄울 시세/기업정보 — quote 와 info 가 둘 다 있을 때만 담는다. */
export const collectTickerStats = (results) => {
  const stats = {};
  results.filter(r => r.type === 'stock').forEach(({ symbol, quote, info }) => {
    if (quote && info) stats[symbol] = { quote, info };
  });
  return stats;
};

/** 표시 구간으로 자른다 — 지표 워밍업 버퍼와, 오늘 기준으로 받아온 매크로 시리즈의 초과분을 걷어낸다. */
export const windowToRange = (data, startDate, endDate) => {
  const startTs = new Date(startDate).getTime();
  const endTs = new Date(endDate).getTime() + 86400000; // 종료일 당일 포함
  return data.filter(d => d.timestamp >= startTs && d.timestamp < endTs);
};

/** 여러 소스를 날짜로 합쳐 하나의 시계열로 만든다. normalize 면 첫 값 대비 % 로 환산. */
export const mergeData = (results, normalize) => {
  if (results.length === 0) return [];

  let minDate = null;
  let maxDate = null;

  const stockResults = results.filter(r => r.type === 'stock');

  // 기간 기준은 종목 데이터 — 종목이 없으면 전체(매크로 지표)에서 잡는다.
  const rangeSource = stockResults.length > 0 ? stockResults : results;
  rangeSource.forEach(({ data }) => {
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

    let filteredData = data;
    if (minDate && maxDate) {
      filteredData = data.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= minDate && itemDate <= maxDate;
      });
    }

    if (type === 'stock') {
      // 정규화 기준점은 정렬 후 첫 종가
      const sortedData = [...filteredData].sort((a, b) => new Date(a.date) - new Date(b.date));
      const basePrice = normalize && sortedData.length > 0 ? sortedData[0].close : 1;

      sortedData.forEach(item => {
        if (!dateMap.has(item.date)) {
          dateMap.set(item.date, { date: item.date, timestamp: new Date(item.date).getTime() });
        }
        const entry = dateMap.get(item.date);
        entry[symbol] = normalize ? ((item.close / basePrice - 1) * 100) : item.close;
        entry[`${symbol}_volume`] = item.volume;
        // 캔들/OHLC 차트용 — 정규화 모드에서는 의미가 없어 담지 않는다.
        if (!normalize) {
          entry[`${symbol}_open`] = item.open;
          entry[`${symbol}_high`] = item.high;
          entry[`${symbol}_low`] = item.low;
          entry[`${symbol}_close`] = item.close;
        }
      });
    } else {
      // 매크로 지표 — 일부 fetcher는 value 대신 rate 필드를 쓴다(fed_funds_rate 등)
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

  return Array.from(dateMap.values()).sort((a, b) => a.timestamp - b.timestamp);
};

/**
 * 시리즈 모드에서 계산된 기술 지표를 차트 데이터에 얹는다.
 * 지표 모양이 네 가지라(MACD / 밴드 / 스토캐스틱 / 단일선) 형태로 분기한다.
 */
export const mergeSeriesIndicatorData = (chartData, indicatorData, indicatorId, seriesId) => {
  const dataMap = new Map(chartData.map(d => [d.date, { ...d }]));
  const key = (suffix) => `${seriesId}_${indicatorId}${suffix}`;

  if (indicatorData.macd) {
    indicatorData.macd.forEach((item, idx) => {
      if (!dataMap.has(item.date)) return;
      const entry = dataMap.get(item.date);
      entry[key('_macd')] = item.value;
      entry[key('_signal')] = indicatorData.signal[idx]?.value || null;
      entry[key('_histogram')] = indicatorData.histogram[idx]?.value || null;
    });
  } else if (indicatorData.upper) {
    indicatorData.upper.forEach((item, idx) => {
      if (!dataMap.has(item.date)) return;
      const entry = dataMap.get(item.date);
      entry[key('_upper')] = item.value;
      entry[key('_middle')] = indicatorData.middle[idx]?.value || null;
      entry[key('_lower')] = indicatorData.lower[idx]?.value || null;
    });
  } else if (indicatorData.k) {
    indicatorData.k.forEach((item, idx) => {
      if (!dataMap.has(item.date)) return;
      const entry = dataMap.get(item.date);
      entry[key('_k')] = item.value;
      entry[key('_d')] = indicatorData.d[idx]?.value || null;
    });
  } else {
    indicatorData.forEach(item => {
      if (dataMap.has(item.date)) dataMap.get(item.date)[key('')] = item.value;
    });
  }

  return Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);
};
