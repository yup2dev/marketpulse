/**
 * PlotlyRawChart — renders a raw Plotly figure object directly.
 *
 * OpenBB style: the backend returns a complete Plotly JSON
 * ({ data, layout, frames }) and this component passes it through
 * to Plotly.react() without any transformation.
 *
 * Dark theme overrides are merged onto top of whatever layout the
 * backend sends, so charts always match the app's dark UI.
 *
 * Props:
 *   plotlyJson  { data, layout, frames }  — raw Plotly figure
 */
import { useEffect, useRef, useCallback } from 'react';

const DARK_OVERRIDES = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor:  'rgba(0,0,0,0)',
  font:    { family: 'Inter, system-ui, sans-serif', color: '#9ca3af', size: 11 },
  xaxis:   { gridcolor: '#1f2937', zerolinecolor: '#374151', linecolor: '#374151',
             tickfont: { color: '#6b7280', size: 10 }, automargin: true },
  yaxis:   { gridcolor: '#1f2937', zerolinecolor: '#374151', linecolor: '#374151',
             tickfont: { color: '#6b7280', size: 10 }, automargin: true },
  legend:  { font: { color: '#9ca3af', size: 10 }, bgcolor: 'rgba(0,0,0,0)', borderwidth: 0 },
  margin:  { t: 8, r: 8, b: 32, l: 48 },
  hoverlabel: { bgcolor: '#1a1f2e', bordercolor: '#374151', font: { color: '#f9fafb', size: 11 } },
  hovermode: 'x unified',
};

const PLOTLY_CONFIG = {
  displayModeBar: false,
  displaylogo:    false,
  responsive:     true,
};

export default function PlotlyRawChart({ plotlyJson }) {
  const containerRef = useRef(null);

  const draw = useCallback(async () => {
    const el = containerRef.current;
    if (!el || !plotlyJson?.data?.length) return;

    const Plotly = window.Plotly;
    if (!Plotly) {
      console.warn('PlotlyRawChart: window.Plotly not loaded');
      return;
    }

    // Merge dark overrides — backend layout takes precedence for data props,
    // but visual theme props are always forced to dark.
    const layout = {
      ...plotlyJson.layout,
      ...DARK_OVERRIDES,
      // Restore any axis titles from the original layout
      xaxis: { ...DARK_OVERRIDES.xaxis, ...plotlyJson.layout?.xaxis },
      yaxis: { ...DARK_OVERRIDES.yaxis, ...plotlyJson.layout?.yaxis },
      width:  undefined,
      height: undefined,
    };

    try {
      if (!el._plotlyInitialized) {
        await Plotly.newPlot(el, plotlyJson.data, layout, PLOTLY_CONFIG);
        el._plotlyInitialized = true;
        const ro = new ResizeObserver(() => Plotly.Plots.resize(el));
        ro.observe(el);
        el._ro = ro;
      } else {
        await Plotly.react(el, plotlyJson.data, layout, PLOTLY_CONFIG);
      }
    } catch (err) {
      console.warn('PlotlyRawChart render error:', err);
    }
  }, [plotlyJson]);

  useEffect(() => {
    draw();
    return () => {
      const el = containerRef.current;
      if (el?._ro) el._ro.disconnect();
    };
  }, [draw]);

  return <div ref={containerRef} className="w-full h-full" />;
}
