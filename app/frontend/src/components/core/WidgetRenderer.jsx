/**
 * WidgetRenderer — generic dispatcher.
 *
 * Looks up `widget.type` in WIDGET_ENDPOINTS:
 *   - entry has `component`  → render `<Component {...resolvedProps} />`
 *   - entry has `endpoint`   → render UniversalWidget (auto table/chart)
 *
 * Custom-component entries declare which props to inject via `propsFrom`,
 * e.g. `propsFrom: ['symbol', 'portfolioId']` resolves at render time.
 */
import UniversalWidget from './UniversalWidget';
import { WIDGET_ENDPOINTS } from '../../registry/widgetEndpoints';

export default function WidgetRenderer({ widget, symbol, portfolioData, onRemove }) {
  const portfolioId = portfolioData?.selectedPortfolio?.portfolio_id;
  const reg = WIDGET_ENDPOINTS[widget.type];

  if (reg?.component) {
    const Component = reg.component;
    const propBag = { symbol, portfolioId };
    const injected = Object.fromEntries(
      (reg.propsFrom || []).map((k) => [k, propBag[k]])
    );
    return <Component {...injected} onRemove={onRemove} />;
  }

  return (
    <UniversalWidget
      widgetId={widget.type}
      symbol={symbol || 'AAPL'}
      portfolioId={portfolioId}
      onRemove={onRemove}
    />
  );
}
