/**
 * Analysis 개요 탭 - WidgetDashboard 기반 동적 레이아웃
 * ProfessionalDashboard와 동일한 패턴으로 개별 위젯을 드래그/리사이즈 가능
 */
import { useMemo } from 'react';
import { useStockContext } from './AnalysisDashboard';
import WidgetDashboard from '../WidgetDashboard';

export default function AnalysisOverviewTab() {
  const { symbol } = useStockContext();

  // 사용 가능한 위젯 목록 (symbol을 initialProps로 전달)
  const AVAILABLE_WIDGETS = useMemo(() => [
    // 종목 정보 위젯들
    { id: 'ticker-information', name: 'Ticker Information', description: '미니 차트 포함 종목 정보', defaultSize: { w: 4, h: 4 }, initialProps: { symbol } },
    { id: 'ticker-info', name: 'Ticker Info', description: '종목 상세 정보', defaultSize: { w: 4, h: 7 }, initialProps: { symbol } },
    { id: 'key-metrics', name: 'Key Metrics', description: '밸류에이션/수익성/성장성', defaultSize: { w: 4, h: 8 }, initialProps: { symbol } },
    // 차트
    { id: 'advanced-chart', name: 'Advanced Chart', description: '고급 주가 차트', defaultSize: { w: 8, h: 7 }, initialProps: { symbol } },
    // 실적/애널리스트
    { id: 'earnings', name: 'Earnings', description: 'EPS 실적 발표', defaultSize: { w: 4, h: 7 }, initialProps: { symbol } },
    { id: 'analyst', name: 'Analyst', description: '애널리스트 의견/목표가', defaultSize: { w: 4, h: 7 }, initialProps: { symbol } },
    { id: 'insider', name: 'Insider', description: '내부자 매매 현황', defaultSize: { w: 4, h: 7 }, initialProps: { symbol } },
    // 재무/분석
    { id: 'financials', name: 'Financials', description: '손익/재무상태표', defaultSize: { w: 6, h: 8 }, initialProps: { symbol } },
    { id: 'estimates-tab', name: 'Estimates', description: 'EPS/매출 추정치', defaultSize: { w: 6, h: 8 }, initialProps: { symbol } },
    { id: 'ownership-tab', name: 'Ownership', description: '기관/내부자 보유', defaultSize: { w: 6, h: 8 }, initialProps: { symbol } },
  ], [symbol]);

  // 기본 위젯 구성 (Dashboard와 동일한 스타일)
  const DEFAULT_WIDGETS = useMemo(() => [
    { id: 'ticker-information-1', type: 'ticker-information', symbol },
    { id: 'key-metrics-1', type: 'key-metrics', symbol },
    { id: 'analyst-1', type: 'analyst', symbol },
    { id: 'chart-1', type: 'advanced-chart', symbol },
    { id: 'earnings-1', type: 'earnings', symbol },
  ], [symbol]);

  // 기본 레이아웃 (Dashboard 스타일)
  const DEFAULT_LAYOUT = [
    { i: 'ticker-information-1', x: 0, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
    { i: 'key-metrics-1', x: 4, y: 0, w: 4, h: 8, minW: 3, minH: 5 },
    { i: 'analyst-1', x: 8, y: 0, w: 4, h: 8, minW: 3, minH: 5 },
    { i: 'chart-1', x: 0, y: 4, w: 4, h: 6, minW: 4, minH: 4 },
    { i: 'earnings-1', x: 0, y: 10, w: 12, h: 6, minW: 6, minH: 4 },
  ];

  return (
    <WidgetDashboard
      dashboardId={`analysis-overview-${symbol}`}
      title="종목 개요"
      subtitle={symbol}
      availableWidgets={AVAILABLE_WIDGETS}
      defaultWidgets={DEFAULT_WIDGETS}
      defaultLayout={DEFAULT_LAYOUT}
    />
  );
}
