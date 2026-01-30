/**
 * Macro Sentiment Tab - WidgetDashboard 기반 동적 레이아웃
 */
import WidgetDashboard from '../WidgetDashboard';

// 사용 가능한 위젯 목록
const AVAILABLE_WIDGETS = [
  { id: 'sentiment', name: '시장 심리', description: '복합 심리 지표', defaultSize: { w: 12, h: 12 } },
];

// 기본 위젯 구성
const DEFAULT_WIDGETS = [
  { id: 'sentiment-1', type: 'sentiment' },
];

// 기본 레이아웃
const DEFAULT_LAYOUT = [
  { i: 'sentiment-1', x: 0, y: 0, w: 12, h: 12, minW: 6, minH: 8 },
];

export default function MacroSentimentTab() {
  return (
    <WidgetDashboard
      dashboardId="macro-sentiment-dashboard"
      title="시장 심리"
      subtitle="Market Sentiment Composite"
      availableWidgets={AVAILABLE_WIDGETS}
      defaultWidgets={DEFAULT_WIDGETS}
      defaultLayout={DEFAULT_LAYOUT}
    />
  );
}
