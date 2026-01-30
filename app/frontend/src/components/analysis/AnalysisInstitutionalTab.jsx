/**
 * Analysis 기관 보유 탭 - WidgetDashboard 기반 동적 레이아웃
 */
import { useStockContext } from './AnalysisDashboard';
import WidgetDashboard from '../WidgetDashboard';

// 사용 가능한 위젯 목록
const AVAILABLE_WIDGETS = [
  { id: 'institutional-portfolios', name: '기관 보유', description: '기관 투자자 포트폴리오', defaultSize: { w: 12, h: 12 } },
];

export default function AnalysisInstitutionalTab() {
  const { symbol } = useStockContext();

  // 기본 위젯 구성 (symbol 전달)
  const DEFAULT_WIDGETS = [
    { id: 'institutional-1', type: 'institutional-portfolios', symbol },
  ];

  // 기본 레이아웃
  const DEFAULT_LAYOUT = [
    { i: 'institutional-1', x: 0, y: 0, w: 12, h: 12, minW: 6, minH: 8 },
  ];

  return (
    <WidgetDashboard
      dashboardId={`analysis-institutional-${symbol}`}
      title="기관 보유"
      subtitle={symbol}
      availableWidgets={AVAILABLE_WIDGETS}
      defaultWidgets={DEFAULT_WIDGETS}
      defaultLayout={DEFAULT_LAYOUT}
    />
  );
}
