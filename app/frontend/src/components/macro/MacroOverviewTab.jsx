/**
 * Macro Overview Tab - Widget Dashboard
 */
import WidgetDashboard from '../WidgetDashboard';

// 매크로 대시보드에서 사용 가능한 위젯 정의
const availableMacroWidgets = [
  // 글로벌 위젯
  {
    id: 'market-overview',
    name: 'Market Overview',
    description: '글로벌 주요 지수 현황',
    defaultSize: { w: 12, h: 3 }
  },
  {
    id: 'live-watchlist',
    name: 'Live Watchlist',
    description: '실시간 관심 종목 리스트',
    defaultSize: { w: 8, h: 5 }
  },
  {
    id: 'ticker-information',
    name: 'Ticker Information',
    description: '티커 상세 정보 및 차트',
    defaultSize: { w: 4, h: 5 }
  },
  {
    id: 'watchlist',
    name: 'Watchlist',
    description: '관심 종목 관리',
    defaultSize: { w: 4, h: 5 }
  },
  // 매크로 위젯
  {
    id: 'yield-curve',
    name: 'Yield Curve',
    description: '미국 국채 수익률 곡선',
    defaultSize: { w: 6, h: 6 }
  },
  {
    id: 'regime',
    name: 'Economic Regime',
    description: '현재 경제 사이클 상태',
    defaultSize: { w: 6, h: 6 }
  }
];

// 기본 레이아웃
const defaultMacroLayout = [
  { i: 'market-overview-default', x: 0, y: 0, w: 12, h: 3 },
  { i: 'yield-curve-default', x: 0, y: 3, w: 6, h: 6 },
  { i: 'regime-default', x: 6, y: 3, w: 6, h: 6 }
];

// 기본 위젯
const defaultMacroWidgets = [
  { id: 'market-overview-default', type: 'market-overview' },
  { id: 'yield-curve-default', type: 'yield-curve' },
  { id: 'regime-default', type: 'regime' }
];

export default function MacroOverviewTab() {
  return (
    <WidgetDashboard
      dashboardId="macro-overview"
      title="매크로 대시보드"
      subtitle="경제 지표 및 시장 현황"
      availableWidgets={availableMacroWidgets}
      defaultLayout={defaultMacroLayout}
      defaultWidgets={defaultMacroWidgets}
    />
  );
}
