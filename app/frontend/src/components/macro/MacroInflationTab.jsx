/**
 * Macro Inflation Tab - WidgetDashboard 기반 동적 레이아웃
 */
import WidgetDashboard from '../WidgetDashboard';

// 사용 가능한 위젯 목록
const AVAILABLE_WIDGETS = [
  { id: 'inflation', name: '인플레이션', description: '인플레이션 분해 분석', defaultSize: { w: 12, h: 12 } },
];

// 기본 위젯 구성
const DEFAULT_WIDGETS = [
  { id: 'inflation-1', type: 'inflation' },
];

// 기본 레이아웃
const DEFAULT_LAYOUT = [
  { i: 'inflation-1', x: 0, y: 0, w: 12, h: 12, minW: 6, minH: 8 },
];

export default function MacroInflationTab() {
  return (
    <WidgetDashboard
      dashboardId="macro-inflation-dashboard"
      title="인플레이션"
      subtitle="CPI 분해 분석"
      availableWidgets={AVAILABLE_WIDGETS}
      defaultWidgets={DEFAULT_WIDGETS}
      defaultLayout={DEFAULT_LAYOUT}
    />
  );
}
