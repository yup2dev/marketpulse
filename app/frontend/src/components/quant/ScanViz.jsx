import React, { useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { BarChart2 } from 'lucide-react';

/**
 * ScanViz — 파라미터 스캔 결과 시각화
 *
 * 2개 파라미터 → 2D Heatmap
 * 3개 파라미터 → 3D Scatter + 슬라이스 Heatmap
 *
 * props:
 *   results  : scan results array (each row has param cols + sharpe, total_return, win_rate …)
 *   paramKeys: string[]  e.g. ['fast','slow'] or ['fast','slow','signal']
 */
const METRIC_OPTIONS = [
  { key: 'sharpe',           label: 'Sharpe Ratio' },
  { key: 'total_return',     label: 'Total Return %' },
  { key: 'annualized_return',label: 'Ann. Return %' },
  { key: 'win_rate',         label: 'Win Rate %' },
  { key: 'max_drawdown',     label: 'Max Drawdown %' },
];

const PLOTLY_LAYOUT_BASE = {
  paper_bgcolor: '#0d0d12',
  plot_bgcolor:  '#0d0d12',
  font: { color: '#aaa', size: 10 },
  margin: { l: 50, r: 20, t: 36, b: 50 },
};

const AXIS_STYLE = {
  gridcolor:    '#1e1e2a',
  linecolor:    '#333',
  tickfont:     { color: '#888', size: 9 },
  title:        { font: { color: '#888', size: 10 } },
  zerolinecolor:'#333',
};

// ── colorscale helper ────────────────────────────────────────────────────────
const RDYLGN = [
  [0,   '#dc2626'],
  [0.3, '#ca8a04'],
  [0.5, '#facc15'],
  [0.7, '#4ade80'],
  [1,   '#22d3ee'],
];

function metricColor(key) {
  // For drawdown, invert the scale
  if (key === 'max_drawdown') return RDYLGN.map(([v, c]) => [1 - v, c]).sort((a, b) => a[0] - b[0]);
  return RDYLGN;
}

// ── 2D Heatmap ────────────────────────────────────────────────────────────────
const Heatmap2D = ({ results, paramKeys, metric }) => {
  const [px, py] = paramKeys;
  const xVals = [...new Set(results.map(r => r[px]))].sort((a, b) => a - b);
  const yVals = [...new Set(results.map(r => r[py]))].sort((a, b) => a - b);

  const z = yVals.map(y =>
    xVals.map(x => {
      const row = results.find(r => r[px] === x && r[py] === y);
      return row ? row[metric] : null;
    })
  );

  const text = yVals.map(y =>
    xVals.map(x => {
      const row = results.find(r => r[px] === x && r[py] === y);
      return row ? row[metric]?.toFixed(2) : '';
    })
  );

  return (
    <Plot
      data={[{
        type: 'heatmap',
        x: xVals,
        y: yVals,
        z,
        text,
        texttemplate: '%{text}',
        textfont: { size: 9, color: '#fff' },
        colorscale: metricColor(metric),
        showscale: true,
        colorbar: {
          thickness: 10,
          tickfont: { color: '#888', size: 8 },
          len: 0.8,
        },
        hovertemplate: `${px}=%{x}<br>${py}=%{y}<br>${metric}=%{z:.2f}<extra></extra>`,
      }]}
      layout={{
        ...PLOTLY_LAYOUT_BASE,
        title: { text: `${px} × ${py}  →  ${metric}`, font: { color: '#ccc', size: 11 } },
        xaxis: { ...AXIS_STYLE, title: { text: px, font: { color: '#888', size: 10 } } },
        yaxis: { ...AXIS_STYLE, title: { text: py, font: { color: '#888', size: 10 } } },
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%', height: '320px' }}
    />
  );
};

// ── 3D Scatter ─────────────────────────────────────────────────────────────────
const Scatter3D = ({ results, paramKeys, metric }) => {
  const [px, py, pz] = paramKeys;

  const xs      = results.map(r => r[px]);
  const ys      = results.map(r => r[py]);
  const zs      = results.map(r => r[pz]);
  const colors  = results.map(r => r[metric]);
  const sizes   = results.map(r => {
    const wr = r.win_rate ?? 50;
    return 4 + (wr / 100) * 10;
  });
  const texts   = results.map(r =>
    `${px}=${r[px]}, ${py}=${r[py]}, ${pz}=${r[pz]}<br>${metric}=${r[metric]?.toFixed(2)}<br>win=${r.win_rate?.toFixed(0)}%`
  );

  // highlight best
  const bestIdx = results.reduce((bi, r, i) =>
    (r[metric] ?? -999) > (results[bi][metric] ?? -999) ? i : bi, 0);

  return (
    <Plot
      data={[
        {
          type: 'scatter3d',
          mode: 'markers',
          x: xs, y: ys, z: zs,
          text: texts,
          hovertemplate: '%{text}<extra></extra>',
          marker: {
            size: sizes,
            color: colors,
            colorscale: metricColor(metric),
            showscale: true,
            colorbar: {
              thickness: 10,
              tickfont: { color: '#888', size: 8 },
              title: { text: metric, font: { color: '#aaa', size: 9 }, side: 'right' },
            },
            opacity: 0.85,
          },
        },
        {
          // best point overlay
          type: 'scatter3d',
          mode: 'markers+text',
          x: [xs[bestIdx]], y: [ys[bestIdx]], z: [zs[bestIdx]],
          text: ['★'],
          textposition: 'top center',
          textfont: { color: '#facc15', size: 14 },
          marker: { size: 12, color: '#facc15', symbol: 'diamond', opacity: 1 },
          hovertemplate: `Best<br>${texts[bestIdx]}<extra></extra>`,
          showlegend: false,
        },
      ]}
      layout={{
        ...PLOTLY_LAYOUT_BASE,
        margin: { l: 0, r: 0, t: 36, b: 0 },
        title: {
          text: `3D Parameter Space  —  color = ${metric}  |  size = win rate`,
          font: { color: '#ccc', size: 11 },
        },
        scene: {
          bgcolor: '#0d0d12',
          xaxis: { ...AXIS_STYLE, title: { text: px } },
          yaxis: { ...AXIS_STYLE, title: { text: py } },
          zaxis: { ...AXIS_STYLE, title: { text: pz } },
        },
      }}
      config={{ displayModeBar: true, modeBarButtonsToRemove: ['toImage'], responsive: true }}
      style={{ width: '100%', height: '420px' }}
    />
  );
};

// ── 3rd-param slice heatmap ────────────────────────────────────────────────────
const SliceHeatmap = ({ results, paramKeys, metric }) => {
  const [px, py, pz] = paramKeys;
  const pzVals = [...new Set(results.map(r => r[pz]))].sort((a, b) => a - b);
  const [selectedPz, setSelectedPz] = useState(pzVals[Math.floor(pzVals.length / 2)]);

  const slice = results.filter(r => r[pz] === selectedPz);

  return (
    <div>
      {/* slider / pills */}
      <div className="flex items-center gap-2 px-1 mb-2 flex-wrap">
        <span className="text-[10px] text-gray-500">{pz} =</span>
        {pzVals.map(v => (
          <button
            key={v}
            onClick={() => setSelectedPz(v)}
            className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
              v === selectedPz
                ? 'bg-cyan-900/50 border-cyan-600 text-cyan-300'
                : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <Heatmap2D results={slice} paramKeys={[px, py]} metric={metric} />
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const ScanViz = ({ results, paramKeys }) => {
  const [metric, setMetric] = useState('sharpe');
  const is3D = paramKeys.length >= 3;

  if (!results || results.length === 0) return null;

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#0d0d12] border-b border-gray-800">
        <div className="flex items-center gap-2">
          <BarChart2 size={13} className="text-cyan-400" />
          <span className="text-[11px] font-semibold text-white">
            {is3D ? '3D Parameter Visualization' : '2D Heatmap'}
          </span>
          {is3D && (
            <span className="text-[9px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
              마우스로 회전 가능
            </span>
          )}
        </div>
        {/* metric selector */}
        <select
          value={metric}
          onChange={e => setMetric(e.target.value)}
          className="text-[10px] bg-[#0a0a0f] border border-gray-700 text-gray-300 rounded px-2 py-1 focus:outline-none focus:border-cyan-500"
        >
          {METRIC_OPTIONS.map(m => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="p-2 space-y-3">
        {is3D ? (
          <>
            <Scatter3D results={results} paramKeys={paramKeys} metric={metric} />
            <div className="border-t border-gray-800 pt-3">
              <div className="text-[10px] text-gray-500 px-1 mb-1">
                2D Slice Heatmap — {paramKeys[2]} 값 고정
              </div>
              <SliceHeatmap results={results} paramKeys={paramKeys} metric={metric} />
            </div>
          </>
        ) : (
          <Heatmap2D results={results} paramKeys={paramKeys} metric={metric} />
        )}
      </div>
    </div>
  );
};

export default ScanViz;
