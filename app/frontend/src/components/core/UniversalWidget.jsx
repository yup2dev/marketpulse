/**
 * UniversalWidget — OpenBB-style data-driven widget renderer.
 *
 * No widgetConfigs. No column definitions. No chartConfig.
 *
 * Rendering decision (after fetch):
 *   - Plotly response  → default chart  (toggle → auto-column table)
 *   - Table response   → default table  (toggle → CommonChart with type selector)
 *
 * Chart type selector (Line / Bar / Stack / Pie) is shown in the header
 * only when viewing table-data as a chart.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart2, BarChart3, PieChart, TrendingUp, Layers } from 'lucide-react';
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

const CHART_TYPE_OPTIONS = [
  { id: 'line',       icon: TrendingUp, label: 'Line' },
  { id: 'bar',        icon: BarChart2,  label: 'Bar' },
  { id: 'stackedBar', icon: Layers,     label: 'Stacked' },
  { id: 'pie',        icon: PieChart,   label: 'Pie' },
];

export default function UniversalWidget({
  widgetId,
  endpoint: endpointProp,
  title:    titleProp,
  symbol:   symbolProp,
  portfolioId,
  onRemove,
}) {
  const reg      = WIDGET_ENDPOINTS[widgetId] || {};
  const endpoint = endpointProp || reg.endpoint;
  const title    = titleProp    || reg.title  || widgetId;

  const [symbol,    setSymbol]    = useState(symbolProp || 'AAPL');
  const [period,    setPeriod]    = useState('1y');
  const [response,  setResponse]  = useState(null);
  const [loading,   setLoading]   = useState(!!endpoint);
  const [error,     setError]     = useState(null);
  const [viewMode,  setViewMode]  = useState(null);   // null = auto
  const [chartType, setChartType] = useState('line');

  useEffect(() => { if (symbolProp) setSymbol(symbolProp); }, [symbolProp]);

  const fetchData = useCallback(async () => {
    if (!endpoint) return;
    setLoading(true);
    setError(null);
    try {
      const url = endpoint
        .replace('{symbol}',      symbol)
        .replace('{period}',      period)
        .replace('{portfolioId}', portfolioId || '');
      const result = await apiClient.get(`${API_BASE}${url}`);
      setResponse(result);
      setViewMode(null); // reset to auto on new data
    } catch (e) {
      setError(e.message || 'HTTP error');
    } finally {
      setLoading(false);
    }
  }, [endpoint, symbol, period, portfolioId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!endpoint) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-xs p-4">
        No endpoint for: <code className="ml-1 font-mono text-red-400">{widgetId}</code>
      </div>
    );
  }

  // ── Derived state ────────────────────────────────────────────────────────
  const renderType     = response ? detectRenderType(response) : null;
  const defaultView    = renderType === 'plotly' ? 'chart' : 'table';
  const activeView     = viewMode ?? defaultView;

  const rows           = useMemo(() => normalizeTableRows(response), [response]);
  const columns        = useMemo(() => autoColumns(rows), [rows]);
  const chartSpec      = useMemo(() => buildChartFromRows(rows), [rows]);

  const requiresSymbol = endpoint.includes('{symbol}');
  const requiresPeriod = endpoint.includes('{period}');

  // Chart type selector — only shown when table data is viewed as chart
  const showChartTypeSelector = activeView === 'chart' && renderType !== 'plotly';

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

  // ── Render body ──────────────────────────────────────────────────────────
  let body;
  if (error) {
    body = (
      <div className="flex items-center justify-center h-full text-red-400 text-xs p-4">
        {error}
      </div>
    );
  } else if (activeView === 'table') {
    body = <CommonTable columns={columns} data={rows} emptyMessage="No data available" />;
  } else if (renderType === 'plotly') {
    // Backend sent Plotly JSON — render as-is
    body = (
      <div className="absolute inset-0">
        <PlotlyRawChart plotlyJson={normalizePlotlyJson(response)} />
      </div>
    );
  } else if (chartSpec) {
    // Table data converted to chart — absolute fill to guarantee height
    body = (
      <div className="absolute inset-0">
        <CommonChart
          data={rows}
          series={chartSpec.series}
          xKey={chartSpec.xKey}
          type={chartType}
          fillContainer
        />
      </div>
    );
  } else {
    body = <CommonTable columns={columns} data={rows} emptyMessage="No data available" />;
  }

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
      showViewToggle={!!(renderType)}
      headerExtra={chartTypeSelector}
    >
      {body}
    </BaseWidget>
  );
}
