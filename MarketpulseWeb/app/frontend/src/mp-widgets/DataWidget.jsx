/**
 * DataWidget — 스펙 하나로 위젯을 그린다:  API → (실시간 시세 병합) → transform → 뷰.
 * 스펙 모양은 README.md 참고. 위젯마다 컴포넌트를 새로 만들지 않는다.
 */
import { useMemo } from 'react';
import {
  Card, HeaderSeg, StateView, toState, useStored, useSymbol, useQuotes,
} from './adapter';
import { fill, pick, useApi, useExtra } from './data';
import TilesView from './views/TilesView';
import TableView from './views/TableView';
import CandlesView from './views/CandlesView';
import TreemapView from './views/TreemapView';
import ListView from './views/ListView';

const VIEWS = {
  tiles:   TilesView,
  table:   TableView,
  candles: CandlesView,
  treemap: TreemapView,
  list:    ListView,
};

/** 새 뷰 종류를 붙인다 — Component 는 { rows, meta, quotes, ctx, symbol, setSymbol, options } 를 받는다 */
export function registerView(name, Component) {
  VIEWS[name] = Component;
}

/** 스펙을 그대로 돌려준다 — 필수 항목이 빠졌으면 개발 중에 바로 알린다 */
export function defineWidget(spec) {
  if (import.meta.env?.DEV) {
    if (!spec.view || !VIEWS[spec.view]) console.error('[mp-widgets] unknown view:', spec.view, spec);
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
  const { tabs, controls = EMPTY, api = {}, quotes: quoteSpec } = spec;

  // ── 고른 값: 탭 · 헤더 컨트롤 · 종목 (다시 mount 돼도 기억한다) ──
  const [tabId, setTab] = useStored('tab', tabs?.[0]?.id);
  const tab = tabs?.find((t) => t.id === tabId) || tabs?.[0];
  const [picked, setPicked] = useStored('controls', {});
  const [symbol, setSymbol] = useSymbol(pageSymbol, spec.symbol?.default);

  // endpoint 의 {이름} 자리에 들어갈 값: today · symbol · 컨트롤 값(+ 그 선택지의 params) · 탭 params
  const params = useMemo(() => {
    const out = { today: today(), symbol };
    for (const c of controls) {
      const value = picked[c.name] ?? c.default;
      out[c.name] = value;
      Object.assign(out, c.options.find((o) => o.value === value)?.params);
    }
    return Object.assign(out, tab?.params);
  }, [controls, picked, symbol, tab]);

  // ── 요청 ──
  const path = api.endpoint ? fill(api.endpoint, params) : null;
  const { data: res, error, loading, reload } = useApi(path, { refresh: api.refresh });
  const extra = useExtra(api.extra);

  // endpoint 가 없으면 탭(또는 스펙)의 고정 items 가 행이다 (예: 지수 타일)
  const baseRows = useMemo(
    () => (path ? pick(res, api.dataPath) || EMPTY : tab?.items || spec.items || EMPTY),
    [path, res, api.dataPath, tab, spec.items],
  );

  // ── 실시간 시세 ──
  const quoteSymbols = useMemo(() => {
    if (!quoteSpec) return EMPTY;
    if (quoteSpec.symbols) return quoteSpec.symbols(baseRows).map((s) => String(s).toUpperCase());
    if (quoteSpec.key === '$symbol') return symbol ? [String(symbol).toUpperCase()] : EMPTY;
    return baseRows.map((r) => String(r[quoteSpec.key] || '').toUpperCase()).filter(Boolean);
  }, [quoteSpec, baseRows, symbol]);
  const quotes = useQuotes(quoteSymbols);

  // ── 병합 → transform → 탭 필터 ──
  const ctx = useMemo(() => ({ params, tab, symbol, extra, quotes }), [params, tab, symbol, extra, quotes]);
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
  const View = VIEWS[spec.view];
  const source = [].concat(spec.source || []).map((s) => (s === '$provider' ? res?.provider : s)).filter(Boolean);
  const empty = typeof spec.empty === 'function' ? spec.empty(ctx) : spec.empty;

  const actions = controls.length ? (
    <>
      {controls.map((c) => (
        <HeaderSeg
          key={c.name}
          value={params[c.name]}
          options={c.options}
          onChange={(v) => setPicked((prev) => ({ ...prev, [c.name]: v }))}
          ariaLabel={c.label}
        />
      ))}
    </>
  ) : null;

  // 데이터를 못 보여 줄 때의 화면. 뷰가 ownsState 면(예: 종목을 바꾸는 머리줄이 있는 캔들)
  // 뷰 안에서 그리게 넘긴다 — 오류가 나도 종목을 다시 고를 수 있어야 한다.
  let state = null;
  if (!View) state = <StateView kind="error" message={`Unknown view: ${spec.view}`} compact />;
  else if (path && loading) state = <StateView kind="loading" />;
  else if (error) state = <StateView {...toState(error)} onRetry={() => reload()} compact />;
  else if (!rows.length) state = <StateView kind="empty" title={empty} compact />;

  const body = state && !View?.ownsState ? state : (
    <View
      rows={rows} meta={meta} quotes={quotes} ctx={ctx} state={state}
      symbol={symbol} setSymbol={setSymbol} options={spec.options}
    />
  );

  return (
    <Card
      title={spec.title}
      tabs={tabs}
      activeTab={tab?.id}
      onTabChange={setTab}
      source={source}
      sourceNote={typeof spec.sourceNote === 'function' ? spec.sourceNote(ctx) : spec.sourceNote}
      live={!!spec.live && !error}
      actions={actions}
      onRemove={onRemove}
    >
      {body}
    </Card>
  );
}
