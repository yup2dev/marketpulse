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
 *              — initial fetch runs with defaults; Run button manually re-fetches.
 *   expandable: { keyField, endpoint, dataPath }             (sub-row drilldown)
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BarChart2, PieChart, TrendingUp, Layers, Play } from 'lucide-react';
import BaseWidget    from '../widgets/common/BaseWidget';
import CommonTable   from '../common/CommonTable';
import CommonChart   from '../common/CommonChart';
import PlotlyRawChart from './PlotlyRawChart';
import { apiClient, API_BASE } from '../../config/api';
import { WIDGET_ENDPOINTS } from '../../registry/widgetEndpoints';
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

const CHART_TYPE_OPTIONS = [
  { id: 'line',       icon: TrendingUp, label: 'Line' },
  { id: 'bar',        icon: BarChart2,  label: 'Bar' },
  { id: 'stackedBar', icon: Layers,     label: 'Stacked' },
  { id: 'pie',        icon: PieChart,   label: 'Pie' },
];

const inputCls =
  'bg-[#0a0a0f] border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-200 ' +
  'outline-none focus:border-cyan-700 tabular-nums';

// ── Param form ────────────────────────────────────────────────────────────────
function ParamForm({ spec, values, onChange, onRun, loading }) {
  const cols = Math.min(4, Math.max(2, spec.length <= 3 ? spec.length : 4));
  return (
    <div
      className="border-b border-gray-800/60 pb-2 mb-2 space-y-2"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {spec.map((p) => (
          <div key={p.name} className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wide text-gray-500">{p.label || p.name}</label>
            {p.kind === 'select' ? (
              <select
                className={inputCls}
                value={values[p.name] ?? ''}
                onChange={(e) => onChange(p.name, e.target.value)}
              >
                {(p.options || []).map((opt) => {
                  const v = typeof opt === 'string' ? opt : opt.value;
                  const l = typeof opt === 'string' ? opt : (opt.label ?? opt.value);
                  return <option key={v} value={v}>{l}</option>;
                })}
              </select>
            ) : p.kind === 'number' ? (
              <input
                type="number"
                step={p.step ?? 'any'}
                min={p.min}
                max={p.max}
                className={inputCls}
                value={values[p.name] ?? ''}
                onChange={(e) => onChange(p.name, e.target.value === '' ? '' : Number(e.target.value))}
              />
            ) : p.kind === 'date' ? (
              <input
                type="date"
                className={inputCls}
                value={values[p.name] ?? ''}
                onChange={(e) => onChange(p.name, e.target.value)}
              />
            ) : (
              <input
                type="text"
                className={inputCls}
                value={values[p.name] ?? ''}
                onChange={(e) => onChange(p.name, p.upper ? e.target.value.toUpperCase() : e.target.value)}
              />
            )}
            {p.hint && <span className="text-[10px] text-gray-600">{p.hint}</span>}
          </div>
        ))}
      </div>
      <button
        onClick={onRun}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold text-xs py-1.5 rounded transition-colors"
      >
        <Play size={11} />
        {loading ? 'Computing…' : 'Run'}
      </button>
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────
export default function UniversalWidget({
  widgetId,
  endpoint: endpointProp,
  title:    titleProp,
  symbol:   symbolProp,
  portfolioId,
  onRemove,
}) {
  const reg        = WIDGET_ENDPOINTS[widgetId] || {};
  const endpoint   = endpointProp || reg.endpoint;
  const title      = titleProp    || reg.title  || widgetId;
  const expandable = reg.expandable;
  const dataPath   = reg.dataPath;
  const display    = reg.display;
  const paramsSpec = reg.params;
  const chartCfg   = reg.chart || {};

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
  const [params,    setParams]    = useState(initParams);
  const paramsRef = useRef(initParams);
  useEffect(() => { paramsRef.current = params; }, [params]);

  const [response,  setResponse]  = useState(null);
  const [loading,   setLoading]   = useState(!!endpoint);
  const [error,     setError]     = useState(null);
  const [viewMode,  setViewMode]  = useState(null);
  const [chartType, setChartType] = useState(chartCfg.defaultType || 'line');

  useEffect(() => { if (symbolProp) setSymbol(symbolProp); }, [symbolProp]);

  const buildUrl = useCallback((current) => {
    if (!endpoint) return null;
    const fallback = { symbol, period, portfolioId: portfolioId || '' };
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
    if (qs.length) url += (url.includes('?') ? '&' : '?') + qs.join('&');
    return url;
  }, [endpoint, symbol, period, portfolioId]);

  const fetchData = useCallback(async () => {
    if (!endpoint) return;
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
  }, [endpoint, buildUrl]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!endpoint) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-xs p-4">
        No endpoint for: <code className="ml-1 font-mono text-red-400">{widgetId}</code>
      </div>
    );
  }

  if (endpoint.includes('{portfolioId}') && !portfolioId) {
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
  const chartSpec = useMemo(() => (display === 'kv' ? null : buildChartFromRows(rows)), [rows, display]);

  // Has param? Hide BaseWidget header symbol/period selectors for those params
  const paramNames     = useMemo(() => new Set((paramsSpec || []).map(p => p.name)), [paramsSpec]);
  const requiresSymbol = endpoint.includes('{symbol}') && !paramNames.has('symbol');
  const requiresPeriod = endpoint.includes('{period}') && !paramNames.has('period');

  const showChartTypeSelector = activeView === 'chart' && renderType !== 'plotly' && display !== 'kv';
  const chartTypeSelector = showChartTypeSelector ? (
    <div className="flex items-center bg-gray-800/80 rounded p-0.5 gap-0.5" onMouseDown={e => e.stopPropagation()}>
      {CHART_TYPE_OPTIONS.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => setChartType(id)}
          title={label}
          className={`px-1.5 py-0.5 rounded transition-colors ${
            chartType === id
              ? 'bg-cyan-700 text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Icon size={11} />
        </button>
      ))}
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
          yFormatter={chartCfg.yFormatter}
          xFormatter={chartCfg.xFormatter}
        />
      </div>
    );
  } else {
    body = <CommonTable columns={columns} data={rows} emptyMessage="No data available" />;
  }

  const showViewToggle = !!renderType && !expandable && display !== 'kv';

  return (
    <BaseWidget
      title={title}
      loading={loading}
      onRefresh={fetchData}
      onRemove={onRemove}
      symbol={requiresSymbol ? symbol : undefined}
      onSymbolChange={requiresSymbol ? setSymbol : undefined}
      period={requiresPeriod ? period : undefined}
      onPeriodChange={requiresPeriod ? setPeriod : undefined}
      showPeriodSelector={requiresPeriod}
      viewMode={activeView}
      onViewModeChange={setViewMode}
      showViewToggle={showViewToggle}
      headerExtra={chartTypeSelector}
    >
      {paramsSpec?.length ? (
        <div className="px-2 pt-2">
          <ParamForm
            spec={paramsSpec}
            values={params}
            onChange={setParam}
            onRun={fetchData}
            loading={loading}
          />
        </div>
      ) : null}
      {body}
    </BaseWidget>
  );
}
