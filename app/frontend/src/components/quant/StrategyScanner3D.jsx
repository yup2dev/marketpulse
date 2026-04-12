/**
 * StrategyScanner3D
 *
 * Multi-dimensional parameter sweep with:
 *   - 2 params  → 3D Surface + 2D Heatmap
 *   - 3+ params → Parallel Coordinates plot
 *   - Always    → Rankings table
 *
 * Passes scan request to /api/quant/scan, visualises with Plotly.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { quantAPI } from '../../config/api';

const METRIC_OPTIONS = [
  { key: 'sharpe',           label: 'Sharpe Ratio'   },
  { key: 'total_return',     label: 'Total Return %' },
  { key: 'annualized_return',label: 'Ann. Return %'  },
  { key: 'max_drawdown',     label: 'Max Drawdown %' },
  { key: 'win_rate',         label: 'Win Rate %'     },
  { key: 'trade_count',      label: 'Trade Count'    },
];

// ── Small helpers ─────────────────────────────────────────────────────────────
const Input = ({ label, value, onChange, ...rest }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[9px] text-gray-600 uppercase tracking-wider">{label}</span>
    <input
      value={value} onChange={e => onChange(e.target.value)}
      className="px-2 py-1 bg-[#060608] border border-gray-700/60 rounded text-[11px] text-white focus:outline-none focus:border-cyan-600 tabular-nums"
      {...rest}
    />
  </div>
);

function countCombinations(paramRanges) {
  return Object.values(paramRanges).reduce((acc, { min, max, step }) => {
    const s = step || 1;
    return acc * Math.max(1, Math.floor((max - min) / s) + 1);
  }, 1);
}

// ── Robustness computation ────────────────────────────────────────────────────
// For each scan result point, compute how "plateau-like" its neighborhood is.
// robustness ≈ 1 → flat plateau (robust, generalises well)
// robustness ≈ 0 → sharp peak (fragile, likely overfit)
function computeRobustness(results, paramKeys, metric) {
  if (results.length < 3 || paramKeys.length === 0) {
    return results.map(r => ({ ...r, robustness: 0.5 }));
  }
  // Smallest step per param
  const steps = {};
  paramKeys.forEach(k => {
    const sorted = [...new Set(results.map(r => r[k]))].sort((a, b) => a - b);
    steps[k] = sorted.length > 1
      ? Math.min(...sorted.slice(1).map((v, i) => v - sorted[i]))
      : 1;
  });

  return results.map(r => {
    const myVal = r[metric] ?? 0;
    const neighbors = [];
    for (const key of paramKeys) {
      for (const dir of [-1, 1]) {
        const target = r[key] + dir * steps[key];
        const nb = results.find(o =>
          Math.abs(o[key] - target) < steps[key] * 0.05 &&
          paramKeys.filter(k => k !== key).every(k => Math.abs(o[k] - r[k]) < steps[k] * 0.05)
        );
        if (nb) neighbors.push(nb[metric] ?? 0);
      }
    }
    if (neighbors.length === 0) return { ...r, robustness: 0.5 };
    // Use worst neighbor as robustness signal (conservative)
    const minNb = Math.min(...neighbors);
    if (myVal <= 0) return { ...r, robustness: 0.3 };
    const robustness = Math.max(0, Math.min(1, minNb / myVal));
    return { ...r, robustness };
  });
}

// Robustness colorscale: 0=red (fragile), 0.5=yellow, 1=green (robust plateau)
const ROBUST_COLORSCALE = [
  [0,    '#ef4444'],
  [0.35, '#f97316'],
  [0.6,  '#eab308'],
  [0.8,  '#84cc16'],
  [1,    '#22c55e'],
];

// ── 3D Surface (2 params) ─────────────────────────────────────────────────────
function Surface3D({ results, param1, param2, metric, robustMode }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !results.length) return;

    const p1Vals = [...new Set(results.map(r => r[param1]))].sort((a, b) => a - b);
    const p2Vals = [...new Set(results.map(r => r[param2]))].sort((a, b) => a - b);

    const zMatrix = p1Vals.map(p1 =>
      p2Vals.map(p2 => {
        const row = results.find(r => r[param1] === p1 && r[param2] === p2);
        return row ? row[metric] : null;
      })
    );

    // Color matrix: metric value (standard) or robustness (robust mode)
    const surfColor = robustMode
      ? p1Vals.map(p1 => p2Vals.map(p2 => {
          const row = results.find(r => r[param1] === p1 && r[param2] === p2);
          return row ? (row.robustness ?? 0.5) : null;
        }))
      : zMatrix;

    const colorscale = robustMode ? ROBUST_COLORSCALE : 'RdYlGn';
    const cbarTitle  = robustMode ? 'Robustness' : metric;

    import('plotly.js-dist-min').then(P => {
      const Plotly = P.default ?? P;

      // Main surface
      const surface = {
        type: 'surface',
        x: p2Vals, y: p1Vals, z: zMatrix,
        surfacecolor: surfColor,
        colorscale,
        cmin: robustMode ? 0 : undefined,
        cmax: robustMode ? 1 : undefined,
        colorbar: { title: { text: cbarTitle, font: { size: 10 } }, len: 0.5, thickness: 12, tickfont: { size: 9 } },
        hovertemplate: robustMode
          ? `${param1}=%{y}<br>${param2}=%{x}<br>${metric}=%{z:.3f}<br>Robustness=%{surfacecolor:.2f}<extra></extra>`
          : `${param1}=%{y}<br>${param2}=%{x}<br>${metric}=%{z:.3f}<extra></extra>`,
      };

      const traces = [surface];

      // In robust mode: overlay scatter markers for fragile peaks (robustness < 0.4)
      if (robustMode) {
        const fragile = results.filter(r => (r.robustness ?? 1) < 0.4);
        if (fragile.length) {
          traces.push({
            type: 'scatter3d',
            x: fragile.map(r => r[param2]),
            y: fragile.map(r => r[param1]),
            z: fragile.map(r => (r[metric] ?? 0) * 1.05), // slightly above surface
            mode: 'markers',
            marker: { size: 5, color: '#ef4444', symbol: 'x', opacity: 0.8 },
            hovertemplate: `⚠ 과적합 위험<br>${param1}=%{y}<br>${param2}=%{x}<extra></extra>`,
            name: '과적합 위험',
            showlegend: false,
          });
        }
        const robust = results.filter(r => (r.robustness ?? 0) >= 0.75 && (r[metric] ?? 0) > 0);
        if (robust.length) {
          const top = [...robust].sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0)).slice(0, 5);
          traces.push({
            type: 'scatter3d',
            x: top.map(r => r[param2]),
            y: top.map(r => r[param1]),
            z: top.map(r => (r[metric] ?? 0) * 1.08),
            mode: 'markers',
            marker: { size: 6, color: '#22c55e', symbol: 'circle', opacity: 0.9 },
            hovertemplate: `✓ Robust Optimum<br>${param1}=%{y}<br>${param2}=%{x}<extra></extra>`,
            name: 'Robust Optimum',
            showlegend: false,
          });
        }
      }

      const layout = {
        paper_bgcolor: 'transparent',
        scene: {
          bgcolor: '#0a0e14',
          xaxis: { title: param2, gridcolor: '#1f2937', color: '#6b7280', tickfont: { size: 9 } },
          yaxis: { title: param1, gridcolor: '#1f2937', color: '#6b7280', tickfont: { size: 9 } },
          zaxis: { title: metric, gridcolor: '#1f2937', color: '#6b7280', tickfont: { size: 9 } },
          camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } },
        },
        margin: { l: 0, r: 0, t: 20, b: 0 },
        font: { family: 'Inter, sans-serif', color: '#9ca3af', size: 10 },
      };
      Plotly.react(ref.current, traces, layout, { responsive: true, displayModeBar: false });
    });
  }, [results, param1, param2, metric, robustMode]);

  return <div ref={ref} className="w-full h-full" />;
}

// ── 2D Heatmap (2 params) ─────────────────────────────────────────────────────
function Heatmap2D({ results, param1, param2, metric, robustMode }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !results.length) return;

    const p1Vals = [...new Set(results.map(r => r[param1]))].sort((a, b) => a - b);
    const p2Vals = [...new Set(results.map(r => r[param2]))].sort((a, b) => a - b);

    const lookup = (p1, p2) => results.find(r => r[param1] === p1 && r[param2] === p2);

    const zMatrix = p1Vals.map(p1 => p2Vals.map(p2 => lookup(p1, p2)?.[metric] ?? null));
    const rMatrix = p1Vals.map(p1 => p2Vals.map(p2 => {
      const r = lookup(p1, p2);
      return r ? (r.robustness ?? 0.5) : null;
    }));

    const colorData = robustMode ? rMatrix : zMatrix;
    const colorscale = robustMode ? ROBUST_COLORSCALE : 'RdYlGn';
    const cbarTitle  = robustMode ? 'Robustness' : metric;

    import('plotly.js-dist-min').then(P => {
      const Plotly = P.default ?? P;

      const hm = {
        type: 'heatmap',
        x: p2Vals.map(String), y: p1Vals.map(String),
        z: colorData,
        colorscale,
        cmin: robustMode ? 0 : undefined,
        cmax: robustMode ? 1 : undefined,
        colorbar: { title: { text: cbarTitle, font: { size: 10 } }, thickness: 12, tickfont: { size: 9 } },
        hovertemplate: robustMode
          ? `${param1}=%{y}<br>${param2}=%{x}<br>Robustness=%{z:.2f}<extra></extra>`
          : `${param1}=%{y}<br>${param2}=%{x}<br>${metric}=%{z:.3f}<extra></extra>`,
        // Text overlay: show metric value on each cell
        text: p1Vals.map(p1 => p2Vals.map(p2 => {
          const r = lookup(p1, p2);
          return r ? (r[metric] ?? 0).toFixed(2) : '';
        })),
        texttemplate: robustMode ? '%{text}' : '',
        textfont: { size: 8, color: '#e5e7eb' },
      };
      const layout = {
        paper_bgcolor: 'transparent', plot_bgcolor: '#0a0e14',
        font: { family: 'Inter, sans-serif', color: '#6b7280', size: 10 },
        margin: { l: 50, r: 20, t: 20, b: 50 },
        xaxis: { title: param2, gridcolor: '#1a1f2b', tickfont: { size: 9 } },
        yaxis: { title: param1, gridcolor: '#1a1f2b', tickfont: { size: 9 } },
      };
      Plotly.react(ref.current, [hm], layout, { responsive: true, displayModeBar: false });
    });
  }, [results, param1, param2, metric, robustMode]);

  return <div ref={ref} className="w-full h-full" />;
}

// ── Parallel Coordinates (N params) ──────────────────────────────────────────
function ParallelCoords({ results, paramKeys, primaryMetric }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !results.length) return;

    const allKeys = [...paramKeys, 'sharpe', 'total_return', 'win_rate', 'max_drawdown', 'trade_count'];
    const colorVals = results.map(r => r[primaryMetric] ?? 0);
    const minC = Math.min(...colorVals);
    const maxC = Math.max(...colorVals);

    const dimensions = allKeys.map(k => ({
      label: k,
      values: results.map(r => r[k] ?? 0),
      range: [Math.min(...results.map(r => r[k] ?? 0)), Math.max(...results.map(r => r[k] ?? 0))],
    }));

    import('plotly.js-dist-min').then(P => {
      const Plotly = P.default ?? P;
      const trace = {
        type: 'parcoords',
        line: {
          color: colorVals, colorscale: 'RdYlGn',
          cmin: minC, cmax: maxC,
          showscale: true,
          colorbar: { title: { text: primaryMetric, font: { size: 10 } }, thickness: 12, tickfont: { size: 9 } },
        },
        dimensions,
        labelangle: -20,
        labelfont: { size: 9, color: '#9ca3af' },
        tickfont: { size: 8, color: '#6b7280' },
      };
      const layout = {
        paper_bgcolor: 'transparent',
        plot_bgcolor: '#0a0e14',
        font: { family: 'Inter, sans-serif', color: '#9ca3af', size: 10 },
        margin: { l: 60, r: 60, t: 40, b: 20 },
      };
      Plotly.react(ref.current, [trace], layout, { responsive: true, displayModeBar: false });
    });
  }, [results, paramKeys, primaryMetric]);

  return <div ref={ref} className="w-full h-full" />;
}

// ── Sensitivity Chart: per-param 1D metric line ───────────────────────────────
// For each param, shows how the metric changes as that param varies,
// maximising over all other params. Dotted vertical = current strategy value.
function SensitivityChart({ results, paramKeys, metric, currentParams }) {
  const ref = useRef(null);
  const COLORS = ['#06b6d4', '#a78bfa', '#fb923c', '#34d399', '#f472b6', '#facc15'];

  const sensData = useMemo(() => {
    if (!results.length || !paramKeys.length) return [];
    return paramKeys.map(pk => {
      const vals = [...new Set(results.map(r => r[pk]))].sort((a, b) => a - b);
      const metrics = vals.map(v => {
        const subset = results.filter(r => Math.abs(r[pk] - v) < 1e-9);
        if (!subset.length) return null;
        return Math.max(...subset.map(r => r[metric] ?? -Infinity));
      });
      return { key: pk, vals, metrics };
    });
  }, [results, paramKeys, metric]);

  useEffect(() => {
    if (!ref.current || !sensData.length) return;
    import('plotly.js-dist-min').then(P => {
      const Plotly = P.default ?? P;
      const traces = sensData.map((s, i) => ({
        type: 'scatter', mode: 'lines+markers', name: s.key,
        x: s.vals, y: s.metrics,
        line: { color: COLORS[i % COLORS.length], width: 2 },
        marker: { size: 5, color: COLORS[i % COLORS.length] },
        hovertemplate: `${s.key}=%{x}<br>${metric}=%{y:.3f}<extra></extra>`,
      }));
      // Dotted vlines for current values
      const shapes = sensData.map((s, i) => {
        const cur = currentParams?.[s.key];
        if (cur === undefined || cur === null) return null;
        return {
          type: 'line', xref: 'x', yref: 'paper',
          x0: Number(cur), x1: Number(cur), y0: 0, y1: 1,
          line: { color: COLORS[i % COLORS.length], width: 1, dash: 'dot' },
        };
      }).filter(Boolean);

      const layout = {
        paper_bgcolor: 'transparent', plot_bgcolor: '#0a0e14',
        font: { family: 'Inter, sans-serif', color: '#9ca3af', size: 10 },
        margin: { l: 55, r: 20, t: 40, b: 50 },
        xaxis: { title: 'Parameter Value', gridcolor: '#1a1f2b', tickfont: { size: 9 }, color: '#6b7280' },
        yaxis: { title: metric, gridcolor: '#1a1f2b', tickfont: { size: 9 }, color: '#6b7280' },
        legend: { font: { size: 9 }, bgcolor: 'rgba(10,14,20,0.8)', bordercolor: '#1f2937', borderwidth: 1 },
        shapes,
        annotations: [{
          text: '점선 = 현재 전략값',
          xref: 'paper', yref: 'paper', x: 0.5, y: 1.04,
          showarrow: false, font: { size: 9, color: '#4b5563' }, xanchor: 'center',
        }],
      };
      Plotly.react(ref.current, traces, layout, { responsive: true, displayModeBar: false });
    });
  }, [sensData, metric, currentParams]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={ref} className="w-full h-full" />;
}

// Robustness bar chip
function RobustnessBar({ value }) {
  const pct   = Math.round((value ?? 0.5) * 100);
  const color  = value >= 0.7 ? '#22c55e' : value >= 0.4 ? '#eab308' : '#ef4444';
  const label  = value >= 0.7 ? 'Robust' : value >= 0.4 ? 'Moderate' : 'Fragile';
  const tcolor = value >= 0.7 ? 'text-green-400' : value >= 0.4 ? 'text-yellow-400' : 'text-red-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className={`text-[9px] tabular-nums ${tcolor}`}>{label}</span>
    </div>
  );
}

// ── Rankings Table ────────────────────────────────────────────────────────────
function RankingsTable({ results, paramKeys, primaryMetric, currentParams, onApplyParams }) {
  // Sort options
  const [sortBy, setSortBy] = useState('metric'); // 'metric' | 'robust' | 'combined'

  const scored = results.map(r => ({
    ...r,
    // combined = 60% metric rank + 40% robustness
    _combined: ((r[primaryMetric] ?? 0) / (Math.max(...results.map(x => Math.abs(x[primaryMetric] ?? 0))) || 1)) * 0.6
      + (r.robustness ?? 0.5) * 0.4,
  }));

  const top = [...scored].sort((a, b) => {
    if (sortBy === 'robust')   return (b.robustness ?? 0) - (a.robustness ?? 0);
    if (sortBy === 'combined') return b._combined - a._combined;
    if (primaryMetric === 'max_drawdown') return (a[primaryMetric] ?? 0) - (b[primaryMetric] ?? 0);
    return (b[primaryMetric] ?? 0) - (a[primaryMetric] ?? 0);
  }).slice(0, 30);

  const metricCols = ['sharpe', 'total_return', 'win_rate', 'max_drawdown', 'trade_count'];

  const isCurrentParams = (row) => {
    if (!currentParams) return false;
    return paramKeys.every(k => {
      const cur = Number(currentParams[k]);
      return !isNaN(cur) && Math.abs(row[k] - cur) < 1e-6;
    });
  };

  const buildParams = (row) => {
    const p = {};
    paramKeys.forEach(k => { p[k] = row[k]; });
    return p;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Sort controls */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-800 bg-[#0d0d12] shrink-0">
        <span className="text-[9px] text-gray-600 uppercase tracking-wider">정렬:</span>
        {[
          { id: 'metric',   label: '성과 기준'       },
          { id: 'robust',   label: '안정성 기준'     },
          { id: 'combined', label: '종합 (60/40)'  },
        ].map(opt => (
          <button
            key={opt.id}
            onClick={() => setSortBy(opt.id)}
            className={`px-2 py-0.5 text-[9px] rounded transition-colors ${
              sortBy === opt.id
                ? 'text-cyan-400 bg-cyan-400/10 border border-cyan-800/50'
                : 'text-gray-600 hover:text-gray-400'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <span className="ml-auto text-[9px] text-gray-700 tabular-nums">Top {top.length} / {results.length}</span>
      </div>
      <div className="flex-1 overflow-auto">
      <table className="w-full text-[10px]">
        <thead className="sticky top-0 bg-[#0d0d12] border-b border-gray-800">
          <tr>
            <th className="px-3 py-2 text-left text-gray-600 font-medium w-8">#</th>
            {paramKeys.map(k => (
              <th key={k} className="px-3 py-2 text-right text-cyan-600 font-medium">{k}</th>
            ))}
            {metricCols.map(k => (
              <th key={k} className={`px-3 py-2 text-right font-medium ${k === primaryMetric ? 'text-yellow-400' : 'text-gray-500'}`}>
                {k}
              </th>
            ))}
            <th className="px-3 py-2 text-left text-gray-600 font-medium">Robustness</th>
            {onApplyParams && <th className="px-3 py-2 w-14" />}
          </tr>
        </thead>
        <tbody>
          {top.map((row, i) => {
            const isCurrent = isCurrentParams(row);
            return (
              <tr
                key={i}
                className={`border-b border-gray-800/50 hover:bg-gray-800/20 group ${
                  isCurrent
                    ? 'bg-yellow-900/20 border-l-2 border-l-yellow-500/60'
                    : i === 0
                    ? 'bg-cyan-900/10'
                    : ''
                }`}
              >
                <td className="px-3 py-1.5 tabular-nums">
                  {isCurrent
                    ? <span className="text-yellow-400 font-bold">◆</span>
                    : <span className="text-gray-600">{i + 1}</span>
                  }
                </td>
                {paramKeys.map(k => (
                  <td key={k} className={`px-3 py-1.5 text-right tabular-nums font-mono ${isCurrent ? 'text-yellow-300 font-semibold' : 'text-white'}`}>
                    {row[k]}
                  </td>
                ))}
                <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${(row.sharpe ?? 0) >= 1 ? 'text-green-400' : (row.sharpe ?? 0) >= 0 ? 'text-gray-300' : 'text-red-400'}`}>
                  {(row.sharpe ?? 0).toFixed(2)}
                </td>
                <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${(row.total_return ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(row.total_return ?? 0) >= 0 ? '+' : ''}{(row.total_return ?? 0).toFixed(1)}%
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-gray-300">
                  {(row.win_rate ?? 0).toFixed(1)}%
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-red-400">
                  {(row.max_drawdown ?? 0).toFixed(1)}%
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">
                  {row.trade_count ?? 0}
                </td>
                <td className="px-3 py-1.5">
                  <RobustnessBar value={row.robustness ?? 0.5} />
                </td>
                {onApplyParams && (
                  <td className="px-2 py-1.5">
                    <button
                      onClick={() => onApplyParams(buildParams(row))}
                      className={`
                        px-2 py-0.5 text-[10px] font-medium rounded border transition-colors
                        opacity-0 group-hover:opacity-100
                        ${isCurrent
                          ? 'text-yellow-400 border-yellow-700/50 bg-yellow-900/20 hover:bg-yellow-900/40'
                          : 'text-green-400 border-green-800/50 bg-green-900/10 hover:bg-green-900/25'
                        }
                      `}
                    >
                      적용
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// ── factorId → possible backend factor names ──────────────────────────────────
// Mirrors FACTOR_BACKEND_EXPANSIONS in strategy/constants.js (subset used in backtests)
const FACTOR_BACKEND_NAMES = {
  ema:            ['EMA'],
  sma:            ['SMA'],
  rsi:            ['RSI'],
  macd:           ['MACD_LINE', 'MACD_SIGNAL', 'MACD_HIST'],
  bb:             ['BB_UPPER', 'BB_MID', 'BB_LOWER'],
  vwap_intraday:  ['VWAP'],
  per:            ['FUND_PE'],
  pbr:            ['FUND_PB'],
  roe:            ['FUND_ROE'],
  op_margin:      ['FUND_OP_MARGIN'],
  debt_ratio:     ['FUND_DE'],
  base_rate:      ['MACRO_BASE_RATE'],
  yield_2y:       ['MACRO_YIELD_2Y'],
  yield_10y:      ['MACRO_YIELD_10Y'],
  yield_curve:    ['MACRO_YIELD_CURVE'],
  cpi:            ['MACRO_CPI'],
  ppi:            ['MACRO_PPI'],
  dxy:            ['MACRO_DXY'],
  wti:            ['MACRO_WTI'],
  gold:           ['MACRO_GOLD'],
  opt_bs:         ['OPT_BS_PRICE', 'OPT_BS_DELTA', 'OPT_BS_GAMMA', 'OPT_BS_THETA', 'OPT_BS_VEGA'],
  opt_heston:     ['OPT_HESTON_PRICE', 'OPT_HESTON_DELTA'],
};

function paramsMatch(a = {}, b = {}) {
  const ak = Object.keys(a || {});
  const bk = Object.keys(b || {});
  if (ak.length !== bk.length) return false;
  return ak.every(k => String(a[k]) === String(b[k]));
}

// ── Extract scannable params using selectedFactors (named by varName) ─────────
// selectedFactors: [{factorId, varName, params}]  — from strategy.variables
// buyConds/sellConds: compiled condition JSON arrays (stored in strategy.parameters)
//
// Returns: { params: {varName_paramKey: value, threshold_N: value},
//            buyTemplate: [...], sellTemplate: [...] }
// where templates have ##varName_paramKey## / ##threshold_N## placeholders
function extractFactorScanParams(selectedFactors = [], buyConds = [], sellConds = []) {
  const scanParams = {};

  // Build factor instances: {varName, backendNames[], params}
  const instances = selectedFactors.map(sf => ({
    varName:      sf.varName,
    backendNames: FACTOR_BACKEND_NAMES[sf.factorId] || [sf.factorId.toUpperCase()],
    params:       sf.params || {},
  }));

  // Add each numeric factor param as a scan variable
  for (const inst of instances) {
    for (const [key, val] of Object.entries(inst.params)) {
      if (typeof val === 'number') {
        scanParams[`${inst.varName}_${key}`] = val;
      }
    }
  }

  // Build template from a factorDef: replace numeric params with ##varName_key## placeholders
  function templateFactorDef(fd) {
    if (!fd || fd.factor === 'VALUE') return fd;

    // Find matching factor instance by backend factor name + params equality
    const inst = instances.find(fi =>
      fi.backendNames.includes(fd.factor) && paramsMatch(fi.params, fd.params),
    );
    if (!inst) return fd;  // no match — keep unchanged

    const newParams = {};
    for (const [k, v] of Object.entries(fd.params || {})) {
      const plKey = `${inst.varName}_${k}`;
      newParams[k] = (typeof v === 'number' && plKey in scanParams)
        ? `##${plKey}##`
        : v;
    }
    return { ...fd, params: newParams };
  }

  // Build a descriptive threshold name from the condition context
  const usedThreshNames = {};
  function threshName(cond) {
    // Use the left factor's varName (or factor key) + op direction
    const leftFactor = cond.left?.factor || 'val';
    const inst = instances.find(fi => fi.backendNames.includes(leftFactor));
    const base = inst ? inst.varName : leftFactor.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const opTag = (cond.op || '').includes('>') ? 'gt'
                : (cond.op || '').includes('<') ? 'lt' : 'eq';
    let name = `${base}_${opTag}`;
    // Deduplicate: append _2, _3, etc. if already used
    if (name in usedThreshNames) {
      usedThreshNames[name]++;
      name = `${name}_${usedThreshNames[name]}`;
    } else {
      usedThreshNames[name] = 1;
    }
    return name;
  }

  function templateCond(cond) {
    const newCond = { ...cond };
    newCond.left = templateFactorDef(cond.left);
    if (cond.right?.factor === 'VALUE' && typeof cond.right.value === 'number') {
      const name = threshName(cond);
      scanParams[name] = cond.right.value;
      newCond.right = { factor: 'VALUE', value: `##${name}##` };
    } else {
      newCond.right = templateFactorDef(cond.right);
    }
    return newCond;
  }

  const buyTemplate  = (buyConds  || []).map(templateCond);
  const sellTemplate = (sellConds || []).map(templateCond);

  return { params: scanParams, buyTemplate, sellTemplate };
}

// ── Fallback: extract scannable params directly from conditions (no selectedFactors) ─
// Used when selectedFactors is unavailable (older saved strategies)
function extractCustomScanParams(buyConds = [], sellConds = []) {
  const params = {};
  const usedNames = {};

  function placeholder(baseName, value) {
    let name = baseName;
    if (name in params && params[name] !== value) {
      const count = (usedNames[baseName] = (usedNames[baseName] || 1) + 1);
      name = `${baseName}_${count}`;
    }
    usedNames[baseName] = usedNames[baseName] || 1;
    params[name] = value;
    return `##${name}##`;
  }

  function templateFactorDef(fd) {
    if (!fd || fd.factor === 'VALUE') return fd;
    const factorKey = fd.factor.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newParams = {};
    for (const [k, v] of Object.entries(fd.params || {})) {
      if (typeof v === 'number') newParams[k] = placeholder(`${factorKey}_${k}`, v);
      else newParams[k] = v;
    }
    return { ...fd, params: newParams };
  }

  const usedThreshNames = {};
  function threshName(cond) {
    const leftFactor = cond.left?.factor || 'val';
    const base = leftFactor.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const opTag = (cond.op || '').includes('>') ? 'gt'
                : (cond.op || '').includes('<') ? 'lt' : 'eq';
    let name = `${base}_${opTag}`;
    if (name in usedThreshNames) {
      usedThreshNames[name]++;
      name = `${name}_${usedThreshNames[name]}`;
    } else {
      usedThreshNames[name] = 1;
    }
    return name;
  }

  function templateCond(cond) {
    const newCond = { ...cond };
    newCond.left = templateFactorDef(cond.left);
    if (cond.right?.factor === 'VALUE' && typeof cond.right.value === 'number') {
      const name = threshName(cond);
      params[name] = cond.right.value;
      newCond.right = { factor: 'VALUE', value: `##${name}##` };
    } else {
      newCond.right = templateFactorDef(cond.right);
    }
    return newCond;
  }

  const buyTemplate  = (buyConds  || []).map(templateCond);
  const sellTemplate = (sellConds || []).map(templateCond);
  return { params, buyTemplate, sellTemplate };
}

// ── Range builder: center around current param value ─────────────────────────
function buildCenteredRange(currentVal, preset) {
  const { min: pMin, max: pMax, step } = preset;
  const span = pMax - pMin;
  const half = span / 2;
  const snap = (v) => Math.round(v / step) * step;
  return {
    min:  Math.max(snap(pMin * 0.4), snap(currentVal - half)),
    max:  Math.min(snap(pMax * 1.5), snap(currentVal + half)),
    step,
  };
}

// ── Scan mode definitions ────────────────────────────────────────────────────
const SCAN_MODES = [
  { id: 'quick',    label: 'Quick',    desc: 'Step ×2  (빠른 탐색)',  stepMult: 2    },
  { id: 'standard', label: 'Standard', desc: '기본 Step (균형)',       stepMult: 1    },
  { id: 'fine',     label: 'Fine',     desc: 'Step ÷2  (정밀 탐색)', stepMult: 0.5  },
];

// ── Smart range: auto min/max/step based on value semantics ──────────────────
// - Threshold / float values (RSI < 30, multiplier 1.5) → float-safe range
// - Integer period params (EMA 20, RSI 14) → integer-friendly range
// - Macro-scale values (gold 1800, CPI 300, DXY 105) → ±20% narrow band
function smartRange(val, name) {
  const v   = Number(val);
  const isThresh = /_(?:gt|lt|eq)/.test(name);
  const looksFloat  = !Number.isInteger(v) || isThresh;

  // Large-scale macro values (gold ~1800, CPI ~300, DXY ~105, WTI ~75, etc.)
  // Use ±20% band with smart step sizing
  if (isThresh && Math.abs(v) > 50) {
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(v) || 1)));
    const step = Math.max(0.5, Math.round(magnitude / 10 * 2) / 2);
    return {
      min:  Math.round(v * 0.8 / step) * step,
      max:  Math.round(v * 1.2 / step) * step,
      step,
    };
  }

  if (looksFloat) {
    const step = v < 5 ? 0.5 : v < 20 ? 1 : 2;
    return {
      min:  Math.max(0, Math.round(v * 0.5 * 2) / 2),
      max:  Math.round(v * 1.5 * 2) / 2,
      step,
    };
  }
  // Integer period
  const step = v <= 10 ? 1 : v <= 30 ? 2 : v <= 100 ? 5 : 10;
  return {
    min:  Math.max(2, Math.round(v * 0.4)),
    max:  Math.min(500, Math.round(v * 2.5)),
    step,
  };
}

// ── Main Component ────────────────────────────────────────────────────────────
// strategyCtx : { type, params } — 선택된 전략의 타입 + 저장된 파라미터 값 (부모에서 전달)
// commission  : 부모 ExecutionSettings의 commission 값 그대로 사용
export default function StrategyScanner3D({ ticker, startDate, endDate, strategyCtx, strategyTypes, commission: commissionProp = 0, onApplyParams }) {
  const [paramRanges, setParamRanges] = useState({});
  const [metric,      setMetric]      = useState('sharpe');
  const [loading,     setLoading]     = useState(false);
  const [results,     setResults]     = useState([]);    // raw results (no robustness)
  const [summary,     setSummary]     = useState(null);
  const [viewTab,     setViewTab]     = useState('surface');
  const [configOpen,  setConfigOpen]  = useState(true);
  const [robustMode,  setRobustMode]  = useState(false);
  const [scanMode,    setScanMode]    = useState('standard');  // quick | standard | fine
  const [vizP1,       setVizP1]       = useState(null);        // 3D viz param 1 (null = auto)
  const [vizP2,       setVizP2]       = useState(null);        // 3D viz param 2 (null = auto)

  // ── 백엔드 STRATEGY_META → presetMap ─────────────────────────────────────
  const presetMap = useMemo(() => {
    const map = {};
    (strategyTypes || []).forEach(s => {
      if (s.key === 'custom') return;
      map[s.key] = {
        label:    s.label,
        group:    s.group,
        slowScan: s.slow_scan,
        desc:     s.desc,
        params:   (s.params || []).map(p => ({
          key: p.key, label: p.label,
          min: p.min, max: p.max, step: p.step,
        })),
      };
    });
    return map;
  }, [strategyTypes]);

  // ── 전략 타입은 strategyCtx에서 직접 읽음 (내부 state 없음) ──────────────
  const stratType     = strategyCtx?.type;
  const currentParams = strategyCtx?.params || {};
  const safePreset    = (stratType && presetMap[stratType]) ? presetMap[stratType] : null;
  const isPresetType  = !!safePreset;                         // 프리셋 전략 (ema_cross, rsi 등)
  const isCustomType  = stratType === 'custom';               // Custom 블록 전략

  // Custom 전략: 스캔 파라미터 추출
  // selectedFactors가 있으면 varName 기반 네이밍 (rsi1_period 등),
  // 없으면 조건 JSON에서 직접 추출 (구형 전략 호환)
  const customScan = useMemo(() => {
    if (!isCustomType) return null;
    const sf = strategyCtx?.selectedFactors || [];
    if (sf.length > 0) {
      return extractFactorScanParams(
        sf,
        strategyCtx?.buy_conditions,
        strategyCtx?.sell_conditions,
      );
    }
    return extractCustomScanParams(
      strategyCtx?.buy_conditions,
      strategyCtx?.sell_conditions,
    );
  }, [isCustomType, strategyCtx]);

  // 스캔 불가 (custom도 아니고 presetMap에도 없는 타입)
  const isUnscannable = !isPresetType && !isCustomType;

  // ── strategyCtx가 바뀔 때마다 스마트 범위로 재설정 (결과는 유지) ─────────
  useEffect(() => {
    if (!strategyCtx) return;
    // 전략 타입이 바뀐 경우에만 결과 초기화 (단순 파라미터 변경 시 결과 유지)
    setVizP1(null);
    setVizP2(null);

    if (isPresetType && safePreset) {
      const ranges = {};
      safePreset.params.forEach(pd => {
        const curVal = currentParams[pd.key];
        ranges[pd.key] = (curVal !== undefined && curVal !== null)
          ? buildCenteredRange(Number(curVal), pd)
          : { min: pd.min, max: pd.max, step: pd.step };
      });
      setParamRanges(ranges);
    } else if (isCustomType) {
      const sf = strategyCtx?.selectedFactors || [];
      const extracted = sf.length > 0
        ? extractFactorScanParams(sf, strategyCtx?.buy_conditions, strategyCtx?.sell_conditions)
        : extractCustomScanParams(strategyCtx?.buy_conditions, strategyCtx?.sell_conditions);
      const ranges = {};
      Object.entries(extracted.params).forEach(([name, val]) => {
        ranges[name] = smartRange(val, name);
      });
      setParamRanges(ranges);
    }
  }, [strategyCtx]); // eslint-disable-line react-hooks/exhaustive-deps

  // 범위를 스마트 범위로 초기화 (결과는 유지)
  const resetRanges = useCallback(() => {
    if (isPresetType && safePreset) {
      const ranges = {};
      safePreset.params.forEach(pd => {
        const curVal = currentParams[pd.key];
        ranges[pd.key] = (curVal !== undefined && curVal !== null)
          ? buildCenteredRange(Number(curVal), pd)
          : { min: pd.min, max: pd.max, step: pd.step };
      });
      setParamRanges(ranges);
    } else if (isCustomType && customScan) {
      const ranges = {};
      Object.entries(customScan.params).forEach(([name, val]) => {
        ranges[name] = smartRange(val, name);
      });
      setParamRanges(ranges);
    }
  }, [isPresetType, isCustomType, safePreset, currentParams, customScan]);

  const updateRange = (key, field, val) =>
    setParamRanges(prev => ({ ...prev, [key]: { ...prev[key], [field]: Number(val) } }));

  // Effective ranges: apply scan mode step multiplier
  const effectiveRanges = useMemo(() => {
    const mult = SCAN_MODES.find(m => m.id === scanMode)?.stepMult ?? 1;
    if (mult === 1) return paramRanges;
    return Object.fromEntries(
      Object.entries(paramRanges).map(([k, r]) => [k, { ...r, step: Math.max(0.5, r.step * mult) }])
    );
  }, [paramRanges, scanMode]);

  const combCount = Object.keys(effectiveRanges).length ? countCombinations(effectiveRanges) : 0;

  // All scan params (preset order / custom extraction order)
  const allParamKeys = isPresetType
    ? (safePreset?.params.map(p => p.key) ?? [])
    : Object.keys(customScan?.params ?? {});

  // 3D viz: user-selected params (default: first two)
  const activeVizP1 = vizP1 && allParamKeys.includes(vizP1) ? vizP1 : allParamKeys[0] ?? null;
  const activeVizP2 = vizP2 && allParamKeys.includes(vizP2) ? vizP2 : (allParamKeys[1] ?? allParamKeys[0] ?? null);
  const is2Params   = allParamKeys.length >= 2;

  // ── Robustness scores (computed after scan results arrive) ─────────────────
  const scoredResults = useMemo(() =>
    results.length ? computeRobustness(results, allParamKeys, metric) : [],
  [results, allParamKeys, metric]); // eslint-disable-line react-hooks/exhaustive-deps

  // Best robust optimum: high metric AND high robustness
  const bestRobust = useMemo(() => {
    if (!scoredResults.length) return null;
    const withMetric = scoredResults.filter(r => (r[metric] ?? 0) > 0);
    if (!withMetric.length) return null;
    const maxM = Math.max(...withMetric.map(r => r[metric]));
    const best = withMetric.reduce((acc, r) => {
      const score = (r[metric] / maxM) * 0.6 + (r.robustness ?? 0) * 0.4;
      return score > acc.score ? { r, score } : acc;
    }, { r: null, score: -Infinity });
    return best.r;
  }, [scoredResults, metric]);

  const handleScan = useCallback(async () => {
    if (!ticker)       { toast.error('Ticker를 먼저 설정하세요'); return; }
    if (isUnscannable) { toast.error('이 전략 타입은 파라미터 스캔을 지원하지 않습니다'); return; }
    if (isCustomType && (!customScan || Object.keys(customScan.params).length === 0)) {
      toast.error('스캔 가능한 파라미터가 없습니다. 조건에 숫자 파라미터를 추가하세요.'); return;
    }
    const HARD_CAP = 100_000_000;  // 1억
    const maxCombos = safePreset?.slowScan ? 10_000 : HARD_CAP;
    if (combCount > maxCombos) {
      toast.error(`조합 수 초과 (${combCount.toLocaleString()} > 최대 ${maxCombos.toLocaleString()}). FFT 전략은 범위를 줄여주세요.`);
      return;
    }
    if (combCount > 1_000_000) {
      const ok = window.confirm(
        `${combCount.toLocaleString()}개 조합을 스캔하려 합니다.\n` +
        `대규모 시뮬레이션은 수 분 ~ 수 시간이 걸릴 수 있습니다. 계속하시겠습니까?`
      );
      if (!ok) return;
    }
    setLoading(true);
    setResults([]);
    try {
      const payload = {
        ticker,
        start_date:      startDate,
        end_date:        endDate,
        strategy_type:   stratType,
        param_ranges:    effectiveRanges,
        stop_loss_pct:   0,
        take_profit_pct: 0,
        initial_capital: 10000,
        commission_pct:  commissionProp,
      };
      if (isCustomType && customScan) {
        payload.buy_conditions  = customScan.buyTemplate;
        payload.sell_conditions = customScan.sellTemplate;
        payload.buy_logic       = strategyCtx?.buy_logic  || 'AND';
        payload.sell_logic      = strategyCtx?.sell_logic || 'OR';
      }
      const res = await quantAPI.scan(payload);
      const data = res.data;
      setResults(data.results || []);
      setSummary({ best: data.best, total: data.total_combinations });
      setConfigOpen(false);
      toast.success(`${data.total_combinations}개 조합 완료 — Best ${metric}: ${data.best?.[metric]?.toFixed(2) ?? 'N/A'}`);
    } catch (err) {
      toast.error(err.message || '스캔 실패');
    } finally {
      setLoading(false);
    }
  }, [ticker, startDate, endDate, stratType, effectiveRanges, commissionProp, combCount,
      isUnscannable, isCustomType, customScan, safePreset, strategyCtx, scanMode, metric]);

  const vizTabs = is2Params
    ? [
        { id: 'surface',  label: '3D Surface'      },
        { id: 'heatmap',  label: 'Heatmap'          },
        { id: 'parallel', label: 'Parallel Coords'  },
        { id: 'sensitivity', label: '민감도 분석'   },
        { id: 'rank',     label: 'Rankings'          },
      ]
    : [
        { id: 'parallel',    label: 'Parallel Coords' },
        { id: 'sensitivity', label: '민감도 분석'     },
        { id: 'rank',        label: 'Rankings'         },
      ];

  useEffect(() => {
    if (!is2Params && (viewTab === 'surface' || viewTab === 'heatmap')) setViewTab('parallel');
  }, [is2Params, viewTab]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f]">

      {/* ── Config panel ─────────────────────────────────────────────────── */}
      <div className="border-b border-gray-800 bg-[#0d0d12] shrink-0">

        {/* 헤더 — 전략명 고정 표시 + 조합 수 + 토글 */}
        <button
          onClick={() => setConfigOpen(o => !o)}
          className="flex items-center gap-2 w-full px-4 py-2.5 text-left hover:bg-gray-800/20 transition-colors"
        >
          <span className="text-xs font-semibold text-white">
            {safePreset ? safePreset.label : (stratType || '전략')} — 파라미터 최적화
          </span>
          {combCount > 0 && (
            <span className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded ${
              combCount > 1_000_000 ? 'text-red-400 bg-red-900/20'
              : combCount > 10_000  ? 'text-amber-400 bg-amber-900/20'
              : 'text-gray-500 bg-gray-800/50'
            }`}>
              {combCount.toLocaleString()} 조합
            </span>
          )}
          <div className="ml-auto text-gray-600">
            {configOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </div>
        </button>

        {configOpen && (
          <div className="px-4 pb-4 space-y-3">

            {isUnscannable ? (
              <div className="px-3 py-3 bg-gray-800/30 border border-gray-700/40 rounded text-[11px] text-gray-500 leading-relaxed">
                이 전략 타입(<span className="text-gray-400 font-mono">{stratType}</span>)은 스캔을 지원하지 않습니다.
              </div>
            ) : (
              <>
                {/* 전략 설명 (Heston 등) */}
                {safePreset?.desc && (
                  <div className={`px-3 py-2 rounded text-[10px] leading-relaxed ${
                    safePreset?.slowScan
                      ? 'bg-amber-900/15 border border-amber-700/30 text-amber-400/90'
                      : 'bg-purple-900/10 border border-purple-800/30 text-purple-300/80'
                  }`}>
                    {safePreset?.slowScan && <span className="font-semibold">⚠ FFT 연산 전략 — 조합 수를 1만 개 이하로 권장합니다.<br /></span>}
                    {safePreset?.desc}
                  </div>
                )}

                {/* 파라미터별 현재값 + 스캔 범위 설정 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-gray-600 uppercase tracking-wider">
                      파라미터 스캔 범위
                      {isCustomType && customScan && (
                        <span className="ml-2 text-purple-600 normal-case tracking-normal font-normal">
                          {strategyCtx?.selectedFactors?.length > 0
                            ? `— ${strategyCtx.selectedFactors.length}개 변수 · ${Object.keys(customScan.params).length}개 파라미터`
                            : `— 조건에서 ${Object.keys(customScan.params).length}개 추출됨`
                          }
                        </span>
                      )}
                    </span>
                    <button onClick={resetRanges} className="text-[9px] text-gray-700 hover:text-cyan-600 transition-colors">
                      현재값 중심으로 초기화
                    </button>
                  </div>

                  {/* 프리셋 전략 파라미터 */}
                  {isPresetType && safePreset.params.map(pd => {
                    const r         = paramRanges[pd.key] || { min: pd.min, max: pd.max, step: pd.step };
                    const er        = effectiveRanges[pd.key] || r;
                    const curVal    = currentParams[pd.key];
                    const hasCur    = curVal !== undefined && curVal !== null;
                    const inRange   = hasCur && Number(curVal) >= r.min && Number(curVal) <= r.max;
                    const stepCount = Math.max(1, Math.floor((er.max - er.min) / (er.step || 1)) + 1);
                    return (
                      <div key={pd.key} className="bg-[#060608] border border-gray-800 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-white font-medium">{pd.label}</span>
                          {hasCur
                            ? <span className={`text-[10px] font-mono tabular-nums font-semibold ${inRange ? 'text-cyan-400' : 'text-amber-400'}`}>
                                현재: {curVal}
                                {!inRange && <span className="text-amber-500/70 font-normal ml-1">⚠ 범위 밖</span>}
                              </span>
                            : <span className="text-[10px] text-gray-700">현재값 없음</span>
                          }
                        </div>
                        <div className="flex items-center gap-2">
                          <Input label="Min"  type="number" value={r.min}  onChange={v => updateRange(pd.key, 'min', v)} />
                          <Input label="Max"  type="number" value={r.max}  onChange={v => updateRange(pd.key, 'max', v)} />
                          <Input label="Step" type="number" value={r.step} onChange={v => updateRange(pd.key, 'step', v)} />
                          <div className="flex flex-col self-end pb-0.5">
                            <span className="text-[9px] text-gray-700 tabular-nums">{stepCount} 값</span>
                            {scanMode !== 'standard' && (
                              <span className="text-[8px] text-cyan-700 tabular-nums">eff. step={er.step}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Custom 전략: 변수 파라미터 */}
                  {isCustomType && customScan && Object.keys(customScan.params).length === 0 && (
                    <div className="px-3 py-3 bg-gray-800/30 border border-gray-700/40 rounded text-[11px] text-gray-500 leading-relaxed">
                      스캔 가능한 파라미터가 없습니다.<br />
                      <span className="text-gray-600">Strategy Builder Variables 패널에서 RSI, EMA 등 인디케이터를 추가하고, 조건에 숫자 임계값을 설정하세요.</span>
                    </div>
                  )}
                  {isCustomType && customScan && Object.entries(customScan.params).map(([name, curVal]) => {
                    const r         = paramRanges[name] || smartRange(curVal, name);
                    const er        = effectiveRanges[name] || r;
                    const inRange   = Number(curVal) >= r.min && Number(curVal) <= r.max;
                    const stepCount = Math.max(1, Math.floor((er.max - er.min) / (er.step || 0.5)) + 1);
                    // Label: "rsi1_period" → varName badge + param label
                    //        "threshold_0" → Threshold badge + index
                    const isThreshold = /_(?:gt|lt|eq)(?:_\d+)?$/.test(name);
                    const parts = name.split('_');
                    // For threshold: "gold_px_gt" → varName="gold_px", direction="gt"
                    //                "rsi14_lt"   → varName="rsi14",   direction="lt"
                    // For varName-based: "rsi14_period" → varName="rsi14", param="period"
                    const dirMatch = name.match(/^(.+)_(gt|lt|eq)(?:_\d+)?$/);
                    const varName  = isThreshold ? (dirMatch?.[1] || name) : parts.slice(0, -1).join('_');
                    const paramKey = isThreshold ? (dirMatch?.[2] || '') : parts[parts.length - 1];
                    const paramLabel = paramKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    return (
                      <div key={name} className="bg-[#060608] border border-gray-800 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isThreshold ? (
                              <span className="px-1.5 py-0.5 text-[9px] rounded bg-orange-900/30 border border-orange-700/40 text-orange-400 font-mono font-medium">
                                {varName}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 text-[9px] rounded bg-cyan-900/30 border border-cyan-700/40 text-cyan-400 font-mono font-medium">
                                {varName}
                              </span>
                            )}
                            <span className="text-[11px] text-white font-medium">
                              {isThreshold
                                ? `${paramKey === 'gt' ? '>' : paramKey === 'lt' ? '<' : '='} 임계값`
                                : paramLabel}
                            </span>
                          </div>
                          <span className={`text-[10px] font-mono tabular-nums font-semibold ${inRange ? 'text-cyan-400' : 'text-amber-400'}`}>
                            현재: {curVal}
                            {!inRange && <span className="text-amber-500/70 font-normal ml-1">⚠ 범위 밖</span>}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input label="Min"  type="number" value={r.min}  onChange={v => updateRange(name, 'min', v)} />
                          <Input label="Max"  type="number" value={r.max}  onChange={v => updateRange(name, 'max', v)} />
                          <Input label="Step" type="number" value={r.step} onChange={v => updateRange(name, 'step', v)} />
                          <div className="flex flex-col self-end pb-0.5">
                            <span className="text-[9px] text-gray-700 tabular-nums">{stepCount} 값</span>
                            {scanMode !== 'standard' && (
                              <span className="text-[8px] text-cyan-700 tabular-nums">eff. step={er.step}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 스캔 모드 + 최적화 기준 */}
                <div className="flex items-center gap-3 flex-wrap pt-1">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-gray-600 uppercase tracking-wider">스캔 모드</span>
                    <div className="flex items-center gap-1">
                      {SCAN_MODES.map(m => (
                        <button
                          key={m.id}
                          onClick={() => setScanMode(m.id)}
                          title={m.desc}
                          className={`px-2.5 py-1 text-[10px] font-medium rounded border transition-colors ${
                            scanMode === m.id
                              ? 'text-cyan-300 border-cyan-700/60 bg-cyan-900/25'
                              : 'text-gray-600 border-gray-700/50 hover:text-gray-400 hover:border-gray-600'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                      <span className="text-[9px] text-gray-700 ml-1 tabular-nums">
                        {SCAN_MODES.find(m => m.id === scanMode)?.desc}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 ml-auto">
                    <span className="text-[9px] text-gray-600 uppercase tracking-wider">최적화 기준</span>
                    <select
                      value={metric}
                      onChange={e => setMetric(e.target.value)}
                      className="px-2 py-1.5 bg-[#060608] border border-gray-700/60 rounded text-[11px] text-white focus:outline-none focus:border-cyan-600"
                    >
                      {METRIC_OPTIONS.map(m => (
                        <option key={m.key} value={m.key}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleScan}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-xs font-semibold rounded transition-colors"
                >
                  {loading
                    ? <><span className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />스캔 중 ({combCount.toLocaleString()} 조합)…</>
                    : <><Play size={12} />최적 파라미터 스캔 ({combCount.toLocaleString()} 조합)</>
                  }
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Results area ─────────────────────────────────────────────────── */}
      {results.length > 0 && (
        <>
          {/* Best combo strip — shows current→best per param */}
          {summary?.best && (
            <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800 bg-[#0d0d12] shrink-0 flex-wrap">
              <span className="text-[10px] text-yellow-500 font-semibold shrink-0">Best</span>
              {allParamKeys.map(k => {
                const cur = currentParams[k];
                const best = summary.best[k];
                const changed = cur !== undefined && cur !== null && Number(cur) !== Number(best);
                return (
                  <span key={k} className="text-[10px] flex items-center gap-1">
                    <span className="text-gray-600">{k}=</span>
                    {changed && (
                      <>
                        <span className="text-gray-600 font-mono tabular-nums line-through">{cur}</span>
                        <span className="text-gray-600">→</span>
                      </>
                    )}
                    <span className={`font-mono tabular-nums font-semibold ${changed ? 'text-yellow-300' : 'text-cyan-300'}`}>{best}</span>
                  </span>
                );
              })}
              <span className="text-[10px] text-gray-700 mx-1">|</span>
              <span className="text-[10px]">
                <span className="text-gray-600">Sharpe </span>
                <span className="text-yellow-300 font-semibold tabular-nums">{summary.best.sharpe?.toFixed(2)}</span>
              </span>
              <span className="text-[10px]">
                <span className="text-gray-600">Return </span>
                <span className={`font-semibold tabular-nums ${(summary.best.total_return ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(summary.best.total_return ?? 0) >= 0 ? '+' : ''}{summary.best.total_return?.toFixed(1)}%
                </span>
              </span>
              <span className="text-[10px]">
                <span className="text-gray-600">Win </span>
                <span className="text-gray-300 tabular-nums">{summary.best.win_rate?.toFixed(1)}%</span>
              </span>
              {onApplyParams && (
                <button
                  onClick={() => {
                    const p = {};
                    allParamKeys.forEach(k => { p[k] = summary.best[k]; });
                    onApplyParams(p);
                  }}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-[11px] font-semibold rounded transition-colors shrink-0"
                  title="전략 파라미터를 업데이트하고 백테스트를 즉시 재실행합니다 → Performance 탭으로 자동 이동"
                >
                  <Play size={11} /> Best 값으로 백테스트
                </button>
              )}
            </div>
          )}

          {/* Viz tab bar + robustness toggle + 3D param selector */}
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-800 bg-[#0d0d12] shrink-0 flex-wrap">
            {vizTabs.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setViewTab(id)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded transition-colors ${
                  viewTab === id
                    ? 'text-cyan-400 bg-cyan-400/10'
                    : 'text-gray-500 hover:text-white hover:bg-gray-800'
                }`}
              >
                {label}
              </button>
            ))}

            {/* 3D param selector — only when >2 params and viewing surface/heatmap */}
            {allParamKeys.length > 2 && (viewTab === 'surface' || viewTab === 'heatmap') && (
              <div className="flex items-center gap-1 ml-2 pl-2 border-l border-gray-800">
                <span className="text-[9px] text-gray-600">X축</span>
                <select
                  value={activeVizP2}
                  onChange={e => setVizP2(e.target.value)}
                  className="px-1.5 py-0.5 bg-[#060608] border border-gray-700 rounded text-[10px] text-cyan-300 focus:outline-none focus:border-cyan-600"
                >
                  {allParamKeys.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <span className="text-[9px] text-gray-600">Y축</span>
                <select
                  value={activeVizP1}
                  onChange={e => setVizP1(e.target.value)}
                  className="px-1.5 py-0.5 bg-[#060608] border border-gray-700 rounded text-[10px] text-purple-300 focus:outline-none focus:border-purple-600"
                >
                  {allParamKeys.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              {(viewTab === 'surface' || viewTab === 'heatmap' || viewTab === 'rank') && (
                <button
                  onClick={() => setRobustMode(v => !v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium rounded border transition-colors ${
                    robustMode
                      ? 'text-green-400 border-green-700/50 bg-green-900/20'
                      : 'text-gray-600 border-gray-700/50 hover:text-gray-400'
                  }`}
                  title="Robust Mode: 안정적인 파라미터 구간(plateau)을 초록, 불안정한 피크(overfit 위험)를 빨강으로 표시"
                >
                  {robustMode ? '🟢' : '⬡'} Robust {robustMode ? 'ON' : 'OFF'}
                </button>
              )}
              <span className="text-[10px] text-gray-700 tabular-nums">
                {results.length} 조합
              </span>
            </div>
          </div>

          {/* Best Robust strip (shown when robustMode is on) */}
          {robustMode && bestRobust && (
            <div className="flex items-center gap-3 px-4 py-1.5 border-b border-green-900/30 bg-green-900/[0.06] shrink-0 flex-wrap">
              <span className="text-[10px] text-green-400 font-semibold shrink-0">🟢 Best Robust</span>
              {allParamKeys.map(k => (
                <span key={k} className="text-[10px]">
                  <span className="text-gray-600">{k}=</span>
                  <span className="text-green-300 font-mono tabular-nums font-semibold">{bestRobust[k]}</span>
                </span>
              ))}
              <span className="text-[10px]">
                <span className="text-gray-600">Sharpe </span>
                <span className="text-green-300 font-semibold">{bestRobust.sharpe?.toFixed(2)}</span>
              </span>
              <span className="text-[10px]">
                <span className="text-gray-600">Robustness </span>
                <span className="text-green-300 font-semibold">{((bestRobust.robustness ?? 0) * 100).toFixed(0)}%</span>
              </span>
              {onApplyParams && (
                <button
                  onClick={() => { const p = {}; allParamKeys.forEach(k => { p[k] = bestRobust[k]; }); onApplyParams(p); }}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-green-800 hover:bg-green-700 text-white text-[11px] font-semibold rounded transition-colors shrink-0"
                >
                  <Play size={10} /> Robust 파라미터 적용
                </button>
              )}
            </div>
          )}

          {/* Chart area */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {viewTab === 'surface' && is2Params && activeVizP1 && activeVizP2 && (
              <Surface3D results={scoredResults} param1={activeVizP1} param2={activeVizP2} metric={metric} robustMode={robustMode} />
            )}
            {viewTab === 'heatmap' && is2Params && activeVizP1 && activeVizP2 && (
              <Heatmap2D results={scoredResults} param1={activeVizP1} param2={activeVizP2} metric={metric} robustMode={robustMode} />
            )}
            {viewTab === 'parallel' && (
              <ParallelCoords results={scoredResults} paramKeys={allParamKeys} primaryMetric={metric} />
            )}
            {viewTab === 'sensitivity' && (
              <SensitivityChart results={scoredResults} paramKeys={allParamKeys} metric={metric} currentParams={currentParams} />
            )}
            {viewTab === 'rank' && (
              <RankingsTable results={scoredResults} paramKeys={allParamKeys} primaryMetric={metric} currentParams={currentParams} onApplyParams={onApplyParams} />
            )}
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && results.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 text-gray-700">
          <div className="text-3xl mb-3 opacity-20">⬡</div>
          {strategyCtx ? (
            <div className="space-y-2 max-w-xs">
              <p className="text-xs text-gray-500 leading-relaxed">
                <span className="text-cyan-700 font-medium">{strategyCtx.type}</span> 전략이 백테스트에서 동기화됨 —<br />
                파라미터 범위를 확인하고 <span className="text-cyan-700">Run Scan</span>을 클릭하세요
              </p>
              <p className="text-[10px] text-gray-700 leading-relaxed">
                최적 파라미터를 찾으면 <span className="text-green-700">백테스트 재실행</span>으로<br />
                Performance 탭에서 개선 결과를 바로 확인할 수 있습니다
              </p>
            </div>
          ) : (
            <p className="text-xs leading-relaxed max-w-xs">
              파라미터 범위를 설정하고 Run Scan을 클릭하면<br />
              <span className="text-cyan-800">3D Surface · Heatmap · Parallel Coords</span>로<br />
              전략의 파라미터 민감도를 분석합니다
            </p>
          )}
        </div>
      )}
    </div>
  );
}
