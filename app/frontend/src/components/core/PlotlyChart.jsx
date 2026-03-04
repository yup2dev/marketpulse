/**
 * PlotlyChart — unified Plotly wrapper replacing recharts/CommonChart.
 *
 * Supported types:
 *   'line' | 'area' | 'bar' | 'stackedBar' | 'scatter' |
 *   'pie'  | 'donut' | 'candlestick' | 'heatmap'
 *
 * Multi-series data format (same as CommonChart):
 *   data   = [{ [xKey]: 'Jan', seriesA: 10, seriesB: 20 }, ...]
 *   series = [{ key: 'seriesA', name: 'Series A', color: '#3b82f6' }, ...]
 *
 * Pie/donut: each row = one slice; first series.key = value; xKey = label field.
 * Candlestick: data rows must have open/high/low/close (or ohlc* keys).
 */
import { useEffect, useRef, useMemo, useCallback } from 'react';
import { CHART_COLORS } from '../widgets/constants';
import ChartTypeSelector from '../common/ChartTypeSelector';

// ── Plotly dark theme layout defaults ─────────────────────────────────────────
const DARK_LAYOUT = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor:  'rgba(0,0,0,0)',
  font: { family: 'Inter, system-ui, sans-serif', color: '#9ca3af', size: 11 },
  xaxis: {
    gridcolor:    '#1f2937',
    zerolinecolor:'#374151',
    linecolor:    '#374151',
    tickfont:     { color: '#6b7280', size: 10 },
    automargin:   true,
  },
  yaxis: {
    gridcolor:    '#1f2937',
    zerolinecolor:'#374151',
    linecolor:    '#374151',
    tickfont:     { color: '#6b7280', size: 10 },
    automargin:   true,
  },
  legend: {
    font:        { color: '#9ca3af', size: 10 },
    bgcolor:     'rgba(0,0,0,0)',
    borderwidth: 0,
  },
  margin:  { t: 8, r: 8, b: 32, l: 48 },
  hoverlabel: {
    bgcolor:     '#1a1f2e',
    bordercolor: '#374151',
    font:        { color: '#f9fafb', size: 11 },
  },
  hovermode: 'x unified',
};

const PLOTLY_CONFIG = {
  displayModeBar:   false,
  displaylogo:      false,
  responsive:       true,
};

// ── Colour helpers ─────────────────────────────────────────────────────────────
function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function resolveColor(series, index) {
  return series.color || CHART_COLORS[index % CHART_COLORS.length];
}

// ── Build Plotly traces ────────────────────────────────────────────────────────
function buildTraces(type, data, series, xKey, xFormatter, yFormatter) {
  if (!data?.length || !series?.length) return [];

  const xs = data.map(row => xFormatter ? xFormatter(row[xKey]) : row[xKey]);

  // ── Pie / Donut ────────────────────────────────────────────────────────────
  if (type === 'pie' || type === 'donut') {
    const key = series[0]?.key || Object.keys(data[0] || {}).find(k => k !== xKey) || 'value';
    const colors = data.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
    return [{
      type:   'pie',
      labels: xs,
      values: data.map(row => Number(row[key]) || 0),
      marker: { colors },
      hole:   type === 'donut' ? 0.52 : 0,
      textinfo:      'label+percent',
      textfont:      { color: '#9ca3af', size: 10 },
      insidetextorientation: 'auto',
      hovertemplate: '<b>%{label}</b><br>%{value}<br>%{percent}<extra></extra>',
    }];
  }

  // ── Candlestick ────────────────────────────────────────────────────────────
  if (type === 'candlestick') {
    const row0 = data[0] || {};
    // Support both 'open','high','low','close' and prefixed 'XXX_open' etc.
    const prefix = Object.keys(row0).find(k => k.endsWith('_open'))?.replace(/_open$/, '') || '';
    const pk = (k) => prefix ? `${prefix}_${k}` : k;

    return [{
      type:       'candlestick',
      x:          xs,
      open:       data.map(r => r[pk('open')]),
      high:       data.map(r => r[pk('high')]),
      low:        data.map(r => r[pk('low')]),
      close:      data.map(r => r[pk('close')]),
      increasing: { line: { color: '#22c55e' } },
      decreasing: { line: { color: '#ef4444' } },
      hoverinfo:  'x+y',
      name:       series[0]?.name || 'OHLC',
    }];
  }

  // ── Heatmap ───────────────────────────────────────────────────────────────
  if (type === 'heatmap') {
    const yLabels = series.map(s => s.name || s.key);
    const zRows   = series.map(s => data.map(row => row[s.key]));
    return [{
      type:  'heatmap',
      x:     xs,
      y:     yLabels,
      z:     zRows,
      colorscale: 'RdYlGn',
      hovertemplate: '%{x}<br>%{y}: %{z}<extra></extra>',
    }];
  }

  // ── Scatter ────────────────────────────────────────────────────────────────
  if (type === 'scatter') {
    return series.map((s, i) => ({
      type: 'scatter',
      mode: 'markers',
      x:    xs,
      y:    data.map(row => row[s.key]),
      name: s.name || s.key,
      marker: { color: resolveColor(s, i), size: 6 },
      hovertemplate: `<b>${s.name || s.key}</b>: %{y}<extra></extra>`,
    }));
  }

  // ── Bar / StackedBar ──────────────────────────────────────────────────────
  if (type === 'bar' || type === 'stackedBar') {
    return series.map((s, i) => ({
      type:        'bar',
      x:           xs,
      y:           data.map(row => row[s.key]),
      name:        s.name || s.key,
      marker:      { color: resolveColor(s, i) },
      hovertemplate: `<b>${s.name || s.key}</b>: %{y}<extra></extra>`,
    }));
  }

  // ── Area ──────────────────────────────────────────────────────────────────
  if (type === 'area') {
    return series.map((s, i) => {
      const color = resolveColor(s, i);
      return {
        type:       'scatter',
        mode:       'lines',
        x:          xs,
        y:          data.map(row => row[s.key]),
        name:       s.name || s.key,
        line:       { color, width: 2 },
        fill:       'tozeroy',
        fillcolor:  hexToRgba(color, 0.12),
        hovertemplate: `<b>${s.name || s.key}</b>: %{y}<extra></extra>`,
      };
    });
  }

  // ── Line (default) ────────────────────────────────────────────────────────
  return series.map((s, i) => ({
    type: 'scatter',
    mode: 'lines',
    x:    xs,
    y:    data.map(row => row[s.key]),
    name: s.name || s.key,
    line: { color: resolveColor(s, i), width: 2 },
    hovertemplate: `<b>${s.name || s.key}</b>: %{y}<extra></extra>`,
  }));
}

// ── Build layout overrides ─────────────────────────────────────────────────────
function buildLayout(type, compact, yFormatter, referenceLines = [], height) {
  const layout = {
    ...DARK_LAYOUT,
    showlegend: !compact,
    height:     height || undefined,
  };

  // Stacked bar
  if (type === 'stackedBar') {
    layout.barmode = 'stack';
  }

  // Pie/donut: no axes
  if (type === 'pie' || type === 'donut') {
    layout.xaxis = { visible: false };
    layout.yaxis = { visible: false };
    layout.margin = { t: 16, r: 16, b: 16, l: 16 };
    layout.hovermode = 'closest';
  }

  // y-axis tick format
  if (yFormatter && type !== 'pie' && type !== 'donut') {
    layout.yaxis = { ...layout.yaxis };
    // Plotly doesn't accept JS functions for tickformat — handled via hovertemplate
  }

  // Reference lines as shapes
  if (referenceLines?.length) {
    layout.shapes = referenceLines.map(rl => ({
      type:      'line',
      xref:      'paper',
      yref:      'y',
      x0:        0,
      x1:        1,
      y0:        rl.y,
      y1:        rl.y,
      line:      { color: rl.color || '#6b7280', dash: 'dot', width: 1 },
    }));
    layout.annotations = referenceLines
      .filter(rl => rl.label)
      .map(rl => ({
        x:         0,
        y:         rl.y,
        xref:      'paper',
        yref:      'y',
        text:      rl.label,
        showarrow: false,
        font:      { color: rl.color || '#6b7280', size: 9 },
        xanchor:   'left',
      }));
  }

  return layout;
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PlotlyChart({
  data = [],
  series = [],
  xKey = 'x',
  type = 'line',
  onTypeChange,
  height = 280,
  fillContainer = false,
  showTypeSelector = true,
  allowedTypes,
  compact = false,
  xFormatter,
  yFormatter,
  tooltipFormatter,
  referenceLines = [],
}) {
  const containerRef = useRef(null);
  const plotRef      = useRef(null);   // stores Plotly div element

  const traces = useMemo(
    () => buildTraces(type, data, series, xKey, xFormatter, yFormatter),
    [type, data, series, xKey, xFormatter, yFormatter],
  );

  const layout = useMemo(
    () => buildLayout(type, compact, yFormatter, referenceLines, fillContainer ? undefined : height),
    [type, compact, yFormatter, referenceLines, fillContainer, height],
  );

  // ── Lazy-load Plotly to avoid large bundle in initial chunk ────────────────
  const drawChart = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;

    try {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (!plotRef.current) {
        await Plotly.newPlot(el, traces, layout, { ...PLOTLY_CONFIG, responsive: true });
        plotRef.current = el;
        // Wire resize observer
        const ro = new ResizeObserver(() => Plotly.Plots.resize(el));
        ro.observe(el);
        el._ro = ro;
      } else {
        await Plotly.react(el, traces, layout, { ...PLOTLY_CONFIG, responsive: true });
      }
    } catch (err) {
      console.warn('PlotlyChart render error:', err);
    }
  }, [traces, layout]);

  useEffect(() => {
    drawChart();
    return () => {
      const el = containerRef.current;
      if (el?._ro) el._ro.disconnect();
    };
  }, [drawChart]);

  const wrapperCls = `relative w-full ${fillContainer ? 'h-full' : ''}`;
  const wrapperStyle = fillContainer ? { minHeight: height } : { height };

  return (
    <div className={wrapperCls} style={wrapperStyle}>
      {showTypeSelector && onTypeChange && (
        <div className="absolute top-0 right-0 z-10">
          <ChartTypeSelector
            value={type}
            onChange={onTypeChange}
            types={allowedTypes}
          />
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
