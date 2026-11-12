# mp-widgets

위젯 = **API + 뷰**. 컴포넌트를 새로 만들지 않고 스펙만 적으면 `DataWidget` 이 그린다.

```
endpoint → 행 꺼내기(dataPath) → 실시간 시세 병합(quotes) → transform → 탭 filter → 뷰
```

## 위젯 하나 추가하기

1. 스펙을 적는다 — `registry/homeWidgets.js` (화면별로 파일을 나눠도 된다)

```js
import { defineWidget } from '../mp-widgets';

export const topGainers = defineWidget({
  title: '급상승',
  source: 'yahoo',                                   // 필수 — 헤더 오른쪽에 출처로 표시
  api: { endpoint: '/stock/ranking/live?sort_by=gainers&limit=10' },
  view: 'table',
  options: {
    columns: [
      { type: 'rank',   header: '순위', width: 56 },
      { type: 'stock',  header: '종목', symbol: 'stk_cd', name: 'stk_nm' },
      { type: 'change', header: '등락률', field: 'change_rate' },
    ],
  },
});
```

2. 등록한다 — `registry/widgetEndpoints.js` 에 `'top-gainers': { title: 'Top Gainers', spec: home.topGainers }`
3. 크기는 `registry/widgetSizes.js`, 화면 배치·카탈로그는 `registry/urlWidgetMap.js`

## 스펙

| 항목 | 설명 |
|---|---|
| `title` / `tabs` | 제목, 또는 탭 `[{ id, label, items?, params?, filter? }]`. 둘 중 하나는 필수 |
| `source` | 출처 키(`ui/sources.js`) 또는 배열. `'$provider'` 는 응답의 `provider` 값으로 바뀐다. **필수** |
| `sourceNote` | 출처 뒤 덧붙이는 말 — 문자열 또는 `(ctx) => 문자열` |
| `live` | `true` 면 출처 앞에 실시간 점 |
| `api.endpoint` | `/api` 뒤 경로. `{이름}` 자리는 params 로 채운다 (아래) |
| `api.dataPath` | 응답에서 행이 있는 곳. 기본 `'results'`, `'a.b'`, `''`(응답 그대로) |
| `api.refresh` | 자동 갱신 간격(ms) |
| `api.transform` | `(rows, ctx) => rows` 또는 `{ rows, meta }` |
| `api.extra` | 보조 요청 `{ 이름: 경로 }` → `ctx.extra.이름` |
| `controls` | 헤더 버튼 `[{ name, label, default, options: [{ value, label, params? }] }]` |
| `symbol` | `{ default: 'NVDA' }` — 위젯이 종목 하나를 갖는다 (`{symbol}`) |
| `quotes` | 실시간 시세. `{ key: '행의 심볼 필드', fields: { 행필드: 시세필드 } }` · `{ key: '$symbol' }` · `{ symbols: (rows) => [...] }` |
| `view` / `options` | 뷰 이름과 그 뷰의 옵션 |
| `empty` | 행이 없을 때 문구 — 문자열 또는 `(ctx) => 문자열` |

**params** (`{이름}` 에 들어가는 값): `today`(YYYY-MM-DD) · `symbol` · 각 control 의 값(이름 그대로) + 고른 선택지의 `params` · 탭의 `params`.

**ctx** (`transform` · `filter` · 함수형 옵션이 받는 값): `{ params, tab, symbol, extra, quotes }`.

`endpoint` 가 없으면 탭(또는 스펙)의 `items` 가 그대로 행이 된다 (지수 타일처럼 목록이 고정일 때).

## 뷰

| 뷰 | 용도 | 옵션 (자세한 건 각 파일 머리 주석) |
|---|---|---|
| `tiles` | 시세 타일 격자 | `symbol, label, series, columns` |
| `table` | 표 | `columns[{ type, header, field, width, align, render }]`, `minWidth` — type: `rank stock price change compact number trend tag text` |
| `candles` | 한 종목 캔들 + 거래량 | `headline` — 등락률 기준은 `meta.prevClose` |
| `treemap` | 넓이 = 크기, 색 = 등락률 | `value, label, change, group, link, heatMax` |
| `list` | 시각 · 제목 · 꼬리표/값 | `time, title, sub, href, tag, tagSymbol, value, valueMuted, dot, rowHeight` |

뷰 옵션의 필드 자리에는 필드 이름이나 `(row, ctx) => 값` 을 쓸 수 있다.

### 새 뷰 붙이기

```js
import { registerView, Plot } from '../mp-widgets';

function BarsView({ rows, options }) {
  return <Plot figure={(c) => ({ data: [{ type: 'bar', x: rows.map((r) => r[options.x]), y: rows.map((r) => r[options.y]), marker: { color: c.up } }], layout: {} })} />;
}
registerView('bars', BarsView);
```

뷰는 `{ rows, meta, quotes, ctx, symbol, setSymbol, options, state }` 를 받는다.
`View.ownsState = true` 로 두면 로딩·오류·빈 화면(`state`)도 뷰가 직접 그린다.

## 구조

| 파일 | 역할 |
|---|---|
| `DataWidget.jsx` | 스펙 → 화면. `defineWidget`, `registerView` |
| `data.js` | `fill` `pick` `useApi` `useSeries` `useExtra` `normalizeBars` `lastSession` |
| `format.js` | `fmtPct` `fmtPrice` `fmtCompact` `fmtNumber` `toneOf` `read` |
| `Plot.jsx` | Plotly 래퍼 — `figure(colors)`. 테마가 바뀌면 다시 그린다 |
| `views/` | 뷰 5종 + 공용 조각(`parts.jsx`) |
| `adapter.js` | 앱에 기대는 것 전부 (요청·시세 소켓·테마·카드·상태 화면·라우팅). 다른 파일은 앱 코드를 직접 import 하지 않는다 |

색은 `index.css` 의 `--mp-*`(카드) · `--mpc-*`(차트) 변수만 쓴다. 다크/라이트와 등락 색 관례(`html[data-updown="us"]`)가 변수에서 바뀐다.
