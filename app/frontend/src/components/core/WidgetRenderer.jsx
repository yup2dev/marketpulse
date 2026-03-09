/**
 * WidgetRenderer — widget.type을 UniversalWidget으로 라우팅.
 *
 * widgetConfigs 없음. widgetEndpoints.js에 endpoint가 없어도
 * UniversalWidget이 "No endpoint" 메시지를 표시한다.
 */
import UniversalWidget from './UniversalWidget';

export default function WidgetRenderer({ widget, symbol, portfolioData, onRemove }) {
  return (
    <UniversalWidget
      widgetId={widget.type}
      symbol={symbol || 'AAPL'}
      portfolioId={portfolioData?.selectedPortfolio?.portfolio_id}
      onRemove={onRemove}
    />
  );
}
