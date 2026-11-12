/**
 * lines — 선 차트 (Plotly). 계열이 여럿이면 위에 칩을 두고 최대 max 개까지 골라 비교한다.
 *
 * options:
 *   x        'date'                     가로축 필드 (날짜면 MM.DD 눈금, 아니면 값 그대로)
 *   series   'y2:2Y,y10:10Y'            '필드:이름' 목록 — 계열 하나면 칩 없이 선 하나
 *   pick     'y2,y10'                   처음 골라 둘 계열 (없으면 앞에서부터 max 개)
 *   max      4                          같이 볼 수 있는 계열 수
 *   labels   false                      점마다 값을 적는다 (점이 적은 곡선용)
 *   unit     '%'                        값 뒤 단위
 *   digits   2                          소수 자릿수
 *
 * 세로축은 고른 계열의 범위에 맞춘다.
 */
import { useCallback, useMemo } from 'react';
import { useStored } from '../adapter';
import Plot, { FONT } from '../Plot';
import { SERIES_COLORS, SLICE_COLORS, parseSeries } from './parts';

const isDate = (v) => /^\d{4}-\d{2}-\d{2}/.test(String(v ?? ''));

function dateTick(v, long) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  if (!m) return String(v);
  return long ? `${m[1].slice(2)}.${m[2]}` : `${m[2]}.${m[3]}`;
}

export default function LinesView({ rows: input, ctx, options = {} }) {
  const { x = 'date', series, pick, max = 4, labels = false, unit = '', digits = 2 } = options;
  // 날짜 축이면 오래된 것부터 — 응답이 최신순으로 와도 왼쪽이 과거다
  const rows = useMemo(
    () => (isDate(input[0]?.[x]) ? [...input].sort((a, b) => String(a[x]).localeCompare(String(b[x]))) : input),
    [input, x],
  );
  const all = useMemo(
    // 계열이 서넛이면 또렷한 색부터, 많으면(만기 7개 등) 순서가 읽히는 색 줄
    () => parseSeries(series || 'value').map((s, i, a) => {
      const palette = a.length <= 3 ? SLICE_COLORS : SERIES_COLORS;
      return { ...s, color: palette[i % palette.length] };
    }),
    [series],
  );
  const multi = all.length > 1;

  const initial = useMemo(() => {
    const wanted = String(pick ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const found = all.filter((s) => wanted.includes(s.field)).map((s) => s.field);
    return (found.length ? found : all.map((s) => s.field)).slice(0, max);
  }, [all, pick, max]);
  const [stored, setStored] = useStored(`lines.${ctx?.tab?.id || '_'}`, null);
  const selected = useMemo(() => {
    const valid = (stored || []).filter((f) => all.some((s) => s.field === f));
    return valid.length ? valid : initial;
  }, [stored, all, initial]);

  const toggle = (field) => {
    const on = selected.includes(field);
    if (on && selected.length === 1) return;          // 하나는 남긴다
    if (!on && selected.length >= max) return;
    setStored(on ? selected.filter((f) => f !== field) : [...selected, field]);
  };

  const fmt = useCallback((v) => (v == null ? '—' : `${Number(v).toFixed(digits)}${unit}`), [digits, unit]);
  const last = rows[rows.length - 1] || {};

  const figure = useCallback((c) => {
    const xs = rows.map((r) => String(r[x] ?? ''));
    const n = xs.length;
    const dated = isDate(xs[0]);
    const long = dated && n > 1 && (new Date(xs[n - 1]) - new Date(xs[0])) > 200 * 86400e3;
    const ticks = dated
      ? [0, 1, 2, 3, 4].map((i) => Math.round((i * (n - 1)) / 4)).filter((v, i, a) => a.indexOf(v) === i)
      : xs.map((_, i) => i);
    const shown = all.filter((s) => selected.includes(s.field));
    const values = shown.flatMap((s) => rows.map((r) => r[s.field])).filter((v) => v != null).map(Number);
    const lo = Math.min(...values), hi = Math.max(...values);
    const pad = (hi - lo || Math.abs(hi) || 1) * (labels ? 0.22 : 0.08);
    const tickfont = { color: c.muted, size: 10.5, family: FONT };
    return {
      data: shown.map((s) => ({
        type: 'scatter',
        mode: labels ? 'lines+markers+text' : 'lines',
        name: s.label,
        x: xs,
        y: rows.map((r) => r[s.field]),
        connectgaps: true,
        line: { color: s.color, width: 2, shape: 'linear' },
        marker: { size: 8, color: c.panel, line: { color: s.color, width: 2 } },
        text: labels ? rows.map((r) => (r[s.field] == null ? '' : Number(r[s.field]).toFixed(digits))) : undefined,
        textposition: 'top center',
        textfont: { color: c.text, size: 12, family: FONT },
        cliponaxis: false,
        hovertemplate: `%{y:.${digits}f}${unit}<extra>${s.label}</extra>`,
      })),
      layout: {
        margin: { t: 8, r: 16, b: 24, l: 44 },
        showlegend: false,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: FONT, color: c.muted, size: 10.5 },
        dragmode: false,
        hovermode: labels ? false : 'x unified',
        hoverlabel: { bgcolor: c.surface, bordercolor: c.line, font: { color: c.text, size: 11, family: FONT } },
        xaxis: {
          type: 'category', fixedrange: true, showgrid: false, linecolor: c.axis, tickangle: 0, tickfont,
          tickmode: 'array', tickvals: ticks.map((i) => xs[i]),
          ticktext: ticks.map((i) => (dated ? dateTick(xs[i], long) : xs[i])),
        },
        yaxis: {
          fixedrange: true, nticks: 4, gridcolor: c.grid, zeroline: false, tickfont, ticksuffix: unit,
          range: values.length ? [lo - pad, hi + pad] : undefined,
        },
      },
    };
  }, [rows, x, all, selected, labels, unit, digits]);

  return (
    <div className="h-full flex flex-col min-h-0">
      {multi && (
        <div className="flex flex-wrap items-center gap-1 px-3 pb-1.5 flex-shrink-0">
          {all.map((s) => {
            const on = selected.includes(s.field);
            return (
              <button
                key={s.field}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(s.field)}
                className={`h-7 px-2 rounded-md border flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                  on ? 'bg-[var(--mp-tile)] text-[var(--mp-text)]' : 'border-[var(--mp-tile-line)] text-[var(--mp-muted)] hover:text-[var(--mp-text)]'
                }`}
                style={on ? { borderColor: s.color } : undefined}
              >
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: on ? s.color : 'var(--mp-grip)' }} aria-hidden="true" />
                {s.label}
                <span className={`font-medium ${on ? 'text-[var(--mp-text-2)]' : 'text-[var(--mp-faint)]'}`}>{fmt(last[s.field])}</span>
              </button>
            );
          })}
          {all.length > max && <span className="ml-auto text-[11px] text-[var(--mp-faint)]">최대 {max}개 비교</span>}
        </div>
      )}
      <div className="flex-1 min-h-0 px-1 pb-1">
        <Plot figure={figure} ariaLabel={all.filter((s) => selected.includes(s.field)).map((s) => s.label).join(', ')} />
      </div>
    </div>
  );
}
