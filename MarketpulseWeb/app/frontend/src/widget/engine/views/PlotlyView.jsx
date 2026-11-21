/**
 * plotly — 서버가 통째로 준 Plotly 그림({ data, layout })을 그대로 그린다.
 * 배경 · 글자 · 격자 색만 지금 테마로 덮고, 데이터 · 축 제목 등은 서버 layout 을 따른다.
 *
 * options:
 *   figure   { data, layout }
 */
import { useCallback } from 'react';
import Plot, { FONT } from '../Plot';

const CONFIG = { doubleClick: 'reset+autosize' };

export default function PlotlyView({ options = {} }) {
  const { figure: fig } = options;
  const figure = useCallback((c) => {
    const layout = fig?.layout || {};
    const axis = (a) => ({ gridcolor: c.grid, linecolor: c.axis, zerolinecolor: c.grid, ...a, tickfont: { color: c.muted, size: 10.5, family: FONT, ...a?.tickfont } });
    return {
      data: fig?.data || [],
      layout: {
        ...layout,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: FONT, ...layout.font, color: c.muted },
        legend: { ...layout.legend, font: { ...layout.legend?.font, color: c.text } },
        hoverlabel: { bgcolor: c.surface, bordercolor: c.line, font: { color: c.text, size: 11, family: FONT } },
        xaxis: axis(layout.xaxis),
        yaxis: axis(layout.yaxis),
        width: undefined,
        height: undefined,
      },
    };
  }, [fig]);

  if (!fig?.data?.length) return <div className="w-full h-full" />;
  return <Plot figure={figure} config={CONFIG} />;
}
