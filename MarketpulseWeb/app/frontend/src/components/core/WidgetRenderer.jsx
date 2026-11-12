/**
 * WidgetRenderer — generic dispatcher.
 *
 * Looks up `widget.type` in WIDGET_ENDPOINTS:
 *   - entry has `component`  → render `<Component {...resolvedProps} />`
 *   - entry has `endpoint`   → render UniversalWidget (auto table/chart)
 * Types that are not in the registry:
 *   - built-in widgets defined in the DB (home widgets …) → DataWidget (mp-widgets), spec built from the rows
 *   - copilot/{id}, user/{id}, model/{model}, data/{provider}/{model}
 *
 * Custom-component entries declare which props to inject via `propsFrom`,
 * e.g. `propsFrom: ['symbol', 'portfolioId']` resolves at render time.
 */
import { useMemo } from 'react';
import UniversalWidget from './UniversalWidget';
import UserWidget from './UserWidget';
import { DataWidget } from '../../mp-widgets';
import { WIDGET_ENDPOINTS } from '../../registry/widgetEndpoints';
import { toSpec } from '../../registry/builtinWidgets';
import useUserWidgetStore from '../../store/userWidgetStore';

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
  // 기본 제공 위젯 — 정의는 서버 DB 행 (store 가 불러온다)
  const builtinDef = useUserWidgetStore((s) => s.builtin.find((w) => w.widget_id === type));

  // copilot/{id} — Copilot이 합성한 데이터셋. rows는 localStorage(copilot-ds:{id})에 있다.
  const copilotDs = useMemo(() => {
    if (!type?.startsWith('copilot/')) return null;
    try {
      return JSON.parse(localStorage.getItem(`copilot-ds:${type.slice('copilot/'.length)}`));
    } catch {
      return null;
    }
  }, [type]);

  if (!reg && type?.startsWith('copilot/')) {
    return (
      <UniversalWidget
        widgetId={type}
        title={copilotDs?.title || 'Copilot Dataset'}
        data={copilotDs || { rows: [] }}
        onRemove={onRemove}
      />
    );
  }

  // user/{widget_id} — 설정 화면에서 만든 사용자 정의 위젯 (정의는 서버 DB)
  if (!reg && type?.startsWith('user/')) {
    return (
      <UserWidget
        widgetId={type}
        symbol={symbol}
        portfolioId={portfolioId}
        onRemove={onRemove}
      />
    );
  }

  // 기본 제공 위젯 — DB 정의를 mp-widgets 스펙으로 바꿔 그린다 (위젯마다 컴포넌트 없음)
  if (!reg && builtinDef) {
    return <DataWidget spec={toSpec(builtinDef)} symbol={symbol} onRemove={onRemove} />;
  }

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
