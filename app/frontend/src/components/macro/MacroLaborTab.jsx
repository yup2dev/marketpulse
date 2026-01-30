/**
 * Macro Labor Market Tab - WidgetDashboard 기반 동적 레이아웃
 */
import WidgetDashboard from '../WidgetDashboard';

// 사용 가능한 위젯 목록
const AVAILABLE_WIDGETS = [
  { id: 'labor-market', name: '노동시장', description: '노동시장 히트맵', defaultSize: { w: 12, h: 12 } },
];

// 기본 위젯 구성
const DEFAULT_WIDGETS = [
  { id: 'labor-market-1', type: 'labor-market' },
];

// 기본 레이아웃
const DEFAULT_LAYOUT = [
  { i: 'labor-market-1', x: 0, y: 0, w: 12, h: 12, minW: 6, minH: 8 },
];

export default function MacroLaborTab() {
  return (
    <WidgetDashboard
      dashboardId="macro-labor-dashboard"
      title="노동시장"
      subtitle="Labor Market Indicators"
      availableWidgets={AVAILABLE_WIDGETS}
      defaultWidgets={DEFAULT_WIDGETS}
      defaultLayout={DEFAULT_LAYOUT}
    />
  );
}
