import PlotlyOscillator from './PlotlyOscillator';
import { INDICATOR_COLORS } from '../constants';

/**
 * 오실레이터 서브패널 (RSI / MACD / STOCH / ATR / OBV).
 *
 * 5종 모두 틀이 같았다 — 표시 조건, 카드 컨테이너, 제목, PlotlyOscillator 호출이
 * 동일하고 traces/shapes/yDomain 만 달랐다. ChartWidget.jsx 안에서 거의 같은 JSX
 * 블록 5개로 복사돼 있던 것을, 다른 부분만 표로 선언하고 렌더는 한 번만 쓰도록 모았다.
 * 지표를 추가할 때 블록을 통째로 복사하는 대신 OSCILLATORS 에 한 줄을 더하면 된다.
 */

// 과매수/과매도 기준선 같은 수평 보조선
const hLine = (y, color) => ({
  type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: y, y1: y,
  line: { color, dash: 'dot', width: 1 },
});
const lineTrace = (dataKey, name, color) => ({ dataKey, name, line: { color, width: 2 } });

const OSCILLATORS = [
  {
    id: 'RSI',
    title: 'RSI (Relative Strength Index)',
    yDomain: [0, 100],
    shapes: [hLine(70, '#ef4444'), hLine(30, '#22c55e')],
    traces: (ind) => [lineTrace(`${ind.symbol}_RSI`, `${ind.symbol} RSI`, INDICATOR_COLORS.RSI)],
  },
  {
    id: 'MACD',
    title: 'MACD (Moving Average Convergence Divergence)',
    shapes: [hLine(0, '#9ca3af')],
    traces: (ind) => [
      {
        type: 'bar',
        dataKey: `${ind.symbol}_MACD_histogram`,
        name: `${ind.symbol} Histogram`,
        marker: { color: INDICATOR_COLORS.MACD, opacity: 0.3 },
      },
      lineTrace(`${ind.symbol}_MACD_macd`, `${ind.symbol} MACD`, INDICATOR_COLORS.MACD),
      lineTrace(`${ind.symbol}_MACD_signal`, `${ind.symbol} Signal`, INDICATOR_COLORS.MACD_signal),
    ],
  },
  {
    id: 'STOCH',
    title: 'Stochastic Oscillator',
    yDomain: [0, 100],
    shapes: [hLine(80, '#ef4444'), hLine(20, '#22c55e')],
    traces: (ind) => [
      lineTrace(`${ind.symbol}_STOCH_k`, `${ind.symbol} %K`, INDICATOR_COLORS.STOCH_k),
      lineTrace(`${ind.symbol}_STOCH_d`, `${ind.symbol} %D`, INDICATOR_COLORS.STOCH_d),
    ],
  },
  {
    id: 'ATR',
    title: 'ATR (Average True Range)',
    shapes: [],
    traces: (ind) => [lineTrace(`${ind.symbol}_ATR`, `${ind.symbol} ATR`, INDICATOR_COLORS.ATR)],
  },
  {
    id: 'OBV',
    title: 'OBV (On-Balance Volume)',
    shapes: [],
    traces: (ind) => [lineTrace(`${ind.symbol}_OBV`, `${ind.symbol} OBV`, INDICATOR_COLORS.OBV)],
  },
];

const OscillatorPanels = ({ technicalIndicators, normalized, displayChartData, chartTheme }) => {
  // 정규화(%) 보기에서는 가격 축이 바뀌어 오실레이터 눈금이 의미를 잃는다.
  if (normalized) return null;

  // Fragment 라 DOM 노드가 생기지 않는다 — 각 카드가 부모 space-y-4 의 직계 자식으로
  // 남아야 패널 간 간격이 유지된다.
  return (
    <>
      {OSCILLATORS.map(({ id, title, yDomain, shapes, traces }) => {
        const active = technicalIndicators.filter(ti => ti.indicatorId === id && ti.visible);
        if (active.length === 0) return null;
        return (
          <div key={id} className="rounded-lg p-4 border border-gray-800" style={{ backgroundColor: chartTheme.background }}>
            <div className="mb-2">
              <h4 className="text-sm font-semibold text-gray-400">{title}</h4>
            </div>
            <PlotlyOscillator
              chartData={displayChartData}
              chartTheme={chartTheme}
              height={192}
              yDomain={yDomain}
              traces={active.flatMap(traces)}
              shapes={shapes}
            />
          </div>
        );
      })}
    </>
  );
};

export default OscillatorPanels;
