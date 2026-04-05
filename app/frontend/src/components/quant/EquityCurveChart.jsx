/**
 * EquityCurveChart
 * Plotly chart showing:
 *   - Top 70%: Portfolio equity curve vs Buy & Hold benchmark
 *   - Bottom 30%: Drawdown area chart
 */
import { useEffect, useRef, useState } from 'react';

const fmt = (v) =>
  v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(2)}M`
    : v >= 1_000
    ? `$${(v / 1_000).toFixed(1)}K`
    : `$${v.toFixed(0)}`;

export default function EquityCurveChart({ equityCurve, performance, ticker }) {
  const ref = useRef(null);
  const [plotly, setPlotly] = useState(null);

  // Lazy-load Plotly once
  useEffect(() => {
    import('plotly.js-dist-min').then((P) => setPlotly(P.default ?? P));
  }, []);

  useEffect(() => {
    if (!plotly || !equityCurve || !ref.current) return;
    const { dates, equity, benchmark, drawdown } = equityCurve;
    if (!dates?.length) return;

    const equityTrace = {
      x: dates, y: equity,
      type: 'scatter', mode: 'lines',
      name: 'Strategy',
      line: { color: '#06b6d4', width: 2 },
      hovertemplate: '%{x}<br>%{y:$,.0f}<extra>Strategy</extra>',
    };

    const benchTrace = {
      x: dates, y: benchmark,
      type: 'scatter', mode: 'lines',
      name: 'Buy & Hold',
      line: { color: '#6b7280', width: 1.5, dash: 'dot' },
      hovertemplate: '%{x}<br>%{y:$,.0f}<extra>B&H</extra>',
    };

    const ddTrace = {
      x: dates, y: drawdown,
      type: 'scatter', mode: 'lines', fill: 'tozeroy',
      name: 'Drawdown',
      line: { color: '#ef4444', width: 1 },
      fillcolor: 'rgba(239,68,68,0.12)',
      hovertemplate: '%{x}<br>%{y:.2f}%<extra>Drawdown</extra>',
      yaxis: 'y2',
      xaxis: 'x2',
    };

    const layout = {
      paper_bgcolor: 'transparent',
      plot_bgcolor: '#0a0e14',
      font: { color: '#6b7280', size: 10, family: 'Inter, sans-serif' },
      margin: { l: 64, r: 16, t: 8, b: 8, pad: 0 },

      // Equity chart (top 68%)
      xaxis: {
        domain: [0, 1], gridcolor: '#1a1f2b', zeroline: false,
        showticklabels: false, showgrid: true,
        rangeslider: { visible: false },
      },
      yaxis: {
        domain: [0.36, 1], gridcolor: '#1a1f2b', zeroline: false,
        tickformat: '$,.0f', tickfont: { size: 9 },
        title: { text: 'Portfolio Value', font: { size: 9, color: '#4b5563' } },
      },

      // Drawdown chart (bottom 28%)
      xaxis2: {
        domain: [0, 1], gridcolor: '#1a1f2b', zeroline: false,
        showgrid: true, anchor: 'y2',
        tickfont: { size: 9 },
      },
      yaxis2: {
        domain: [0, 0.30], gridcolor: '#1a1f2b', zeroline: false,
        tickformat: '.1f', ticksuffix: '%', tickfont: { size: 9 },
        title: { text: 'Drawdown', font: { size: 9, color: '#4b5563' } },
        anchor: 'x2',
      },

      legend: {
        x: 0.01, y: 0.99, bgcolor: 'rgba(10,10,15,0.7)',
        bordercolor: '#1f2937', borderwidth: 1,
        font: { size: 10 },
      },
      showlegend: true,
      hovermode: 'x unified',
    };

    plotly.react(ref.current, [equityTrace, benchTrace, ddTrace], layout, {
      responsive: true, displayModeBar: false,
    });
  }, [plotly, equityCurve]);

  if (!equityCurve) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-gray-600">
        백테스트 실행 후 Equity Curve가 표시됩니다
      </div>
    );
  }

  // Mini summary bar
  const { equity = [], benchmark = [] } = equityCurve;
  const finalEq = equity[equity.length - 1] ?? 0;
  const finalBh = benchmark[benchmark.length - 1] ?? 0;
  const alpha = performance
    ? performance.total_return - (finalBh / (performance.initial_capital || 1) - 1) * 100
    : null;

  return (
    <div className="h-full flex flex-col">
      {/* Top summary strip */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-cyan-400 inline-block" />
          <span className="text-[10px] text-gray-400">Strategy</span>
          <span className="text-[11px] font-semibold text-cyan-300 tabular-nums ml-1">
            {fmt(finalEq)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-gray-500 inline-block border-t border-dashed border-gray-500" />
          <span className="text-[10px] text-gray-400">Buy &amp; Hold</span>
          <span className="text-[11px] font-semibold text-gray-300 tabular-nums ml-1">
            {fmt(finalBh)}
          </span>
        </div>
        {alpha !== null && (
          <div className="ml-auto text-[10px]">
            <span className="text-gray-600">Alpha  </span>
            <span className={alpha >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
              {alpha >= 0 ? '+' : ''}{alpha.toFixed(2)}%
            </span>
          </div>
        )}
        {ticker && (
          <span className="text-[10px] text-gray-600 tabular-nums">{ticker}</span>
        )}
      </div>

      {/* Plotly chart */}
      <div ref={ref} className="flex-1 min-h-0" />
    </div>
  );
}
