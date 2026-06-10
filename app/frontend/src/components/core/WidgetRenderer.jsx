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

  // data/{provider}/{model} — Universal Data Gateway 자동 매핑
  // widgetEndpoints에 없는 경우에도 /api/data/{provider}/{model} 엔드포인트로 바로 조회 가능
  //
  // stock-specific provider(polygon / yahoo / fmp)는 symbol이 필수이므로
  // ?symbol={symbol}&ticker={symbol} 를 붙여 두 가지 필드명을 모두 시도.
  // 백엔드 _filter_extra_params가 모델에 맞는 필드만 남기고 나머지는 버린다.
  const _STOCK_PROVIDERS = new Set(['polygon', 'yahoo', 'fmp', 'alpaca', 'intrinio']);
  let dynamicEndpoint;
  if (!reg && widget.type?.startsWith('data/')) {
    const provider = widget.type.split('/')[1];
    const symbolSuffix = _STOCK_PROVIDERS.has(provider)
      ? '?symbol={symbol}&ticker={symbol}'
      : '';
    dynamicEndpoint = `/${widget.type}${symbolSuffix}`;
  }

  return (
    <UniversalWidget
      widgetId={widget.type}
      endpoint={dynamicEndpoint}
      symbol={symbol || 'AAPL'}
      portfolioId={portfolioId}
      onRemove={onRemove}
    />
  );
}
