/**
 * bars — 이름 · 값 + 얇은 가로 막대 목록. 막대 길이 = 가장 큰 값 대비 비율 (예: 기관 보유).
 *
 * options: (각 칸은 필드 이름 또는 (row, ctx) => 값)
 *   label      'label'   이름 (넘치면 …)
 *   value      'value'   막대 길이를 정하는 숫자
 *   sub                  이름 뒤 흐린 글자 (예: 지분율)
 *   format     'compact' 값 표기 — compact(1.2B) · number · pct
 *   prefix     ''        값 앞 글자 (예: '$')
 *   digits     2         compact · pct 의 소수 자릿수
 *   rowHeight  44
 */
import { fmtCompact, fmtNumber, read } from '../format';

function formatValue(v, { format = 'compact', prefix = '', digits = 2 }) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  if (format === 'pct') return `${Number(v).toFixed(digits)}%`;
  return `${prefix}${format === 'number' ? fmtNumber(v) : fmtCompact(v, digits)}`;
}

export default function BarsView({ rows, ctx, options = {} }) {
  const { label = 'label', value = 'value', sub, rowHeight = 44 } = options;
  const max = Math.max(...rows.map((r) => Math.abs(Number(read(r, value, ctx)) || 0)), 0) || 1;

  return (
    <div className="h-full overflow-auto pb-1">
      {rows.map((row, i) => {
        const name = read(row, label, ctx);
        const v = read(row, value, ctx);
        const s = read(row, sub, ctx);
        return (
          <div
            key={row.id ?? i}
            className="flex flex-col justify-center gap-[5px] px-4 hover:bg-[var(--mp-row-hover)] transition-colors"
            style={{ height: rowHeight }}
            title={name}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate font-semibold">
                {name}{s != null && s !== '' && <span className="font-normal text-[var(--mp-faint)]"> · {s}</span>}
              </span>
              <span className="flex-shrink-0 font-semibold">{formatValue(v, options)}</span>
            </div>
            <span className="block h-[3px] rounded-sm bg-[var(--mp-tag)] overflow-hidden" aria-hidden="true">
              <span
                className="block h-full bg-[var(--mp-accent)]"
                style={{ width: `${Math.round((Math.abs(Number(v) || 0) / max) * 100)}%` }}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
}
