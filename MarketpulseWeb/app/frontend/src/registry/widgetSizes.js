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

export const WIDGET_SIZES = {
  // ── Institutional / research ──
  'institutional-portfolios': S('tableWide', { h: 10, minW: 8, minH: 6 }),   // 기관 선택 FilterBar + 섹션 탭 + 표
  'fund-performance':         S('tableWide', { h: 7 }),
  'holder-breakdown':         S('tableWide', { h: 7 }),
  'research-reports':         S('list', { w: 8, h: 10, minW: 6, minH: 6 }),  // 목록 + PDF 미리보기

  // ── Stock (자동 표) ──
  'financials':               S('tableWide', { h: 9 }),
  'dividend':                 S('table', { h: 6 }),
  'stock-splits':             S('table', { h: 5 }),
  'company-filings':          S('tableWide', { h: 6 }),
  'earnings':                 S('table', { h: 6 }),
  'earnings-history':         S('table', { w: 8, h: 6 }),
  'insider':                  S('table'),
  'ownership-overview':       S('tableWide', { h: 6 }),
  'ownership-institutional':  S('table'),
  'ownership-insider':        S('table'),
  'management':               S('table'),
  'swot':                     S('table', { h: 8 }),
  'economic-moat':            S('table'),
  'investment-scorecard':     S('table', { h: 9 }),
  'stock-sentiment':          S('table', { h: 7 }),
  'social-sentiment':         S('table', { h: 8 }),

  // ── Macro: 지표 개념 (국가 칩 + 기간 + 보기 + provider) ──
  'concept-cpi':              S('chart', { h: 7, minW: 5 }),
  'concept-unemployment':     S('chart', { h: 7, minW: 5 }),
  'concept-policy-rate':      S('chart', { h: 7, minW: 5 }),
  'concept-long-rate':        S('chart', { h: 7, minW: 5 }),
  'concept-gdp-growth':       S('chart', { h: 7, minW: 5 }),

  // ── Macro: FRED ──
  'gdp-forecast':             S('chart'),
  'inflation-momentum':       S('chart'),
  'initial-claims':           S('chart'),
  'jobs-breakdown':           S('chart'),
  'yield-curve-snapshot':     S('chart'),
  'yield-trends':             S('chart'),
  'real-rates':               S('chart'),
  'fed-balance-sheet':        S('chart'),
  'inflation-decomp':         S('chart', { h: 7 }),
  'inflation-trends':         S('chart', { h: 7 }),
  'labor-market-dashboard':   S('chartWide', { w: 12, h: 7 }),
  'pmi':                      S('chartWide'),
  'fin-conditions-tab':       S('chart', { h: 7 }),
  'sentiment-tab':            S('chart', { h: 7 }),
  'commodities-tab':          S('chart', { h: 7 }),

  // ── Quant ──
  'option-pricing':           S('kv', { w: 6, h: 7, minW: 4 }),   // 그릭스 6타일이 한 줄에 들어가는 폭
  'quant-summary':            S('kv'),
  'quant-capm':               S('kv'),
  'quant-adf':                S('kv'),
  'quant-normality':          S('table', { h: 5, minH: 4 }),
  'quant-rolling':            S('chartWide'),

  // ── Market / screening ──
  'market-ranking':           S('list', { w: 6, h: 10, minW: 5, minH: 6 }),   // 시장·정렬·기간 FilterBar 한 줄
  'screener':                 S('tableWide', { h: 10, minW: 8, minH: 7 }),   // 왼쪽 프리셋 + 결과 표
  'watchlist':                S('list'),
  'alerts':                   S('list'),
  'news-feed':                S('list'),
  'heatmap':                  S('chart', { w: 8, h: 8, minW: 5, minH: 6 }),

  // ── TradingView 임베드 ──
  'tv-index-charts':          S('strip'),
  'tv-market-ranking':        S('list', { w: 5, h: 10, minW: 4, minH: 7 }),
  'tv-mini-chart':            S('chart', { w: 4, h: 5, minW: 3, minH: 4 }),

  // ── Visualization ──
  'sparkline':                S('strip', { h: 3, minW: 4 }),   // 헤더(시장 필터) + 카드 72px
  'advanced-chart':           S('chartWide', { h: 10, minW: 6, minH: 6 }),
  'comparison':               S('chartWide', { h: 8, minH: 6 }),
  'correlation':              S('chart', { h: 8, minW: 4, minH: 6 }),
  'backtest-lab':             S('panel', { w: 12, h: 12, minW: 8, minH: 8 }),

  // ── Backtest Lab ──
  'bt-variables':             S('panel'),
  'bt-variable-explorer':     S('panel'),
  'bt-events':                S('panel'),
  'bt-event-study':           S('panel'),
  'bt-strategy':              S('panel', { h: 11 }),
  'bt-results':               S('panel', { h: 11 }),

  // ── Calendar / notes ──
  'economic-calendar':        S('list', { minW: 4 }),   // 날짜·중요도·US only FilterBar
  'earnings-calendar':        S('list', { minW: 4 }),
  'notes':                    S('list', { w: 4, h: 6, minW: 3, minH: 4 }),

  // ── Portfolio ──
  'portfolio-stats':          S('list', { w: 5, h: 6, minW: 4, minH: 5 }),   // 지표 카드 세로 목록
  'portfolio-chart':          S('chartWide'),
  'portfolio-holdings':       S('tableWide', { h: 7 }),
  'portfolio-balances':       S('table', { h: 6 }),
  'portfolio-positions':      S('tableWide', { h: 7 }),
  'portfolio-trade-history':  S('tableWide', { h: 7 }),
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
