/**
 * UniversalWidget — OpenBB-style data-driven widget renderer.
 *
 * Rendering decision (after fetch):
 *   - Plotly response  → default chart  (toggle → auto-column table)
 *   - Table response   → default table  (toggle → CommonChart with type selector)
 *
 * Optional registry (widgetEndpoints) extensions:
 *   dataPath:  'result' | 'result.points' | 'result.tests'   (dot-path → unwrap)
 *   display:   'kv'                                          (flat object → metric/value rows)
 *   params:    [{ name, kind, label, default, options?, step? }]
 *              — renders an inline form; values feed both `{name}` placeholders and querystring.
 *              — initial fetch runs with defaults; Run button (in header) manually re-fetches.
 *   expandable: { keyField, endpoint, dataPath }             (sub-row drilldown)
 *   params[].pin / params[].showIf                          (paramSpec.js 참고 — 헤더 칩 / 조건부 입력칸)
 *              — params 에 symbol 이 있으면 폼이 아니라 헤더 심볼 칩으로 올린다
 *   titleFrom: 'institution_key'                            (그 param 의 현재 값 라벨을 제목 뒤에)
 *   kv:        { primary: ['npv', …], hide: [...], labels: { npv: 'NPV' } }
 *              — primary 는 큰 타일로, 나머지는 표로. 키는 자동으로 사람이 읽는 라벨로 바꾼다
 *   columns:   { hide: [...], order: [...], labels: {...} }  (자동 컬럼 손질)
 *   chart:     { defaultType?, allowedTypes?, referenceLines?, yFormatter?, xFormatter? }
 *              — defaultType ∈ 'line'|'area'|'bar'|'stackedBar'|'pie'|'donut'
 *              — allowedTypes restricts the in-header type selector
 *   concept:   'cpi_yoy'                                   (provider 무관 지표 — /api/concepts/{concept})
 *              — 서버가 '내 키' 기준으로 provider 를 고른다. 헤더 셀렉터 = 응답의 candidates,
 *                고르면 ?provider= 로 고정. 기본 뷰는 차트.
 *
 * 레지스트리에 없는 위젯(사용자 정의 위젯)은 같은 모양의 객체를 `config` prop 으로 넘긴다.
 * 그때만 쓰는 확장:
 *   view:      'table' | 'line' | …                         (처음 보여 줄 보기)
 *   chart:     { xKey, yKeys }                              (자동 감지 대신 지정한 축·시리즈)
 *   columns:   { formats: { field: 'percent' } }            (컬럼 표시 형식)
 *
 * 보기(view)는 하나의 값이다: 'table' | 'plotly' | 차트형('line'|'area'|…).
 * BaseWidget 헤더의 View 드롭다운이 이 값을 고른다 (차트/표 토글 + 차트형 아이콘을 합침).
 *
 * 오류·키 미등록·Fetcher 꺼짐·0건은 전부 공통 WidgetState 로 그린다 (BaseWidget state prop).
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import BaseWidget         from '../widgets/common/BaseWidget';
import WidgetParamForm    from '../widgets/common/WidgetParamForm';
import CommonTable        from '../common/CommonTable';
import CommonChart        from '../common/CommonChart';
import PlotlyRawChart     from './PlotlyRawChart';
import { WidgetState, MetricTiles, stateFromError, buildViewOptions, providerFromEndpoint, useWidgetState, useWidgetSymbol } from '../widgets/ui';
import {
  isParamVisible, visibleParams, paramDisplayValue, humanizeKey, applyColumnConfig,
} from '../widgets/common/paramSpec';
import { apiClient, API_BASE, providersAPI } from '../../config/api';
import { FETCHER_WORKER_CONNECTED } from '../../hooks/useFetcherHealth';
import { WIDGET_ENDPOINTS } from '../../registry/widgetEndpoints';
import { resolveProviderView } from '../../registry/providerViews';
import {
  detectRenderType,
  normalizePlotlyJson,
  normalizeTableRows,
  autoColumns,
  buildChartFromRows,
} from '../../utils/autoRender';

// ── helpers ───────────────────────────────────────────────────────────────────
function getByPath(obj, path) {
  if (!path) return obj;
  return path.split('.').reduce((acc, k) => (acc != null ? acc[k] : undefined), obj);
}

// 서버 부하 가중치(낮을수록 우선). db=로컬 0, 공개/키 API=낮음,
// sec·whalewisdom=서버 인프로세스 스크래핑/XBRL 파싱(무겁고 OOM 유발) → 높음.
const PROVIDER_LOAD = {
  db: 0, database: 0,
  fred: 20, bls: 20, eia: 20, oecd: 20, imf: 20, nasdaqtrader: 20, krx: 20,
  fmp: 25, polygon: 25, alphavantage: 25, tiingo: 25,
  yahoo: 30, social: 35, kis: 35, wsj: 35,
  sec: 70, whalewisdom: 75,
};

// 기본 provider 선택: ① db 우선 ② 설정키(usable=configured) 우선 ③ 서버 부하 적은 것 우선.
function pickDefaultProvider(opts) {
  if (!opts?.length) return null;
  const score = (o) => [
    (o.id === 'db' || o.id === 'database') ? 0 : 1,   // ① db
    o.configured ? 0 : 1,                              // ② 키 설정(또는 무키)
    PROVIDER_LOAD[o.id] ?? 50,                         // ③ 서버 부하
    o.id,                                              // 안정적 tie-break
  ];
  return [...opts].sort((a, b) => {
    const sa = score(a), sb = score(b);
    for (let i = 0; i < sa.length; i++) { if (sa[i] < sb[i]) return -1; if (sa[i] > sb[i]) return 1; }
    return 0;
  })[0].id;
}

function fmtKv(v) {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return String(v);
    const a = Math.abs(v);
    if (a === 0)       return '0';
    if (Number.isInteger(v)) return v.toLocaleString();
    if (a >= 1000)     return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (a >= 0.0001)   return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
    return v.toExponential(3);
  }
  if (Array.isArray(v)) return `[${v.length} items]`;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

const KV_COLUMNS = [
  { key: 'metric', header: 'Metric', sortable: false, formatter: 'none' },
  { key: 'value',  header: 'Value',  align: 'right', sortable: false, formatter: 'none',
    renderFn: (v) => <span className="tabular-nums text-gray-200">{fmtKv(v)}</span> },
];

// ── Sub-row detail panel (lazy fetch on expand) ───────────────────────────────
function ExpandedRowDetail({ row, config }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    const keyVal = row[config.keyField];
    const url    = config.endpoint.replace(`{${config.keyField}}`, encodeURIComponent(keyVal));
    apiClient.get(`${API_BASE}${url}`)
      .then(res => {
        const arr = config.dataPath
          ? (Array.isArray(getByPath(res, config.dataPath)) ? getByPath(res, config.dataPath) : [])
          : normalizeTableRows(res);
        setData(arr);
      })
      .catch(e => setError(stateFromError(e)))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <WidgetState kind="loading" compact />;
  if (error)   return <WidgetState {...error} compact />;
  if (!data?.length) return <WidgetState kind="empty" compact />;

  return (
    <CommonTable
      data={data}
      columns={autoColumns(data)}
      compact
      searchable={false}
      exportable={false}
    />
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────
export default function UniversalWidget({
  widgetId,
  endpoint: endpointProp,
  title:    titleProp,
  symbol:   symbolProp,
  category: categoryProp,
  data:     dataProp,        // 정적 응답 객체 — 주어지면 fetch 없이 그대로 렌더 (copilot 데이터셋)
  config:   configProp,      // 레지스트리 항목과 같은 모양 — 주어지면 WIDGET_ENDPOINTS 대신 쓴다 (사용자 정의 위젯)
  portfolioId,
  onRemove,
}) {
  const reg        = configProp || WIDGET_ENDPOINTS[widgetId] || {};
  const concept    = reg.concept;
  const endpoint   = endpointProp || reg.endpoint || (concept ? `/concepts/${concept}?period={period}` : undefined);
  const title      = titleProp    || reg.title  || widgetId;
  const expandable = reg.expandable;
  const dataPath   = reg.dataPath;
  const display    = reg.display;
  const chartCfg   = reg.chart || {};
  const kvCfg      = reg.kv;          // 객체를 새로 만들지 않는다 (useMemo 의존성)
  const columnCfg  = reg.columns;
  // 헤더 기간 셀렉터({period} 엔드포인트): 위젯마다 기본값·선택지를 정한다.
  // 개념 위젯은 장기 추세라 10Y, 그 외 기본은 macro 프리셋 1Y.
  const periodCfg  = reg.period || (concept ? { default: '10y', preset: 'concept' } : { default: '1y', preset: 'macro' });
  // category = model 키 (provider 셀렉터 활성화 조건). 모델 단위 동적 위젯은 prop으로 주입.
  const category   = categoryProp ?? reg.category;

  // 모델 단위 게이트웨이 위젯: 모델의 필수 파라미터(symbol 외)를 동적 폼으로 노출.
  // reg.params(정적 폼)가 있으면 그걸 쓰고, 없으면 /api/data/ 메타에서 받아온 동적 스펙 사용.
  const [dynamicParams, setDynamicParams] = useState(null);
  // 모델이 symbol을 받는지(null=미상/정적 위젯 → 기존대로 표시). false면 심볼 셀렉터 숨김.
  const [modelAcceptsSymbol, setModelAcceptsSymbol] = useState(null);
  // select 파라미터의 선택지를 API에서 채운다: p.optionsFrom = { endpoint, value, label }.
  // 실패하거나 비면 정적 p.options 를 그대로 쓴다.
  const [remoteOptions, setRemoteOptions] = useState({});
  const paramsSpec = useMemo(() => {
    const base = reg.params ?? dynamicParams ?? undefined;
    if (!base || !Object.keys(remoteOptions).length) return base;
    return base.map((p) => (remoteOptions[p.name] ? { ...p, options: remoteOptions[p.name] } : p));
  }, [reg.params, dynamicParams, remoteOptions]);

  useEffect(() => {
    const specs = (reg.params || []).filter((p) => p.optionsFrom?.endpoint);
    if (!specs.length) return undefined;
    let cancelled = false;
    specs.forEach((p) => {
      const { endpoint: optionsEndpoint, value = 'value', label = 'label' } = p.optionsFrom;
      apiClient.get(`${API_BASE}${optionsEndpoint}`)
        .then((res) => {
          const opts = (res?.results || [])
            .filter((r) => r?.[value] != null)
            .map((r) => ({ value: r[value], label: r[label] ?? r[value] }));
          if (!cancelled && opts.length) setRemoteOptions((s) => ({ ...s, [p.name]: opts }));
        })
        .catch(() => { /* 정적 options 유지 */ });
    });
    return () => { cancelled = true; };
  }, [reg.params]);

  const initParams = useMemo(() => {
    const obj = {};
    for (const p of paramsSpec || []) {
      const d = typeof p.default === 'function' ? p.default() : p.default;
      obj[p.name] = d ?? '';
    }
    return obj;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 사용자가 위젯에서 고른 값은 인스턴스별로 기억한다 (탭·화면 이동 후 돌아와도 유지)
  const [symbol,    setSymbol]    = useWidgetSymbol(symbolProp, initParams.symbol || 'AAPL');
  const [period,    setPeriod]    = useWidgetState('period', periodCfg.default);
  const [provider,  setProvider]  = useWidgetState('provider', reg.provider || null);
  const [providerOptions, setProviderOptions] = useState([]);
  const [params,    setParams]    = useWidgetState('params', initParams);
  const paramsRef = useRef(params);
  useEffect(() => { paramsRef.current = params; }, [params]);

  const [response,  setResponse]  = useState(dataProp ?? null);
  const [loading,   setLoading]   = useState(!!endpoint);
  // 실패 상태 — WidgetState props ({ kind, message, provider }). null 이면 정상.
  const [error,     setError]     = useState(null);
  // 사용자가 고른 보기. null 이면 응답 모양에 맞는 기본 보기(defaultView)를 쓴다.
  const [viewSel,   setViewSel]   = useWidgetState('view', null);

  // category가 있으면 해당 model을 지원하는 provider만 추려 셀렉터 옵션 구성.
  useEffect(() => {
    if (!category) { setProviderOptions([]); return; }
    let alive = true;
    providersAPI.list()
      .then((res) => {
        if (!alive) return;
        const opts = (res?.providers || [])
          .filter((p) => (p.categories || []).includes(category))
          .map((p) => ({ id: p.id, name: p.name, configured: p.configured }));
        setProviderOptions(opts);
        // 현재 provider가 지원 목록에 있으면 유지(전용 위젯의 명시 provider 존중),
        // 없으면 우선순위 규칙(db>설정키>저부하)으로 기본값 선택.
        setProvider((prev) =>
          (prev && opts.some((o) => o.id === prev)) ? prev : pickDefaultProvider(opts)
        );
      })
      .catch(() => { if (alive) setProviderOptions([]); });
    return () => { alive = false; };
  }, [category, reg.provider, setProvider]);

  // 모델 게이트웨이 위젯: 선택된 provider의 QueryParams 스키마로 파라미터 폼 자동 생성.
  // provider가 바뀌면 그 provider의 옵션(표준모델 + provider 전용 필드)으로 폼을 재구성한다.
  // (symbol/ticker 는 심볼 셀렉터로 자동 주입되므로 폼에서 제외)
  useEffect(() => {
    if (reg.params || !category || !endpoint?.includes('{provider}') || !provider) return;
    let alive = true;
    setDynamicParams(null);   // 스키마 로딩 동안 fetch 보류 (아래 fetchData 게이트)
    apiClient.get(`${API_BASE}/data/${provider}/${category}/schema`)
      .then((r) => {
        if (!alive) return;
        setModelAcceptsSymbol(!!r.accepts_symbol);
        const specs = (r.params || []).filter((p) => p.name !== 'symbol' && p.name !== 'ticker');
        // params 동기화: 같은 이름은 사용자가 고른 값 유지, 새 파라미터는 기본값
        // (필수 select는 첫 옵션), 이전 provider에만 있던 키는 제거
        // (extra='allow' 모델은 서버가 안 걸러줌). setDynamicParams와 같은 배치로
        // 커밋되어 fetchData 이펙트가 항상 동기화된 params로 실행된다.
        setParams((prev) => {
          const next = {};
          for (const p of specs) {
            if (p.name in prev && prev[p.name] !== '') { next[p.name] = prev[p.name]; continue; }
            let def = p.default;
            if ((def == null || def === '') && p.required && p.options?.length) {
              const first = p.options[0];
              def = (first && typeof first === 'object') ? first.value : first;
            }
            next[p.name] = def ?? '';
          }
          return next;
        });
        setDynamicParams(specs);
      })
      .catch(() => { if (alive) { setDynamicParams([]); setModelAcceptsSymbol(true); } });
    return () => { alive = false; };
  }, [category, endpoint, reg.params, provider, setParams]);

  const buildUrl = useCallback((current) => {
    if (!endpoint) return null;
    // 모델이 symbol을 받지 않으면(스키마 accepts_symbol=false — institution 계열 등)
    // 템플릿에 자동 주입된 symbol/ticker 쿼리를 제거해 fetcher에 흘러가지 않게 한다.
    let ep = endpoint;
    if (modelAcceptsSymbol === false && ep.includes('?')) {
      const [path, rawQs] = ep.split('?');
      const kept = rawQs.split('&').filter((kv) => !/^(symbol|ticker)=/.test(kv));
      ep = kept.length ? `${path}?${kept.join('&')}` : path;
    }
    // {provider} 경로 플레이스홀더는 선택된 provider로 채운다(모델 단위 게이트웨이 위젯).
    const fallback = { symbol, period, portfolioId: portfolioId || '', provider: provider || '' };
    let url = ep.replace(/\{([\w_]+)\}/g, (_, k) => {
      const v = current[k] ?? fallback[k] ?? '';
      return encodeURIComponent(v);
    });
    const placeholders = new Set();
    ep.replace(/\{([\w_]+)\}/g, (_, k) => { placeholders.add(k); return ''; });
    // showIf 로 숨겨진 파라미터는 요청에 싣지 않는다 (서버 기본값을 쓰게)
    const hidden = new Set((paramsSpec || []).filter((ps) => !isParamVisible(ps, current)).map((ps) => ps.name));
    const qs = [];
    for (const [k, v] of Object.entries(current)) {
      if (v == null || v === '') continue;
      if (placeholders.has(k)) continue;
      if (hidden.has(k)) continue;
      qs.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
    // 전용 라우트(경로에 {provider} 없음) → 선택된 provider를 ?provider= 로 주입.
    // 게이트웨이(/data/{provider}/{model})는 이미 경로에 provider가 들어가므로 생략.
    // 개념 위젯은 provider 가 null 이면 서버 자동 선택, 고르면 고정.
    if ((category || concept) && provider && !endpoint.includes('{provider}')) {
      qs.push(`provider=${encodeURIComponent(provider)}`);
    }
    if (qs.length) url += (url.includes('?') ? '&' : '?') + qs.join('&');
    return url;
  }, [endpoint, symbol, period, portfolioId, category, concept, provider, modelAcceptsSymbol, paramsSpec]);

  const fetchData = useCallback(async () => {
    if (!endpoint) return;
    // 게이트웨이 위젯은 provider 셀렉터가 확정되기 전 fetch하지 않는다(빈 provider 경로 방지).
    if (endpoint.includes('{provider}') && !provider) return;
    if (!reg.params && category && endpoint.includes('{provider}')) {
      // 스키마 로딩 중이면 보류 — 이전 provider의 폼으로 fetch하는 것 방지.
      if (dynamicParams == null) return;
      // 필수 파라미터(예: index_constituents 의 index)가 비어 있으면
      // 폼만 노출하고 fetch 보류 → 422(필수 누락) 방지.
      if (dynamicParams.some((p) => {
        if (!p.required) return false;
        const v = paramsRef.current[p.name];
        return v == null || v === '';
      })) {
        setLoading(false);
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const url = buildUrl(paramsRef.current);
      const result = await apiClient.get(`${API_BASE}${url}`);
      setResponse(result);
    } catch (e) {
      setError(stateFromError(e));
    } finally {
      setLoading(false);
    }
  }, [endpoint, buildUrl, provider, category, dynamicParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  // 파라미터 적용은 '다음 렌더에서' 조회한다 — setParams 직후 바로 fetch 하면
  // paramsRef 가 아직 이전 값이라 바뀌기 전 조건으로 요청된다.
  const [applySeq, setApplySeq] = useState(0);
  const requestApply = useCallback(() => setApplySeq((n) => n + 1), []);
  useEffect(() => { if (applySeq) fetchData(); }, [applySeq]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetcher 워커가 풀에 합류하면 실패 상태였던 위젯을 재조회 — 합류 전 요청의 503이 남지 않게.
  useEffect(() => {
    if (!error) return undefined;
    window.addEventListener(FETCHER_WORKER_CONNECTED, fetchData);
    return () => window.removeEventListener(FETCHER_WORKER_CONNECTED, fetchData);
  }, [error, fetchData]);

  // 응답에 chart_hint가 실려 오면(copilot 데이터셋 등) 그 차트형을 보기로 쓴다
  useEffect(() => {
    const hint = response?.chart_hint;
    if (hint?.type) setViewSel(hint.type);
  }, [response, setViewSel]);

  // 개념 위젯: 셀렉터 옵션 = 응답의 candidates(그 국가를 지원하는 provider + 내 사용 가능 여부)
  const conceptMeta = concept ? response?.metadata : null;
  const conceptProviderOptions = useMemo(
    () => (conceptMeta?.candidates || []).map((c) => ({ id: c.provider, name: c.provider.toUpperCase(), configured: c.available })),
    [conceptMeta],
  );

  // ── Derived state ────────────────────────────────────────────────────────
  const renderType  = response ? detectRenderType(response) : null;

  // (model, provider) 쌍에 등록된 provider 전용 body override. 없으면 null → 기본 렌더.
  const OverrideView = resolveProviderView(category, provider);

  const rows = useMemo(() => {
    if (!response) return [];
    const target = dataPath ? getByPath(response, dataPath) : null;
    if (display === 'kv') {
      // 행 목록이 오면 첫 행을 요약한다 (게이트웨이는 한 건짜리도 배열로 준다)
      const src = (target ?? response);
      const obj = Array.isArray(src) ? src[0] : src;
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
      return Object.entries(obj).map(([metric, value]) => ({ metric, value }));
    }
    if (target !== null && target !== undefined) {
      if (Array.isArray(target)) return target;
      if (typeof target === 'object') return [target];
    }
    return normalizeTableRows(response);
  }, [response, dataPath, display]);

  const columns   = useMemo(
    () => (display === 'kv' ? KV_COLUMNS : applyColumnConfig(autoColumns(rows), columnCfg)),
    [rows, display, columnCfg],
  );

  // kv: primary 필드는 타일, 나머지는 표 (hide 는 둘 다에서 뺀다). 키는 사람이 읽는 라벨로.
  const { kvTiles, kvRows } = useMemo(() => {
    if (display !== 'kv') return { kvTiles: [], kvRows: [] };
    const cfg = kvCfg || {};
    const primary = cfg.primary || [];
    const hide = new Set(cfg.hide || []);
    const label = (k) => cfg.labels?.[k] || humanizeKey(k);
    const byKey = new Map(rows.map((r) => [r.metric, r.value]));
    const tiles = primary.filter((k) => byKey.has(k)).map((k) => ({ key: k, label: label(k), value: typeof byKey.get(k) === 'boolean' ? byKey.get(k) : fmtKv(byKey.get(k)) }));
    const rest = rows
      .filter((r) => !hide.has(r.metric) && !primary.includes(r.metric))
      .map((r) => ({ metric: label(r.metric), value: r.value }));
    return { kvTiles: tiles, kvRows: rest };
  }, [rows, display, kvCfg]);
  // chart_hint(x_key/y_keys)가 있으면 자동 감지 대신 지정된 축/시리즈 사용
  const chartSpec = useMemo(() => {
    if (display === 'kv') return null;
    const hint = response?.chart_hint;
    if (hint?.x_key && hint?.y_keys?.length) {
      return {
        xKey: hint.x_key,
        series: hint.y_keys.map((k) => ({ key: k, name: k.replace(/_/g, ' ') })),
      };
    }
    // 설정에서 축·시리즈를 지정했으면(사용자 정의 위젯의 매핑) 그걸 쓴다
    if (chartCfg.xKey && chartCfg.yKeys?.length) {
      return {
        xKey: chartCfg.xKey,
        series: chartCfg.yKeys.map((k) => ({ key: k, name: columnCfg?.labels?.[k] || humanizeKey(k) })),
      };
    }
    return buildChartFromRows(rows);
  }, [rows, display, response, chartCfg.xKey, chartCfg.yKeys, columnCfg]);

  // ── 보기 옵션 ─────────────────────────────────────────────────────────────
  // plotly 응답: [Chart, Table] / 행 응답: [차트형…, Table] / kv·override·펼침 표: 보기 선택 없음
  const viewOptions = useMemo(() => {
    if (!renderType || OverrideView || display === 'kv' || expandable) return [];
    if (renderType === 'plotly') return buildViewOptions({ plotly: true, chart: false, table: true });
    if (!chartSpec) return [];
    return buildViewOptions({ chart: chartCfg.allowedTypes || true, table: true });
  }, [renderType, OverrideView, display, expandable, chartSpec, chartCfg.allowedTypes]);

  const preferredView = renderType === 'plotly'
    ? 'plotly'
    : (concept ? (chartCfg.defaultType || 'line') : 'table');
  // 설정이 고른 보기(reg.view)는 그 보기가 실제로 가능할 때만 따른다 (숫자 필드가 없으면 차트 불가)
  const defaultView = (reg.view && viewOptions.some((o) => o.value === reg.view)) ? reg.view : preferredView;
  const view = (viewSel && viewOptions.some((o) => o.value === viewSel)) ? viewSel : defaultView;

  // params 의 symbol 은 폼이 아니라 헤더 심볼 칩으로 (심볼 입력 위치를 한 곳으로)
  const symbolParam = (paramsSpec || []).find((ps) => ps.name === 'symbol');
  const formSpec = useMemo(
    () => visibleParams((paramsSpec || []).filter((ps) => ps.name !== 'symbol'), params),
    [paramsSpec, params],
  );
  const titleParam = reg.titleFrom ? (paramsSpec || []).find((ps) => ps.name === reg.titleFrom) : null;

  // Has param? Hide BaseWidget header symbol/period selectors for those params
  const paramNames     = useMemo(() => new Set((paramsSpec || []).map(p => p.name)), [paramsSpec]);
  // 모델이 symbol을 받지 않으면(modelAcceptsSymbol===false) 심볼 셀렉터 숨김.
  const requiresSymbol = !!endpoint?.includes('{symbol}') && !paramNames.has('symbol')
    && modelAcceptsSymbol !== false;
  const requiresPeriod = !!endpoint?.includes('{period}') && !paramNames.has('period');

  // ── 조기 반환은 반드시 모든 훅 뒤에 둔다 ──────────────────────────────────
  // 앞쪽(파생 useMemo 위)에 있던 것을 여기로 내렸다. 조건에 따라 훅을 건너뛰면
  // 렌더마다 훅 개수가 달라져 React 가 "Rendered more hooks than during the
  // previous render" 로 터진다 — 포트폴리오 위젯에서 portfolioId 를 고르는 순간
  // 실제로 발생하는 경로였다.
  if (!endpoint && !dataProp) {
    return <WidgetState kind="error" title="Widget is not configured" message={`No endpoint for ${widgetId}`} />;
  }

  if (endpoint?.includes('{portfolioId}') && !portfolioId) {
    return <WidgetState kind="idle" title="Select a portfolio" message="Pick a portfolio in the page header to see this widget." />;
  }

  const setParam = (name, value) => {
    setParams((s) => ({ ...s, [name]: value }));
    // 국가를 바꾸면 고정했던 provider 가 그 국가를 지원하지 않을 수 있다 → 자동 선택으로 되돌림
    if (concept && name === 'country') setProvider(null);
  };

  // 파라미터 폼 → 헤더 컨트롤(뷰 토글·새로고침·닫기) 옆의 컴팩트 팝오버로 노출.
  const paramMenu = formSpec.length ? (
    <WidgetParamForm
      spec={formSpec}
      values={params}
      onChange={setParam}
      onApply={requestApply}
      loading={loading}
      idPrefix={`wp-${widgetId}`}
    />
  ) : null;

  const headerSymbol = symbolParam ? params.symbol : (requiresSymbol ? symbol : undefined);
  const onHeaderSymbol = symbolParam
    ? (v) => { setParam('symbol', v); requestApply(); }
    : (requiresSymbol ? setSymbol : undefined);
  // (개념 위젯의 국가는 pin 된 헤더 칩이 보여 주므로 제목에 다시 붙이지 않는다)
  const titleSuffix = titleParam ? paramDisplayValue(titleParam, params[titleParam.name]) : undefined;

  // 출처: 응답이 밝힌 provider(실제로 답한 소스) > 고른 provider > 엔드포인트에 박힌 provider.
  // 응답에 provider 가 없는 사용자 데이터 라우트 등은 레지스트리 source 로 정한다.
  const source = reg.source
    ?? (response?.provider || provider || reg.provider || providerFromEndpoint(endpoint) || undefined);

  // ── Render body ──────────────────────────────────────────────────────────
  // 실패·0건은 BaseWidget state 로 넘긴다 (본문 대신 공통 WidgetState).
  const isEmpty = !!response && !OverrideView && renderType !== 'plotly' && rows.length === 0;
  let widgetState = null;
  if (error) widgetState = { ...error, onRetry: fetchData };
  else if (isEmpty) widgetState = { kind: 'empty', message: paramsSpec?.length ? 'Try different parameters.' : undefined };

  let body = null;
  if (OverrideView) {
    // provider 전용 뷰: 기본 table/chart 대신 등록된 컴포넌트로 body 교체.
    body = (
      <OverrideView
        response={response}
        rows={rows}
        provider={provider}
        symbol={symbol}
        period={period}
        loading={loading}
        error={error?.message}
      />
    );
  } else if (display === 'kv') {
    body = (
      <div className="absolute inset-0 overflow-auto">
        <MetricTiles items={kvTiles} />
        {kvRows.length > 0 && (
          <CommonTable columns={columns} data={kvRows} searchable={false} exportable={false} compact />
        )}
      </div>
    );
  } else if (view === 'table' || (!chartSpec && renderType !== 'plotly')) {
    body = (
      <CommonTable
        columns={columns}
        data={rows}
        renderExpanded={expandable ? (row) => <ExpandedRowDetail row={row} config={expandable} /> : undefined}
      />
    );
  } else if (view === 'plotly') {
    body = (
      <div className="absolute inset-0">
        <PlotlyRawChart plotlyJson={normalizePlotlyJson(response)} />
      </div>
    );
  } else {
    body = (
      <div className="absolute inset-0">
        <CommonChart
          data={rows}
          series={chartSpec.series}
          xKey={chartSpec.xKey}
          type={view}
          fillContainer
          referenceLines={chartCfg.referenceLines}
          annotations={response?.chart_hint?.annotations}
          yFormatter={chartCfg.yFormatter}
          xFormatter={chartCfg.xFormatter}
        />
      </div>
    );
  }

  return (
    <BaseWidget
      title={title}
      titleSuffix={titleSuffix}
      loading={loading}
      onRefresh={endpoint ? fetchData : undefined}
      onRemove={onRemove}
      symbol={headerSymbol}
      onSymbolChange={onHeaderSymbol}
      period={requiresPeriod ? period : undefined}
      onPeriodChange={requiresPeriod ? setPeriod : undefined}
      showPeriodSelector={requiresPeriod}
      periodPreset={periodCfg.preset}
      provider={concept ? (provider || response?.provider) : (category ? provider : undefined)}
      onProviderChange={(category || concept) ? setProvider : undefined}
      providerOptions={concept ? conceptProviderOptions : (category ? providerOptions : undefined)}
      view={view}
      viewOptions={viewOptions}
      onViewChange={setViewSel}
      headerExtra={paramMenu}
      state={widgetState}
      source={source}
      sourceNote={reg.sourceNote}
    >
      <div className="relative h-full min-h-0">
        {body}
      </div>
    </BaseWidget>
  );
}
