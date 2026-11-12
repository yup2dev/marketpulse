/**
 * donut — 비중 도넛 + 오른쪽 범례 목록. 행 = 조각.
 *
 * options: (각 칸은 필드 이름)
 *   value        'weight'      조각 크기 (합계로 나눠 비중을 낸다)
 *   label        'category'    조각 이름
 *   change       —             범례의 등락 칸 (%, 등락 색)
 *   detail        —             범례의 맨 오른쪽 칸 (숫자)
 *   centerLabel  —             가운데 첫 줄
 *   labelHeader · changeHeader · detailHeader   범례 머리 글자
 *
 * 가운데 둘째 줄은 meta.center (스펙의 transform 이 { rows, meta } 로 넘긴다).
 * 조각 색은 등락 색과 섞이지 않는 범주 색이다.
 */
import { fmtPct, toneOf, read } from '../format';
import { SLICE_COLORS } from './parts';

const R = 60;
const C = 2 * Math.PI * R;
const GAP = 2;

export default function DonutView({ rows, meta, ctx, options = {} }) {
  const {
    value = 'weight', label = 'category', change, detail,
    centerLabel, labelHeader, changeHeader, detailHeader,
  } = options;

  const slices = rows
    .map((row, i) => ({ row, size: Number(read(row, value, ctx)) || 0, name: read(row, label, ctx), color: SLICE_COLORS[i % SLICE_COLORS.length] }))
    .filter((s) => s.size > 0);
  const total = slices.reduce((sum, s) => sum + s.size, 0) || 1;
  let before = 0;
  const arcs = slices.map((s) => {
    const len = Math.max(0, (s.size / total) * C - GAP);
    const arc = { ...s, share: (s.size / total) * 100, dash: `${len.toFixed(2)} ${(C - len).toFixed(2)}`, offset: (-(before / total) * C).toFixed(2) };
    before += s.size;
    return arc;
  });
  const summary = arcs.map((a) => `${a.name} ${a.share.toFixed(1)}%`).join(', ');

  return (
    <div className="h-full flex items-center gap-4 px-4 pb-3 overflow-auto">
      <svg viewBox="0 0 160 160" className="flex-shrink-0" style={{ width: '42%', maxWidth: 200, minWidth: 120, maxHeight: '100%' }} role="img" aria-label={summary}>
        <circle cx="80" cy="80" r={R} fill="none" stroke="var(--mp-raised)" strokeWidth="22" />
        {arcs.map((a) => (
          <circle
            key={a.name} cx="80" cy="80" r={R} fill="none" stroke={a.color} strokeWidth="22"
            strokeDasharray={a.dash} strokeDashoffset={a.offset} transform="rotate(-90 80 80)"
          />
        ))}
        {centerLabel && (
          <text x="80" y={meta?.center ? 73 : 80} textAnchor="middle" dominantBaseline="central" fill="var(--mp-muted)" fontSize="12" fontWeight="500">{centerLabel}</text>
        )}
        {meta?.center && (
          <text x="80" y={centerLabel ? 87 : 80} textAnchor="middle" dominantBaseline="central" fill="var(--mp-text)" fontSize="12" fontWeight="500">{meta.center}</text>
        )}
      </svg>

      <div className="flex-1 min-w-0 flex flex-col">
        {(labelHeader || changeHeader || detailHeader) && (
          <div className="flex items-center gap-2 h-6 text-[11px] text-[var(--mp-muted)]">
            <span className="w-2 flex-shrink-0" />
            <span className="flex-1 min-w-0 truncate">{labelHeader}</span>
            {change && <span className="w-[60px] text-right flex-shrink-0">{changeHeader}</span>}
            {detail && <span className="w-9 text-right flex-shrink-0">{detailHeader}</span>}
          </div>
        )}
        {arcs.map((a) => {
          const chg = change ? read(a.row, change, ctx) : null;
          const ex = detail ? read(a.row, detail, ctx) : null;
          return (
            <div key={a.name} className="flex items-center gap-2 h-8">
              <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: a.color }} aria-hidden="true" />
              <span className="flex-1 min-w-0 truncate font-semibold" title={a.name}>
                {a.name} <span className="font-medium text-[var(--mp-muted)]">{a.share.toFixed(1)}%</span>
              </span>
              {change && (
                <span className="w-[60px] text-right font-semibold flex-shrink-0" style={{ color: toneOf(chg) }}>{chg != null ? fmtPct(chg) : '—'}</span>
              )}
              {detail && (
                <span className="w-9 text-right text-[var(--mp-text-2)] flex-shrink-0">{ex != null ? Number(ex).toFixed(2) : '—'}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
