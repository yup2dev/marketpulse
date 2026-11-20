/**
 * strip — 시간 순으로 이어 붙인 상태 띠 (예: 달마다의 시장 국면). 위에 지금 상태, 아래에 띠 · 범례 · 양 끝 날짜.
 *
 * options:
 *   x        'date'                          시점 필드
 *   state    'state'                         상태 필드
 *   states   'bull:강세,side:횡보,bear:약세'   '값:이름' — 적은 순서대로 밝은 색에서 어두운 색
 *   value    'p'                             지금 상태 옆에 적을 값 필드 (0~1 이면 %)
 *   valueLabel '확률'
 */
import { parseSeries } from './parts';

const SHADES = ['var(--mp-text-2)', 'var(--mp-muted)', 'var(--mp-chip-on)', 'var(--mp-tag)'];

export default function StripView({ rows, options = {} }) {
  const { x = 'date', state = 'state', states, value, valueLabel = '' } = options;
  const defs = parseSeries(states).map((s, i) => ({ ...s, color: SHADES[Math.min(i, SHADES.length - 1)] }));
  const byState = Object.fromEntries(defs.map((d) => [d.field, d]));
  const last = rows[rows.length - 1] || {};
  const now = byState[last[state]];
  const v = value ? last[value] : null;
  const month = (d) => String(d ?? '').slice(0, 7).replace('-', '.');

  return (
    <div className="h-full flex flex-col justify-center gap-2.5 px-4 pb-3 overflow-hidden">
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-[var(--mp-muted)]">현재</span>
        <span className="text-[17px] font-semibold">{now?.label ?? last[state] ?? '—'}</span>
        {v != null && (
          <span className="text-xs text-[var(--mp-muted)]">
            {valueLabel} <span className="font-semibold text-[var(--mp-text-2)]">{v <= 1 ? `${Math.round(v * 100)}%` : v}</span>
          </span>
        )}
        <span className="ml-auto flex items-center gap-3 text-[11px] text-[var(--mp-muted)]">
          {defs.map((d) => (
            <span key={d.field} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ background: d.color }} aria-hidden="true" />{d.label}
            </span>
          ))}
        </span>
      </div>
      <div
        role="img"
        aria-label={`${month(rows[0]?.[x])} ~ ${month(last[x])} 상태 변화, 현재 ${now?.label ?? ''}`}
        className="flex gap-px h-4"
      >
        {rows.map((r, i) => (
          <span
            key={r[x] ?? i}
            title={`${month(r[x])} · ${byState[r[state]]?.label ?? r[state]}`}
            className="flex-1 rounded-[1px]"
            style={{ background: byState[r[state]]?.color ?? 'var(--mp-tag)' }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-[var(--mp-faint)]">
        <span>{month(rows[0]?.[x])}</span>
        <span>{month(rows[Math.floor(rows.length / 2)]?.[x])}</span>
        <span>{month(last[x])}</span>
      </div>
    </div>
  );
}
