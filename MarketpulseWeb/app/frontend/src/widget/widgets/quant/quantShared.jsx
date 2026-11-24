/**
 * 퀀트 탭(메인 · 전략 설정 · 포트폴리오 설정)이 같이 쓰는 작은 부품과 표기.
 */

const KIND_TAG = {
  factor: ['팩터', 'bg-[#1B2A44] text-[#8FB8FF]'],
  ml: ['ML', 'bg-[#231A33] text-[#C4B5FD]'],
  mix: ['팩터+ML', 'bg-[#231A33] text-[#C4B5FD]'],
  none: ['보유', 'bg-[#14201A] text-[#3FC27A]'],
};

const pad = (n) => String(n).padStart(2, '0');

/** first ~ last(YYYY-MM-DD) 사이 월말 날짜 — 최근 달부터 */
export function monthEnds(first, last) {
  if (!first || !last) return [];
  const out = [];
  let y = Number(last.slice(0, 4));
  let m = Number(last.slice(5, 7));
  const stop = first.slice(0, 7);
  while (`${y}-${pad(m)}` >= stop && out.length < 600) {
    out.push(`${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`);
    m -= 1;
    if (!m) { m = 12; y -= 1; }
  }
  return out;
}

/** 점수 종류 — 'factor' · 'ml' · 'none', 팩터 조합에 ML 점수(ml_*)를 섞었으면 'mix' */
export function kindOf(s) {
  if (!s) return 'factor';
  if (s.score_kind !== 'factor') return s.score_kind;
  const ids = (s.factors || []).filter((f) => Number(f.weight) > 0).map((f) => f.factor_id);
  const ml = ids.filter((id) => id.startsWith('ml_')).length;
  if (!ml) return 'factor';
  return ml === ids.length ? 'ml' : 'mix';
}

/** 점수 종류 표시 — 팩터 / ML / 팩터+ML / 보유(대상 전부 보유) */
export function KindTag({ kind }) {
  const [label, cls] = KIND_TAG[kind] || KIND_TAG.factor;
  return <span className={`px-1.5 py-px rounded-md text-[10px] font-semibold whitespace-nowrap ${cls}`}>{label}</span>;
}

/** 전략 한 줄 요약 — '모멘텀 12-1 + 추세' (비중 큰 순) · 'ML 융합 · 스태킹 확률' · '반도체 전부 보유'
 *  + 대상 종목 묶음 · 매크로 조건 수. baskets = 내 포트폴리오 목록 (서버 행에 basket 이 있으면 그걸 쓴다) */
export function strategyHead(s, catalog, baskets = []) {
  if (!s) return '';
  const basket = s.basket || baskets.find((b) => b.portfolio_id === s.basket_id);
  let head;
  if (s.score_kind === 'none') {
    head = `${basket?.name || '묶음'} 전부 보유`;
  } else if (s.score_kind === 'ml') {
    head = `${catalog?.models?.find((m) => m.id === s.model)?.name || s.model} 확률`;
  } else {
    head = [...(s.factors || [])]
      .filter((f) => Number(f.weight) > 0)
      .sort((a, b) => b.weight - a.weight)
      .map((f) => catalog?.factors?.find((x) => x.id === f.factor_id)?.name || f.factor_id)
      .join(' + ') || '팩터 없음';
    if (basket) head = `${basket.name} 안 ${head}`;
  }
  const n = s.overlay?.rules?.length;
  return n ? `${head} · 매크로 조건 ${n}개` : head;
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
