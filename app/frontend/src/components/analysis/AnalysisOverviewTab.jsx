/**
 * Analysis 개요 탭 - 위젯 대시보드
 */
import WidgetDashboard from '../WidgetDashboard';
import { useStockContext } from './AnalysisDashboard';

// 분석 대시보드에서 사용 가능한 위젯 정의
const availableAnalysisWidgets = [
  {
    id: 'ticker-info',
    name: '종목 정보',
    description: '현재가, 변동률, 거래량 등 기본 정보',
    defaultSize: { w: 4, h: 6 }
  },
  {
    id: 'key-metrics',
    name: '핵심 지표',
    description: 'P/E, EPS, 시가총액 등 핵심 재무지표',
    defaultSize: { w: 4, h: 7 }
  },
  {
    id: 'advanced-chart',
    name: '고급 차트',
    description: '멀티 티커 비교 및 기술적 분석',
    defaultSize: { w: 12, h: 8 }
  },
  {
    id: 'financials',
    name: '재무 요약',
    description: '손익계산서, 재무상태표, 현금흐름표',
    defaultSize: { w: 6, h: 9 }
  },
  {
    id: 'stock-quote',
    name: '주가 위젯',
    description: '간단한 주가 차트와 정보',
    defaultSize: { w: 5, h: 7 }
  }
];

// 기본 레이아웃
const defaultAnalysisLayout = [
  { i: 'ticker-info-default', x: 0, y: 0, w: 4, h: 6 },
  { i: 'key-metrics-default', x: 4, y: 0, w: 4, h: 7 },
  { i: 'advanced-chart-default', x: 0, y: 6, w: 12, h: 8 }
];

// 기본 위젯
const defaultAnalysisWidgets = [
  { id: 'ticker-info-default', type: 'ticker-info' },
  { id: 'key-metrics-default', type: 'key-metrics' },
  { id: 'advanced-chart-default', type: 'advanced-chart' }
];

export default function AnalysisOverviewTab() {
  const { symbol } = useStockContext();

  return (
    <WidgetDashboard
      dashboardId="analysis-overview"
      title="종목 분석 대시보드"
      subtitle={`${symbol} - 커스터마이즈 가능한 분석 대시보드`}
      availableWidgets={availableAnalysisWidgets}
      defaultLayout={defaultAnalysisLayout}
      defaultWidgets={defaultAnalysisWidgets}
    />
  );
}
