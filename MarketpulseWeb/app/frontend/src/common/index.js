/**
 * 프론트 공통 진입점 — 화면·위젯은 common 내부 파일이 아니라 여기서 import 한다.
 *
 *   format/   숫자·날짜 표기
 *
 * 공통으로 올리는 기준: 도메인과 무관하고 두 곳 이상에서 쓴다. 한 화면 전용은 그 폴더에 둔다.
 * 상태(store)는 여기 두지 않는다.
 */
export { isNum, fmtPct, fmtCompact, fmtNumber, fmtPrice, toneOf } from './format/number';
export { fmtDate } from './format/date';
