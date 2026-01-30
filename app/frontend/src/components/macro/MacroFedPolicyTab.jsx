/**
 * Macro Fed Policy Tab - WidgetDashboard 기반 동적 레이아웃
 */
import WidgetDashboard from '../WidgetDashboard';

// 사용 가능한 위젯 목록
const AVAILABLE_WIDGETS = [
  { id: 'fed-policy', name: '연준 정책', description: '연준 금리 정책 게이지', defaultSize: { w: 12, h: 12 } },
];

// 기본 위젯 구성
const DEFAULT_WIDGETS = [
  { id: 'fed-policy-1', type: 'fed-policy' },
];

// 기본 레이아웃
const DEFAULT_LAYOUT = [
  { i: 'fed-policy-1', x: 0, y: 0, w: 12, h: 12, minW: 6, minH: 8 },
];

export default function MacroFedPolicyTab() {
  return (
    <WidgetDashboard
      dashboardId="macro-fed-policy-dashboard"
      title="연준 정책"
      subtitle="Federal Reserve 금리 정책"
      availableWidgets={AVAILABLE_WIDGETS}
      defaultWidgets={DEFAULT_WIDGETS}
      defaultLayout={DEFAULT_LAYOUT}
    />
  );
}
