---
name: add-widget
description: 대시보드 위젯을 추가/수정할 때 사용. widgetEndpoints.js 단일 소스 등록 → urlWidgetMap.js 화면 배치 → UniversalWidget 자동 렌더(테이블/차트/kv) 흐름과, provider 셀렉터·providerViews 오버라이드·커스텀 컴포넌트 escape hatch·params 폼·expandable 드릴다운 선택 기준을 안내한다. "위젯 추가", "위젯 만들어줘", "이 데이터 대시보드에 띄워줘", "위젯에 provider 셀렉터", "위젯 차트로" 같은 요청에 사용.
---

# 위젯 추가 가이드

위젯은 **`registry/widgetEndpoints.js` 항목 1개**가 기본이다. React 파일은 대부분 불필요 —
`UniversalWidget`이 응답을 보고 자동 렌더한다 (Plotly JSON → 차트, 행 배열 → CommonTable, `display:'kv'` → 지표/값 2열).

핵심 파일 (`app/frontend/src/`):
- `registry/widgetEndpoints.js` — **모든 위젯 타입의 단일 소스** (id → 정의)
- `registry/urlWidgetMap.js` — URL별 화면 구성 (탭·위젯 카탈로그·기본 그리드)
- `registry/providerViews.js` — (model, provider)별 body UI 오버라이드
- `components/core/UniversalWidget.jsx` — 자동 렌더러 (수정할 일 거의 없음)
- `components/core/WidgetRenderer.jsx` — component escape hatch 위임

> 과거의 3-Tier `widgetConfigs.jsx`(UNIVERSAL_WIDGET_CONFIGS)는 **폐기됨** — 참조하지 말 것.

---

## 0. 위젯 유형 결정

| 상황 | 방법 | 코드량 |
|---|---|---|
| API 응답을 표/차트로 | **A. 레지스트리 위젯** — widgetEndpoints 항목 | JS 오브젝트 1개 |
| 게이트웨이 model을 임시로 | **B. 동적 위젯** `data/{provider}/{model}` 타입 | 0줄 (등록 불필요) |
| 특정 provider만 전용 UI | **C. providerViews 오버라이드** | body 컴포넌트 1개 |
| API 외 상태 필요(포트폴리오 등) | **D. component escape hatch** | 컴포넌트 + 항목 |

**A로 안 되는 이유가 명확할 때만 C/D로 간다.**

---

## A. 레지스트리 위젯 (기본)

`widgetEndpoints.js`에 항목 추가:

```js
'<widget-id>': {
  title:    'Dividends',
  endpoint: '/stock/dividends/{symbol}',   // {placeholder} ← params/외부 상태(symbol 등)
  // ── 선택 필드 ──
  dataPath: 'result.points',   // 응답 dot-path unwrap (기본: OBBject results 자동 인식)
  display:  'kv',              // flat object → Metric/Value 2열
  category: 'dividends',       // ← QueryExecutor model 키. 지정 시 provider 셀렉터 자동
  provider: 'yahoo',           // 초기 provider (전용 라우트 기본값과 동일하게)
  params: [                    // 헤더 팝오버 파라미터 폼 (값 → {placeholder} + querystring)
    { name: 'period', kind: 'select', default: '1y', options: ['3mo','1y','5y'] },
    { name: 'start_date', kind: 'date', default: '2020-01-01' },
  ],
  chart: { defaultType: 'bar', allowedTypes: ['bar','line'], yFormatter: 'percent' },
  expandable: { keyField: 'institution_key', endpoint: '/institutions/{institution_key}', dataPath: 'holdings' },
},
```

규칙:
- **endpoint는 두 종류**: 전용 라우트(`/stock/…/{symbol}`) 또는 범용 게이트웨이(`/data/<provider>/<model>?period={period}`). 게이트웨이면 백엔드 코드 0줄.
- **`category`를 지정하면** UniversalWidget이 `/api/providers`에서 그 category 지원 provider를 조회해 2개 이상일 때 헤더 셀렉터를 띄우고 `?provider=`를 주입한다. 기본 provider 자동선택은 ① db ② 키 설정됨 ③ 서버 부하 낮음 순 (`PROVIDER_LOAD`).
- **응답 계약**: 프론트는 항상 OBBject `res.results`로 읽고 **`apiClient`** 사용. 옛 `.data` 참조·생 `fetch()`가 "조용한 빈 위젯"의 단골 원인.

## B. 동적 위젯 — 등록 없이

`data/{provider}/{model}` 형태의 type은 등록 없이 렌더된다 (예: `data/fred/cpi`).
파라미터 폼은 `/api/data/{provider}/{model}/schema`로 자동 생성. 임시 확인·copilot add_widget용 — 정식 위젯은 A로 등록해라.

## C. providerViews — provider별 body 오버라이드

같은 model인데 특정 provider만 전용 UI가 필요할 때 (`registry/providerViews.js`):

```js
export const PROVIDER_VIEWS = {
  financials: { fmp: FmpFinancialsView },   // model(category) → { providerId: BodyComponent }
};
```
- 컴포넌트는 **body만** 렌더. props 계약: `{ response, rows, provider, symbol, period, loading, error }` — header(타이틀/셀렉터/refresh)는 UniversalWidget 소유.
- 오버라이드 활성 시 기본 table/chart 토글은 숨겨진다.

## D. component escape hatch — 완전 커스텀

API fetch 이외의 상태(portfolioData 등)가 필요할 때만:

```js
'institutional-portfolios': {
  title:     'Institutional Portfolios',
  component: InstitutionalPortfoliosWidget,
  propsFrom: ['symbol'],        // 'symbol' | 'portfolioId' 주입
},
```
컴포넌트는 `components/widgets/`에. 차트는 `PlotlyChart`/`CommonChart`, 표는 `CommonTable` 재사용 (recharts 신규 사용 금지).

---

## 2. 화면 배치 (`urlWidgetMap.js`)

해당 URL 항목의 category 안에 등록:

```js
widgets: [   // WidgetMenu 카탈로그 (사용자가 + 로 추가)
  { id: '<widget-id>', name: '표시명', description: '설명', defaultSize: { w: 6, h: 6 } },
],
defaultWidgets: [   // 저장된 워크스페이스 없을 때 초기 그리드
  { id: 'w9', type: '<widget-id>', x: 0, y: 0, w: 6, h: 6 },
],
```

**defaultWidgets 제약**: 랜딩이 키 없이도 채워져야 한다 —
- API 키 필요 provider(fred/polygon 등) 지양
- **로컬 Fetcher(exe) 필수 provider(yahoo/whalewisdom) 지양** — 배포 환경에서 Fetcher 미실행 사용자는 빈 위젯을 본다. SEC 게이트웨이 위젯(financials-sec 등)이 안전한 대안.

---

## 3. 함정 체크

- **빈 위젯**: ① `res.results` 대신 `.data`를 읽고 있음 ② 생 fetch()로 인증 헤더 누락 ③ dataPath 오타 ④ provider가 로컬 Fetcher 필수인데 미실행. 네트워크 탭에서 응답 shape부터 확인.
- **라이트 테마 안 바뀜**: 색상은 `index.css`의 `html.light .<class> !important` 중앙 오버라이드 목록 기반 — 전환 안 되는 클래스는 그 목록에 추가.
- **입력 필드명**: 같은 category의 provider끼리 QueryParams 키가 다르면 셀렉터 전환이 깨진다 (백엔드 add-fetcher 스킬 참조).
- **id 충돌**: widget-id는 WIDGET_ENDPOINTS 전역 유일. urlWidgetMap의 `type`이 이 id를 참조한다.

## 4. 검증

```bash
cd app/frontend && npm run build        # 빌드 통과
# 화면에서: WidgetMenu에 노출 → 추가 → 데이터 렌더 → (category 지정 시) provider 전환
# 라이트/다크 토글 양쪽 확인
```

## 체크리스트
- [ ] 유형 결정 (A 기본 / B 임시 / C provider 전용 / D 커스텀)
- [ ] widgetEndpoints.js 항목 (category+provider는 셀렉터 필요 시)
- [ ] urlWidgetMap.js widgets(+필요 시 defaultWidgets — 무키·무Fetcher 제약)
- [ ] apiClient + res.results 계약 준수
- [ ] npm run build + 라이트/다크 확인
