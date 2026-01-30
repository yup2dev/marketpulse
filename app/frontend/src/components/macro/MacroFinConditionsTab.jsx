/**
 * Macro Financial Conditions Tab - WidgetDashboard 기반 동적 레이아웃
 */
import WidgetDashboard from '../WidgetDashboard';

// 사용 가능한 위젯 목록
const AVAILABLE_WIDGETS = [
  { id: 'fin-conditions', name: '금융 여건', description: '금융 환경 지표', defaultSize: { w: 12, h: 12 } },
];

// 기본 위젯 구성
const DEFAULT_WIDGETS = [
  { id: 'fin-conditions-1', type: 'fin-conditions' },
];

// 기본 레이아웃
const DEFAULT_LAYOUT = [
  { i: 'fin-conditions-1', x: 0, y: 0, w: 12, h: 12, minW: 6, minH: 8 },
];

export default function MacroFinConditionsTab() {
  return (
    <WidgetDashboard
      dashboardId="macro-fin-conditions-dashboard"
      title="금융 여건"
      subtitle="Financial Conditions Index"
      availableWidgets={AVAILABLE_WIDGETS}
      defaultWidgets={DEFAULT_WIDGETS}
      defaultLayout={DEFAULT_LAYOUT}
    />
  );
}
