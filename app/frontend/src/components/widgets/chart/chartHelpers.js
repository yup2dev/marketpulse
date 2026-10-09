/**
 * ChartWidget 순수 헬퍼 — 날짜 범위 프리셋, 시프트(lead/lag), Heikin-Ashi 변환.
 *
 * ChartWidget.jsx 에서 분리했다. 전부 React 에 의존하지 않는 순수 함수라
 * 단독으로 테스트하거나 다른 차트 위젯에서 재사용할 수 있다.
 */

// Time shift (lead/lag) helpers — shift a series' dates by calendar D/W/M.
// Positive value = lead: data moves forward (right) so past values overlay the present.
export const SHIFT_UNITS = [
  { id: 'D', label: 'Days' },
  { id: 'W', label: 'Weeks' },
  { id: 'M', label: 'Months' },
];

export const shiftDateStr = (dateStr, value, unit) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  if (unit === 'M') d.setMonth(d.getMonth() + value);
  else if (unit === 'W') d.setDate(d.getDate() + value * 7);
  else d.setDate(d.getDate() + value);
  const pad = (n) => String(n).padStart(2, '0');
  const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  // Preserve time portion for intraday data (e.g. "2026-07-15T09:30:00")
  return dateStr.length > 10 ? `${datePart}${dateStr.slice(10)}` : datePart;
};

export const getShiftLabel = (shift) =>
  shift?.value ? `${shift.value > 0 ? '+' : ''}${shift.value}${shift.unit}` : null;

export const tickerDisplayName = (ticker) => {
  const base = ticker.name || ticker.symbol;
  const label = getShiftLabel(ticker.shift);
  return label ? `${base} (${label})` : base;
};

// Calculate Heikin-Ashi values
export const calculateHeikinAshi = (data, symbol) => {
  if (!data || data.length === 0) return data;

  const result = [...data];
  let prevHA = null;

  for (let i = 0; i < result.length; i++) {
    const item = result[i];
    const open = item[`${symbol}_open`];
    const high = item[`${symbol}_high`];
    const low = item[`${symbol}_low`];
    const close = item[`${symbol}_close`];

    if (open === undefined || close === undefined) continue;

    const haClose = (open + high + low + close) / 4;
    const haOpen = prevHA ? (prevHA.open + prevHA.close) / 2 : (open + close) / 2;
    const haHigh = Math.max(high || haClose, haOpen, haClose);
    const haLow = Math.min(low || haClose, haOpen, haClose);

    result[i] = {
      ...item,
      [`${symbol}_open`]: haOpen,
      [`${symbol}_high`]: haHigh,
      [`${symbol}_low`]: haLow,
      [`${symbol}_close`]: haClose,
    };

    prevHA = { open: haOpen, close: haClose };
  }

  return result;
};

export const fmtDate = (d) => d.toISOString().slice(0, 10);

// Default date range: last 1 month.
export const defaultDateRange = () => {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 1);
  return { start: fmtDate(start), end: fmtDate(end) };
};

export const DATE_RANGE_PRESETS = [
  { label: '1M', months: 1 },
  { label: '6M', months: 6 },
  { label: '1Y', months: 12 },
  { label: '5Y', months: 60 },
];

export const presetDateRange = (months) => {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  return { start: fmtDate(start), end: fmtDate(end) };
};

// Period-anchored aux endpoints (regime 등) fetch startDate→today; pick the
// smallest preset covering that span.
export const rangeToPeriod = (startDate) => {
  const days = Math.ceil((Date.now() - new Date(startDate).getTime()) / 86400000);
  if (days <= 31)   return '1mo';
  if (days <= 93)   return '3mo';
  if (days <= 186)  return '6mo';
  if (days <= 366)  return '1y';
  if (days <= 731)  return '2y';
  if (days <= 1827) return '5y';
  return 'max';
};
