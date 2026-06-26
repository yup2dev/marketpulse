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

// 제거된(deprecated) 위젯 타입 → 대체 위젯 매핑. 저장된 워크스페이스 레이아웃이
// 옛 타입을 참조해도 "No endpoint for…"로 깨지지 않게 한다.
//   *-sec(하드코딩 SEC 게이트웨이) → provider 셀렉터 달린 정식 위젯.
const DEPRECATED_TYPE_ALIASES = {
  'insider-sec':    'insider',
  'financials-sec': 'financials',
  'filings-sec':    'company-filings',
};

export default function WidgetRenderer({ widget, symbol, portfolioData, onRemove }) {
  const portfolioId = portfolioData?.selectedPortfolio?.portfolio_id;
  const type = DEPRECATED_TYPE_ALIASES[widget.type] ?? widget.type;
  const reg = WIDGET_ENDPOINTS[type];

  if (reg?.component) {
    const Component = reg.component;
    const propBag = { symbol, portfolioId };
    const injected = Object.fromEntries(
      (reg.propsFrom || []).map((k) => [k, propBag[k]])
    );
    return <Component {...injected} onRemove={onRemove} />;
  }

  // model/{model} — standard_model 단위 위젯. provider는 셀렉터로 선택(경로 {provider} 치환).
  // category={model} 을 넘겨 UniversalWidget이 지원 provider 셀렉터를 띄우고 기본값(db>설정키>저부하)을 고른다.
  if (!reg && type?.startsWith('model/')) {
    const model = type.slice('model/'.length);
    return (
      <UniversalWidget
        widgetId={type}
        endpoint={`/data/{provider}/${model}?symbol={symbol}&ticker={symbol}`}
        category={model}
        symbol={symbol || 'AAPL'}
        portfolioId={portfolioId}
        onRemove={onRemove}
      />
    );
  }

  // data/{provider}/{model} — Universal Data Gateway 자동 매핑(provider 고정, 하위호환).
  // widgetEndpoints에 없는 경우에도 /api/data/{provider}/{model} 엔드포인트로 바로 조회 가능
  //
  // stock-specific provider(polygon / yahoo / fmp)는 symbol이 필수이므로
  // ?symbol={symbol}&ticker={symbol} 를 붙여 두 가지 필드명을 모두 시도.
  // 백엔드 _filter_extra_params가 모델에 맞는 필드만 남기고 나머지는 버린다.
  const _STOCK_PROVIDERS = new Set(['polygon', 'yahoo', 'fmp', 'alpaca', 'intrinio']);
  let dynamicEndpoint;
  if (!reg && type?.startsWith('data/')) {
    const provider = type.split('/')[1];
    const symbolSuffix = _STOCK_PROVIDERS.has(provider)
      ? '?symbol={symbol}&ticker={symbol}'
      : '';
    dynamicEndpoint = `/${type}${symbolSuffix}`;
  }

  return (
    <UniversalWidget
      widgetId={type}
      endpoint={dynamicEndpoint}
      symbol={symbol || 'AAPL'}
      portfolioId={portfolioId}
      onRemove={onRemove}
    />
  );
}
