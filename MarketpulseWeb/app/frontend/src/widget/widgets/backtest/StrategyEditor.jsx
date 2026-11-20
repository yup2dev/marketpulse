/**
 * StrategyEditor — 포트폴리오 전략 만들기 · 고치기 팝오버 (백테스트 머리줄의 StrategyPicker 가 연다).
 *   팩터 전략: 고른 팩터 z-점수의 가중 평균 — 서버가 바로 계산
 *   ML 전략:  로컬 배치가 학습해 적재한 표본 밖 확률 — 서버는 고른 확률로 줄만 세운다
 */
import { Copy, X } from 'lucide-react';
import { HeaderSeg } from '../../../common/widget/WidgetCard';

export const FIELD = 'h-7 px-2 rounded-md bg-[var(--mp-raised)] text-xs text-[var(--mp-text)] outline-none focus:ring-1 focus:ring-[var(--mp-accent)] tabular-nums';
export const BTN = 'h-7 px-2.5 rounded-md text-xs flex items-center gap-1.5 transition-colors';
export const GHOST = `${BTN} text-[var(--mp-text-2)] hover:bg-[var(--mp-raised)] hover:text-[var(--mp-text)] disabled:opacity-40 disabled:pointer-events-none`;
export const PRIMARY = `${BTN} bg-[var(--mp-accent)] text-white font-bold hover:brightness-110 disabled:opacity-50`;

export const blank = (catalog) => ({
  name: '새 전략',
  description: '',
  score_kind: 'factor',
  model: 'stack',
  factors: (catalog?.factors || []).slice(0, 2).map((f) => ({ factor_id: f.id, weight: 1 })),
  top_n: 30,
  rebalance: 'M',
});

export function summary(s, catalog) {
  if (!s) return '';
  const reb = s.rebalance === 'Q' ? '분기' : '월간';
  if (s.score_kind === 'ml') {
    const m = catalog?.models?.find((x) => x.id === s.model)?.name || s.model;
    return `${m} · ${reb} · 상위 ${s.top_n}종목`;
  }
  const names = s.factors.map((f) => catalog?.factors?.find((x) => x.id === f.factor_id)?.name || f.factor_id);
  return `${names.length > 2 ? `팩터 ${names.length}개` : names.join(' + ')} · ${reb} · 상위 ${s.top_n}종목`;
}

export default function StrategyEditor({ form, setForm, catalog, saving, error, onSave, onCopy, onClose }) {
  const patch = (p) => setForm({ ...form, ...p });
  const weightOf = (id) => form.factors.find((f) => f.factor_id === id);
  const toggle = (id) => patch({
    factors: weightOf(id) ? form.factors.filter((f) => f.factor_id !== id) : [...form.factors, { factor_id: id, weight: 1 }],
  });
  const setWeight = (id, w) => patch({ factors: form.factors.map((f) => (f.factor_id === id ? { ...f, weight: w } : f)) });
  const [minN, maxN] = catalog?.top_n || [5, 100];

  return (
    <div
      role="dialog"
      aria-label={form.id ? '전략 편집' : '새 전략'}
      className="absolute left-0 top-full mt-1 z-50 w-[380px] max-w-[calc(100vw-32px)] rounded-lg bg-[var(--mp-panel)] border border-[var(--mp-tile-line)] shadow-2xl p-3 flex flex-col gap-3 text-xs"
    >
      <div className="flex items-center justify-between">
        <span className="font-bold text-sm text-[var(--mp-text)]">{form.id ? '전략 편집' : '새 전략'}</span>
        <button type="button" aria-label="닫기" onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center text-[var(--mp-muted)] hover:text-[var(--mp-text)]"><X size={13} /></button>
      </div>

      <label className="flex flex-col gap-1 text-[var(--mp-muted)]">
        이름
        <input value={form.name} maxLength={100} onChange={(e) => patch({ name: e.target.value })} className={`${FIELD} w-full`} />
      </label>
      <label className="flex flex-col gap-1 text-[var(--mp-muted)]">
        설명 <span className="sr-only">(선택)</span>
        <input value={form.description} maxLength={300} placeholder="선택" onChange={(e) => patch({ description: e.target.value })} className={`${FIELD} w-full`} />
      </label>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[var(--mp-muted)]">점수</span>
        <HeaderSeg
          value={form.score_kind}
          options={[{ value: 'factor', label: '팩터 조합' }, { value: 'ml', label: 'ML 모델' }]}
          onChange={(v) => patch({ score_kind: v })}
          ariaLabel="점수 종류"
        />
      </div>

      {form.score_kind === 'factor' ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="text-[var(--mp-muted)] mb-1">팩터 · 가중치 <span className="text-[var(--mp-faint)]">— 서버가 바로 계산</span></legend>
          {(catalog?.factors || []).map((f) => {
            const on = weightOf(f.id);
            return (
              <div key={f.id} className="flex items-center gap-2 h-8 px-2 rounded-md bg-[var(--mp-tile)]">
                <input id={`fac-${f.id}`} type="checkbox" checked={!!on} onChange={() => toggle(f.id)} className="accent-[var(--mp-accent)]" />
                <label htmlFor={`fac-${f.id}`} className="flex-1 min-w-0">
                  <span className="text-[var(--mp-text)] font-semibold">{f.name}</span>
                  <span className="ml-1.5 text-[var(--mp-faint)] text-[11px]">{f.desc}</span>
                </label>
                <input
                  type="number" min={0.5} max={10} step={0.5} aria-label={`${f.name} 가중치`}
                  disabled={!on} value={on ? on.weight : ''}
                  onChange={(e) => setWeight(f.id, Number(e.target.value))}
                  className={`${FIELD} w-14 text-right disabled:opacity-30`}
                />
              </div>
            );
          })}
        </fieldset>
      ) : (
        <label className="flex flex-col gap-1 text-[var(--mp-muted)]">
          모델 <span className="text-[var(--mp-faint)]">— 로컬 배치가 학습한 표본 밖 확률 (학습은 서버에서 하지 않아요)</span>
          <select value={form.model} onChange={(e) => patch({ model: e.target.value })} className={`${FIELD} w-full`}>
            {(catalog?.models || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
      )}

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-[var(--mp-muted)]">
          보유 종목
          <input type="number" min={minN} max={maxN} step={5} value={form.top_n}
            onChange={(e) => patch({ top_n: Number(e.target.value) })} className={`${FIELD} w-16 text-right`} />
        </label>
        <span className="flex items-center gap-1.5 text-[var(--mp-muted)] ml-auto">
          리밸런싱
          <HeaderSeg value={form.rebalance} options={[{ value: 'M', label: '월간' }, { value: 'Q', label: '분기' }]}
            onChange={(v) => patch({ rebalance: v })} ariaLabel="리밸런싱" />
        </span>
      </div>

      {error && <p role="alert" className="text-red-400">{error}</p>}

      <div className="flex items-center justify-end gap-1.5">
        {onCopy && <button type="button" className={GHOST} onClick={onCopy}><Copy size={12} />다른 이름으로</button>}
        <button type="button" className={GHOST} onClick={onClose}>취소</button>
        <button type="button" className={PRIMARY} onClick={onSave} disabled={saving}>{saving ? '저장 중…' : '저장하고 실행'}</button>
      </div>
    </div>
  );
}
