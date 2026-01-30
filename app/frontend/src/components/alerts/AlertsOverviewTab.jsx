/**
 * 알림 개요 탭 - WidgetDashboard 기반 동적 레이아웃
 */
import WidgetDashboard from '../WidgetDashboard';

// 사용 가능한 위젯 목록
const AVAILABLE_WIDGETS = [
  { id: 'alert-statistics', name: '알림 통계', description: '전체 알림 현황', defaultSize: { w: 4, h: 7 } },
  { id: 'recent-triggers', name: '최근 발생', description: '최근 발생한 알림', defaultSize: { w: 8, h: 7 } },
  { id: 'active-alerts', name: '활성 알림', description: '현재 활성화된 알림 목록', defaultSize: { w: 12, h: 8 } },
];

// 기본 위젯 구성
const DEFAULT_WIDGETS = [
  { id: 'alert-stats-1', type: 'alert-statistics' },
  { id: 'recent-triggers-1', type: 'recent-triggers' },
  { id: 'active-alerts-1', type: 'active-alerts' },
];

// 기본 레이아웃
const DEFAULT_LAYOUT = [
  { i: 'alert-stats-1', x: 0, y: 0, w: 4, h: 7, minW: 3, minH: 5 },
  { i: 'recent-triggers-1', x: 4, y: 0, w: 8, h: 7, minW: 4, minH: 5 },
  { i: 'active-alerts-1', x: 0, y: 7, w: 12, h: 8, minW: 6, minH: 5 },
];

export default function AlertsOverviewTab() {
  return (
    <WidgetDashboard
      dashboardId="alerts-overview-dashboard"
      title="알림 개요"
      subtitle="전체 알림 현황"
      availableWidgets={AVAILABLE_WIDGETS}
      defaultWidgets={DEFAULT_WIDGETS}
      defaultLayout={DEFAULT_LAYOUT}
    />
  );
}
