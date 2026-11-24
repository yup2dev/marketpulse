/**
 * xy — 가로축 하나 + 계열 여럿의 범용 차트 (Plotly). 응답 모양을 미리 모르는 위젯(UniversalWidget)의 차트 보기.
 * 디자인이 정해진 차트는 전용 뷰(lines · curve · candles …)를 쓴다.
 *
 * options:
 *   type     'line'                  line · area · bar · stackedBar · scatter
 *   x        'date'                  가로축 필드 (날짜면 오래된 것부터 놓는다)
 *   series   [{ field, label, color }] 또는 'f1:이름,f2:이름'
 *   refs     [{ y, label, color }]   가로 기준선 (점선)
 *   marks    [{ x, label, color }]   세로 이벤트 표시 (뉴스 등)
 *   right    'rate:증감률'           오른쪽 축에 선으로 겹칠 계열 ('필드:이름' 목록) — 값이 전부 비면 그리지 않는다
 *   rightUnit '%'                    오른쪽 축 값 뒤 단위
 *   unit     ''                      값 뒤 단위
 *   digits   2                       툴팁 소수 자릿수
 *
 * 끌어서 확대, 더블클릭으로 되돌린다. 계열이 둘 이상이면 위에 범례.
 */
import { useCallback, useMemo } from 'react';
import Plot, { FONT, withAlpha } from '../Plot';
import { SERIES_COLORS, SLICE_COLORS, parseSeries } from './parts';

const isDate = (v) => /^\d{4}-\d{2}-\d{2}/.test(String(v ?? ''));
// 엔진 차트는 확대를 막지만, 범용 차트는 데이터를 들여다보는 용도라 끌어서 확대 · 더블클릭 되돌리기를 둔다
const CONFIG = { doubleClick: 'reset+autosize' };

export default function XYView({ rows: input, options = {} }) {
  const { type = 'line', x = 'date', refs, marks, unit = '', digits = 2, rightUnit = '%' } = options;
  const rows = useMemo(
    () => (isDate(input[0]?.[x]) ? [...input].sort((a, b) => String(a[x]).localeCompare(String(b[x]))) : input),
    [input, x],
  );
  const series = useMemo(() => {
    const list = Array.isArray(options.series) ? options.series : parseSeries(options.series || 'value');
    const palette = list.length <= 3 ? SLICE_COLORS : SERIES_COLORS;
    return list.map((s, i) => ({ ...s, label: s.label ?? s.field, color: s.color || palette[i % palette.length] }));
  }, [options.series]);
  // 오른쪽 축 계열 — 값(막대·선) 위에 증감률 같은 다른 단위를 선으로 겹친다
  const right = useMemo(() => {
    if (!options.right) return [];
    const list = Array.isArray(options.right) ? options.right : parseSeries(options.right);
    // 색을 안 주면 그릴 때 테마 글자색(밝은/어두운 테마 모두 보이게) — 둘째부터는 계열 팔레트
    return list.map((s, i) => ({ ...s, label: s.label ?? s.field, color: s.color || (i ? SERIES_COLORS[(i + 3) % SERIES_COLORS.length] : null) }));
  }, [options.right]);

  const figure = useCallback((c) => {
    const xs = rows.map((r) => r[x]);
    const tickfont = { color: c.muted, size: 10.5, family: FONT };
    const hover = (s) => `%{y:,.${digits}f}${unit}<extra>${s.label}</extra>`;
    const ys = (s) => rows.map((r) => (r[s.field] == null || r[s.field] === '' ? null : Number(r[s.field])));

    const data = series.map((s) => {
      if (type === 'bar' || type === 'stackedBar') {
        return { type: 'bar', name: s.label, x: xs, y: ys(s), marker: { color: s.color }, hovertemplate: hover(s) };
      }
      return {
        type: 'scatter',
        mode: type === 'scatter' ? 'markers' : 'lines',
        name: s.label,
        x: xs,
        y: ys(s),
        connectgaps: true,
        line: { color: s.color, width: 2 },
        marker: { color: s.color, size: 6 },
        ...(type === 'area' ? { fill: 'tozeroy', fillcolor: withAlpha(s.color, 0.12) } : {}),
        hovertemplate: hover(s),
      };
    });
    // 오른쪽 축 — 값이 하나라도 있는 계열만 (증감률 '끄기'면 전부 비어 그리지 않는다)
    const rightData = right
      .map((s) => ({ s, y: ys(s) }))
      .filter(({ y }) => y.some((v) => v != null))
      .map(({ s, y }) => ({
        type: 'scatter', mode: 'lines', name: s.label, x: xs, y, yaxis: 'y2', connectgaps: true,
        line: { color: s.color || c.text, width: 1.5 }, hovertemplate: `%{y:,.1f}${rightUnit}<extra>${s.label}</extra>`,
      }));
    data.push(...rightData);

    const shapes = [];
    const notes = [];
    for (const r of refs || []) {
      shapes.push({ type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: r.y, y1: r.y, line: { color: r.color || c.muted, dash: 'dot', width: 1 } });
      if (r.label) notes.push({ x: 0, y: r.y, xref: 'paper', yref: 'y', text: r.label, showarrow: false, xanchor: 'left', yanchor: 'bottom', font: { color: r.color || c.muted, size: 10, family: FONT } });
    }
    for (const m of marks || []) {
      if (m?.x == null) continue;
      const color = m.color || '#E0A845';
      shapes.push({ type: 'line', xref: 'x', yref: 'paper', x0: m.x, x1: m.x, y0: 0, y1: 1, line: { color, dash: 'dash', width: 1 } });
      if (m.label) notes.push({ x: m.x, y: 1, xref: 'x', yref: 'paper', text: String(m.label).slice(0, 40), showarrow: false, textangle: -90, xanchor: 'left', yanchor: 'top', font: { color, size: 10, family: FONT } });
    }

    const multi = series.length + rightData.length > 1;
    return {
      data,
      layout: {
        margin: { t: multi ? 28 : 8, r: 16, b: 28, l: 48 },
        showlegend: multi,
        legend: { orientation: 'h', x: 0, y: 1, yanchor: 'bottom', font: { color: c.text, size: 11, family: FONT } },
        barmode: type === 'stackedBar' ? 'stack' : 'group',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: FONT, color: c.muted, size: 10.5 },
        hovermode: 'x unified',
        hoverlabel: { bgcolor: c.surface, bordercolor: c.line, font: { color: c.text, size: 11, family: FONT } },
        xaxis: { showgrid: false, linecolor: c.axis, tickfont, automargin: true },
        yaxis: { nticks: 5, gridcolor: c.grid, zeroline: false, tickfont, ticksuffix: unit, automargin: true },
        ...(rightData.length ? {
          yaxis2: {
            overlaying: 'y', side: 'right', nticks: 5, showgrid: false, tickfont, ticksuffix: rightUnit, automargin: true,
            zeroline: true, zerolinecolor: c.axis, zerolinewidth: 1,
          },
        } : {}),
        shapes,
        annotations: notes,
      },
    };
  }, [rows, x, series, right, type, refs, marks, unit, digits, rightUnit]);

  return (
    <div className="h-full min-h-0 px-1 pb-1">
      <Plot figure={figure} config={CONFIG} ariaLabel={series.map((s) => s.label).join(', ')} />
    </div>
  );
}
