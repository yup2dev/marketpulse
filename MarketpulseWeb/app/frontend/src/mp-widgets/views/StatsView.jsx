/**
 * stats — 요약 줄. 박스 없이 '이름 값'을 얇은 세로선으로 구분해 한 줄로 늘어놓는다.
 * 머리줄 없는 한 줄 패널로 그려진다 (bare) — 지표 칸을 박스로 만들지 않는다.
 *
 * options: (각 칸은 필드 이름 또는 (row, ctx) => 값)
 *   label   'label'   회색 이름
 *   value   'value'   값
 *   note    'note'    값 뒤 주황 상태 글자 (있을 때만)
 */
import { read } from '../format';

StatsView.bare = true;

export default function StatsView({ rows, ctx, options = {} }) {
  const { label = 'label', value = 'value', note = 'note' } = options;
  return (
    <dl className="h-full m-0 flex flex-wrap items-center content-center gap-y-1.5 overflow-hidden">
      {rows.map((row, i) => {
        const n = read(row, note, ctx);
        return (
          <div
            key={row.id ?? i}
            className={`flex items-baseline gap-1.5 px-3.5 whitespace-nowrap ${i ? 'border-l border-[var(--mp-tile-line)]' : ''}`}
          >
            <dt className="text-xs text-[var(--mp-muted)]">{read(row, label, ctx)}</dt>
            <dd className="m-0 font-semibold">{read(row, value, ctx) ?? '—'}</dd>
            {n && <span className="text-[11px] font-semibold text-[#E0A845]">{n}</span>}
          </div>
        );
      })}
    </dl>
  );
}
