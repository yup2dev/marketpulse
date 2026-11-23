/**
 * 퀀트 탭(메인 · 전략 설정 · 포트폴리오 설정)이 같이 쓰는 작은 부품과 표기.
 */

/** 점수 종류 표시 — 팩터 / ML */
export function KindTag({ kind }) {
  const ml = kind === 'ml';
  return (
    <span className={`px-1.5 py-px rounded-md text-[10px] font-semibold whitespace-nowrap ${ml ? 'bg-[#231A33] text-[#C4B5FD]' : 'bg-[#1B2A44] text-[#8FB8FF]'}`}>
      {ml ? 'ML' : '팩터'}
    </span>
  );
}

/** 전략 한 줄 요약 — '모멘텀 12-1 + 추세' (비중 큰 순) 또는 'ML 융합 · 스태킹 확률' */
export function strategyHead(s, catalog) {
  if (!s) return '';
  if (s.score_kind === 'ml') {
    return `${catalog?.models?.find((m) => m.id === s.model)?.name || s.model} 확률`;
  }
  const names = [...(s.factors || [])]
    .filter((f) => Number(f.weight) > 0)
    .sort((a, b) => b.weight - a.weight)
    .map((f) => catalog?.factors?.find((x) => x.id === f.factor_id)?.name || f.factor_id);
  return names.join(' + ') || '팩터 없음';
}

/** 판정 — 월간 IC 의 t 값 (= 연환산 ICIR × √(개월/12)) 기준 */
export function verdict(f) {
  if (f?.icir == null) return null;
  const t = Number(f.icir) * Math.sqrt((f.months || 120) / 12);
  if (t >= 3) return { label: '유의', cls: 'bg-[#14201A] text-[#3FC27A]' };
  if (t >= 2) return { label: '보통', cls: 'bg-[#1E1F23] text-[#C9C9CF]' };
  return { label: '약함', cls: 'bg-[#221B10] text-[#F5A623]' };
}

export const PANEL = 'rounded-lg bg-[var(--mp-panel)] border border-[var(--mp-tag)] flex flex-col min-h-0 overflow-hidden';
export const LBL = 'text-xs font-semibold text-[var(--mp-muted)]';
export const FIELD = 'h-9 px-2.5 rounded-md border border-[var(--mp-tile-line)] bg-[var(--mp-raised)] text-[13px] text-[var(--mp-text)] outline-none focus:border-[var(--mp-accent)] disabled:text-[var(--mp-muted)] disabled:bg-[var(--mp-panel)] tabular-nums';
const BTN = 'flex items-center gap-1.5 h-9 px-3.5 rounded-md text-[13px] font-semibold whitespace-nowrap transition-colors disabled:opacity-45 disabled:pointer-events-none';
export const BTN_PRIMARY = `${BTN} bg-[var(--mp-accent)] text-white hover:brightness-110`;
export const BTN_GHOST = `${BTN} border border-[var(--mp-tile-line)] text-[var(--mp-text)] hover:bg-[var(--mp-raised)]`;
export const BTN_DANGER = `${BTN} border border-[#4A2229] text-[#FF8A94] hover:bg-[#22141A]`;

/** 세그먼트 버튼 묶음 — [{ id, label, sub? }] */
export function Seg({ items, value, onChange, disabled = false, label, size = 'md' }) {
  const h = size === 'sm' ? 'h-[26px] px-2.5 text-xs' : 'h-8 px-3.5 text-[13px]';
  return (
    <div role="group" aria-label={label} className="flex flex-wrap self-start p-[3px] rounded-md bg-[var(--mp-raised)] border border-[var(--mp-tag)]">
      {items.map((it) => {
        const on = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(it.id)}
            className={`${h} rounded-md whitespace-nowrap disabled:cursor-default ${on ? 'bg-[var(--mp-chip-on)] text-[var(--mp-text)] font-bold' : 'text-[var(--mp-muted)] font-medium hover:text-[var(--mp-text)]'}`}
          >
            {it.label}{it.sub != null && <span className="ml-1 text-[var(--mp-faint)] font-medium">{it.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** 목록의 한 항목 (전략 · 포트폴리오) */
export function ListItem({ on, onClick, title, sub, right }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`w-full flex flex-col gap-1 px-3 py-2.5 rounded-md text-left text-[var(--mp-text)] hover:bg-[var(--mp-raised)] ${on ? 'bg-[var(--mp-raised)] ring-1 ring-inset ring-[var(--mp-accent)]' : ''}`}
    >
      <span className="flex items-center gap-2 w-full">
        <span className="flex-1 min-w-0 text-xs font-semibold truncate">{title}</span>
        {right}
      </span>
      <span className="w-full text-[11px] text-[var(--mp-muted)] truncate">{sub}</span>
    </button>
  );
}
