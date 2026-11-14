/**
 * columns — 세로 막대 + 막대 위 값 · 아래 이름. 항목이 몇 개 안 되는 시계열 (예: 분기 배당).
 * 막대가 좁아지면 값·이름을 건너뛰며 보여 준다 (마지막 막대는 항상 보인다).
 *
 * options: (각 칸은 필드 이름 또는 (row, ctx) => 값)
 *   label    'label'   막대 아래 이름
 *   value    'value'   막대 높이를 정하는 숫자
 *   prefix   ''        값 앞 글자 (예: '$')
 *   digits   2         값의 소수 자릿수
 */
import { read } from '../format';
import { useWidth } from './parts';

const MIN_LABEL_PX = 44;   // 값·이름 한 칸이 읽히는 최소 폭

export default function ColumnsView({ rows, ctx, options = {} }) {
  const { label = 'label', value = 'value', prefix = '', digits = 2 } = options;
  const [ref, width] = useWidth();
  const values = rows.map((r) => Number(read(r, value, ctx)) || 0);
  const max = Math.max(...values, 0) || 1;
  const n = rows.length;
  const gap = n > 8 ? 4 : 12;
  // 한 칸이 좁으면 step 개마다 하나씩만 글자를 단다 — 끝(최신)에서부터 센다
  const slot = n ? (width - 32) / n : 0;
  const step = slot > 0 ? Math.max(1, Math.ceil(MIN_LABEL_PX / slot)) : 1;

  return (
    <div ref={ref} className="h-full flex items-end px-4 pt-2 pb-3" style={{ gap }}>
      {rows.map((row, i) => {
        const v = values[i];
        const text = `${prefix}${v.toFixed(digits)}`;
        const name = read(row, label, ctx);
        const shown = (n - 1 - i) % step === 0;
        return (
          <div key={row.id ?? i} className="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-1.5" title={`${name} · ${text}`}>
            <span className="text-xs font-semibold whitespace-nowrap" style={{ visibility: shown ? 'visible' : 'hidden' }}>{text}</span>
            <span
              className="w-full max-w-[56px] rounded-t-md bg-[var(--mp-accent)]"
              style={{ height: `${Math.max(2, Math.round((v / max) * 80))}%`, minHeight: 2 }}
            />
            <span className="text-[11px] text-[var(--mp-muted)] whitespace-nowrap" style={{ visibility: shown ? 'visible' : 'hidden' }}>{name}</span>
          </div>
        );
      })}
    </div>
  );
}
