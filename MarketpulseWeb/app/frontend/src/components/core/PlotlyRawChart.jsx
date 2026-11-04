/**
 * PlotlyRawChart — renders a raw Plotly figure object directly.
 *
 * OpenBB style: the backend returns a complete Plotly JSON
 * ({ data, layout, frames }) and this component passes it through
 * to Plotly.react() without any transformation.
 *
 * Theme overrides (dark/light) are merged on top of whatever layout the
 * backend sends, so charts always match the app's current theme.
 *
 * Props:
 *   plotlyJson  { data, layout, frames }  — raw Plotly figure
 */
import { useEffect, useRef, useCallback } from 'react';
import useThemeStore from '../../store/themeStore';
import { getPlotlyLayoutDefaults } from '../../utils/plotlyTheme';

const PLOTLY_CONFIG = {
  displayModeBar: false,
  displaylogo:    false,
  responsive:     true,
};

// Singleton promise so Plotly is only loaded once across all instances
let _plotlyPromise = null;
function loadPlotly() {
  if (!_plotlyPromise) {
    _plotlyPromise = import('plotly.js-dist-min').then(m => m.default || m);
  }
  return _plotlyPromise;
}

export default function PlotlyRawChart({ plotlyJson }) {
  const containerRef = useRef(null);
  const theme = useThemeStore(state => state.theme);

  const draw = useCallback(async () => {
    const el = containerRef.current;
    if (!el || !plotlyJson?.data?.length) return;

    const Plotly = await loadPlotly();
    if (!Plotly) {
      console.warn('PlotlyRawChart: could not load Plotly');
      return;
    }

    // Merge theme overrides — backend layout takes precedence for data props,
    // but visual theme props always follow the app theme.
    const themeOverrides = getPlotlyLayoutDefaults(theme);
    const layout = {
      ...plotlyJson.layout,
      ...themeOverrides,
      // Restore any axis titles from the original layout
      xaxis: { ...themeOverrides.xaxis, ...plotlyJson.layout?.xaxis },
      yaxis: { ...themeOverrides.yaxis, ...plotlyJson.layout?.yaxis },
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
  }, [plotlyJson, theme]);

  useEffect(() => {
    draw();
    return () => {
      const el = containerRef.current;
      if (el?._ro) el._ro.disconnect();
    };
  }, [draw]);

  return <div ref={containerRef} className="w-full h-full" />;
}
