/**
 * kv — 이름 · 값 목록 (박스 없이 얇은 밑줄, 넓으면 여러 열).
 *
 * options: (각 칸은 필드 이름 또는 (row, ctx) => 값)
 *   label    'label'    왼쪽 회색 이름
 *   value    'value'    오른쪽 값
 *   columns  2          넓을 때 열 수 (좁으면 1)
 */
import { read } from '../format';
import { useWidth } from './parts';

export default function KvView({ rows, ctx, options = {} }) {
  const { label = 'label', value = 'value', columns = 2 } = options;
  const [ref, width] = useWidth();
  const cols = width >= 360 ? columns : 1;

  return (
    <dl
      ref={ref}
      className="h-full overflow-auto grid content-start gap-x-6 px-4 pb-2 m-0"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {rows.map((row, i) => (
        <div key={row.id ?? i} className="flex items-center justify-between gap-3 h-9 border-b border-[var(--mpc-grid)] min-w-0">
          <dt className="truncate text-[var(--mp-muted)]">{read(row, label, ctx)}</dt>
          <dd className="m-0 font-semibold whitespace-nowrap">{read(row, value, ctx) ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
