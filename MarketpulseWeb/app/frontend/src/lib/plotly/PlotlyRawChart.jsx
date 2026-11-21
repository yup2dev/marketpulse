/**
 * PlotlyRawChart — 백엔드가 통째로 준 Plotly figure({ data, layout, frames })를 그대로 그린다.
 *
 * 테마(라이트/다크)의 시각 속성만 덮어쓴다 — 데이터·축 제목 등은 백엔드 layout 을 따른다.
 * 그리기는 Plot(lib/plotly/Plot) 이 한다.
 *
 * Props:
 *   plotlyJson  { data, layout, frames }
 */
import { useCallback } from 'react';
import useThemeStore from '../../store/themeStore';
import Plot from './Plot';
import { getPlotlyLayoutDefaults } from './plotlyTheme';

// Plot 의 기본 config 는 더블클릭을 끈다 — 이 차트는 예전처럼 Plotly 기본(더블클릭 = 축 리셋)을 쓴다
const CONFIG = { doubleClick: 'reset+autosize' };

export default function PlotlyRawChart({ plotlyJson }) {
  const theme = useThemeStore((s) => s.theme);

  const figure = useCallback(() => {
    const themeOverrides = getPlotlyLayoutDefaults(theme);
    return {
      data: plotlyJson?.data || [],
      layout: {
        ...plotlyJson?.layout,
        ...themeOverrides,
        // 축 제목 등 원래 layout 의 축 설정은 살린다
        xaxis: { ...themeOverrides.xaxis, ...plotlyJson?.layout?.xaxis },
        yaxis: { ...themeOverrides.yaxis, ...plotlyJson?.layout?.yaxis },
        width: undefined,
        height: undefined,
      },
    };
  }, [plotlyJson, theme]);

  if (!plotlyJson?.data?.length) return <div className="w-full h-full" />;
  return <Plot figure={figure} config={CONFIG} />;
}
