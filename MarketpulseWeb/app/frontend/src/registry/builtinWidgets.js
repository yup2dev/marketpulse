/**
 * builtinWidgets — 기본 제공 위젯의 정의(서버 DB 행)를 mp-widgets 스펙으로 바꾼다.
 *
 * 정의의 주인은 DB 다 (user_widgets 계열, user_id NULL — GET /api/user-widgets/builtin).
 * 엔드포인트·컬럼·탭·심볼 목록·선택지·기본 배치·크기는 전부 행이고, 이 파일에는 위젯이 없다.
 * 여기 있는 것은 행에 담을 수 없는 것뿐이다:
 *
 *   TRANSFORMS   행을 다듬는 함수 — DB 에는 이름만 있다 (코드 TRANSFORM)
 *   TAB_FILTERS  탭에서 행을 거르는 함수 (코드 TAB_FILTER)
 *   toSpec()     정의 → DataWidget 스펙 (mp-widgets/README.md 의 모양)
 *
 * 새 위젯은 행을 넣는다. 함수가 새로 필요할 때만 여기에 이름을 추가하고,
 * 같은 이름을 서버 코드값(services/user_widget_service.CODES)에도 올린다.
 */
import { normalizeBars } from '../mp-widgets';

// ── 행을 다듬는 함수 ───────────────────────────────────────────────────────────
//   prepare(rows, options)       응답 직후 — 실시간 시세를 붙이기 전에 행의 모양을 바꾼다
//   apply(rows, ctx, options)    시세를 붙인 뒤 — 정렬·계산. ctx = { params, tab, symbol, extra, quotes }

const pad = (n) => String(n).padStart(2, '0');

/** 오늘 기사면 HH:MM, 아니면 MM/DD */
function newsTime(a) {
  const d = new Date(a.published_utc);
  if (Number.isNaN(d.getTime())) return '';
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

const RANK_SORT = {
  trade_value: (rows) => [...rows].sort((a, b) => (b.trade_value ?? 0) - (a.trade_value ?? 0)),
  gainers: (rows) => rows.filter((r) => (r.change_rate ?? 0) > 0).sort((a, b) => b.change_rate - a.change_rate),
  losers:  (rows) => rows.filter((r) => (r.change_rate ?? 0) < 0).sort((a, b) => a.change_rate - b.change_rate),
};

export const TRANSFORMS = {
  // 시각 순 (시각이 없는 종일 일정은 맨 위) + 값 칸: 실제치, 없으면 '예상 …'(흐리게)
  events_by_time: {
    apply: (rows, _ctx, o) => rows
      .map((ev, i) => ({ ev, i }))
      .sort((a, b) => String(a.ev.time || '').localeCompare(String(b.ev.time || '')) || a.i - b.i)
      .map(({ ev }) => ({
        ...ev,
        _value: ev.actual || (ev.consensus ? `${o.consensusLabel || ''} ${ev.consensus}`.trim() : null),
        _muted: !ev.actual,
        _dot: ev.impact === 'high',
      })),
  },

  // 실시간 시세가 들어온 뒤의 값으로 거래대금을 다시 계산하고, 고른 정렬 기준(sortBy)으로 다시 정렬한다
  rank_sort: {
    apply: (rows, { params }) => (RANK_SORT[params.sortBy] || RANK_SORT.trade_value)(rows.map((r) => (
      r.volume != null && r.close_price != null ? { ...r, trade_value: r.volume * r.close_price } : r
    ))),
  },

  // 보여 줄 봉만 남기고(take 개 또는 마지막 거래일), 등락률 기준(그 앞 봉의 종가)을 meta 로 넘긴다
  bars_window: {
    apply: (rows, { params }) => {
      const bars = normalizeBars(rows);
      if (!bars.length) return [];
      let start = Math.max(0, bars.length - (params.take || bars.length));
      if (params.session) {
        const day = String(bars[bars.length - 1].date).slice(0, 10);
        start = bars.findIndex((b) => String(b.date).slice(0, 10) === day);
      }
      // 일봉은 '전일 대비' — 마지막 봉 바로 앞 종가
      const ref = params.interval === '1d' ? bars[bars.length - 2] : bars[start - 1];
      return { rows: bars.slice(start), meta: { prevClose: ref?.close ?? null } };
    },
  },

  // 섹터 → 종목 행으로 편다 (섹터마다 시가총액 상위 perSector 개)
  flatten_sectors: {
    prepare: (sectors, o) => sectors.flatMap((sec) => (sec.stocks || []).slice(0, o.perSector || 8)),
  },

  // 기사 시각 표기(_time)와 첫 티커(_tag)
  news_rows: {
    apply: (rows) => rows.map((a) => ({ ...a, _time: newsTime(a), _tag: a.tickers?.[0] })),
  },
};

// ── 탭에서 행을 거르는 함수 ────────────────────────────────────────────────────

export const TAB_FILTERS = {
  // 내 관심 종목(extra.favorites)의 티커가 들어 있는 행만
  watchlist_tickers: (rows, { extra }) => {
    const mine = new Set((extra.favorites || []).map((s) => String(s).toUpperCase()));
    return rows.filter((a) => (a.tickers || []).some((t) => mine.has(String(t).toUpperCase())));
  },
};

// ── 정의 → 스펙 ────────────────────────────────────────────────────────────────

/** DB 의 문자열 값 → 숫자·참거짓 (그 모양일 때만) */
function coerce(v) {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return v;
}
const coerceAll = (obj) => Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k, coerce(v)]));

/** '{symbol} 차트 데이터가 없어요' 의 {이름} 자리를 채운다 */
const fillText = (text, values) => (text || '').replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '');

const camel = (role) => role.toLowerCase().replace(/_(\w)/g, (_, c) => c.toUpperCase());
// 값이 아니라 '참이면 그린다' 인 자리 — 뷰가 (row) => boolean 을 받는다
const FLAG_ROLES = new Set(['VALUE_MUTED', 'DOT']);

/** 표 컬럼 한 개 — 셀 종류(format)마다 필드가 맡는 자리가 다르다 */
function toColumn(f, series) {
  const col = { type: f.format, header: f.label, width: f.width ?? undefined };
  switch (f.format) {
    case 'rank':  return col;
    case 'stock': return { ...col, symbol: f.field_name, name: f.sub_field };
    case 'price': return { ...col, field: f.field_name, currency: f.sub_field };
    case 'trend': return { ...col, symbol: f.field_name, toneBy: f.sub_field, series };
    default:      return { ...col, field: f.field_name };
  }
}

function buildSpec(def) {
  const all = coerceAll(def.options);
  const options = {};
  const extra = {};
  for (const [k, v] of Object.entries(all)) {
    if (k.startsWith('extra.')) extra[k.slice('extra.'.length)] = v;
    else options[k] = v;
  }

  const fields = def.fields || [];
  if (def.view_type === 'table') {
    options.columns = fields.filter((f) => f.field_role === 'COLUMN').map((f) => toColumn(f, options.series));
  } else {
    for (const f of fields) {
      if (f.field_role === 'COLUMN') continue;
      options[camel(f.field_role)] = FLAG_ROLES.has(f.field_role) ? (row) => !!row[f.field_name] : f.field_name;
    }
  }

  // 실시간 시세로 덮어쓸 필드 { 행의 필드: 시세의 필드 }
  const quoteFields = Object.fromEntries(fields.filter((f) => f.quote_field).map((f) => [f.field_name, f.quote_field]));
  const quotes = def.quote_key
    ? { key: def.quote_key, fields: Object.keys(quoteFields).length ? quoteFields : undefined }
    : undefined;

  const fn = def.transform ? TRANSFORMS[def.transform] : null;
  if (def.transform && !fn) console.error('[builtinWidgets] unknown transform:', def.transform, def.widget_id);

  const tabs = (def.tabs || []).map((t) => {
    if (t.filter && !TAB_FILTERS[t.filter]) console.error('[builtinWidgets] unknown tab filter:', t.filter, def.widget_id);
    return {
      id: t.tab_code,
      label: t.label,
      items: t.items?.length ? t.items : undefined,
      filter: t.filter ? TAB_FILTERS[t.filter] : undefined,
      emptyText: t.empty_text,
    };
  });

  const text = (template) => (ctx) => fillText(template, { ...ctx.params, symbol: ctx.symbol });

  return {
    title: def.title || undefined,
    tabs: tabs.length ? tabs : undefined,
    source: def.source,
    sourceNote: def.source_note?.includes('{') ? text(def.source_note) : def.source_note || undefined,
    live: def.live_yn === 'Y',
    symbol: def.default_symbol ? { default: def.default_symbol } : undefined,
    api: {
      endpoint: def.endpoint || undefined,
      dataPath: def.data_path || undefined,
      refresh: def.refresh_sec ? def.refresh_sec * 1000 : undefined,
      extra: Object.keys(extra).length ? extra : undefined,
      prepare: fn?.prepare ? (rows) => fn.prepare(rows, options) : undefined,
      transform: fn?.apply ? (rows, ctx) => fn.apply(rows, ctx, options) : undefined,
    },
    controls: (def.params || []).map((p) => ({
      name: p.param_name,
      label: p.label,
      default: p.param_value,
      options: (p.options || []).map((o) => ({ value: o.value, label: o.label, params: coerceAll(o.params) })),
    })),
    quotes,
    view: def.view_type,
    options,
    empty: (ctx) => fillText(ctx.tab?.emptyText || def.empty_text, { ...ctx.params, symbol: ctx.symbol }),
  };
}

// 정의 객체마다 한 번만 만든다 — 스펙이 렌더마다 새 객체면 DataWidget 이 매번 다시 계산한다
const specs = new WeakMap();

/** 기본 제공 위젯 정의 → DataWidget 스펙 */
export function toSpec(def) {
  if (!specs.has(def)) specs.set(def, buildSpec(def));
  return specs.get(def);
}

// ── 메뉴 · 기본 배치 · 크기 ────────────────────────────────────────────────────

const ALL_SCREENS = '*';
const onScreen = (def, pathname) => (def.screens || []).some((s) => s.screen === ALL_SCREENS || s.screen === pathname);

/** 이 화면의 위젯 메뉴에 내놓을 기본 제공 위젯 — 분류(group_name)마다 카테고리 하나 */
export function builtinWidgetCategories(defs, pathname) {
  const byGroup = new Map();
  for (const def of defs || []) {
    if (!onScreen(def, pathname)) continue;
    const group = def.group_name || 'Widgets';
    if (!byGroup.has(group)) byGroup.set(group, { id: `__builtin_${group}`, label: group, widgets: [] });
    byGroup.get(group).widgets.push({ id: def.widget_id, name: def.name, description: def.description });
  }
  return [...byGroup.values()];
}

/** 이 화면·탭의 기본 배치 (저장된 배치가 없을 때의 그리드). DB 에 배치가 없으면 빈 배열 */
export function builtinDefaultWidgets(defs, pathname, tab) {
  return (defs || [])
    .map((def) => ({ def, at: (def.screens || []).find((s) => s.screen === pathname && s.tab === tab && s.x != null) }))
    .filter(({ at }) => at)
    .sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x)
    .map(({ def, at }, i) => ({ id: `w${i}`, type: def.widget_id, x: at.x, y: at.y, w: at.w, h: at.h }));
}

/** { 위젯 id: { w, h, minW, minH } } — registry/widgetSizes 에 등록할 크기 */
export function builtinWidgetSizes(defs) {
  return Object.fromEntries((defs || []).filter((d) => d.size?.w).map((d) => [d.widget_id, d.size]));
}
