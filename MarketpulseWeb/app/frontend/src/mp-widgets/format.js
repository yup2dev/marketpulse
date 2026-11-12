/** 숫자 표기와 등락 색 — 뷰들이 같이 쓴다. 색은 index.css 의 --mpc-* 변수 */

/** +1.23% / −1.23% (U+2212) / 0.00% */
export function fmtPct(v, digits = 2) {
  if (v == null || Number.isNaN(Number(v))) return '';
  const n = Number(v);
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toFixed(digits)}%`;
}

/** 1.2K · 3.4M · 5.6B · 7.8T */
export function fmtCompact(v, digits = 1) {
  if (v == null || Number.isNaN(Number(v))) return '';
  const n = Number(v), a = Math.abs(n);
  if (a >= 1e12) return `${(n / 1e12).toFixed(digits)}T`;
  if (a >= 1e9)  return `${(n / 1e9).toFixed(digits)}B`;
  if (a >= 1e6)  return `${(n / 1e6).toFixed(digits)}M`;
  if (a >= 1e3)  return `${(n / 1e3).toFixed(digits)}K`;
  return String(Math.round(n));
}

/** 통화 기호 없는 수 — 큰 값일수록 소수 자릿수를 줄인다 */
export function fmtNumber(v) {
  if (v == null || Number.isNaN(Number(v))) return '';
  const a = Math.abs(v);
  const max = a >= 10000 ? 1 : a >= 1 ? 2 : 4;
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: max });
}

/** 통화 기호 붙은 가격 — KRW 는 원 단위, 그 외는 달러 소수 둘째 자리 */
export function fmtPrice(v, currency) {
  if (v == null) return '—';
  if (currency === 'KRW') return `₩${Math.round(v).toLocaleString('ko-KR')}`;
  return `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** 부호 → 상승/하락/보합 색 (CSS 변수) */
export function toneOf(v) {
  const n = Number(v);
  if (v == null || Number.isNaN(n) || n === 0) return 'var(--mpc-flat)';
  return n > 0 ? 'var(--mpc-up)' : 'var(--mpc-down)';
}

/** 행에서 값 꺼내기 — 필드 이름 또는 (row, ctx) => 값 */
export function read(row, key, ctx) {
  if (key == null) return undefined;
  return typeof key === 'function' ? key(row, ctx) : row[key];
}
