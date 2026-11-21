/** 숫자 표기·등락 색은 common/format 이 단일 소스 — 뷰들이 쓰던 경로를 유지하려고 다시 내보낸다 */
export { fmtPct, fmtCompact, fmtNumber, fmtPrice, fmtDate, toneOf } from '../../common';

/** 행에서 값 꺼내기 — 필드 이름 또는 (row, ctx) => 값 */
export function read(row, key, ctx) {
  if (key == null) return undefined;
  return typeof key === 'function' ? key(row, ctx) : row[key];
}
