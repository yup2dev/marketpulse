import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { LineChart, Play, Loader2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { quantAPI } from '../../config/api';

// ── Overlay catalog ─────────────────────────────────────────────────────────
// Each overlay defines the backend factor calls + how to render on Plotly.
// kind: 'line' (overlay on price y-axis), 'marker' (scatter), 'band' (bg shapes)
const OVERLAYS = [
  {
    id: 'ema',
    label: 'EMA',
    kind: 'line',
    params: [{ name: 'period', label: 'Period', default: 20, min: 2, max: 500 }],
    factors: (p) => [{ factor: 'EMA', params: { period: p.period }, style: { color: '#22d3ee', name: `EMA(${p.period})` } }],
    strategyId: 'ema',
  },
  {
    id: 'sma',
    label: 'SMA',
    kind: 'line',
    params: [{ name: 'period', label: 'Period', default: 50, min: 2, max: 500 }],
    factors: (p) => [{ factor: 'SMA', params: { period: p.period }, style: { color: '#f59e0b', name: `SMA(${p.period})` } }],
    strategyId: 'sma',
  },
  {
    id: 'bb',
    label: 'Bollinger Bands',
    kind: 'line',
    params: [
      { name: 'period',  label: 'Period',  default: 20,  min: 5,   max: 200 },
      { name: 'std_dev', label: 'Std Dev', default: 2.0, min: 0.5, max: 5, step: 0.1 },
    ],
    factors: (p) => [
      { factor: 'BB_UPPER', params: p, style: { color: '#a78bfa', name: `BB Upper`, dash: 'dot' } },
      { factor: 'BB_MID',   params: p, style: { color: '#a78bfa', name: `BB Mid` } },
      { factor: 'BB_LOWER', params: p, style: { color: '#a78bfa', name: `BB Lower`, dash: 'dot' } },
    ],
    strategyId: 'bb',
  },
  {
    id: 'volume_profile',
    label: 'Volume Profile',
    kind: 'line',
    params: [
      { name: 'lookback', label: 'Lookback', default: 30, min: 5,  max: 120 },
      { name: 'bins',     label: 'Bins',     default: 20, min: 10, max: 60  },
    ],
    factors: (p) => [
      { factor: 'CHART_VP_POC', params: p, style: { color: '#22c55e', name: 'POC' } },
      { factor: 'CHART_VP_VAH', params: p, style: { color: '#64748b', name: 'VAH', dash: 'dash' } },
      { factor: 'CHART_VP_VAL', params: p, style: { color: '#64748b', name: 'VAL', dash: 'dash' } },
    ],
    strategyId: 'volume_profile',
  },
  {
    id: 'liquidity_sweep',
    label: 'Liquidity Sweep',
    kind: 'marker',
    params: [{ name: 'lookback', label: 'Lookback', default: 20, min: 5, max: 60 }],
    factors: (p) => [
      { factor: 'CHART_LIQ_SWEEP_HIGH', params: p, style: { color: '#ef4444', name: 'Sweep High', symbol: 'triangle-down' } },
      { factor: 'CHART_LIQ_SWEEP_LOW',  params: p, style: { color: '#22c55e', name: 'Sweep Low',  symbol: 'triangle-up'   } },
    ],
    strategyId: 'liquidity_sweep',
  },
  {
    id: 'hmm_regime',
    label: 'HMM Regime',
    kind: 'band',
    params: [
      { name: 'n_states',     label: 'States',       default: 3,   min: 2,  max: 4 },
      { name: 'train_window', label: 'Train Window', default: 252, min: 60, max: 750 },
      { name: 'refit_every',  label: 'Refit Every',  default: 20,  min: 1,  max: 60 },
    ],
    factors: (p) => [
      { factor: 'CHART_HMM_STATE', params: p, style: { name: 'Regime' } },
    ],
    strategyId: 'hmm_regime',
  },
];

const REGIME_COLORS = {
  0: 'rgba(239, 68, 68, 0.10)',   // bear — red
  1: 'rgba(148, 163, 184, 0.08)', // neutral — gray
  2: 'rgba(34, 197, 94, 0.10)',   // bull — green
  3: 'rgba(34, 197, 94, 0.14)',   // strong bull (when n_states=4)
};

// ── Helpers ─────────────────────────────────────────────────────────────────
function defaultParams(overlay) {
  return Object.fromEntries(overlay.params.map(p => [p.name, p.default]));
}

function todayISO(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function VisualizePage() {
  const navigate = useNavigate();
  const [ticker, setTicker]     = useState('AAPL');
  const [startDate, setStart]   = useState(todayISO(-365));
  const [endDate, setEnd]       = useState(todayISO(0));
  const [enabled, setEnabled]   = useState({});          // { overlayId: boolean }
  const [overlayParams, setOP]  = useState({});          // { overlayId: {param: value} }
  const [data, setData]         = useState(null);        // server response
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  // Initialize overlay params defaults
  useEffect(() => {
    setOP(Object.fromEntries(OVERLAYS.map(o => [o.id, defaultParams(o)])));
  }, []);

  const toggleOverlay = (id) => setEnabled(s => ({ ...s, [id]: !s[id] }));
  const updateParam = (overlayId, paramName, value) => {
    setOP(s => ({ ...s, [overlayId]: { ...s[overlayId], [paramName]: value } }));
  };

  // Build factor request list from enabled overlays
  const factorRequests = useMemo(() => {
    const out = [];
    for (const ov of OVERLAYS) {
      if (!enabled[ov.id]) continue;
      const p = overlayParams[ov.id] || defaultParams(ov);
      for (const f of ov.factors(p)) {
        out.push({ overlayId: ov.id, kind: ov.kind, factor: f.factor, params: f.params, style: f.style });
      }
    }
    return out;
  }, [enabled, overlayParams]);

  const runAnalysis = useCallback(async () => {
    if (!ticker.trim()) { toast.error('티커를 입력하세요'); return; }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        ticker: ticker.trim().toUpperCase(),
        start_date: startDate,
        end_date: endDate,
        factors: factorRequests.map(r => ({ factor: r.factor, params: r.params })),
      };
      const resp = await quantAPI.factorSeries(payload);
      setData({ ...resp.data, _requests: factorRequests });
    } catch (e) {
      setError(e.message || 'Failed to fetch');
      toast.error(e.message || '데이터 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [ticker, startDate, endDate, factorRequests]);

  // Auto-run once on mount with defaults
  useEffect(() => {
    runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addToStrategy = (overlay) => {
    const p = overlayParams[overlay.id] || defaultParams(overlay);
    const qs = new URLSearchParams({
      addFactor: overlay.strategyId,
      params: JSON.stringify(p),
    });
    navigate(`/strategy?${qs.toString()}`);
  };

  return (
    <div className="h-[calc(100vh-56px)] flex bg-[#0a0a0f] text-gray-100">
      {/* ── LEFT PANEL ── */}
      <aside className="w-[320px] flex-shrink-0 border-r border-gray-800 bg-[#0d0d12] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
          <LineChart size={14} className="text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-300">Visualize</span>
        </div>

        <div className="p-4 space-y-3 border-b border-gray-800">
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Ticker</label>
            <input
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter') runAnalysis(); }}
              className="mt-1 w-full px-2.5 py-1.5 bg-[#0a0a0f] border border-gray-700 rounded text-xs font-mono text-gray-100 focus:outline-none focus:border-cyan-500"
              placeholder="AAPL"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider">Start</label>
              <input type="date" value={startDate} onChange={e => setStart(e.target.value)}
                className="mt-1 w-full px-2 py-1.5 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-gray-200 focus:outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider">End</label>
              <input type="date" value={endDate} onChange={e => setEnd(e.target.value)}
                className="mt-1 w-full px-2 py-1.5 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-gray-200 focus:outline-none focus:border-cyan-500" />
            </div>
          </div>
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-800 disabled:text-gray-500 text-white text-xs font-semibold rounded transition-colors"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {loading ? '불러오는 중…' : 'Run'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Overlays</div>
          {OVERLAYS.map(ov => {
            const on = !!enabled[ov.id];
            const p  = overlayParams[ov.id] || defaultParams(ov);
            return (
              <div key={ov.id} className={`border rounded-lg transition-colors ${on ? 'border-cyan-700/50 bg-cyan-950/20' : 'border-gray-800 bg-[#0a0a0f]'}`}>
                <div className="flex items-center justify-between px-3 py-2">
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <input type="checkbox" checked={on} onChange={() => toggleOverlay(ov.id)}
                      className="w-3.5 h-3.5 rounded border-gray-600 bg-[#0a0a0f] accent-cyan-500" />
                    <span className="text-xs font-medium text-gray-200">{ov.label}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 uppercase">{ov.kind}</span>
                  </label>
                  {on && (
                    <button
                      onClick={() => addToStrategy(ov)}
                      title="전략에 추가"
                      className="p-1 text-gray-500 hover:text-cyan-400 transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  )}
                </div>
                {on && ov.params.length > 0 && (
                  <div className="px-3 pb-2 pt-1 border-t border-gray-800/60 space-y-1.5">
                    {ov.params.map(pm => (
                      <div key={pm.name} className="flex items-center gap-2 text-[11px]">
                        <span className="text-gray-500 w-[80px] truncate">{pm.label}</span>
                        <input
                          type="number"
                          value={p[pm.name] ?? pm.default}
                          min={pm.min}
                          max={pm.max}
                          step={pm.step ?? 1}
                          onChange={e => updateParam(ov.id, pm.name, Number(e.target.value))}
                          className="flex-1 px-2 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] tabular-nums focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* ── MAIN CHART ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="px-5 py-2.5 border-b border-gray-800 bg-[#0d0d12] flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-100">{data?.ticker || ticker}</span>
          <span className="text-[11px] text-gray-500">{startDate} → {endDate}</span>
          {data && <span className="text-[11px] text-gray-500">· {data.dates?.length ?? 0} bars</span>}
          {error && <span className="ml-auto text-[11px] text-red-400">Error: {error}</span>}
        </div>
        <div className="flex-1 overflow-hidden relative bg-[#06080c]">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#06080c]/70">
              <Loader2 size={24} className="animate-spin text-cyan-400" />
            </div>
          )}
          {data && <PlotlyChart data={data} />}
          {!data && !loading && (
            <div className="h-full flex items-center justify-center text-gray-500 text-sm">
              좌측에서 오버레이를 선택하고 Run을 누르세요
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Plotly chart ────────────────────────────────────────────────────────────
function PlotlyChart({ data }) {
  const divRef = useRef(null);

  useEffect(() => {
    if (!divRef.current || !data) return;
    let cancelled = false;

    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (cancelled) return;

      const { dates, ohlcv, series, _requests: reqs } = data;
      const traces = [];
      const shapes = [];

      // Candlestick
      traces.push({
        type: 'candlestick',
        x: dates,
        open:  ohlcv.open,
        high:  ohlcv.high,
        low:   ohlcv.low,
        close: ohlcv.close,
        name: 'Price',
        increasing: { line: { color: '#22c55e' } },
        decreasing: { line: { color: '#ef4444' } },
        yaxis: 'y',
      });

      // Match series to request (1:1 order)
      series.forEach((s, idx) => {
        const req = reqs?.[idx];
        if (!req) return;
        const style = req.style || {};
        const values = s.values;

        if (req.kind === 'line') {
          traces.push({
            type: 'scatter',
            mode: 'lines',
            x: dates,
            y: values,
            name: style.name || s.factor,
            line: { color: style.color || '#9ca3af', width: 1.5, dash: style.dash || 'solid' },
            yaxis: 'y',
          });
        } else if (req.kind === 'marker') {
          // Liquidity sweep: 0/1 series. Show markers only where value===1.
          const anchor = req.factor.endsWith('_HIGH') ? ohlcv.high : ohlcv.low;
          const yOffset = req.factor.endsWith('_HIGH') ? 1.005 : 0.995;
          const xs = [], ys = [];
          for (let i = 0; i < values.length; i++) {
            if (values[i] === 1) {
              xs.push(dates[i]);
              ys.push((anchor[i] ?? 0) * yOffset);
            }
          }
          traces.push({
            type: 'scatter',
            mode: 'markers',
            x: xs,
            y: ys,
            name: style.name || s.factor,
            marker: { color: style.color || '#9ca3af', symbol: style.symbol || 'circle', size: 9, line: { width: 0 } },
            yaxis: 'y',
          });
        } else if (req.kind === 'band') {
          // HMM regime: draw background rectangles for each contiguous regime run
          let runStart = 0;
          let runState = values[0];
          for (let i = 1; i <= values.length; i++) {
            const v = i < values.length ? values[i] : null;
            if (v !== runState) {
              if (runState !== null && runState !== undefined) {
                shapes.push({
                  type: 'rect',
                  xref: 'x',
                  yref: 'paper',
                  x0: dates[runStart],
                  x1: dates[Math.min(i, values.length - 1)],
                  y0: 0,
                  y1: 1,
                  fillcolor: REGIME_COLORS[Math.round(runState)] || 'rgba(0,0,0,0)',
                  line: { width: 0 },
                  layer: 'below',
                });
              }
              runStart = i;
              runState = v;
            }
          }
        }
      });

      const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor:  'rgba(0,0,0,0)',
        font: { family: 'Inter, system-ui', color: '#9ca3af', size: 11 },
        margin: { l: 50, r: 50, t: 20, b: 40 },
        xaxis: {
          gridcolor: '#1f2937',
          linecolor: '#374151',
          tickfont:  { color: '#6b7280', size: 10 },
          rangeslider: { visible: false },
          type: 'category',
        },
        yaxis: {
          gridcolor: '#1f2937',
          linecolor: '#374151',
          tickfont:  { color: '#6b7280', size: 10 },
          automargin: true,
          side: 'right',
        },
        legend: { orientation: 'h', y: 1.05, x: 0, font: { size: 10 } },
        hovermode: 'x unified',
        shapes,
      };

      const config = { displayModeBar: false, responsive: true };
      Plotly.newPlot(divRef.current, traces, layout, config);
    })();

    return () => { cancelled = true; };
  }, [data]);

  return <div ref={divRef} className="w-full h-full" />;
}
