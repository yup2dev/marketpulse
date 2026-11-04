/**
 * events — 이벤트 정의를 프레임(날짜 인덱스) 위의 발생 마스크로 변환.
 *
 *   manual    : spec.dates = [{ date:'YYYY-MM-DD', label }] — 휴장일이면 다음 거래일에 매핑
 *   condition : spec.expr (변수 수식), spec.cooldown(봉) — 조건이 거짓→참으로 바뀐 봉에서 발생
 */
import { compile, evaluate, asSeries, ExprError } from './expr';
import { truthy } from './indicators';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD 라벨" 줄 목록 → [{date, label}] (잘못된 줄은 errors 로). */
export function parseManualDates(text) {
  const dates = [];
  const errors = [];
  String(text || '').split(/\r?\n/).forEach((line, i) => {
    const s = line.trim();
    if (!s) return;
    const [date, ...rest] = s.split(/[\s,]+/);
    if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
      errors.push(`${i + 1}번째 줄: 날짜는 YYYY-MM-DD 형식이어야 합니다 (${date})`);
      return;
    }
    dates.push({ date, label: rest.join(' ') });
  });
  dates.sort((a, b) => a.date.localeCompare(b.date));
  return { dates, errors };
}

export const formatManualDates = (dates = []) =>
  dates.map((d) => (d.label ? `${d.date} ${d.label}` : d.date)).join('\n');

/** 이벤트가 참조하는 변수 이름 (프레임 구성 시 함께 불러와야 하는 것들). */
export function eventVariableRefs(eventItem) {
  const spec = eventItem?.spec || {};
  if (spec.type !== 'condition') return [];
  return compile(spec.expr, { allowEvents: false }).variables;
}

function firstIndexOnOrAfter(dates, date) {
  let lo = 0;
  let hi = dates.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] < date) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * @returns {{ mask:number[], labels:(string|null)[] }}
 */
export function eventMask(eventItem, frame) {
  const n = frame.dates.length;
  const mask = new Array(n).fill(0);
  const labels = new Array(n).fill(null);
  const spec = eventItem?.spec || {};

  if (spec.type === 'manual') {
    for (const { date, label } of spec.dates || []) {
      if (!n || date < frame.dates[0] || date > frame.dates[n - 1]) continue;
      const i = firstIndexOnOrAfter(frame.dates, date);
      if (i < n) {
        mask[i] = 1;
        labels[i] = label || eventItem.name;
      }
    }
    return { mask, labels };
  }

  if (spec.type === 'condition') {
    const { ast } = compile(spec.expr, { allowEvents: false });
    const values = asSeries(evaluate(ast, { n, variable: (name) => frame.columns[name] }), n);
    const cooldown = Math.max(0, Number(spec.cooldown) || 0);
    let last = -Infinity;
    for (let i = 0; i < n; i += 1) {
      const on = truthy(values[i]);
      const wasOn = i > 0 && truthy(values[i - 1]);
      if (on && !wasOn && i - last > cooldown) {
        mask[i] = 1;
        labels[i] = eventItem.name;
        last = i;
      }
    }
    return { mask, labels };
  }

  throw new ExprError(`이벤트 '${eventItem?.name}' 의 유형을 알 수 없습니다`);
}

export const occurrences = (mask, frame, labels = []) =>
  mask.reduce((acc, v, i) => {
    if (v) acc.push({ index: i, date: frame.dates[i], label: labels[i] || null });
    return acc;
  }, []);
