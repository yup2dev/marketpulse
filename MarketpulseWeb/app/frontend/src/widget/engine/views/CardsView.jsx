/**
 * cards — 핵심 숫자 몇 개를 작은 카드 격자로 (이름 / 큰 값). 넓이에 맞춰 열 수가 바뀐다.
 * kpis 는 테두리 없는 한 줄 요약, cards 는 칸마다 상자다 — 계산 결과(NPV · IRR …)처럼 몇 개를 한눈에 볼 때.
 *
 * options: (각 칸은 필드 이름 또는 (row, ctx) => 값)
 *   label   'label'   회색 이름
 *   value   'value'   값 — 이미 표기된 글자 · 숫자 · 참/거짓(Yes/No, 등락 색)
 *   hint    'hint'    이름에 올리면 보이는 설명
 *   tone    'tone'    값의 색을 정하는 숫자 (부호) — 없으면 기본 글자색
 *   min     120       카드 최소 폭(px)
 */
import { read, toneOf } from '../format';

function show(v) {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

export default function CardsView({ rows, ctx, options = {} }) {
  const { label = 'label', value = 'value', hint = 'hint', tone = 'tone', min = 120 } = options;
  return (
    <dl className="m-0 grid gap-2 p-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` }}>
      {rows.map((row, i) => {
        const name = read(row, label, ctx);
        const v = read(row, value, ctx);
        const t = typeof v === 'boolean' ? (v ? 1 : -1) : read(row, tone, ctx);
        return (
          <div key={row.key ?? row.id ?? i} className="min-w-0 rounded-md border border-[var(--mp-tile-line)] bg-[var(--mp-tile)] px-3 py-2">
            <dt className="text-[11px] text-[var(--mp-muted)] truncate" title={read(row, hint, ctx) || name}>{name}</dt>
            <dd className="m-0 mt-0.5 text-base font-semibold tabular-nums truncate" style={t != null ? { color: toneOf(t) } : undefined}>
              {show(v)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
