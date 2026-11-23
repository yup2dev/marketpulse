/**
 * DataWidget — 스펙 하나로 위젯을 그린다:  API → (실시간 시세 병합) → transform → 뷰.
 * 스펙 모양은 README.md 참고. 위젯마다 컴포넌트를 새로 만들지 않는다.
 */
import { useMemo } from 'react';
import {
  Card, HeaderSeg, StateView, toState, useStored, useSymbol, useQuotes, useProviderOptions, sourceLabel,
} from './adapter';
import { ProviderSelect, ControlSelect, DateChip, OptionsMenu } from './HeaderControls';
import { fill, pick, useApi, useExtra } from './data';
import StripView from './views/StripView';
import MpGrid from './MpGrid';
import { CHART_VIEWS, chartView } from './MpChart';
import { KPI_VIEWS } from './MpKpi';
import { LIST_VIEWS } from './MpList';
import { useShared, setShared } from './shared';

// 화면에서 직접 쓰는 부품과 같은 것 — 표 MpGrid · 차트 MpChart · 숫자 요약 MpKpi · 목록 MpList 의 종류표
const VIEWS = {
  table: MpGrid,
  ...CHART_VIEWS,
  ...KPI_VIEWS,
  ...LIST_VIEWS,
  strip: StripView,
};
const viewOf = (name) => VIEWS[name] || chartView(name);

/**
 * 새 뷰 종류를 붙인다 — Component 는 { rows, meta, quotes, ctx, symbol, setSymbol, setParam, options } 를 받는다.
 * Component.ownsState = true 면 로딩·오류 화면도 뷰가 그리고, Component.bare = true 면 머리줄 없는 한 줄 패널이 된다.
 */
export function registerView(name, Component) {
  VIEWS[name] = Component;
}

/** 스펙을 그대로 돌려준다 — 필수 항목이 빠졌으면 개발 중에 바로 알린다 */
export function defineWidget(spec) {
  if (import.meta.env?.DEV) {
    if (!spec.view || !viewOf(spec.view)) console.error('[mp-widgets] unknown view:', spec.view, spec);
    if (!spec.source) console.error('[mp-widgets] source is required:', spec);
    if (!spec.title && !spec.tabs?.length) console.error('[mp-widgets] title or tabs is required:', spec);
  }
  return spec;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const EMPTY = [];

export default function DataWidget({ spec, symbol: pageSymbol, onRemove }) {
  const { tabs, controls = EMPTY, quotes: quoteSpec } = spec;

  // ── 고른 값: 탭 · 헤더 컨트롤 · 종목 (다시 mount 돼도 기억한다) ──
  const [tabId, setTab] = useStored('tab', tabs?.[0]?.id);
  const tab = tabs?.find((t) => t.id === tabId) || tabs?.[0];
  // 탭은 요청·뷰·옵션을 따로 가질 수 있다 (예: 곡선 탭 / 추이 탭) — 안 적은 것은 스펙의 값
  const api = useMemo(() => ({ ...spec.api, ...tab?.api }), [spec.api, tab]);
  const options = tab?.options || spec.options;
  const [picked, setPicked] = useStored('controls', {});
  const [symbol, setSymbol] = useSymbol(pageSymbol, spec.symbol?.default);
  // 화면 변수 — 이 이름의 값은 위젯마다 따로가 아니라 같은 이름을 쓰는 위젯이 같이 따른다 (고른 기관 · 실행)
  const sharedNames = spec.shared || EMPTY;
  const shared = useShared();

  // ── 데이터 소스 (모든 위젯에 있다) ──
  //   '/data/{provider}/<model>'  그 모델을 구현한 provider 중에서 고른다
  //   그 밖의 '{provider}'        서버가 알려 주는 후보(응답 metadata.candidates) 중에서 — 비우면 자동
  //   '{provider}' 없음           고정 — 실제로 답한 소스를 보여 주기만 한다
  const [pickedProvider, setProvider] = useStored('provider', null);
  const endpoint = api.endpoint || '';
  const model = /\/data\/\{provider\}\/([\w-]+)/.exec(endpoint)?.[1];
  const switchable = endpoint.includes('{provider}');
  const registry = useProviderOptions(model);
  let provider = '';
  if (model) {
    const ok = pickedProvider && (!registry.length || registry.some((o) => o.value === pickedProvider));
    provider = ok ? pickedProvider : (spec.provider || registry[0]?.value || '');
  } else if (switchable) provider = pickedProvider || spec.provider || '';

  // endpoint 의 {이름} 자리에 들어갈 값: today · symbol · 컨트롤 값(+ 그 선택지의 params) · 탭 params
  const params = useMemo(() => {
    const out = { today: today(), symbol, provider };
    for (const name of sharedNames) out[name] = shared[name] ?? '';
    for (const c of controls) {
      const value = (sharedNames.includes(c.name) ? shared[c.name] : picked[c.name]) ?? c.default;
      out[c.name] = value;
      Object.assign(out, c.options.find((o) => o.value === value)?.params);
    }
    return Object.assign(out, tab?.params);
  }, [controls, picked, symbol, tab, provider, sharedNames, shared]);

  // ── 요청 ──
  const path = api.endpoint ? fill(api.endpoint, params) : null;
  const { data: res, error, loading, reload } = useApi(path, { refresh: api.refresh });
  const extra = useExtra(api.extra, params);

  // endpoint 가 없으면 탭(또는 스펙)의 고정 items 가 행이다 (예: 지수 타일).
  // api.prepare 는 시세를 붙이기 전에 행의 모양을 바꾼다 (예: 섹터 → 종목 행)
  const baseRows = useMemo(() => {
    if (!path) return tab?.items || spec.items || EMPTY;
    const picked = pick(res, api.dataPath) || EMPTY;
    return api.prepare && picked.length ? api.prepare(picked) : picked;
  }, [path, res, api, tab, spec.items]);

  // ── 실시간 시세 ──
  const quoteSymbols = useMemo(() => {
    if (!quoteSpec) return EMPTY;
    if (quoteSpec.symbols) return quoteSpec.symbols(baseRows).map((s) => String(s).toUpperCase());
    if (quoteSpec.key === '$symbol') return symbol ? [String(symbol).toUpperCase()] : EMPTY;
    return baseRows.map((r) => String(r[quoteSpec.key] || '').toUpperCase()).filter(Boolean);
  }, [quoteSpec, baseRows, symbol]);
  const quotes = useQuotes(quoteSymbols);

  // ── (prepare) → 병합 → transform → 탭 필터 ──
  const ctx = useMemo(
    () => ({ params, tab, symbol, extra, quotes, response: res }),
    [params, tab, symbol, extra, quotes, res],
  );
  const { rows, meta } = useMemo(() => {
    let out = baseRows;
    const fields = quoteSpec?.fields;
    if (fields && quoteSpec.key && quoteSpec.key !== '$symbol') {
      out = out.map((r) => {
        const q = quotes[String(r[quoteSpec.key] || '').toUpperCase()];
        if (!q) return r;
        const next = { ...r };
        for (const [to, from] of Object.entries(fields)) if (q[from] != null) next[to] = q[from];
        return next;
      });
    }
    let m = null;
    if (api.transform) {
      const result = api.transform(out, ctx);
      if (Array.isArray(result)) out = result;
      else { out = result?.rows || EMPTY; m = result?.meta || null; }
    }
    if (tab?.filter) out = tab.filter(out, ctx);
    return { rows: out, meta: m };
  }, [baseRows, quotes, quoteSpec, api, tab, ctx]);

  // ── 그리기 ──
  const viewName = tab?.view || spec.view;
  const View = viewOf(viewName);
  // 출처는 하나만 보인다 — 실제로 답한 소스('$provider' = 응답의 provider · 고른 소스). 응답에 없으면 정의의 첫 소스
  const declared = [].concat(spec.source || []);
  const answered = declared.includes('$provider') ? (res?.provider || provider) : null;
  const one = answered || declared.find((s) => s !== '$provider');
  const source = one ? [one] : [];
  const candidates = res?.metadata?.candidates || error?.candidates;   // 실패해도 다른 소스로 바꿀 수 있게
  let providerValue = '_';
  let providerOptions = [{ value: '_', label: one ? sourceLabel(one) : '—' }];
  if (model) {
    providerValue = provider;
    providerOptions = registry.length ? registry : [{ value: provider, label: sourceLabel(provider) }];
  } else if (switchable) {
    providerValue = provider || res?.provider || error?.provider || '';   // 키가 없어 실패했어도 어느 소스였는지 보인다
    providerOptions = (candidates || [{ provider: providerValue, available: true }])
      .filter((c) => c.provider)
      .map((c) => ({ value: c.provider, label: sourceLabel(c.provider), note: c.available ? undefined : 'Key needed' }));
  }
  const setControl = (name, value) => {
    if (sharedNames.includes(name)) setShared(name, value);
    else setPicked((prev) => ({ ...prev, [name]: value }));
    // 조건이 바뀌면 후보도 바뀐다 — 다시 자동 선택. 후보가 조건과 무관한 위젯(spec.keepProvider)은 고른 소스를 유지
    if (switchable && !model && !spec.keepProvider) setProvider(null);
  };
  const empty = typeof spec.empty === 'function' ? spec.empty(ctx) : spec.empty;

  // 탭이 controls 를 적었으면 그 이름의 컨트롤만 머리줄에 보인다 (빈 목록 = 숨김)
  const shown = tab?.controls ? controls.filter((c) => tab.controls.includes(c.name)) : controls;
  const inputs = shown.filter((c) => c.kind === 'text' || c.kind === 'number');
  const actions = (
    <>
      <ProviderSelect value={providerValue} options={providerOptions} onChange={(v) => { if (v !== '_') setProvider(v); }} />
      {shown.map((c) => {
        if (c.kind === 'date') return <DateChip key={c.name} control={c} value={params[c.name]} onChange={(v) => setControl(c.name, v)} />;
        if (c.kind === 'select') return <ControlSelect key={c.name} control={c} value={params[c.name]} onChange={(v) => setControl(c.name, v)} />;
        if (c.kind === 'text' || c.kind === 'number') return null;
        return (
          <HeaderSeg
            key={c.name}
            value={params[c.name]}
            options={c.options}
            onChange={(v) => setControl(c.name, v)}
            ariaLabel={c.label}
          />
        );
      })}
      {inputs.length > 0 && (
        <OptionsMenu controls={inputs} values={params} onApply={(v) => setPicked((prev) => ({ ...prev, ...v }))} />
      )}
    </>
  );

  // 데이터를 못 보여 줄 때의 화면. 뷰가 ownsState 면(예: 종목을 바꾸는 머리줄이 있는 캔들)
  // 뷰 안에서 그리게 넘긴다 — 오류가 나도 종목을 다시 고를 수 있어야 한다.
  let state = null;
  if (!View) state = <StateView kind="error" message={`Unknown view: ${viewName}`} compact />;
  else if (path && loading) state = <StateView kind="loading" />;
  else if (error) state = <StateView {...toState(error)} onRetry={() => reload()} compact />;
  else if (!rows.length) state = <StateView kind="empty" title={empty} compact />;

  const body = state && !View?.ownsState ? state : (
    <View
      rows={rows} meta={meta} quotes={quotes} ctx={ctx} state={state}
      symbol={symbol} setSymbol={setSymbol} setParam={setControl} options={options}
    />
  );

  return (
    <Card
      title={spec.title}
      tabs={tabs}
      activeTab={tab?.id}
      onTabChange={setTab}
      source={source}
      sourceNote={typeof spec.sourceNote === 'function' ? spec.sourceNote(ctx, meta) : spec.sourceNote}
      bare={!!View?.bare}
      sourceInActions
      live={!!spec.live && !error}
      actions={actions}
      onRemove={onRemove}
      highlight={!!spec.highlight && shared[spec.highlight.name] === spec.highlight.value}
    >
      {body}
    </Card>
  );
}
