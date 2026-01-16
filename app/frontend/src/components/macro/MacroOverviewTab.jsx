/**
 * Macro 개요 탭 - 위젯 대시보드
 */
import WidgetDashboard from '../WidgetDashboard';

// 매크로 대시보드에서 사용 가능한 위젯 정의
const availableMacroWidgets = [
  {
    id: 'yield-curve',
    name: '수익률 곡선',
    description: '미국 국채 수익률 곡선과 주요 스프레드',
    defaultSize: { w: 8, h: 8 }
  }
];

// 기본 레이아웃
const defaultMacroLayout = [
  { i: 'yield-curve-default', x: 0, y: 0, w: 8, h: 8 }
];

// 기본 위젯
const defaultMacroWidgets = [
  { id: 'yield-curve-default', type: 'yield-curve' }
];

export default function MacroOverviewTab() {
  return (
    <WidgetDashboard
      dashboardId="macro-overview"
      title="거시경제 대시보드"
      subtitle="주요 경제 지표와 시장 동향을 한눈에"
      availableWidgets={availableMacroWidgets}
      defaultLayout={defaultMacroLayout}
      defaultWidgets={defaultMacroWidgets}
    />
  );
}
