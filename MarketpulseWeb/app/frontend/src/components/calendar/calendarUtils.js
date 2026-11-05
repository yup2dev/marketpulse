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
  'pre-market': 'Pre-market',
  'after-hours': 'After hours',
};

// 위젯 FilterBar 옵션 (라벨은 영어)
export const IMPACT_FILTERS = [
  { value: 'all',    label: 'All' },
  { value: 'high',   label: '★★★' },
  { value: 'medium', label: '★★+' },
];

export const EARNINGS_SORTS = [
  { value: 'mcap', label: 'Market cap' },
  { value: 'eps',  label: 'EPS forecast' },
];
