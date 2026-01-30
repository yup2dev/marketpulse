/**
 * Macro Overview Tab - WidgetDashboard 기반 동적 레이아웃
 */
import WidgetDashboard from '../WidgetDashboard';

// 사용 가능한 위젯 목록
const AVAILABLE_WIDGETS = [
  { id: 'market-overview', name: '시장 개요', description: '주요 지수 현황', defaultSize: { w: 12, h: 5 } },
  { id: 'yield-curve', name: '수익률 곡선', description: '미국 국채 수익률 곡선', defaultSize: { w: 6, h: 8 } },
  { id: 'regime', name: '경제 체제', description: '현재 경제 체제 분석', defaultSize: { w: 6, h: 8 } },
];

// 기본 위젯 구성
const DEFAULT_WIDGETS = [
  { id: 'market-overview-1', type: 'market-overview' },
  { id: 'yield-curve-1', type: 'yield-curve' },
  { id: 'regime-1', type: 'regime' },
];

// 기본 레이아웃
const DEFAULT_LAYOUT = [
  { i: 'market-overview-1', x: 0, y: 0, w: 12, h: 5, minW: 6, minH: 3 },
  { i: 'yield-curve-1', x: 0, y: 5, w: 6, h: 8, minW: 4, minH: 5 },
  { i: 'regime-1', x: 6, y: 5, w: 6, h: 8, minW: 4, minH: 5 },
];

export default function MacroOverviewTab() {
  return (
    <WidgetDashboard
      dashboardId="macro-overview-dashboard"
      title="매크로 개요"
      subtitle="거시경제 지표 현황"
      availableWidgets={AVAILABLE_WIDGETS}
      defaultWidgets={DEFAULT_WIDGETS}
      defaultLayout={DEFAULT_LAYOUT}
    />
  );
}
