# mp-widgets

위젯 = **API + 뷰**. 컴포넌트를 새로 만들지 않고 스펙만 적으면 `DataWidget` 이 그린다.

```
endpoint → 행 꺼내기(dataPath) → prepare → 실시간 시세 병합(quotes) → transform → 탭 filter → 뷰
```

## 위젯 하나 추가하기

위젯 정의는 **DB 행**이다 — 코드에 스펙을 적지 않는다. 기본 제공 위젯(홈 위젯 등)은
`user_widgets` 계열 테이블의 `user_id` 가 NULL 인 행이고, `GET /api/user-widgets/builtin` 이 돌려준다.
`widget/registry/builtinWidgets.js` 의 `toSpec()` 이 그 행을 아래 **스펙**으로 바꿔 `DataWidget` 에 넘긴다.

| 넣는 곳 (테이블) | 내용 | 스펙에서의 자리 |
|---|---|---|
| `user_widgets` | 이름·제목·뷰 종류·endpoint·출처·transform 이름·시세 키·새로고침·빈 문구·크기 | `title` `view` `api` `source` `quotes.key` `empty` |
| `user_widget_params` + `_param_options` | 헤더 선택지와 그 선택지가 정하는 값 | `controls` |
| `user_widget_fields` | 표 컬럼(셀 종류) 또는 뷰의 자리(SYMBOL·TITLE·VALUE …), 시세로 덮어쓸 필드 | `options.columns` / `options.*` / `quotes.fields` |
| `user_widget_tabs` + `_tab_items` | 탭, 탭의 고정 행(심볼 목록), 탭 필터 이름 | `tabs` |
| `user_widget_options` | 뷰 옵션 (이름 = 값). `extra.이름` 은 보조 요청, `tab.<탭>.이름` 은 그 탭만의 값 | `options` / `api.extra` / `tabs[].view·api·options·controls` |
| `user_widget_screens` | 내놓을 화면(`*` = 전부) + 화면·탭의 기본 배치 위치 | 메뉴 · 기본 그리드 |

1. 행을 넣는다. 새 DB 에 처음 들어갈 값은 `backend/services/builtin_widget_seed.py` 에 추가한다
   (DB 에 그 `widget_id` 가 없을 때만 들어간다 — 이미 있는 행은 건드리지 않으니 DB 행을 고친다.
   위젯을 빼려면 행을 지우지 말고 `use_yn=N`).
2. 코드값은 `backend/services/user_widget_service.CODES` 가 기준이다
   (`SPEC_VIEW` · `SPEC_FIELD_ROLE` · `CELL_TYPE` · `TRANSFORM` · `TAB_FILTER`).
3. 함수(정렬·펼치기·필터)는 행에 담을 수 없다. 새 함수가 필요할 때만 `widget/registry/builtinWidgets.js` 의
   `TRANSFORMS` / `TAB_FILTERS` 에 구현을 추가하고 같은 이름을 코드값에 올린다
   (`tests/test_widget_sources.py` 가 이름이 맞는지 본다).

## 머리줄 공통 컨트롤

모든 위젯의 머리줄은 같은 부품(`HeaderControls.jsx`)으로 그린다 — 위젯마다 따로 만들지 않는다.

| 컨트롤 | 언제 나오나 | 정의하는 법 |
|---|---|---|
| **데이터 소스** | **항상** (모든 위젯 필수) | endpoint 에 `{provider}` 를 넣으면 고를 수 있다. `/data/{provider}/<model>` 은 그 모델을 구현한 provider 목록, 그 밖(`/concepts/…&provider={provider}`, `/stock/ranking/live?…&provider={provider}`)은 응답 `metadata.candidates` (실패 응답의 `candidates` 도 — 실패한 소스에서 다른 소스로 바꿀 수 있게). `{provider}` 가 없으면 실제로 답한 소스를 보여 주기만 한다. 처음 값은 옵션 `provider` (비우면 서버가 고른다) |
| 기준일 칩 | 이름이 `date` · `*_date` 인 컨트롤 | params 행 + endpoint 의 `?date={date}`. 비우면 최신 (빈 값은 요청에서 빠진다) |
| 한 줄 버튼 | 선택지 4개 이하 | params 행 + 선택지 |
| 드롭다운 | 선택지 5개 이상, 또는 옵션 `optionsFrom.<컨트롤>` = `경로|값 필드|이름 필드[|keep]` | 국가처럼 목록을 요청으로 채울 때. `keep` 을 붙이면 정의의 선택지(예: `최근 실행`)를 앞에 남긴다 |
| 옵션 버튼 | 선택지 없는 컨트롤 (직접 입력) | params 행만 — 버튼 안 입력칸, '적용'으로 반영 |

탭마다 보일 컨트롤은 옵션 `tab.<탭>.controls` 로 고른다 (예: 곡선 탭 = `date`, 추이 탭 = `period`). 데이터 소스는 탭과 무관하게 항상 보인다.

### 화면 변수 — 여러 위젯이 같이 따르는 값

종목(`{symbol}`)은 페이지가 내려 준다. 그 밖에 위젯들이 같이 따라야 하는 값(고른 기관 · 고른 백테스트 실행)은
옵션 `shared` = `이름[,이름]` 으로 적는다 — 그 이름의 컨트롤 값이 위젯마다 따로가 아니라 한 곳(`shared.js`)에 놓여,
한 위젯에서 바꾸면 같은 이름을 쓰는 위젯이 모두 따라온다 (새로고침해도 남는다).
표는 옵션 `select` = `이름:행 필드` 로 행 클릭을 그 값에 연결한다 (예: 기관 순위 → `institution:institution_key`).

같은 `widget_id` 가 코드 레지스트리(`widgetEndpoints`)에도 있으면 DB 정의가 이긴다 — 기존 위젯을 이 방식으로 옮길 때 같은 id 로 행을 넣는다.

## 스펙

| 항목 | 설명 |
|---|---|
| `title` / `tabs` | 제목, 또는 탭 `[{ id, label, items?, params?, filter?, view?, api?, options?, controls? }]`. 둘 중 하나는 필수. 탭이 `view`·`api`(endpoint·transform)·`options` 를 적으면 그 탭만 다르게 그린다 (DB: `tab.<탭>.view` · `.endpoint` · `.transform` · 그 밖의 이름은 뷰 옵션). `controls` 는 그 탭 머리줄에 보일 컨트롤 이름 (`none` = 숨김) |
| `source` | 출처 키(`common/widget/sources.js`). 위젯은 출처를 **하나만** 보인다 — `'$provider'` 면 실제로 답한 소스(응답의 `provider`, 고른 소스), 응답에 없으면 정의의 첫 소스. 여러 소스를 '·' 로 잇지 않는다. 실시간은 출처가 아니라 `live` 로 표시. **필수** |
| `sourceNote` | 출처 뒤 덧붙이는 말 — 문자열 또는 `(ctx, meta) => 문자열` (DB 의 `{이름}` 자리는 params · symbol · transform 이 넘긴 meta 로 채운다) |
| `live` | `true` 면 출처 앞에 실시간 점 |
| `api.endpoint` | `/api` 뒤 경로. `{이름}` 자리는 params 로 채운다 (아래) |
| `api.dataPath` | 응답에서 행이 있는 곳. 기본 `'results'`, `'a.b'`, `''`(응답 그대로) |
| `api.refresh` | 자동 갱신 간격(ms) |
| `api.prepare` | `(rows) => rows` — 시세를 붙이기 전에 행의 모양을 바꾼다 (예: 섹터 → 종목 행) |
| `api.transform` | `(rows, ctx) => rows` 또는 `{ rows, meta }` |
| `api.extra` | 보조 요청 `{ 이름: 경로 }` → `ctx.extra.이름` |
| `provider` | 데이터 소스의 처음 값 (endpoint 에 `{provider}` 가 있을 때) |
| `keepProvider` | 컨트롤을 바꿔도 고른 데이터 소스를 유지 (기본은 조건이 바뀌면 자동 선택으로 돌아간다 — 국가처럼 후보가 바뀌는 경우). 후보가 조건과 무관한 위젯(실시간 랭킹의 정렬)에 쓴다 |
| `controls` | 헤더 컨트롤 `[{ name, label, default, kind, options: [{ value, label, params? }], optionsFrom? }]` — `kind`: `seg` `select` `date` `text` |
| `symbol` | `{ default: 'NVDA' }` — 위젯이 종목 하나를 갖는다 (`{symbol}`) |
| `quotes` | 실시간 시세. `{ key: '행의 심볼 필드', fields: { 행필드: 시세필드 } }` · `{ key: '$symbol' }` · `{ symbols: (rows) => [...] }` |
| `view` / `options` | 뷰 이름과 그 뷰의 옵션 |
| `empty` | 행이 없을 때 문구 — 문자열 또는 `(ctx) => 문자열` |

**params** (`{이름}` 에 들어가는 값): `today`(YYYY-MM-DD) · `symbol` · `provider` · 각 control 의 값(이름 그대로) + 고른 선택지의 `params` · 탭의 `params`.

**ctx** (`transform` · `filter` · 함수형 옵션이 받는 값): `{ params, tab, symbol, extra, quotes, response }` — `response` 는 주 요청의 응답 전체(`metadata` 등).

`endpoint` 가 없으면 탭(또는 스펙)의 `items` 가 그대로 행이 된다 (지수 타일처럼 목록이 고정일 때).

## 뷰

| 뷰 | 용도 | 옵션 (자세한 건 각 파일 머리 주석) |
|---|---|---|
| `tiles` | 시세 타일 격자 | `symbol, label, series, columns` |
| `table` | 표 (= `MpGrid`) | `columns[{ type, header, field, width, align, render, digits, sortable, hide }]`, `minWidth`, `rowHeight`, `fixed`(열 폭 고정 + 넘치면 …), `select`(행 클릭 → 화면 변수), 켜는 기능 `sortable` `searchable` `exportable` `columnPicker` `pageSize` `expand(row)` `onRowClick` — type: `rank stock price change percent compact number date trend tag text muted value value_muted money pct pill bar badge entity link` |
| `candles` | 한 종목 캔들 + 거래량 | `headline`, `ma`(이동평균선 봉 수) — 등락률 기준은 `meta.prevClose` |
| `treemap` | 넓이 = 크기, 색 = 등락률 | `value, label, change, group, link, heatMax` |
| `list` | 시각 · 제목 · 꼬리표/값 | `time, title, sub, href, tag, tagSymbol, value, valueMuted, dot, rowHeight` |
| `lines` | 선 차트. 계열이 여럿이면 칩으로 최대 `max` 개 비교 | `x, series('필드:이름,…'), pick, max, labels, unit, digits` |
| `donut` | 비중 도넛 + 범례 목록 (가운데 둘째 줄 = `meta.center`) | `value, label, change, detail, centerLabel, labelHeader, changeHeader, detailHeader` |
| `gauge` | 0~100 반원 게이지 하나 | `value, label, zones('끝값:이름,…')` |
| `kv` | 이름 · 값 목록 (박스 없음) | `label, value, columns` |
| `stats` | 요약 줄 — 머리줄 없는 한 줄 패널 | `label, value, note, change`(값 뒤 등락 — 색은 행의 `tone` 부호) |
| `bars` | 이름 · 값 + 얇은 가로 막대 목록 (막대 = 가장 큰 값 대비) | `label, value, sub, format(compact·number·pct), prefix, digits, rowHeight` |
| `columns` | 세로 막대 + 위에 값 · 아래 이름 (좁으면 건너뛰며 표시) | `label, value, prefix, digits, suffix, tone`(부호로 색 — 분기 수익률) |
| `kpis` | 성과 요약 줄 — 이름 / 큰 값 / 비교 값, 머리줄 없는 한 줄 패널 (`lead: true` 행 = 로고 + 이름) | `label, value, sub, tone` |
| `curve` | 주인공 선(강조색 + 옅은 면) + 회색 비교 선, 위에 범례 · 아래 낙폭 창 | `x, series(첫 계열이 주인공), drawdown, excess, refs, unit, digits, signed` |
| `heatmap` | 줄 × 칸 색 격자 + 줄 합계 (연 × 월 수익률) | `row, col, value, cols, rowSuffix, total(compound·sum·none), totalHeader, max, digits` |
| `articles` | 기사 목록 — 발행처 · 시각 · 감성 / 제목 / 요약 / 관련 종목 | `source, time, title, summary, href, tags, sentiment, sentiments, tones` |
| `strip` | 시간 순 상태 띠 + 지금 상태 (달마다의 시장 국면) | `x, state, states('값:이름,…'), value, valueLabel` |
| `line` `area` `bar` `stackedBar` `scatter` | 범용 x/y 차트 — 응답 모양을 모르는 위젯용 (끌어서 확대 · 더블클릭 되돌리기) | `x, series([{ field, label, color }] 또는 '필드:이름,…'), refs([{ y, label }]), marks([{ x, label }]), unit, digits` |
| `plotly` | 서버가 준 Plotly 그림 그대로 (색만 테마로) | `figure({ data, layout })` |
| `cards` | 이름 / 큰 값 상자 격자 — 계산 결과 몇 개 (참/거짓은 Yes/No + 색) | `label, value, hint, tone, min`(카드 최소 폭) |

`lines` 는 계열을 골라 가며 비교할 때, `curve` 는 '내 것 대 기준' 한 쌍을 볼 때 쓴다. `stats` 는 한 줄짜리 요약, `kpis` 는 값이 주인공인 요약이다.

표 · 목록 · 카드가 같이 쓰는 작은 표시는 `views/parts.jsx` 에 있다 — 새로 만들지 말고 가져다 쓴다:
`Pill`(색 꼬리표 — 등락 · 매수/매도 · 감성) · `MiniBar`(값 옆 얇은 막대) · `LineSwatch`(범례 선 조각) · `Switch`(켜고 끄기) · `StockLogo` · `TrendLine`.

### 표만 쓰기 — `MpGrid`

DataWidget 없이 내가 가진 행을 같은 표로 그린다. 앱의 표는 이것 하나다 (예전 `CommonTable` 은 합쳐 없앴다).

```jsx
import { MpGrid } from '../widget/engine';

<MpGrid rows={rows} options={{ columns, sortable: true }} />          // 바로 그리기

const HoldingsGrid = MpGrid.init({ columns, sortable: true, searchable: true, pageSize: 20 });
<HoldingsGrid rows={rows} />                                          // 미리 설정해 두고 쓰기 (options 를 또 주면 그 값이 이긴다)
```

입력칸이 든 편집 표(설정 화면)도 MpGrid 다 — `rowKey` · `rowHeight: 0`(높이 자동) · `scroll: false`(칸 안 Select 가 잘리지 않게) ·
`render(row, ctx, index)` · `rowClassName` · `expanded(row)`(펼침을 밖에서 정함) · `footer`(추가 줄). 손으로 `<table>` 을 짜지 않는다.

### 차트만 쓰기 — `MpChart`

차트 뷰들은 `MpChart` 의 종류표(`MpChart.jsx` 의 `CHART_VIEWS`)에 모여 있다. DataWidget 의 view 이름도 이 표에서 찾는다 —
DB 위젯과 화면이 같은 차트를 그린다. `options.type` 으로 고르고(`candle` → `candles`, `pie` → `donut` 도 된다), Plotly 는 몰라도 된다.

```jsx
import { MpChart } from '../widget/engine';

<MpChart rows={rows} options={{ type: 'line', x: 'date', series: 'close:종가' }} />

const PriceChart = MpChart.init({ type: 'area', x: 'date' });
<PriceChart rows={rows} options={{ series: [{ field: 'close', label: '종가' }] }} />
```

### 숫자 요약 · 목록 — `MpKpi` · `MpList`

같은 틀(`family.jsx` 의 `createFamily`)이다 — `options.type` 으로 고르고 `.init({...})` 로 미리 설정한다.

| 부품 | type |
|---|---|
| `MpKpi` | `kpis`(기본) · `stats` · `cards` · `tiles` |
| `MpList` | `list`(기본) · `articles` · `kv` |

```jsx
import { MpKpi, MpList } from '../widget/engine';

<MpKpi rows={[{ label: 'NPV', value: '1,234' }]} options={{ type: 'cards' }} />
<MpList rows={news} options={{ type: 'list', time: 'time', title: 'title', href: 'url' }} />
```

DataWidget 의 view 는 `table`(MpGrid) · MpChart · MpKpi · MpList 의 종류표 + `strip` 이다. 새 뷰는 맞는 부품의 종류표에 넣는다.

스펙 하나로 안 되는 화면(그리기 도구가 있는 차트 — `widget/widgets/chartstudio/`)은 같은 조각과 `Plot`(`config` · `onRelayout` 으로 그리기 도구)을 가져다 쓴다.

뷰 옵션의 필드 자리에는 필드 이름이나 `(row, ctx) => 값` 을 쓸 수 있다.

### 새 뷰 붙이기

```js
import { registerView, Plot } from '../widget/engine';

function BarsView({ rows, options }) {
  return <Plot figure={(c) => ({ data: [{ type: 'bar', x: rows.map((r) => r[options.x]), y: rows.map((r) => r[options.y]), marker: { color: c.up } }], layout: {} })} />;
}
registerView('bars', BarsView);
```

뷰는 `{ rows, meta, quotes, ctx, symbol, setSymbol, setParam, options, state }` 를 받는다 (`setParam(이름, 값)` = 컨트롤 · 화면 변수 바꾸기).
`View.ownsState = true` 로 두면 로딩·오류·빈 화면(`state`)도 뷰가 직접 그린다.
`View.bare = true` 로 두면 머리줄 없이 `[⠿] 본문 … 출처 ✕` 한 줄 패널이 된다 (`stats`).

## 구조

| 파일 | 역할 |
|---|---|
| `DataWidget.jsx` | 스펙 → 화면. `defineWidget`, `registerView` |
| `MpGrid.jsx` | 앱의 유일한 표 (view `table`) |
| `MpChart.jsx` | 앱의 유일한 차트 — `options.type` → 차트 뷰 (`CHART_VIEWS`) |
| `MpKpi.jsx` · `MpList.jsx` | 숫자 요약 (`KPI_VIEWS`) · 목록 (`LIST_VIEWS`) |
| `family.jsx` | 위 세 부품의 공통 틀 — `createFamily(name, views, { defaultType, aliases })` |
| `data.js` | `fill` `pick` `useApi` `useSeries` `useExtra` `normalizeBars` `lastSession` |
| `format.js` | `fmtPct` `fmtPrice` `fmtCompact` `fmtNumber` `toneOf` `read` |
| `Plot.jsx` | Plotly 래퍼 — `figure(colors)`. 테마가 바뀌면 다시 그린다 |
| `views/` | 뷰 (MpChart · MpKpi · MpList 를 거쳐 쓴다) + 공용 조각(`parts.jsx`) |
| `shared.js` | 화면 변수 — 여러 위젯이 같이 따르는 값 (`useShared` · `setShared`) |
| `adapter.js` | 앱에 기대는 것 전부 (요청·시세 소켓·테마·카드·상태 화면·라우팅). 다른 파일은 앱 코드를 직접 import 하지 않는다 |

색은 `index.css` 의 `--mp-*`(카드) · `--mpc-*`(차트) 변수만 쓴다. 다크/라이트와 등락 색 관례(`html[data-updown="us"]`)가 변수에서 바뀐다.
