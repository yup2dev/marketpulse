/**
 * plotlyTheme — 테마(dark/light)별 Plotly 레이아웃 기본값.
 *
 * PlotlyChart / PlotlyRawChart / ChartWidget(PlotlyStockChart·PlotlyOscillator)이
 * 공유한다. CSS 오버라이드(index.css)는 DOM 클래스만 바꾸므로 Plotly처럼
 * JS로 색을 그리는 차트는 이 팔레트를 직접 참조해야 라이트 모드를 따라간다.
 */

const PALETTES = {
  dark: {
    font:   '#9ca3af',
    grid:   '#1f2937',
    line:   '#374151',   // 축선 / zeroline
    tick:   '#6b7280',
    legend: '#9ca3af',
    hover:  { bg: '#1a1f2e', border: '#374151', text: '#f9fafb' },
  },
  light: {
    font:   '#475569',
    grid:   '#e5e7eb',
    line:   '#cbd5e1',
    tick:   '#64748b',
    legend: '#475569',
    hover:  { bg: '#ffffff', border: '#e2e8f0', text: '#0f172a' },
  },
};

export function getPlotlyPalette(theme = 'dark') {
  return PALETTES[theme] || PALETTES.dark;
}

export function getPlotlyLayoutDefaults(theme = 'dark') {
  const p = getPlotlyPalette(theme);
  return {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor:  'rgba(0,0,0,0)',
    font: { family: 'Inter, system-ui, sans-serif', color: p.font, size: 11 },
    xaxis: {
      gridcolor:     p.grid,
      zerolinecolor: p.line,
      linecolor:     p.line,
      tickfont:      { color: p.tick, size: 10 },
      automargin:    true,
    },
    yaxis: {
      gridcolor:     p.grid,
      zerolinecolor: p.line,
      linecolor:     p.line,
      tickfont:      { color: p.tick, size: 10 },
      automargin:    true,
    },
    legend: {
      font:        { color: p.legend, size: 10 },
      bgcolor:     'rgba(0,0,0,0)',
      borderwidth: 0,
    },
    margin: { t: 8, r: 8, b: 32, l: 48 },
    hoverlabel: {
      bgcolor:     p.hover.bg,
      bordercolor: p.hover.border,
      font:        { color: p.hover.text, size: 11 },
    },
    hovermode: 'x unified',
  };
}
