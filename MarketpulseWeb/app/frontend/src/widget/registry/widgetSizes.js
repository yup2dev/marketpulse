/**
 * 위젯별 크기 — 단일 기준. 그리드는 12열, 한 행 = 60px + 간격 8px (DashboardGrid).
 *
 *   w, h       위젯을 메뉴에서 추가할 때·기본 배치의 크기
 *   minW, minH 줄일 수 있는 한계 — 헤더 컨트롤·필터 줄·본문이 깨지지 않는 최소
 *
 * 크기는 '그리는 방식'별 프리셋에서 시작해 위젯마다 내용에 맞춰 조정한다.
 * urlWidgetMap 의 카탈로그에는 크기를 적지 않는다 (여기 한 곳).
 */

// 그리는 방식별 기본값
const P = {
  table:      { w: 6,  h: 7,  minW: 4, minH: 4 },   // 자동 컬럼 표 (검색·페이지 바 포함)
  tableWide:  { w: 12, h: 8,  minW: 6, minH: 5 },   // 컬럼이 많은 표
  chart:      { w: 6,  h: 6,  minW: 4, minH: 4 },   // 선·막대 차트 (기간·보기 헤더)
  chartWide:  { w: 8,  h: 6,  minW: 5, minH: 4 },
  kv:         { w: 4,  h: 7,  minW: 3, minH: 5 },   // 결과 타일 + 나머지 표
  list:       { w: 6,  h: 8,  minW: 4, minH: 5 },   // 카드·행 목록 (FilterBar 포함)
  panel:      { w: 6,  h: 10, minW: 5, minH: 7 },   // 폼이 있는 작업 위젯 (Backtest)
  strip:      { w: 12, h: 2,  minW: 6, minH: 2 },   // 한 줄 띠 (지수 타일)
};

const S = (preset, over = {}) => ({ ...P[preset], ...over });

// 시안에 없는 레거시 위젯의 크기는 git 이력의 이 파일에 있다 (리디자인 레거시 정리 이전).
// DB 위젯(기본 제공)의 크기는 DB 행의 size 로 registerWidgetSizes 가 등록한다.
export const WIDGET_SIZES = {
  'chart-studio':             S('panel', { w: 12, h: 12, minW: 8, minH: 8 }),
  'quant-strategy-settings':  S('panel', { w: 12, h: 14, minW: 8, minH: 10 }),
  'quant-portfolio-settings': S('panel', { w: 12, h: 14, minW: 8, minH: 10 }),
};

// 등록되지 않은 위젯(model/*, copilot/* 동적 위젯)
const FALLBACK = S('table', { h: 6 });

// DB 에 정의된 기본 제공 위젯의 크기 — 정의를 불러온 뒤 store 가 등록한다
const DB_SIZES = {};
export function registerWidgetSizes(sizes) {
  Object.assign(DB_SIZES, sizes);
}

/** 위젯 크기. 등록이 없으면 fallback(예: copilot 이 넘긴 크기) → 기본 표 크기 */
export function widgetSize(type, fallback) {
  const s = WIDGET_SIZES[type] || DB_SIZES[type];
  if (s) return s;
  return { ...FALLBACK, ...(fallback || {}) };
}
