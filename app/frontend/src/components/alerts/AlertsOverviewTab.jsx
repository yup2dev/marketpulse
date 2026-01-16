/**
 * 알림 개요 탭 - 위젯 대시보드
 */
import WidgetDashboard from '../WidgetDashboard';

// 알림 대시보드에서 사용 가능한 위젯 정의
const availableAlertWidgets = [
  {
    id: 'alert-statistics',
    name: '알림 통계',
    description: '전체/활성/비활성 알림 수 및 타입별 분포',
    defaultSize: { w: 4, h: 6 }
  },
  {
    id: 'recent-triggers',
    name: '최근 트리거',
    description: '최근 발생한 알림 이력',
    defaultSize: { w: 8, h: 7 }
  },
  {
    id: 'active-alerts',
    name: '활성 알림',
    description: '현재 활성화된 알림 목록',
    defaultSize: { w: 6, h: 8 }
  }
];

// 기본 레이아웃
const defaultAlertLayout = [
  { i: 'alert-statistics-default', x: 0, y: 0, w: 4, h: 6 },
  { i: 'recent-triggers-default', x: 4, y: 0, w: 8, h: 7 },
  { i: 'active-alerts-default', x: 0, y: 6, w: 6, h: 8 }
];

// 기본 위젯
const defaultAlertWidgets = [
  { id: 'alert-statistics-default', type: 'alert-statistics' },
  { id: 'recent-triggers-default', type: 'recent-triggers' },
  { id: 'active-alerts-default', type: 'active-alerts' }
];

export default function AlertsOverviewTab() {
  return (
    <WidgetDashboard
      dashboardId="alerts-overview"
      title="알림 대시보드"
      subtitle="알림 현황을 한눈에 확인하세요"
      availableWidgets={availableAlertWidgets}
      defaultLayout={defaultAlertLayout}
      defaultWidgets={defaultAlertWidgets}
    />
  );
}
