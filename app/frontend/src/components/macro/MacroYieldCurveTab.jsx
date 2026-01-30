/**
 * Macro Yield Curve Tab - WidgetDashboard 기반 동적 레이아웃
 */
import WidgetDashboard from '../WidgetDashboard';

// 사용 가능한 위젯 목록
const AVAILABLE_WIDGETS = [
  { id: 'yield-curve-chart', name: '수익률 곡선', description: '미국 국채 수익률 곡선 차트', defaultSize: { w: 12, h: 12 } },
];

// 기본 위젯 구성
const DEFAULT_WIDGETS = [
  { id: 'yield-curve-chart-1', type: 'yield-curve-chart' },
];

// 기본 레이아웃
const DEFAULT_LAYOUT = [
  { i: 'yield-curve-chart-1', x: 0, y: 0, w: 12, h: 12, minW: 6, minH: 8 },
];

export default function MacroYieldCurveTab() {
  return (
    <WidgetDashboard
      dashboardId="macro-yield-curve-dashboard"
      title="수익률 곡선"
      subtitle="US Treasury Yield Curve"
      availableWidgets={AVAILABLE_WIDGETS}
      defaultWidgets={DEFAULT_WIDGETS}
      defaultLayout={DEFAULT_LAYOUT}
    />
  );
}
