/**
 * heatmap — 줄 × 칸 격자, 칸의 색 = 값의 부호와 크기 (예: 연 × 월 수익률).
 * 오른쪽 끝에 줄 합계(연간), 아래에 가장 큰 칸 · 가장 작은 칸 · 오른 칸 수를 적는다.
 *
 * options: (row · col · value 는 필드 이름)
 *   row       'year'      줄 (위가 최신)
 *   col       'month'     칸 — cols 에 적은 순서대로 놓는다
 *   value     'value'     값 (%)
 *   cols      '1,2,…,12'  칸 머리. 안 적으면 1~12
 *   rowSuffix ''          줄 이름 뒤 글자 (예: '년')
 *   total     'compound'  줄 합계 — compound(복리) · sum · none
 *   totalHeader '연간'
 *   max       8           이 크기에서 색이 가장 진해진다
 *   digits    1
 */
import { fmtPct, toneOf } from '../format';

const numbers12 = '1,2,3,4,5,6,7,8,9,10,11,12';

function cellColor(v, max) {
  const strength = 18 + Math.min(Math.abs(v) / max, 1) * 62;   // 18% ~ 80%
  return `color-mix(in srgb, ${toneOf(v)} ${strength.toFixed(0)}%, transparent)`;
}

export default function HeatmapView({ rows, options = {} }) {
  const {
    row = 'year', col = 'month', value = 'value', cols = numbers12, rowSuffix = '',
    total = 'compound', totalHeader = '연간', max = 8, digits = 1,
  } = options;
  const heads = String(cols).split(',').map((s) => s.trim());
  const byRow = new Map();
  for (const r of rows) {
    if (r[value] == null) continue;
    const key = String(r[row]);
    if (!byRow.has(key)) byRow.set(key, {});
    byRow.get(key)[String(r[col])] = Number(r[value]);
  }
  const lines = [...byRow.entries()].sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true }));
  const all = rows.map((r) => r[value]).filter((v) => v != null).map(Number);
  const best = all.length ? Math.max(...all) : null;
  const worst = all.length ? Math.min(...all) : null;
  const ups = all.filter((v) => v > 0).length;
  const showTotal = total !== 'none';
  const template = `minmax(34px, auto) repeat(${heads.length}, minmax(0, 1fr))${showTotal ? ' minmax(46px, auto)' : ''}`;

  return (
    <div className="h-full overflow-auto px-3 pb-3">
      <div className="grid gap-0.5 text-[10.5px] min-w-[420px]" style={{ gridTemplateColumns: template }}>
        <span />
        {heads.map((h) => (
          <span key={h} className="h-5 flex items-center justify-center text-[var(--mp-muted)]">{h}</span>
        ))}
        {showTotal && <span className="h-5 flex items-center justify-end text-[var(--mp-muted)]">{totalHeader}</span>}
        {lines.map(([name, cells]) => {
          const vals = heads.map((h) => cells[h]).filter((v) => v != null);
          const sum = total === 'sum'
            ? vals.reduce((a, b) => a + b, 0)
            : (vals.reduce((a, b) => a * (1 + b / 100), 1) - 1) * 100;
          return [
            <span key={`${name}-n`} className="flex items-center text-[11px] text-[var(--mp-muted)] whitespace-nowrap pr-1">{name}{rowSuffix}</span>,
            ...heads.map((h) => {
              const v = cells[h];
              if (v == null) return <span key={`${name}-${h}`} className="h-[30px] rounded-[3px] bg-[var(--mp-tile)]" />;
              return (
                <span
                  key={`${name}-${h}`}
                  title={`${name}${rowSuffix} ${h} · ${fmtPct(v, 2)}`}
                  className="h-[30px] rounded-[3px] flex items-center justify-center font-semibold overflow-hidden text-[var(--mp-text)]"
                  style={{ background: cellColor(v, max) }}
                >
                  {Math.abs(v) >= 10 ? Math.round(v) : v.toFixed(digits)}
                </span>
              );
            }),
            showTotal && (
              <span key={`${name}-t`} className="flex items-center justify-end text-[11px] font-semibold" style={{ color: toneOf(sum) }}>
                {vals.length ? fmtPct(sum, digits) : '—'}
              </span>
            ),
          ];
        })}
      </div>
      {best != null && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[11px] text-[var(--mp-muted)]">
          <span>최고 <span className="font-semibold" style={{ color: toneOf(best) }}>{fmtPct(best, digits)}</span></span>
          <span>최저 <span className="font-semibold" style={{ color: toneOf(worst) }}>{fmtPct(worst, digits)}</span></span>
          <span className="ml-auto">상승 {ups} / {all.length}</span>
        </div>
      )}
    </div>
  );
}
