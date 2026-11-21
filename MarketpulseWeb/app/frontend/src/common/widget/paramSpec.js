/**
 * 레지스트리(widgetEndpoints) param 스펙 해석 — UniversalWidget·WidgetParamForm 이 같이 쓴다.
 *
 * param 확장 필드:
 *   pin: true            헤더 버튼 자리에 현재 값을 칩으로 보여 준다 (팝오버를 안 열어도 보이게)
 *   chip: (v) => '21D'   칩에 보일 표기 (숫자 값에 단위를 붙일 때)
 *   emptyLabel: 'Latest' 빈 값의 뜻 — 칩에 그 표기를, 입력칸 옆에 되돌리기 버튼을 둔다
 *   showIf: { metric: 'quantile' } | { metric: ['a','b'] } | (values) => bool
 *                        조건이 맞을 때만 입력칸을 보이고 요청에 싣는다
 *
 * 적용 규칙 (위젯마다 정하지 않는다):
 *   보이는 입력칸이 전부 select·date 면 고르는 즉시 적용, 숫자·텍스트가 하나라도 있으면 Apply.
 */

export function isParamVisible(p, values) {
  const cond = p.showIf;
  if (!cond) return true;
  if (typeof cond === 'function') return !!cond(values || {});
  return Object.entries(cond).every(([k, want]) =>
    (Array.isArray(want) ? want.includes(values?.[k]) : values?.[k] === want));
}

export function visibleParams(spec, values) {
  return (spec || []).filter((p) => isParamVisible(p, values));
}

export function isInstantForm(spec) {
  return !!spec?.length && spec.every((p) => p.kind === 'select' || p.kind === 'date');
}

/** 칩·제목에 보일 값 — select 는 옵션 라벨, 나머지는 값 그대로 */
export function paramDisplayValue(p, value) {
  if (value == null || value === '') return p.emptyLabel ?? '—';
  if (p.kind === 'select') {
    const opt = (p.options || []).find((o) => String(typeof o === 'object' ? o.value : o) === String(value));
    if (opt && typeof opt === 'object') return opt.label ?? String(opt.value);
  }
  return String(value);
}

// 약어는 대문자 그대로 둔다
const ACRONYMS = new Set(['npv', 'eps', 'pe', 'roe', 'roa', 'aum', 'id', 'url', 'qoq', 'yoy', 'adf', 'capm', 'ttm']);

/** snake_case 키 → 사람이 읽는 라벨 ('days_to_expiry' → 'Days to expiry', 'p_25' → 'P25') */
export function humanizeKey(key) {
  const parts = String(key).split('_').filter(Boolean);
  if (parts.length === 2 && /^[a-z]$/.test(parts[0]) && /^\d+$/.test(parts[1])) return `${parts[0].toUpperCase()}${parts[1]}`;
  return parts
    .map((w, i) => (ACRONYMS.has(w) ? w.toUpperCase() : (i === 0 ? w[0].toUpperCase() + w.slice(1) : w)))
    .join(' ');
}

/**
 * 레지스트리 columns 설정을 자동 컬럼에 적용한다.
 *   columns: { hide: ['institution_key'], order: ['name', …], labels: { aum_change_pct: 'AUM change' },
 *              formats: { weight: 'percent' } }   // 표시 형식 — 자동 추론을 덮어쓴다
 * 열은 MpGrid 열 정의({ field, header, type }) — widget/render/autoRender.autoColumns 가 만든다.
 */
// formats 값(위젯 설정에 저장된 이름) → MpGrid 열 종류
const FORMAT_TYPES = {
  number:    { type: 'number', digits: 2 },
  percent:   { type: 'percent' },
  currency:  { type: 'price' },
  magnitude: { type: 'compact', digits: 2 },
  date:      { type: 'date' },
  none:      { type: 'text' },
};

export function applyColumnConfig(cols, cfg) {
  if (!cfg) return cols;
  const hide = new Set(cfg.hide || []);
  let out = cols.filter((c) => !hide.has(c.field));
  if (cfg.labels) out = out.map((c) => (cfg.labels[c.field] ? { ...c, header: cfg.labels[c.field] } : c));
  if (cfg.formats) {
    out = out.map((c) => {
      const f = cfg.formats[c.field];
      if (!f || f === 'auto' || !FORMAT_TYPES[f]) return c;
      // 형식을 직접 고르면 자동 추론이 붙인 색칠은 뗀다 — 등락률로 추론된 열에 퍼센트를 고른 것만 색 유지
      if (f === 'percent' && c.type === 'change') return c;
      const next = { ...c, ...FORMAT_TYPES[f] };
      if (FORMAT_TYPES[f].digits == null) delete next.digits;   // 추론이 붙인 자릿수는 새 형식에 안 맞는다
      return next;
    });
  }
  if (cfg.order?.length) {
    const rank = new Map(cfg.order.map((k, i) => [k, i]));
    out = [...out].sort((a, b) => (rank.get(a.field) ?? 1e9) - (rank.get(b.field) ?? 1e9));
  }
  return out;
}
