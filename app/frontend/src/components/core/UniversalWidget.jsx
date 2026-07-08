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
 *   chart:     { defaultType?, allowedTypes?, referenceLines?, yFormatter?, xFormatter? }
 *              — defaultType ∈ 'line'|'area'|'bar'|'stackedBar'|'pie'|'donut'
 *              — allowedTypes restricts the in-header type selector
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import BaseWidget         from '../widgets/common/BaseWidget';
import WidgetParamForm    from '../widgets/common/WidgetParamForm';
import CommonTable        from '../common/CommonTable';
import CommonChart        from '../common/CommonChart';
import ChartTypeSelector  from '../common/ChartTypeSelector';
import PlotlyRawChart     from './PlotlyRawChart';
import { apiClient, API_BASE, providersAPI } from '../../config/api';
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
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return String(v);
    const a = Math.abs(v);
    if (a === 0)       return '0';
    if (a >= 1000)     return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (a >= 1)        return v.toFixed(4);
    if (a >= 0.0001)   return v.toFixed(6);
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
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="px-4 py-3 text-xs text-gray-500">Loading…</div>;
  if (error)   return <div className="px-4 py-3 text-xs text-red-400">{error}</div>;
  if (!data?.length) return <div className="px-4 py-3 text-xs text-gray-500">No data</div>;

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
  portfolioId,
  onRemove,
}) {
  const reg        = WIDGET_ENDPOINTS[widgetId] || {};
  const endpoint   = endpointProp || reg.endpoint;
  const title      = titleProp    || reg.title  || widgetId;
  const expandable = reg.expandable;
  const dataPath   = reg.dataPath;
  const display    = reg.display;
  const chartCfg   = reg.chart || {};
  // category = model 키 (provider 셀렉터 활성화 조건). 모델 단위 동적 위젯은 prop으로 주입.
  const category   = categoryProp ?? reg.category;

  // 모델 단위 게이트웨이 위젯: 모델의 필수 파라미터(symbol 외)를 동적 폼으로 노출.
  // reg.params(정적 폼)가 있으면 그걸 쓰고, 없으면 /api/data/ 메타에서 받아온 동적 스펙 사용.
  const [dynamicParams, setDynamicParams] = useState(null);
  // 모델이 symbol을 받는지(null=미상/정적 위젯 → 기존대로 표시). false면 심볼 셀렉터 숨김.
  const [modelAcceptsSymbol, setModelAcceptsSymbol] = useState(null);
  const paramsSpec = reg.params ?? dynamicParams ?? undefined;

  const initParams = useMemo(() => {
    const obj = {};
    for (const p of paramsSpec || []) {
      const d = typeof p.default === 'function' ? p.default() : p.default;
      obj[p.name] = d ?? '';
    }
    return obj;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [symbol,    setSymbol]    = useState(symbolProp || initParams.symbol || 'AAPL');
  const [period,    setPeriod]    = useState('1y');
  const [provider,  setProvider]  = useState(reg.provider || null);
  const [providerOptions, setProviderOptions] = useState([]);
  const [params,    setParams]    = useState(initParams);
  const paramsRef = useRef(initParams);
  useEffect(() => { paramsRef.current = params; }, [params]);

  const [response,  setResponse]  = useState(dataProp ?? null);
  const [loading,   setLoading]   = useState(!!endpoint);
  const [error,     setError]     = useState(null);
  const [viewMode,  setViewMode]  = useState(null);
  const [chartType, setChartType] = useState(chartCfg.defaultType || 'line');

  useEffect(() => { if (symbolProp) setSymbol(symbolProp); }, [symbolProp]);

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
  }, [category, reg.provider]);

  // 모델 게이트웨이 위젯: /api/data/ 메타에서 모델의 필수 파라미터를 읽어 동적 폼 스펙 구성.
  // (symbol/ticker 는 심볼 셀렉터로 자동 주입되므로 폼에서 제외)
  useEffect(() => {
    if (reg.params || !category || !endpoint?.includes('{provider}')) return;
    let alive = true;
    apiClient.get(`${API_BASE}/data/`)
      .then((r) => {
        if (!alive) return;
        const req = new Set();
        const choices = {};
        let acceptsSym = false;
        (r.results || []).forEach((p) => (p.models || []).forEach((m) => {
          if ((m.model ?? m) !== category) return;
          (m.required_params || []).forEach((x) => req.add(x));
          if (m.accepts_symbol) acceptsSym = true;
          Object.entries(m.param_choices || {}).forEach(([k, v]) => {
            if (Array.isArray(v) && v.length) {
              choices[k] = [...new Set([...(choices[k] || []), ...v])];
            }
          });
        }));
        setModelAcceptsSymbol(acceptsSym);
        // symbol/ticker는 심볼 셀렉터로 주입 → 폼에서 제외. 선택지(param_choices) 있으면 드롭다운.
        const specs = [...req]
          .filter((n) => n !== 'symbol' && n !== 'ticker')
          .map((n) => {
            const opts = choices[n];
            if (opts && opts.length) {
              const first = opts[0];
              const def = (first && typeof first === 'object') ? first.value : first;
              return { name: n, label: n, kind: 'select', options: opts, default: def };
            }
            return { name: n, label: n, kind: 'text', default: '' };
          });
        setDynamicParams(specs);
      })
      .catch(() => { if (alive) { setDynamicParams([]); setModelAcceptsSymbol(true); } });
    return () => { alive = false; };
  }, [category, endpoint, reg.params]);

  // 동적 파라미터가 로드되면 기본값을 params 상태에 병합.
  useEffect(() => {
    if (!dynamicParams?.length) return;
    setParams((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const p of dynamicParams) {
        if (!(p.name in next)) { next[p.name] = p.default ?? ''; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [dynamicParams]);

  const buildUrl = useCallback((current) => {
    if (!endpoint) return null;
    // {provider} 경로 플레이스홀더는 선택된 provider로 채운다(모델 단위 게이트웨이 위젯).
    const fallback = { symbol, period, portfolioId: portfolioId || '', provider: provider || '' };
    let url = endpoint.replace(/\{([\w_]+)\}/g, (_, k) => {
      const v = current[k] ?? fallback[k] ?? '';
      return encodeURIComponent(v);
    });
    const placeholders = new Set();
    endpoint.replace(/\{([\w_]+)\}/g, (_, k) => { placeholders.add(k); return ''; });
    const qs = [];
    for (const [k, v] of Object.entries(current)) {
      if (v == null || v === '') continue;
      if (placeholders.has(k)) continue;
      qs.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
    // 전용 라우트(경로에 {provider} 없음) → 선택된 provider를 ?provider= 로 주입.
    // 게이트웨이(/data/{provider}/{model})는 이미 경로에 provider가 들어가므로 생략.
    if (category && provider && !endpoint.includes('{provider}')) {
      qs.push(`provider=${encodeURIComponent(provider)}`);
    }
    if (qs.length) url += (url.includes('?') ? '&' : '?') + qs.join('&');
    return url;
  }, [endpoint, symbol, period, portfolioId, category, provider]);

  const fetchData = useCallback(async () => {
    if (!endpoint) return;
    // 게이트웨이 위젯은 provider 셀렉터가 확정되기 전 fetch하지 않는다(빈 provider 경로 방지).
    if (endpoint.includes('{provider}') && !provider) return;
    // 모델 위젯의 필수 파라미터(예: index_constituents 의 index)가 비어 있으면
    // 폼만 노출하고 fetch 보류 → 422(필수 누락) 방지.
    if (!reg.params && dynamicParams && dynamicParams.length &&
        dynamicParams.some((p) => {
          const v = paramsRef.current[p.name];
          return v == null || v === '';
        })) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = buildUrl(paramsRef.current);
      const result = await apiClient.get(`${API_BASE}${url}`);
      setResponse(result);
      setViewMode(null);
    } catch (e) {
      setError(e.detail || e.message || 'HTTP error');
    } finally {
      setLoading(false);
    }
  }, [endpoint, buildUrl, provider, dynamicParams]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 응답에 chart_hint가 실려 오면(copilot 데이터셋 등) 기본 차트형/뷰 적용
  useEffect(() => {
    const hint = response?.chart_hint;
    if (!hint?.type) return;
    setChartType(hint.type);
    setViewMode('chart');
  }, [response]);

  if (!endpoint && !dataProp) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-xs p-4">
        No endpoint for: <code className="ml-1 font-mono text-red-400">{widgetId}</code>
      </div>
    );
  }

  if (endpoint?.includes('{portfolioId}') && !portfolioId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-xs p-4">
        Select a portfolio to view this widget
      </div>
    );
  }

  // ── Derived state ────────────────────────────────────────────────────────
  const renderType  = response ? detectRenderType(response) : null;
  const defaultView = renderType === 'plotly' ? 'chart' : 'table';
  const activeView  = viewMode ?? defaultView;

  // (model, provider) 쌍에 등록된 provider 전용 body override. 없으면 null → 기본 렌더.
  const OverrideView = resolveProviderView(category, provider);

  const rows = useMemo(() => {
    if (!response) return [];
    const target = dataPath ? getByPath(response, dataPath) : null;
    if (display === 'kv') {
      const obj = (target ?? response);
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
      return Object.entries(obj).map(([metric, value]) => ({ metric, value }));
    }
    if (target !== null && target !== undefined) {
      if (Array.isArray(target)) return target;
      if (typeof target === 'object') return [target];
    }
    return normalizeTableRows(response);
  }, [response, dataPath, display]);

  const columns   = useMemo(() => (display === 'kv' ? KV_COLUMNS : autoColumns(rows)), [rows, display]);
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
    return buildChartFromRows(rows);
  }, [rows, display, response]);

  // Has param? Hide BaseWidget header symbol/period selectors for those params
  const paramNames     = useMemo(() => new Set((paramsSpec || []).map(p => p.name)), [paramsSpec]);
  // 모델이 symbol을 받지 않으면(modelAcceptsSymbol===false) 심볼 셀렉터 숨김.
  const requiresSymbol = !!endpoint?.includes('{symbol}') && !paramNames.has('symbol')
    && modelAcceptsSymbol !== false;
  const requiresPeriod = !!endpoint?.includes('{period}') && !paramNames.has('period');

  const showChartTypeSelector = !OverrideView && activeView === 'chart' && renderType !== 'plotly' && display !== 'kv';
  const chartTypeSelector = showChartTypeSelector ? (
    <div onMouseDown={e => e.stopPropagation()}>
      <ChartTypeSelector
        value={chartType}
        onChange={setChartType}
        types={chartCfg.allowedTypes}
      />
    </div>
  ) : null;

  const setParam = (name, value) => setParams((s) => ({ ...s, [name]: value }));

  // ── Render body ──────────────────────────────────────────────────────────
  let body;
  if (error) {
    body = (
      <div className="flex items-center justify-center h-full text-red-400 text-xs p-4">
        {error}
      </div>
    );
  } else if (OverrideView) {
    // provider 전용 뷰: 기본 table/chart 대신 등록된 컴포넌트로 body 교체.
    body = (
      <OverrideView
        response={response}
        rows={rows}
        provider={provider}
        symbol={symbol}
        period={period}
        loading={loading}
        error={error}
      />
    );
  } else if (display === 'kv' || activeView === 'table') {
    body = (
      <CommonTable
        columns={columns}
        data={rows}
        renderExpanded={expandable ? (row) => <ExpandedRowDetail row={row} config={expandable} /> : undefined}
        searchable={display !== 'kv'}
        exportable={display !== 'kv'}
        compact={display === 'kv'}
      />
    );
  } else if (renderType === 'plotly') {
    body = (
      <div className="absolute inset-0">
        <PlotlyRawChart plotlyJson={normalizePlotlyJson(response)} />
      </div>
    );
  } else if (chartSpec) {
    body = (
      <div className="absolute inset-0">
        <CommonChart
          data={rows}
          series={chartSpec.series}
          xKey={chartSpec.xKey}
          type={chartType}
          fillContainer
          referenceLines={chartCfg.referenceLines}
          annotations={response?.chart_hint?.annotations}
          yFormatter={chartCfg.yFormatter}
          xFormatter={chartCfg.xFormatter}
        />
      </div>
    );
  } else {
    body = <CommonTable columns={columns} data={rows} emptyMessage="No data available" />;
  }

  const showViewToggle = !OverrideView && !!renderType && !expandable && display !== 'kv';

  return (
    <BaseWidget
      title={title}
      loading={loading}
      onRefresh={endpoint ? fetchData : undefined}
      onRun={paramsSpec?.length ? fetchData : undefined}
      onRemove={onRemove}
      symbol={requiresSymbol ? symbol : undefined}
      onSymbolChange={requiresSymbol ? setSymbol : undefined}
      period={requiresPeriod ? period : undefined}
      onPeriodChange={requiresPeriod ? setPeriod : undefined}
      showPeriodSelector={requiresPeriod}
      provider={category ? provider : undefined}
      onProviderChange={category ? setProvider : undefined}
      providerOptions={category ? providerOptions : undefined}
      viewMode={activeView}
      onViewModeChange={setViewMode}
      showViewToggle={showViewToggle}
      headerExtra={chartTypeSelector}
    >
      <div className="flex flex-col h-full min-h-0">
        {paramsSpec?.length ? (
          <div className="px-2 pt-2 flex-shrink-0">
            <WidgetParamForm
              spec={paramsSpec}
              values={params}
              onChange={setParam}
            />
          </div>
        ) : null}
        <div className="flex-1 relative min-h-0">
          {body}
        </div>
      </div>
    </BaseWidget>
  );
}
