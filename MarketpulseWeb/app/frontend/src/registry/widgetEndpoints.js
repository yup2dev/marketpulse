/**
 * widgetEndpoints — single source of truth for every widget type.
 *
 * Entry shape:
 *   {
 *     title:       string,
 *     endpoint:    '/path/{symbol}'        // {placeholder} → from params or outer state
 *     dataPath?:   'result' | 'a.b.c'       // dotted path to unwrap response → rows / object
 *     display?:    'kv'                     // flat object → metric/value 2-col table
 *     category?:   'dividends'              // 전용 라우트의 QueryExecutor model 키.
 *                                           //   이 값이 있으면 UniversalWidget이 헤더에
 *                                           //   provider 셀렉터를 띄우고 ?provider= 를 주입한다.
 *                                           //   (해당 category 지원 provider가 2개 이상일 때만 노출)
 *     provider?:   'yahoo'                  // 초기 provider(전용 라우트 기본값과 동일하게 유지)
 *     params?:     [{                       // inline form; values feed {placeholder} + querystring
 *       name, label?, kind: 'text'|'number'|'date'|'select',
 *       default, options?, step?, hint?, upper?,
 *       pin?, chip?,                         //   헤더 버튼에 현재 값을 칩으로 — chip(v) 로 표기를 바꿀 수 있다 (예: v => `${v}D`)
 *       showIf?,                             //   { metric: 'quantile' } — 조건이 맞을 때만 입력칸·요청에 포함
 *     }]                                     //   name 'symbol' 은 폼이 아니라 헤더 심볼 칩으로 올라간다
 *     titleFrom?:  'institution_key'         // 그 param 의 현재 값 라벨을 제목 뒤에 붙인다
 *     kv?:         { primary, hide, labels } // display:'kv' — primary 는 큰 타일, hide 는 숨김
 *     columns?:    { hide, order, labels }   // 자동 컬럼 손질 (내부 키 숨기기 등)
 *     source?:     'user' | ['user','yahoo'] // 출처 고정값 — 응답에 provider 가 없을 때만 (기본은 응답 provider)
 *     sourceNote?: 'from SEC 13F filings'    // 원천·가공 설명. 출처는 모든 위젯 하단에 붙는다
 *     period?:     { default, preset }       // endpoint 에 {period} 가 있으면 헤더 기간 셀렉터의
 *                                           //   기본값·선택지(periods.js 프리셋). 없으면 1Y·macro
 *
 * 기간·기준일 고르는 기준 (OpenBB 표준 파라미터를 따른다):
 *   - 결과 행에 날짜가 있으면(재무제표·실적·배당·공시·거래 내역·뉴스·분기 수익률 …) 반드시 기간을 둔다
 *     → 기간(start_date~end_date). 헤더 기간 셀렉터({period}) 또는 Start/End date param.
 *       '최근 N건·N분기' 같은 개수 파라미터로 대신하지 않는다
 *   - 한 시점 스냅샷(수익률 곡선·지표 대시보드·최신값 목록) → 기준일 date param (asOfParam, 비우면 최신)
 *   - 날짜가 없는 결과(실시간 시세·프로필·정성 분석 SWOT 등) → 둘 다 두지 않는다
 *
 * UI 라벨(title·label·hint)은 영어로 쓴다.
 *     expandable?: { keyField, endpoint, dataPath? }
 *     component?:  Component                // escape hatch — only for portfolio widgets that need
 *                                           //   non-API state (e.g. portfolioData)
 *     propsFrom?:  ['symbol'|'portfolioId']  // which extra props to inject into custom component
 *   }
 *
 * Add a new widget: add an entry here, reference id in urlWidgetMap.js.
 */
//
// 리디자인 화면의 위젯은 대부분 DB 행(registry/builtinWidgets)이라 여기에 없다. 남은 것은 컴포넌트가 따로 있는
// 위젯뿐이다. 시안에 없는 레거시 위젯 정의는 git 이력의 이 파일에 있다 (리디자인 레거시 정리 이전).
import ChartStudioWidget from '../components/widgets/chartstudio/ChartStudioWidget';

export const WIDGET_ENDPOINTS = {
  // 리디자인 차트 — 비교 · 지표 · 매크로 겹침 · 이벤트 · 분할 · 그리기 (Chart.dc.html)
  'chart-studio': {
    title:     'Chart',
    component: ChartStudioWidget,
    propsFrom: ['symbol'],
  },
};
