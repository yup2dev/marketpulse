/** 날짜 표기 공통 */

/**
 * 'YYYY-MM-DD' (로컬 시간대 기준). 날짜로 읽을 수 없으면 값을 그대로 돌려준다.
 *   fmtDate('2026-11-20T09:00:00Z') → '2026-11-20'
 */
export function fmtDate(v, { empty = '' } = {}) {
  if (v == null || v === '') return empty;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
