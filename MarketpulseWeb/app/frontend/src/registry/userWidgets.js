/**
 * userWidgets — 사용자 정의 위젯 정의(서버 DB 행)를 화면이 쓰는 모양으로 바꾼다.
 *
 * 정의는 네 부분이다 (설정 화면의 단계와 같다):
 *   API      provider + model                    → /api/data/{provider}/{model}
 *   params   파라미터마다 값을 대는 방법          FIXED 고정값 · VAR 화면 변수 · INPUT 사용자 입력
 *   fields   응답 필드마다 위젯에서 맡을 자리      X · Y · PRIMARY · COLUMN · HIDDEN (+ 라벨·형식)
 *   view     보여 줄 위젯 종류 + 내놓을 화면
 *            (종류 목록은 관리자가 고치는 DB 목록이고, 종류마다 실제로 그리는 방식 renderer 가 있다)
 *
 * toWidgetConfig() 가 이것을 UniversalWidget 의 config(레지스트리 항목과 같은 모양)로 바꾼다.
 * 그래서 사용자 정의 위젯도 기본 위젯과 똑같은 헤더·표·차트·상태 화면으로 그려진다.
 */
import { humanizeKey } from '../components/widgets/common/paramSpec';
import { URL_WIDGET_MAP } from './urlWidgetMap';

export const USER_WIDGET_PREFIX = 'user/';
export const ALL_SCREENS = '*';

/** 새 위젯의 빈 정의 (설정 화면의 편집 시작점) */
export const EMPTY_DRAFT = {
  widget_id: null,
  name: '',
  description: '',
  group_name: '',
  provider: '',
  model: '',
  view_type: 'table',
  use_yn: 'Y',
  params: [],
  fields: [],
  screens: [ALL_SCREENS],
};

// 화면 변수 period 를 쓰는 위젯의 헤더 기간 선택지
const USER_PERIODS = ['1mo', '3mo', '6mo', '1y', '3y', '5y', '10y'];

// 그리는 방식(renderer) → 매핑이 요구하는 자리의 종류
const CHART_RENDERERS = new Set(['line', 'area', 'bar', 'stackedBar', 'pie', 'donut']);
export const viewKind = (renderer) => (renderer === 'kv' ? 'kv' : (CHART_RENDERERS.has(renderer) ? 'chart' : 'table'));
/** 정의가 실제로 그려지는 방식 — 서버가 위젯 종류에서 풀어 준 renderer (없으면 종류 코드 그대로) */
export const rendererOf = (def) => def.renderer || def.view_type;

const enc = encodeURIComponent;

/** 스키마의 kind 에 맞춰 저장된 문자열 기본값을 입력칸 값으로 바꾼다 */
function coerceDefault(value, spec) {
  if (value == null || value === '') return '';
  if (spec?.kind === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? n : '';
  }
  return value;
}

/**
 * 정의 + (provider, model) 스키마 → UniversalWidget config.
 * schema 는 INPUT 파라미터의 입력칸 종류·선택지를 알아내는 데만 쓴다 (없으면 텍스트 입력).
 */
export function toWidgetConfig(def, schema) {
  const specByName = new Map((schema?.params || []).map((p) => [p.name, p]));
  const qs = [];
  const params = [];
  let period;

  for (const p of def.params || []) {
    const name = p.param_name;
    if (p.bind_type === 'FIXED') {
      qs.push(`${enc(name)}=${enc(p.param_value ?? '')}`);
    } else if (p.bind_type === 'VAR') {
      // {symbol}·{period} 자리는 UniversalWidget 이 헤더의 심볼 칩·기간 선택 값으로 채운다
      qs.push(`${enc(name)}={${p.var_name}}`);
      if (p.var_name === 'period') period = { default: p.param_value || '1y', preset: USER_PERIODS };
    } else {
      const spec = specByName.get(name);
      params.push({
        name,
        label: humanizeKey(name),
        kind: spec?.kind || 'text',
        options: spec?.options,
        step: spec?.step,
        hint: spec?.hint,
        default: coerceDefault(p.param_value, spec),
        pin: spec?.kind === 'select' || spec?.kind === 'date',
      });
    }
  }

  const fields = def.fields || [];
  const labels = {};
  const formats = {};
  for (const f of fields) {
    if (f.label) labels[f.field_name] = f.label;
    if (f.format && f.format !== 'auto') formats[f.field_name] = f.format;
  }
  const byRole = (role) => fields.filter((f) => f.field_role === role).map((f) => f.field_name);
  const hidden = byRole('HIDDEN');
  const renderer = rendererOf(def);
  const kind = viewKind(renderer);

  const config = {
    title: def.name,
    endpoint: `/data/${def.provider}/${def.model}${qs.length ? `?${qs.join('&')}` : ''}`,
    provider: def.provider,
    params: params.length ? params : undefined,
    period,
    columns: {
      hide: hidden,
      order: fields.map((f) => f.field_name),
      labels,
      formats,
    },
  };

  if (kind === 'kv') {
    config.display = 'kv';
    config.dataPath = 'results';
    config.kv = { primary: byRole('PRIMARY'), hide: hidden, labels };
  } else {
    config.view = renderer;
    const xKey = byRole('X')[0];
    const yKeys = byRole('Y');
    if (xKey && yKeys.length) config.chart = { xKey, yKeys };
  }
  return config;
}

/** 위젯 종류별 기본 크기 (registry/widgetSizes 의 프리셋과 같은 값) */
const SIZE_BY_KIND = {
  table: { w: 6, h: 7 },
  chart: { w: 6, h: 6 },
  kv:    { w: 4, h: 7 },
};

/** 이 화면(pathname)의 위젯 메뉴에 내놓을 "My Widgets" 카테고리. 없으면 null. */
export function userWidgetCategory(widgets, pathname) {
  const items = (widgets || [])
    .filter((w) => w.use_yn === 'Y' && (w.screens || []).some((s) => s === ALL_SCREENS || s === pathname))
    .map((w) => ({
      id: `${USER_WIDGET_PREFIX}${w.widget_id}`,
      name: w.name,
      description: [w.group_name, `${w.provider} · ${w.model}`].filter(Boolean).join(' — '),
      defaultSize: SIZE_BY_KIND[viewKind(rendererOf(w))],
    }));
  return items.length ? { id: '__my_widgets', label: 'My Widgets', widgets: items } : null;
}

/** 화면 경로 목록 → 표시 이름 ('*' 또는 빈 목록은 allLabel) */
export function screenLabels(screens, allLabel = '모든 화면') {
  if (!screens?.length || screens.includes(ALL_SCREENS)) return allLabel;
  return screens.map((s) => URL_WIDGET_MAP[s]?.label || s).join(', ');
}

// ── 기본 제공 위젯 (코드에 정의된 카탈로그) ───────────────────────────────────

/**
 * 화면별 카탈로그(urlWidgetMap)에 있는 모든 기본 위젯 — 설정 화면의 '기본 위젯' 목록.
 * [{ id, name, description, pages: [{ path, label }] }]  (pages = 코드가 정한 기본 배치)
 */
export function builtinWidgetCatalog() {
  const byId = new Map();
  for (const [path, page] of Object.entries(URL_WIDGET_MAP)) {
    for (const cat of page.categories || []) {
      for (const w of cat.widgets || []) {
        if (!byId.has(w.id)) byId.set(w.id, { id: w.id, name: w.name, description: w.description, pages: [] });
        const item = byId.get(w.id);
        if (!item.pages.some((p) => p.path === path)) item.pages.push({ path, label: page.label });
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * 위젯 메뉴 카탈로그에 내 설정을 적용한다.
 *   use_yn = 'N'        → 메뉴에서 뺀다
 *   screens 가 있으면   → 그 화면에서만 메뉴에 나온다
 * 설정이 없는 위젯은 그대로다. 이미 그리드에 올려 둔 위젯에는 영향이 없다 (메뉴만 바뀐다).
 */
export function applyWidgetPrefs(categories, prefs, pathname) {
  if (!prefs || !Object.keys(prefs).length) return categories;
  const visible = (w) => {
    const p = prefs[w.id];
    if (!p) return true;
    if (p.use_yn === 'N') return false;
    return !p.screens?.length || p.screens.includes(pathname);
  };
  return categories
    .map((c) => ({ ...c, widgets: c.widgets.filter(visible) }))
    .filter((c) => c.widgets.length > 0);
}
