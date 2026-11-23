/**
 * OverlayEditor — 포트폴리오의 매크로 조건 (포트폴리오 설정 탭 오른쪽 아래).
 *
 * 조건이 켜진 달만 담은 종목을 목표 비중으로 보유하고, 꺼진 달은 전부 현금이다.
 * 매달 말 그때까지의 지표 값으로 판단한다 (서버 quant_portfolio_service.overlay_states).
 * 지표는 로컬 배치가 월별 패널에 '^' 행으로 넣는 시장 지표 (batch quant/macro.py) — 적재 안 된 지표는 '적재 전'.
 *
 * value = null (조건 없음 — 늘 보유) | { mode: 'all' | 'any', rules: [{ series, transform, op, value }] }
 */
import { Plus, X } from 'lucide-react';
import { LBL, Seg } from './quantShared';

const MODES = [{ id: 'all', label: '모두 맞을 때' }, { id: 'any', label: '하나라도 맞을 때' }];
const SELECT = 'h-7 min-w-0 px-1.5 rounded border border-[var(--mp-tile-line)] bg-[var(--mp-raised)] text-xs text-[var(--mp-text)] outline-none focus:border-[var(--mp-accent)] [&_option]:bg-[var(--mp-panel)]';
// 첫 조건 — 시안의 반도체 예시 (금리 하락 + 구리가 12개월 평균 위)
const PRESET = [
  { series: '^TNX', transform: 'chg_3m', op: '<', value: 0 },
  { series: '^HG', transform: 'ma12_gap', op: '>', value: 0 },
];

export default function OverlayEditor({ value, onChange, catalog = {}, loaded = [] }) {
  const series = catalog.macro || [];
  const transforms = catalog.transforms || [];
  const ops = catalog.ops || ['>', '>=', '<', '<='];
  const rules = value?.rules || [];
  const set = (next) => onChange(next.length ? { mode: value?.mode || 'all', rules: next } : null);
  const patch = (i, p) => set(rules.map((r, k) => (k === i ? { ...r, ...p } : r)));
  // 기준값 단위 — 금리 · 포인트 지표의 변화는 %p, 가격 지표의 변화 · 평균 대비는 %, 값은 단위 없음
  const unitOf = (r, kind) => (r.transform === 'level' ? '' : (r.transform === 'chg_3m' || r.transform === 'chg_1m') && kind === 'rate' ? '%p' : '%');

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${LBL} w-[72px]`}>매크로 조건</span>
        {rules.length > 0 ? (
          <Seg label="조건 묶음" size="sm" value={value.mode} onChange={(m) => onChange({ ...value, mode: m })} items={MODES} />
        ) : (
          <span className="text-[11.5px] text-[var(--mp-muted)]">없음 — 늘 보유</span>
        )}
      </div>

      {rules.map((r, i) => {
        const s = series.find((x) => x.id === r.series);
        const missing = loaded.length > 0 && !loaded.includes(r.series);
        return (
          <div key={i} className="flex items-center gap-1.5">
            <select aria-label="지표" className={`${SELECT} flex-[1.4]`} value={r.series} onChange={(e) => patch(i, { series: e.target.value })}>
              {series.map((x) => <option key={x.id} value={x.id}>{x.name}{loaded.length && !loaded.includes(x.id) ? ' (적재 전)' : ''}</option>)}
            </select>
            <select aria-label="변환" className={`${SELECT} flex-[1.3]`} value={r.transform} onChange={(e) => patch(i, { transform: e.target.value })}>
              {transforms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select aria-label="비교" className={`${SELECT} w-12`} value={r.op} onChange={(e) => patch(i, { op: e.target.value })}>
              {ops.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <input
              aria-label={`${s?.name || r.series} 기준값`} type="number" step="0.1" value={String(r.value)}
              onChange={(e) => patch(i, { value: Number(e.target.value) || 0 })}
              className={`${SELECT} w-14 text-right tabular-nums`}
            />
            <span className="w-5 text-[11px] text-[var(--mp-muted)]">{unitOf(r, s?.kind)}</span>
            <button type="button" aria-label="조건 빼기" onClick={() => set(rules.filter((_, k) => k !== i))}
              className="w-6 h-6 rounded flex items-center justify-center text-[var(--mp-muted)] hover:bg-[var(--mp-raised)] hover:text-[var(--mp-text)]">
              <X size={11} aria-hidden="true" />
            </button>
            {missing && <span className="sr-only">이 지표는 아직 적재되지 않았어요</span>}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button" disabled={rules.length >= 5}
          onClick={() => set(rules.length ? [...rules, { series: series[0]?.id || '^TNX', transform: 'level', op: '>', value: 0 }] : PRESET)}
          className="flex items-center gap-1 h-7 px-2 rounded-md border border-[var(--mp-tile-line)] text-xs text-[var(--mp-text)] hover:bg-[var(--mp-raised)] disabled:opacity-45"
        >
          <Plus size={12} aria-hidden="true" />{rules.length ? '조건 추가' : '조건 추가 (예: 금리 하락 + 구리 강세)'}
        </button>
        {rules.some((r) => loaded.length > 0 && !loaded.includes(r.series)) && (
          <span className="text-[11px] text-[#F5B748]">적재 전 지표가 있어요 — 백테스트가 안 돼요</span>
        )}
      </div>
      <span className="text-[11.5px] text-[var(--mp-muted)]">조건이 꺼진 달은 전부 현금 · 매달 말 그때까지의 지표 값으로 판단</span>
    </div>
  );
}
