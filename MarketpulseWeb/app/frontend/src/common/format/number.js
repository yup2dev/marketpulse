/**
 * 숫자 표기 공통 — 화면·위젯·테이블이 모두 이 함수를 쓴다 (따로 정의하지 말 것).
 *
 * 규칙
 *   - 첫 인자는 값, 둘째는 소수 자릿수(위치 인자), 그 밖의 차이는 마지막 옵션 객체로 받는다.
 *   - 숫자가 아니면(null · undefined · NaN · '') opts.empty 를 돌려준다. 기본값은 함수마다 다르다
 *     — 위젯(mp-widgets)은 '' 로 빈 칸, 테이블은 '—' 를 넘겨 쓴다.
 *   - 퍼센트의 음수 기호는 U+2212(−), 나머지는 toFixed/toLocaleString 기본(-) 그대로.
 */

/** 숫자로 읽을 수 있는 값인가 */
export function isNum(v) {
  return v != null && v !== '' && !Number.isNaN(Number(v));
}

/**
 * 퍼센트. 값 자체가 이미 % 단위다 (0.05 가 아니라 5).
 *   fmtPct(1.234)                 → '+1.23%'
 *   fmtPct(-1.234)                → '−1.23%'
 *   fmtPct(0)                     → '0.00%'
 *   fmtPct(4.1, 1, { sign: false }) → '4.1%'   (금리·물가처럼 부호가 의미 없는 값)
 */
export function fmtPct(v, digits = 2, { sign = true, empty = '' } = {}) {
  if (!isNum(v)) return empty;
  const n = Number(v);
  const prefix = n > 0 ? (sign ? '+' : '') : n < 0 ? '−' : '';
  return `${prefix}${Math.abs(n).toFixed(digits)}%`;
}

/**
 * 큰 수 축약 — 1.2K · 3.4M · 5.6B · 7.8T
 *   1000 미만은 기본적으로 정수 반올림. opts.smallDigits 를 주면 그 자릿수까지 소수를 남긴다.
 */
export function fmtCompact(v, digits = 1, { empty = '', smallDigits } = {}) {
  if (!isNum(v)) return empty;
  const n = Number(v), a = Math.abs(n);
  if (a >= 1e12) return `${(n / 1e12).toFixed(digits)}T`;
  if (a >= 1e9)  return `${(n / 1e9).toFixed(digits)}B`;
  if (a >= 1e6)  return `${(n / 1e6).toFixed(digits)}M`;
  if (a >= 1e3)  return `${(n / 1e3).toFixed(digits)}K`;
  if (smallDigits != null) return n.toLocaleString('en-US', { maximumFractionDigits: smallDigits });
  return String(Math.round(n));
}

/**
 * 통화 기호 없는 수 (천 단위 콤마).
 *   digits 를 안 주면 크기에 따라 소수 자릿수를 줄인다: ≥10000 → 1, ≥1 → 2, 그 밖 → 4
 *   digits 를 주면 최대 그 자릿수까지.
 */
export function fmtNumber(v, digits, { empty = '' } = {}) {
  if (!isNum(v)) return empty;
  const n = Number(v), a = Math.abs(n);
  const max = digits ?? (a >= 10000 ? 1 : a >= 1 ? 2 : 4);
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: max });
}

/** 통화 기호 붙은 가격 — KRW 는 원 단위, 그 외는 달러 소수 둘째 자리 */
export function fmtPrice(v, currency, { empty = '—' } = {}) {
  if (!isNum(v)) return empty;
  const n = Number(v);
  if (currency === 'KRW') return `₩${Math.round(n).toLocaleString('ko-KR')}`;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** 부호 → 상승/하락/보합 색 (CSS 변수, index.css 의 --mpc-*) */
export function toneOf(v) {
  if (!isNum(v) || Number(v) === 0) return 'var(--mpc-flat)';
  return Number(v) > 0 ? 'var(--mpc-up)' : 'var(--mpc-down)';
}
