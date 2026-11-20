/**
 * treemap — 넓이 = 크기, 색 = 등락률 (Plotly).
 *
 * options:
 *   value   'market_cap'   넓이
 *   label   'symbol'       타일 글자
 *   change  'change_pct'   등락률(%) — 색과 둘째 줄. 값이 없으면 중립색
 *   group   'sector'       묶음 (없으면 한 겹)
 *   link    'symbol'       타일을 누르면 그 종목 화면으로
 *   heatMax 10             이 등락률(%)에서 색이 가장 진하다
 */
import { useCallback } from 'react';
import { useNavigate, hrefFor } from '../adapter';
import { fmtPct } from '../format';
import Plot, { FONT, withAlpha } from '../Plot';

export default function TreemapView({ rows, options = {} }) {
  const { value = 'value', label = 'label', change, group, link, heatMax = 10 } = options;
  const navigate = useNavigate();

  const figure = useCallback((c) => {
    const leaves = rows.filter((r) => Number(r[value]) > 0);
    const groups = group ? [...new Set(leaves.map((r) => r[group] ?? ''))] : [];
    const heat = (v) => {
      if (v == null || Number.isNaN(Number(v))) return c.neutral;
      return withAlpha(v >= 0 ? c.up : c.down, (0.35 + Math.min(Math.abs(v) / heatMax, 1) * 0.55).toFixed(2));
    };
    const chg = (r) => (change ? r[change] : null);
    return {
      data: [{
        type: 'treemap',
        branchvalues: 'remainder',
        ids:     [...groups.map((g) => `g:${g}`), ...leaves.map((r, i) => `s:${i}`)],
        labels:  [...groups, ...leaves.map((r) => String(r[label] ?? ''))],
        parents: [...groups.map(() => ''), ...leaves.map((r) => (group ? `g:${r[group] ?? ''}` : ''))],
        values:  [...groups.map(() => 0), ...leaves.map((r) => Number(r[value]))],
        text:    [...groups.map(() => ''), ...leaves.map((r) => fmtPct(chg(r)))],
        customdata: [...groups.map(() => null), ...leaves.map((r) => (link ? r[link] : null))],
        marker: {
          colors: [...groups.map(() => 'rgba(0,0,0,0)'), ...leaves.map((r) => heat(chg(r)))],
          line: { width: 2, color: c.panel },
        },
        textinfo: 'label+text',
        textposition: 'middle center',
        textfont: {
          family: FONT, size: 12,
          color: [...groups.map(() => c.muted), ...leaves.map((r) => (chg(r) == null ? c.text : c.onTile))],
        },
        hovertemplate: '%{label}  %{text}<extra></extra>',
        hoverlabel: { bgcolor: c.surface, bordercolor: c.line, font: { color: c.text, size: 11, family: FONT } },
        pathbar: { visible: false },
        tiling: { pad: 1 },
      }],
      layout: {
        margin: { t: 0, r: 0, b: 0, l: 0 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        font: { family: FONT, color: c.muted, size: 11 },
        uniformtext: { minsize: 9, mode: 'hide' },
      },
    };
  }, [rows, value, label, change, group, link, heatMax]);

  return (
    <div className="h-full px-2 pb-2">
      <Plot
        figure={figure}
        ariaLabel="트리맵"
        onClick={(point) => { if (point?.customdata) navigate(hrefFor(point.customdata)); }}
      />
    </div>
  );
}
