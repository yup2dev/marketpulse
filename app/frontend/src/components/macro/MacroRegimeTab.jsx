/**
 * Macro Economic Regime Tab - WidgetDashboard 기반 동적 레이아웃
 */
import WidgetDashboard from '../WidgetDashboard';

// 사용 가능한 위젯 목록
const AVAILABLE_WIDGETS = [
  { id: 'regime-dashboard', name: '경제 체제', description: '경제 체제 대시보드', defaultSize: { w: 12, h: 12 } },
];

// 기본 위젯 구성
const DEFAULT_WIDGETS = [
  { id: 'regime-dashboard-1', type: 'regime-dashboard' },
];

// 기본 레이아웃
const DEFAULT_LAYOUT = [
  { i: 'regime-dashboard-1', x: 0, y: 0, w: 12, h: 12, minW: 6, minH: 8 },
];

export default function MacroRegimeTab() {
  return (
    <WidgetDashboard
      dashboardId="macro-regime-dashboard"
      title="경제 체제"
      subtitle="Economic Regime Analysis"
      availableWidgets={AVAILABLE_WIDGETS}
      defaultWidgets={DEFAULT_WIDGETS}
      defaultLayout={DEFAULT_LAYOUT}
    />
  );
}
