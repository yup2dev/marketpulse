/**
 * calendarUtils — 경제/실적 캘린더 공용 헬퍼.
 * 데이터 소스: /api/data/nasdaq/economic_calendar | earnings_calendar (무료·키 불필요)
 */

export const isoDate = (d) => {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
};

export const addDays = (base, n) => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
};

/** 날짜 스트립 라벨: 어제/오늘/내일, 그 외는 요일 */
export const dayLabel = (date, todayIso) => {
  const iso = isoDate(date);
  const diff = Math.round((new Date(iso) - new Date(todayIso)) / 86400000);
  if (diff === -1) return '어제';
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  return ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
};

/** $3,120,000,000 → "$3.12B" */
export const fmtMarketCap = (v) => {
  if (v == null) return '—';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${Math.round(v).toLocaleString()}`;
};

export const fmtEps = (v) => {
  if (v == null) return '—';
  return v < 0 ? `-$${Math.abs(v).toFixed(2)}` : `$${v.toFixed(2)}`;
};

export const IMPACT_STARS = { high: '★★★', medium: '★★', low: '★' };

export const TIME_LABELS = {
  'pre-market': '개장 전',
  'after-hours': '폐장 후',
};
