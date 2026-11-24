/**
 * urlWidgetMap — per-URL widget configuration.
 *
 * 리디자인 시안(캔버스 https://claude.ai/artifact/DFm1eYtd4yVjoiwX4Ejmrd)에 있는 화면만 둔다.
 * 시안에 없는 레거시 화면·탭·위젯은 앱에서 뺐다 — 되살릴 때는 git 이력에서 가져온다 (리디자인 레거시 정리 커밋의 부모).
 *
 * Each entry maps a URL pathname to:
 *   label           — page title shown in header
 *   needsSymbol     — show stock symbol selector
 *   needsPortfolio  — show portfolio selector + actions
 *   categories      — tabs mapped to ?tab= URL param (헤더 메뉴의 하위 메뉴도 이 목록으로 생성)
 *     ├ id            — used as ?tab= value
 *     ├ label         — tab display label
 *     ├ defaultWidgets — 코드의 기본 배치. 비워 두면 DB(기본 제공 위젯의 화면 등록)의 배치만 쓴다
 *     └ widgets       — 코드 위젯 카탈로그 (DB 위젯은 widget/registry/builtinWidgets 가 메뉴에 붙인다)
 */

// 위젯이 전부 DB 행인 탭 — 배치·카탈로그 모두 DB 에서 온다
const dbTab = (id, label) => ({ id, label, defaultWidgets: [], widgets: [] });

export const URL_WIDGET_MAP = {

  // ─── 홈 (Main.dc.html) ───────────────────────────────────────────────────
  '/': {
    label: 'Dashboard',
    needsSymbol: true,
    needsPortfolio: false,
    categories: [dbTab('overview', 'Overview')],
  },

  // ─── 종목 (StockDetail · Chart · StockNews · Institution) ────────────────
  '/stock': {
    label: 'Stock Analysis',
    needsSymbol: true,
    needsPortfolio: false,
    categories: [
      dbTab('overview', 'Overview'),
      {
        id: 'chart',
        label: 'Chart',
        // 리디자인 차트 화면 (Chart.dc.html) — 한 위젯이 화면을 채운다
        defaultWidgets: [
          { id: 'chart-studio-1', type: 'chart-studio', x: 0, y: 0, w: 12, h: 12 },
        ],
        widgets: [
          { id: 'chart-studio', name: 'Chart', description: 'Compare, indicators, macro overlay, events, split view, drawing' },
        ],
      },
      dbTab('news', 'News & Filings'),
      dbTab('institutional', 'Institutional Holdings'),
    ],
  },

  // ─── 매크로 (MacroDetail) ────────────────────────────────────────────────
  '/macro': {
    label: 'Macro',
    needsSymbol: false,
    needsPortfolio: false,
    categories: [
      dbTab('overview', 'Overview'),
      // provider 무관 지표 — 국가를 고르면 '내 키' 기준으로 FRED/ECOS/OECD 중 자동 선택
      dbTab('global', 'Global Indicators'),
    ],
  },

  // ─── 산업 (Industry) — 산업 → 데이터셋 → 차트 · 요약 · 최근 12개월 · 관련 기업 ─────────
  // 위젯 · 배치 · 위젯 사이 파라미터 그룹(industry · dataset · series)은 모두 DB 행 (builtin_widget_seed)
  '/industry': {
    label: 'Industry',
    needsSymbol: false,
    needsPortfolio: false,
    categories: [dbTab('overview', 'Overview')],
  },

  // ─── 퀀트 (QuantMain · QuantStrategy · QuantPortfolio) ─────────────────────
  '/quantlib': {
    label: 'QuantLib',
    // 종목이 아니라 유니버스 단위 — 종목 선택 대신 머리줄에 워크플로 줄 (widget/widgets/quant/QuantWorkflow).
    // 머리줄의 전략(화면 변수 strategy)은 /backtest 와 같은 변수다
    needsSymbol: false,
    needsQuantWorkflow: true,
    needsPortfolio: false,
    categories: [
      // 대시보드 — 고른 전략 기준의 팩터 · 성과 · ML 모델 · 이번 달 순위. 위젯은 DB 행, 값은 로컬 배치가 적재
      dbTab('factors', 'Dashboard'),
      // 전략 = 종목 점수 규칙만 (팩터 가중치 · ML 모델)
      {
        id: 'strategy',
        label: 'Strategy',
        defaultWidgets: [{ id: 'quant-strategy-settings-1', type: 'quant-strategy-settings', x: 0, y: 0, w: 12, h: 14 }],
        widgets: [{ id: 'quant-strategy-settings', name: 'Strategy Settings', description: 'Build scoring rules from factor weights or an ML model' }],
      },
      // 포트폴리오 = 유니버스 안에서 직접 고른 종목 · 비중 · 리밸런싱 (전략과 무관)
      {
        id: 'portfolio',
        label: 'Portfolio',
        defaultWidgets: [{ id: 'quant-portfolio-settings-1', type: 'quant-portfolio-settings', x: 0, y: 0, w: 12, h: 14 }],
        widgets: [{ id: 'quant-portfolio-settings', name: 'Portfolio Settings', description: 'Pick stocks within a universe, set weights and rebalancing' }],
      },
    ],
  },

  // ─── 백테스트 (Backtest.dc.html) ─────────────────────────────────────────
  '/backtest': {
    label: 'Backtest',
    // 포트폴리오 전략이라 종목 선택 대신 머리줄 왼쪽에 전략 드롭다운 (widget/widgets/backtest/StrategyPicker)
    needsSymbol: false,
    needsStrategy: true,
    needsPortfolio: false,
    // 결과 위젯(bt-run-* · bt-compare)의 배치는 DB 에 있다. 전략 고르기 · 만들기 · 고치기는 머리줄(StrategyPicker)
    categories: [dbTab('results', 'Results')],
  },

  // ─── 운영 (관리자만) — 서버 부하 · 메모리 · 요청 성능. 위젯은 DB 행(ops-*), 값은 /api/admin/monitor/* ──
  '/admin': {
    label: 'Admin',
    adminOnly: true,
    needsSymbol: false,
    needsPortfolio: false,
    categories: [dbTab('monitor', 'Monitoring')],
  },
};

/**
 * getGlobalWidgetCategories — 전 페이지의 완성 위젯 카탈로그를 페이지 단위 카테고리로 집계.
 *
 * WidgetMenu에 현재 pane 카테고리 외에 다른 페이지의 완성 위젯
 * (chart-studio 등)도 노출하기 위해 사용.
 * 같은 위젯 id가 여러 페이지에 있으면 첫 등장만 유지(정의 순서 기준).
 *
 *   excludeIds       — 이미 메뉴에 있는 위젯 id (현재 pane 카테고리)
 *   includePortfolio — portfolioId가 필요한 페이지(needsPortfolio) 포함 여부.
 *                      포트폴리오 컨텍스트가 없는 페이지에서는 렌더링이 깨지므로 기본 제외.
 */
export function getGlobalWidgetCategories({ excludeIds, includePortfolio = false } = {}) {
  const seen = new Set(excludeIds ?? []);
  const result = [];
  for (const [path, page] of Object.entries(URL_WIDGET_MAP)) {
    if (!includePortfolio && page.needsPortfolio) continue;
    const widgets = [];
    for (const cat of page.categories || []) {
      for (const w of cat.widgets || []) {
        if (seen.has(w.id)) continue;
        seen.add(w.id);
        widgets.push(w);
      }
    }
    if (widgets.length) {
      result.push({ id: `page:${path}`, label: page.label, widgets });
    }
  }
  return result;
}

export default URL_WIDGET_MAP;
