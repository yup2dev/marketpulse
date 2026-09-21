/**
 * data — 사용자 변수 정의를 실제 시계열 프레임으로 만든다(브라우저에서 계산).
 *
 *   source  변수 : seriesCatalog 항목(+symbol)을 기존 API로 조회 (yahoo 가격은 Fetcher 위임 경로 그대로)
 *   formula 변수 : 다른 변수를 참조하는 수식 — 의존 순서대로 평가
 *
 * 날짜 축은 참조된 source 중 관측치가 가장 많은(가장 촘촘한) 시계열을 기준으로 하고,
 * 나머지는 기준일 이전 마지막 관측값으로 채운다(월간 매크로 지표 → 일간 축).
 */
import { apiClient, API_BASE } from '../../../config/api';
import { SERIES_CATALOG, resolveTemplate, extractPoints, rangeToPeriod } from '../seriesCatalog';
import { compile, evaluate, asSeries, ExprError } from './expr';

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // url → { at, promise }

export const catalogEntry = (id) => SERIES_CATALOG.find((e) => e.id === id);

export function describeVariable(item) {
  const spec = item?.spec || {};
  if (spec.type === 'formula') return spec.expr || '';
  const entry = catalogEntry(spec.series);
  if (!entry) return `알 수 없는 소스 (${spec.series})`;
  return resolveTemplate(entry.label, { symbol: spec.symbol || '?' });
}

function fetchPoints(url, entry) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise;
  const promise = apiClient.get(`${API_BASE}${url}`).then((res) => {
    const byDate = new Map();
    for (const p of extractPoints(res, entry)) byDate.set(String(p.date).slice(0, 10), p.value);
    return [...byDate.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
  });
  cache.set(url, { at: Date.now(), promise });
  promise.catch(() => cache.delete(url));
  return promise;
}

async function loadSource(item, range) {
  const { series, symbol } = item.spec || {};
  const entry = catalogEntry(series);
  if (!entry) throw new ExprError(`변수 '${item.name}': 알 수 없는 데이터 소스 ${series}`);
  if (entry.needsSymbol && !symbol) throw new ExprError(`변수 '${item.name}': 종목 심볼이 필요합니다`);
  const ctx = {
    symbol: (symbol || '').toUpperCase(),
    startDate: range.start,
    endDate: range.end,
    period: rangeToPeriod(range.start),
  };
  try {
    const points = await fetchPoints(resolveTemplate(entry.endpoint, ctx), entry);
    return points.filter((p) => p.date <= range.end);
  } catch (e) {
    throw new ExprError(`변수 '${item.name}' 데이터 조회 실패: ${e.detail || e.message}`);
  }
}

/** targets 가 (간접적으로) 참조하는 변수를 의존 순서대로. 없는 이름·순환 참조는 오류. */
export function resolveOrder(targets, variables) {
  const byName = Object.fromEntries(variables.map((v) => [v.name, v]));
  const state = {};
  const order = [];
  const visit = (name, path) => {
    const item = byName[name];
    if (!item) throw new ExprError(path.length ? `'${path[path.length - 1]}' 이(가) 참조한 변수 '${name}' 이(가) 없습니다` : `변수 '${name}' 이(가) 없습니다`);
    if (state[name] === 2) return;
    if (state[name] === 1) throw new ExprError(`순환 참조: ${[...path, name].join(' → ')}`);
    state[name] = 1;
    if (item.spec?.type === 'formula') {
      compile(item.spec.expr, { allowEvents: false }).variables.forEach((dep) => visit(dep, [...path, name]));
    }
    state[name] = 2;
    order.push(item);
  };
  targets.forEach((t) => visit(t, []));
  return order;
}

/**
 * @returns {Promise<{dates:string[], columns:Object<string, number[]>}>}
 */
export async function buildFrame(targets, variables, range) {
  const names = [...new Set(targets.filter(Boolean))];
  if (!names.length) throw new ExprError('변수를 하나 이상 선택하세요');
  if (!range?.start || !range?.end || range.start > range.end) throw new ExprError('기간이 올바르지 않습니다');

  const order = resolveOrder(names, variables);
  const sources = order.filter((v) => v.spec?.type !== 'formula');
  if (!sources.length) throw new ExprError('데이터 소스 변수가 하나 이상 필요합니다(수식은 소스 변수를 참조해야 합니다)');

  const loaded = await Promise.all(sources.map((v) => loadSource(v, range)));
  const inRange = loaded.map((pts) => pts.filter((p) => p.date >= range.start));
  const baseIdx = inRange.reduce((best, pts, i) => (pts.length > inRange[best].length ? i : best), 0);
  const dates = inRange[baseIdx].map((p) => p.date);
  if (dates.length < 2) throw new ExprError(`선택한 기간에 '${sources[baseIdx].name}' 데이터가 부족합니다`);

  const columns = {};
  sources.forEach((v, k) => {
    const pts = loaded[k];
    const out = new Array(dates.length);
    let j = -1;
    for (let i = 0; i < dates.length; i += 1) {
      while (j + 1 < pts.length && pts[j + 1].date <= dates[i]) j += 1;
      out[i] = j >= 0 ? pts[j].value : NaN;
    }
    columns[v.name] = out;
  });

  const n = dates.length;
  for (const v of order) {
    if (v.spec?.type !== 'formula') continue;
    try {
      const { ast } = compile(v.spec.expr, { allowEvents: false });
      columns[v.name] = asSeries(evaluate(ast, { n, variable: (name) => columns[name] }), n);
    } catch (e) {
      throw new ExprError(`변수 '${v.name}' 수식 오류: ${e.message}`);
    }
  }

  return { dates, columns };
}

// ── 기간 프리셋 ──────────────────────────────────────────────────────────────
const iso = (d) => d.toISOString().slice(0, 10);
export const RANGE_PRESETS = ['3M', '6M', '1Y', '2Y', '5Y', '10Y'];

export function presetRange(preset) {
  const end = new Date();
  const start = new Date();
  const months = { '3M': 3, '6M': 6, '1Y': 12, '2Y': 24, '5Y': 60, '10Y': 120 }[preset] || 12;
  start.setMonth(start.getMonth() - months);
  return { preset, start: iso(start), end: iso(end) };
}
