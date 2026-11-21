/**
 * MpChart — 앱의 차트는 이것 하나다. options.type 으로 종류를 고르고, 그리기(Plotly·SVG)는 안에서 한다.
 * 화면 개발자는 옵션만 알면 된다 — Plotly 를 직접 쓰지 않는다.
 *
 *   바로 그리기       <MpChart rows={rows} options={{ type: 'line', x: 'date', series: 'close:종가' }} />
 *   미리 설정해 두기  const PriceChart = MpChart.init({ type: 'area', x: 'date' });
 *                     <PriceChart rows={rows} options={{ series }} />   (options 를 또 주면 그 값이 이긴다)
 *
 * type        그리는 것                                             옵션 (자세한 것은 views/<이름>View.jsx 머리말)
 *   line · area · bar · stackedBar · scatter
 *               범용 x/y 차트 — 응답 모양을 모르는 위젯               x · series · refs · marks · unit · digits
 *   lines       계열을 칩으로 골라 비교하는 선 (금리 만기 등)          x · series · pick · max · labels · unit
 *   curve       주인공 선 + 비교 선 (+ 낙폭 창) — 누적 수익           x · series · drawdown · excess · refs
 *   candles     한 종목 캔들 + 거래량  (candle 도 된다)               headline · ma
 *   columns     세로 막대 + 위 값 · 아래 이름 (분기 배당)             label · value · tone
 *   bars        이름 · 값 + 가로 막대 목록 (기관 보유)                 label · value · sub · format
 *   donut       비중 도넛 + 범례  (pie 도 된다)                       value · label · change · detail
 *   heatmap     줄 × 칸 격자 (연 × 월 수익률)                         row · col · value · cols · total
 *   treemap     넓이 = 크기, 색 = 등락률                              value · label · change · group · link
 *   gauge       0~100 반원 게이지                                     value · label · zones
 *   plotly      서버가 준 Plotly 그림 그대로                          figure
 *
 * DataWidget 의 view 이름도 이 표를 쓴다 — DB 위젯과 화면이 같은 차트를 그린다.
 * 받는 props 는 뷰와 같다: { rows, meta, ctx, symbol, setSymbol, quotes, options }.
 */
import BarsView from './views/BarsView';
import CandlesView from './views/CandlesView';
import ColumnsView from './views/ColumnsView';
import CurveView from './views/CurveView';
import DonutView from './views/DonutView';
import GaugeView from './views/GaugeView';
import HeatmapView from './views/HeatmapView';
import LinesView from './views/LinesView';
import PlotlyView from './views/PlotlyView';
import TreemapView from './views/TreemapView';
import XYView from './views/XYView';

/** 범용 x/y 차트 한 종류 — view 이름만으로 고를 수 있게 type 을 박아 둔다 */
function xy(type) {
  function XYChart(props) {
    return <XYView {...props} options={{ type, ...props.options }} />;
  }
  XYChart.displayName = `XYView(${type})`;
  return XYChart;
}

/** type → 그리는 부품. DataWidget 도 이 표로 뷰를 찾는다 */
export const CHART_VIEWS = {
  line: xy('line'),
  area: xy('area'),
  bar: xy('bar'),
  stackedBar: xy('stackedBar'),
  scatter: xy('scatter'),
  lines: LinesView,
  curve: CurveView,
  candles: CandlesView,
  columns: ColumnsView,
  bars: BarsView,
  donut: DonutView,
  heatmap: HeatmapView,
  treemap: TreemapView,
  gauge: GaugeView,
  plotly: PlotlyView,
};

const ALIASES = { candle: 'candles', pie: 'donut' };

/** 종류 이름 → 부품 (없으면 undefined) */
export function chartView(type) {
  return CHART_VIEWS[ALIASES[type] || type];
}

const NO_QUOTES = {};

export default function MpChart({ rows = [], options = {}, quotes = NO_QUOTES, ...props }) {
  const View = chartView(options.type || 'line');
  if (!View) {
    if (import.meta.env?.DEV) console.error('[MpChart] unknown type:', options.type);
    return null;
  }
  // DataWidget 밖에서는 실시간 시세가 없다 — 시세를 읽는 뷰(candles)가 빈 값으로 그리게
  return <View rows={rows} options={options} quotes={quotes} {...props} />;
}

/** 옵션을 미리 정해 둔 차트를 만든다 */
MpChart.init = function init(defaults = {}) {
  function PresetChart({ options, ...props }) {
    return <MpChart {...props} options={options ? { ...defaults, ...options } : defaults} />;
  }
  PresetChart.displayName = 'MpChart.init';
  return PresetChart;
};
