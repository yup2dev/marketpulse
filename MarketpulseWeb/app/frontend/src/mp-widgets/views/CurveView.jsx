/**
 * curve — 주인공 선 하나 + 비교 선들 (+ 아래 낙폭 창). 누적 수익 · 롤링 지표처럼 '내 것 대 기준'을 보는 차트.
 * 위에 범례(마지막 값)를 두고, 주인공 선은 굵은 강조색 + 0 까지 옅은 면, 비교 선은 회색이다.
 * 계열을 골라 가며 보는 차트는 lines 를 쓴다.
 *
 * options:
 *   x         'date'                    가로축 필드
 *   series    'strategy:전략,benchmark:보유'   '필드:이름' — 첫 계열이 주인공
 *   drawdown  'drawdown'                이 필드를 아래 창에 면으로 그린다 (값은 0 이하 %)
 *   excess    true                      범례 오른쪽에 '초과 = 주인공 − 둘째 계열'
 *   refs      '1'                       가로 기준선 값들 (점선)
 *   unit      '%'                       값 뒤 단위
 *   digits    1
 *   signed    true                      범례 값에 부호와 등락 색 (수익률). false 면 그대로
 */
import { useCallback, useMemo } from 'react';
import Plot, { FONT, withAlpha } from '../Plot';
import { fmtPct, toneOf } from '../format';
import { LineSwatch, parseSeries } from './parts';

const ACCENT = '#3182F6';
const DASHES = [undefined, undefined, 'dash', 'dot', 'dashdot'];

function dateTick(v, long) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  if (!m) return String(v);
  return long ? `${m[1].slice(2)}.${m[2]}` : `${m[2]}.${m[3]}`;
}

export default function CurveView({ rows, options = {} }) {
  const { x = 'date', series, drawdown, excess = false, refs, unit = '%', digits = 1, signed = true } = options;
  const all = useMemo(() => parseSeries(series || 'value'), [series]);
  const last = rows[rows.length - 1] || {};
  const show = (v) => {
    if (v == null) return '—';
    return signed ? fmtPct(v, digits).replace('%', unit) : `${Number(v).toFixed(digits)}${unit}`;
  };
  const dd = drawdown ? rows.map((r) => r[drawdown]).filter((v) => v != null).map(Number) : [];
  const maxDd = dd.length ? Math.min(...dd) : null;
  const gap = all.length > 1 && last[all[0].field] != null && last[all[1].field] != null
    ? last[all[0].field] - last[all[1].field] : null;

  const figure = useCallback((c) => {
    const xs = rows.map((r) => String(r[x] ?? ''));
    const n = xs.length;
    const long = n > 1 && (new Date(xs[n - 1]) - new Date(xs[0])) > 200 * 86400e3;
    const ticks = [0, 1, 2, 3, 4].map((i) => Math.round((i * (n - 1)) / 4)).filter((v, i, a) => a.indexOf(v) === i);
    const tickfont = { color: c.muted, size: 10.5, family: FONT };
    const main = drawdown ? 'y2' : 'y';
    // 비교 선을 먼저, 주인공을 맨 위에 그린다
    const data = all.map((s, i) => ({
      type: 'scatter', mode: 'lines', name: s.label, x: xs, y: rows.map((r) => r[s.field]), yaxis: main,
      connectgaps: true,
      line: i === 0 ? { color: ACCENT, width: 2.4 } : { color: c.muted, width: 1.5, dash: DASHES[i] },
      fill: i === 0 ? 'tozeroy' : undefined,
      fillcolor: i === 0 ? withAlpha(ACCENT, 0.1) : undefined,
      hovertemplate: `%{y:.${digits}f}${unit}<extra>${s.label}</extra>`,
    })).reverse();
    if (drawdown) {
      data.push({
        type: 'scatter', mode: 'lines', name: '낙폭', x: xs, y: rows.map((r) => r[drawdown]), yaxis: 'y',
        line: { color: c.down, width: 1 }, fill: 'tozeroy', fillcolor: withAlpha(c.down, 0.3),
        hovertemplate: '%{y:.1f}%<extra>낙폭</extra>',
      });
    }
    const axis = { fixedrange: true, gridcolor: c.grid, zeroline: true, zerolinecolor: c.axis, tickfont, ticksuffix: unit };
    return {
      data,
      layout: {
        margin: { t: 6, r: 14, b: 24, l: 46 },
        showlegend: false,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: FONT, color: c.muted, size: 10.5 },
        dragmode: false,
        hovermode: 'x unified',
        hoverlabel: { bgcolor: c.surface, bordercolor: c.line, font: { color: c.text, size: 11, family: FONT } },
        xaxis: {
          type: 'category', fixedrange: true, showgrid: false, linecolor: c.axis, tickangle: 0, tickfont,
          tickmode: 'array', tickvals: ticks.map((i) => xs[i]), ticktext: ticks.map((i) => dateTick(xs[i], long)),
        },
        ...(drawdown
          ? {
            yaxis: { ...axis, domain: [0, 0.2], nticks: 2, ticksuffix: '%', rangemode: 'tozero' },
            yaxis2: { ...axis, domain: [0.27, 1], nticks: 4 },
          }
          : { yaxis: { ...axis, nticks: 4 } }),
        shapes: String(refs ?? '').split(',').map((s) => s.trim()).filter(Boolean).map((v) => ({
          type: 'line', xref: 'paper', x0: 0, x1: 1, yref: main, y0: Number(v), y1: Number(v),
          line: { color: c.axis, width: 1, dash: 'dot' },
        })),
      },
    };
  }, [rows, x, all, drawdown, refs, unit, digits]);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-1 flex-shrink-0 text-xs text-[var(--mp-text-2)]">
        {all.map((s, i) => (
          <span key={s.field} className="flex items-center gap-1.5">
            <LineSwatch color={i === 0 ? ACCENT : 'var(--mp-muted)'} width={i === 0 ? 2.6 : 1.6} dash={i > 1 ? '4 3' : undefined} />
            {s.label}
            <span className="font-semibold" style={{ color: signed ? toneOf(last[s.field]) : 'var(--mp-text)' }}>{show(last[s.field])}</span>
          </span>
        ))}
        {maxDd != null && (
          <span className="text-[var(--mp-muted)]">최대 낙폭 <span className="font-semibold" style={{ color: toneOf(maxDd) }}>{fmtPct(maxDd, 1)}</span></span>
        )}
        {excess && gap != null && (
          <span className="ml-auto text-[var(--mp-muted)]">초과 <span className="font-semibold" style={{ color: toneOf(gap) }}>{fmtPct(gap, digits)}p</span></span>
        )}
      </div>
      <div className="flex-1 min-h-0 px-1 pb-1">
        <Plot figure={figure} ariaLabel={all.map((s) => `${s.label} ${show(last[s.field])}`).join(', ')} />
      </div>
    </div>
  );
}
