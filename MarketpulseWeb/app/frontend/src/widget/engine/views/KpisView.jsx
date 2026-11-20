/**
 * kpis — 성과 요약 줄. '이름 / 큰 값 / 비교 값' 세 줄짜리 칸을 얇은 세로선으로 나눠 한 줄로 늘어놓는다
 * (백테스트 성과 · 기관 요약). 머리줄 없는 한 줄 패널로 그려진다 (bare) — 칸을 박스로 만들지 않는다.
 * stats 는 한 줄짜리(이름 값), kpis 는 값이 주인공인 요약이다.
 *
 * options: (각 칸은 필드 이름 또는 (row, ctx) => 값)
 *   label   'label'   회색 이름
 *   value   'value'   큰 값
 *   sub     'sub'     값 아래 흐린 비교 값 (예: 'BM +12.3%')
 *   tone    'tone'    값의 색을 정하는 숫자 (부호) — 없으면 기본 글자색
 *
 * 행에 lead: true 가 있으면 그 칸은 '로고 + 이름 + 설명' 으로 그린다 (누구의 요약인지).
 */
import { read, toneOf } from '../format';
import { StockLogo } from './parts';

KpisView.bare = true;

export default function KpisView({ rows, ctx, options = {} }) {
  const { label = 'label', value = 'value', sub = 'sub', tone = 'tone' } = options;
  return (
    <dl className="h-full m-0 flex items-stretch overflow-x-auto overflow-y-hidden">
      {rows.map((row, i) => {
        const name = read(row, label, ctx);
        const s = read(row, sub, ctx);
        const t = read(row, tone, ctx);
        const edge = i ? 'border-l border-[var(--mp-tile-line)]' : '';
        if (row.lead) {
          return (
            <div key={row.id ?? i} className={`flex items-center gap-2.5 px-3.5 min-w-[200px] flex-[1.6_1_0] ${edge}`}>
              <StockLogo symbol={name} name={name} />
              <div className="min-w-0">
                <dt className="font-semibold truncate" title={name}>{name}</dt>
                <dd className="m-0 text-[11px] text-[var(--mp-muted)] truncate">{read(row, value, ctx)}</dd>
              </div>
            </div>
          );
        }
        return (
          <div key={row.id ?? i} className={`flex flex-col justify-center gap-px px-3.5 min-w-[112px] flex-1 whitespace-nowrap ${edge}`}>
            <dt className="text-[11px] text-[var(--mp-muted)]">{name}</dt>
            <dd className="m-0 text-[17px] leading-tight font-semibold" style={t != null ? { color: toneOf(t) } : undefined}>
              {read(row, value, ctx) ?? '—'}
            </dd>
            {s != null && s !== '' && <span className="text-[10.5px] text-[var(--mp-faint)]">{s}</span>}
          </div>
        );
      })}
    </dl>
  );
}
