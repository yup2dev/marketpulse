import { useEffect, useRef } from 'react';
import useThemeStore from '../../../store/themeStore';
import { getPlotlyPalette } from '../../../utils/plotlyTheme';

// Plotly oscillator sub-panel component
const PlotlyOscillator = ({ chartData, traces: traceDefs, shapes: shapeDefs, yDomain, height = 192, chartTheme }) => {
  const divRef = useRef(null);
  const theme = useThemeStore(state => state.theme);

  useEffect(() => {
    if (!divRef.current || !chartData || chartData.length === 0) return;

    const loadPlotly = async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      const dates = chartData.map(d => d.date);

      const traces = traceDefs.map(td => ({
        type: td.type || 'scatter',
        mode: td.mode || 'lines',
        x: dates,
        y: chartData.map(d => d[td.dataKey]),
        name: td.name,
        line: td.line,
        marker: td.marker,
        connectgaps: true,
      }));

      const pal = getPlotlyPalette(theme);
      const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, system-ui', color: pal.font, size: 11 },
        xaxis: {
          gridcolor: chartTheme?.grid || pal.grid,
          linecolor: pal.line,
          tickfont: { color: pal.tick, size: 10 },
          rangeslider: { visible: false },
          type: 'category',
        },
        yaxis: {
          gridcolor: chartTheme?.grid || pal.grid,
          linecolor: pal.line,
          tickfont: { color: pal.tick, size: 10 },
          automargin: true,
          ...(yDomain ? { range: yDomain } : {}),
        },
        margin: { t: 4, r: 8, b: 32, l: 50 },
        legend: { font: { color: pal.legend, size: 10 }, bgcolor: 'rgba(0,0,0,0)' },
        hoverlabel: { bgcolor: pal.hover.bg, bordercolor: pal.hover.border, font: { color: pal.hover.text, size: 11 } },
        hovermode: 'x unified',
        showlegend: true,
        shapes: shapeDefs || [],
      };

      await Plotly.react(divRef.current, traces, layout, { displayModeBar: false, responsive: true });

      const ro = new ResizeObserver(() => {
        if (divRef.current) Plotly.Plots.resize(divRef.current);
      });
      ro.observe(divRef.current);
      divRef.current._ro = ro;
    };

    loadPlotly();

    return () => {
      if (divRef.current?._ro) divRef.current._ro.disconnect();
    };
  }, [chartData, traceDefs, shapeDefs, yDomain, theme, chartTheme]);

  return <div ref={divRef} style={{ width: '100%', height }} />;
};

export default PlotlyOscillator;
