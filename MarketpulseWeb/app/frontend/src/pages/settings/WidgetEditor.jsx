/**
 * WidgetEditor — 사용자 정의 위젯 한 개를 만들거나 고친다.
 *
 *   ① API      provider·model 을 고르고, 파라미터마다 값을 대는 방법을 정한다
 *   ② 매핑     응답 필드마다 위젯에서 맡을 자리·라벨·형식을 정한다
 *   ③ 위젯     보여 줄 위젯 종류, 이름, 내놓을 화면
 *
 * 오른쪽 미리보기는 실제 위젯(UniversalWidget)을 같은 설정으로 그린 것이다 — 저장하면 그대로 나온다.
 * 선택지는 전부 서버 코드값(codes)에서 온다 — '보여 줄 위젯' 은 관리자가 고치는 위젯 종류 목록이다.
 * 데이터 목록·파라미터·필드는 데이터 카탈로그(DB, /api/user-widgets/catalog)에서 온다. OpenBB coverage 처럼
 * 데이터(model)를 먼저 고르고 그 데이터를 주는 출처(provider)를 고른다. 동적 선택지만 /schema 에서 받는다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, RefreshCw, Save, X } from 'lucide-react';
import { notify } from '../../common';
import UniversalWidget from '../../widget/render/UniversalWidget';
import { Select, INPUT_CLS, periodLabel } from '../../common/widget';
import { apiClient, API_BASE, schemaAPI, userWidgetsAPI } from '../../common';
import { toWidgetConfig, viewKind, ALL_SCREENS } from '../../widget/registry/userWidgets';
import { normalizeTableRows } from '../../widget/render/autoRender';
import useUserWidgetStore from '../../store/userWidgetStore';
import { ScreenChips } from './parts';
import { MpGrid } from '../../widget/engine';

const PREVIEW_SYMBOL = 'AAPL';
const PERIOD_CHOICES = ['1mo', '3mo', '6mo', '1y', '3y', '5y', '10y'].map((id) => ({ value: id, label: periodLabel(id) }));
const UNUSED = '';   // 파라미터를 보내지 않는다 (API 기본값)

const titleCase = (s) => String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// ── 스키마 → 편집 행 ──────────────────────────────────────────────────────────

/** 스키마 파라미터 하나의 처음 바인딩 — 심볼은 화면 변수, 필수는 사용자 입력, 나머지는 안 보냄 */
function defaultParamRow(spec) {
  const first = spec.options?.[0];
  const firstValue = first && typeof first === 'object' ? first.value : first;
  const def = spec.default ?? (spec.required ? firstValue : '') ?? '';
  if (spec.name === 'symbol' || spec.name === 'ticker') {
    return { param_name: spec.name, bind_type: 'VAR', var_name: 'symbol', param_value: '' };
  }
  return { param_name: spec.name, bind_type: spec.required ? 'INPUT' : UNUSED, var_name: null, param_value: String(def ?? '') };
}

/**
 * 편집할 파라미터 행 = 스키마의 모든 파라미터 (+ 날짜 범위가 있으면 가상 파라미터 period).
 * 저장된 행이 있으면 그 설정을 얹는다. 스키마에 없는 저장 행도 버리지 않는다.
 */
function buildParamRows(schema, saved) {
  const specs = schema?.params || [];
  const names = new Set(specs.map((s) => s.name));
  const savedBy = new Map((saved || []).map((p) => [p.param_name, p]));
  const rows = specs.map((s) => ({ ...defaultParamRow(s), ...(savedBy.get(s.name) || (saved ? { bind_type: UNUSED } : {})) }));

  // 날짜 범위(start_date~end_date)를 받는 API 는 헤더 기간 선택으로 묶을 수 있다.
  // 게이트웨이가 period 를 start/end 로 바꿔 준다 (모델이 자체 period 를 갖고 있으면 해당 없음).
  if (names.has('start_date') && !names.has('period')) {
    rows.unshift(savedBy.get('period') || {
      param_name: 'period', bind_type: saved ? UNUSED : 'VAR', var_name: 'period', param_value: '1y',
    });
    names.add('period');
  }
  for (const p of saved || []) if (!names.has(p.param_name)) rows.push({ ...p });
  return rows;
}

/**
 * 필드 표시 힌트(카탈로그 · Data 필드 json_schema_extra) → 초안의 표시 형식.
 * 값이 이미 % 인 필드만 percent — 비율(0.0123)을 ×100 해서 보여야 하는 필드는 percent 셀이 곱하지 않으므로 auto 로 둔다.
 */
function formatFromHints(f) {
  if (f.unit === 'percent' && (f.multiply == null || f.multiply === 1)) return 'percent';
  if (f.unit === 'currency') return 'currency';
  return 'auto';
}

function buildFieldRows(schema, saved) {
  const rows = (saved || []).map((f) => ({ ...f }));
  const have = new Set(rows.map((f) => f.field_name));
  for (const f of schema?.fields || []) {
    if (!have.has(f.name)) {
      rows.push({ field_name: f.name, field_role: f.hidden ? 'HIDDEN' : 'COLUMN', label: '', format: formatFromHints(f) });
    }
  }
  return rows;
}

/** 저장·미리보기에 쓸 정의 — 안 보내는 파라미터는 뺀다. renderer 는 미리보기용(서버는 무시한다) */
function toDefinition(draft, viewTypes) {
  return {
    renderer: (viewTypes || []).find((t) => t.value === draft.view_type)?.renderer,
    name: draft.name.trim(),
    description: draft.description,
    group_name: draft.group_name,
    provider: draft.provider,
    model: draft.model,
    view_type: draft.view_type,
    use_yn: draft.use_yn,
    params: draft.params
      .filter((p) => p.bind_type !== UNUSED)
      .map((p) => ({
        param_name: p.param_name,
        bind_type: p.bind_type,
        param_value: p.param_value === '' ? null : String(p.param_value),
        var_name: p.bind_type === 'VAR' ? p.var_name : null,
      })),
    fields: draft.fields.map((f) => ({
      field_name: f.field_name, field_role: f.field_role, label: f.label || null, format: f.format,
    })),
    screens: draft.screens.length ? draft.screens : [ALL_SCREENS],
  };
}

// ── 작은 부품 ────────────────────────────────────────────────────────────────

function Section({ step, title, hint, children, action }) {
  return (
    <section className="rounded-lg border border-gray-800 p-4" style={{ backgroundColor: 'var(--color-bg-widget)' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">
            <span className="text-cyan-400 mr-1.5">{step}</span>{title}
          </h3>
          {hint && <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const BTN_SECONDARY =
  'flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-medium border border-gray-700 text-gray-300 hover:border-cyan-500 hover:text-cyan-300 disabled:opacity-40 transition-colors';

/** 파라미터 값 입력칸 — 스키마가 선택지를 주면 select, 아니면 종류에 맞는 입력 */
function ValueInput({ spec, value, onChange, placeholder }) {
  if (spec?.options?.length) {
    return <Select size="md" align="left" value={value ?? ''} options={spec.options} onChange={onChange} placeholder={placeholder} />;
  }
  const type = spec?.kind === 'number' ? 'number' : (spec?.kind === 'date' ? 'date' : 'text');
  return (
    <input
      type={type}
      className={INPUT_CLS}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// ── Editor ───────────────────────────────────────────────────────────────────

export default function WidgetEditor({ initial, codes, variables, onDone, onCancel }) {
  const [draft, setDraft] = useState(initial);
  const [catalog, setCatalog] = useState([]);     // 카탈로그 — [{ provider, model, provider_name, key_yn, param_count, field_count }]
  const [schema, setSchema] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sampling, setSampling] = useState(false);
  const [preview, setPreview] = useState(null);   // { seq, config }
  const createWidget = useUserWidgetStore((s) => s.create);
  const updateWidget = useUserWidgetStore((s) => s.update);

  const patch = useCallback((p) => setDraft((d) => ({ ...d, ...p })), []);
  const draftRef = useRef(draft);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  useEffect(() => {
    userWidgetsAPI.catalog()
      .then((r) => setCatalog(r.items || []))
      .catch(() => notify.error('데이터 목록을 불러오지 못했습니다'));
  }, []);

  // API 를 고르면 그 스키마로 파라미터·필드 행을 만든다.
  // 처음 열 때(저장된 정의)는 저장된 행을 얹고, API 를 바꿨을 때는 새로 만든다.
  const apiKey = draft.provider && draft.model ? `${draft.provider}/${draft.model}` : null;
  const initialKey = initial.provider && initial.model ? `${initial.provider}/${initial.model}` : null;
  useEffect(() => {
    if (!apiKey) { setSchema(null); return undefined; }
    let alive = true;
    const [provider, model] = apiKey.split('/');
    setSchema(null);
    schemaAPI.fromCatalog(provider, model)
      .then((s) => {
        if (!alive) return;
        const keepSaved = apiKey === initialKey && initial.widget_id;
        const next = {
          params: buildParamRows(s, keepSaved ? initial.params : null),
          fields: buildFieldRows(s, keepSaved ? initial.fields : null),
        };
        const merged = { ...draftRef.current, ...next, name: draftRef.current.name || titleCase(model) };
        setSchema(s);
        setDraft(merged);
        setPreview({ seq: Date.now(), config: toWidgetConfig(toDefinition(merged, codes.VIEW_TYPE), s) });
      })
      .catch(() => { if (alive) notify.error('API 정보를 불러오지 못했습니다'); });
    return () => { alive = false; };
  }, [apiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const specByName = useMemo(() => new Map((schema?.params || []).map((p) => [p.name, p])), [schema]);
  const fieldSpec = useMemo(() => new Map((schema?.fields || []).map((f) => [f.name, f])), [schema]);

  // 데이터(model) → 그 데이터를 주는 출처들. 카탈로그가 모델 · 출처 순으로 온다.
  const providersByModel = useMemo(() => {
    const m = new Map();
    for (const row of catalog) {
      if (!m.has(row.model)) m.set(row.model, []);
      m.get(row.model).push(row);
    }
    return m;
  }, [catalog]);
  // 저장된 위젯이 쓰던 쌍이 카탈로그에서 빠졌으면 (등록에서 빠짐 · 동기화 전) 선택지에 남겨 두고 알린다
  const missingPair = Boolean(catalog.length && apiKey
    && !(providersByModel.get(draft.model) || []).some((r) => r.provider === draft.provider));

  const modelOptions = useMemo(() => {
    const opts = [...providersByModel.entries()].map(([model, rows]) => ({
      value: model,
      label: titleCase(model),
      note: rows.length > 1 ? `${rows.length}곳` : rows[0].provider_name,
    }));
    if (draft.model && !providersByModel.has(draft.model)) {
      opts.unshift({ value: draft.model, label: titleCase(draft.model), note: '목록에 없음' });
    }
    return opts;
  }, [providersByModel, draft.model]);
  const providerOptions = useMemo(() => {
    const opts = (providersByModel.get(draft.model) || []).map((r) => ({
      value: r.provider,
      label: r.provider_name || r.provider.toUpperCase(),
      note: r.key_yn === 'Y' ? 'Key' : undefined,
    }));
    if (draft.provider && !opts.some((o) => o.value === draft.provider)) {
      opts.unshift({ value: draft.provider, label: draft.provider.toUpperCase(), note: '목록에 없음' });
    }
    return opts;
  }, [providersByModel, draft.model, draft.provider]);

  // 데이터를 바꾸면 지금 출처가 그 데이터를 주면 그대로, 아니면 첫 출처로
  const selectModel = (model) => {
    const rows = providersByModel.get(model) || [];
    const provider = rows.some((r) => r.provider === draft.provider) ? draft.provider : (rows[0]?.provider || '');
    patch({ model, provider, params: [], fields: [] });
  };

  const setParam = (i, p) => setDraft((d) => ({ ...d, params: d.params.map((row, k) => (k === i ? { ...row, ...p } : row)) }));
  const setField = (i, p) => setDraft((d) => ({ ...d, fields: d.fields.map((row, k) => (k === i ? { ...row, ...p } : row)) }));
  const moveField = (i, dir) => setDraft((d) => {
    const j = i + dir;
    if (j < 0 || j >= d.fields.length) return d;
    const fields = [...d.fields];
    [fields[i], fields[j]] = [fields[j], fields[i]];
    return { ...d, fields };
  });

  const refreshPreview = () => {
    if (!schema) return;
    setPreview({ seq: Date.now(), config: toWidgetConfig(toDefinition(draft, codes.VIEW_TYPE), schema) });
  };

  // 실제로 한 번 불러서, 스키마에 없는 응답 필드를 매핑 목록에 보탠다
  const sampleFields = async () => {
    if (!schema) return;
    const cfg = toWidgetConfig(toDefinition(draft, codes.VIEW_TYPE), schema);
    let url = cfg.endpoint
      .replace('{symbol}', encodeURIComponent(PREVIEW_SYMBOL))
      .replace('{period}', encodeURIComponent(cfg.period?.default || '1y'));
    const extra = (cfg.params || [])
      .filter((p) => p.default !== '' && p.default != null)
      .map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(p.default)}`);
    if (extra.length) url += (url.includes('?') ? '&' : '?') + extra.join('&');

    setSampling(true);
    try {
      const rows = normalizeTableRows(await apiClient.get(`${API_BASE}${url}`));
      const keys = rows.length ? Object.keys(rows[0]) : [];
      const have = new Set(draft.fields.map((f) => f.field_name));
      const added = keys.filter((k) => !have.has(k));
      if (added.length) {
        setDraft((d) => ({
          ...d,
          fields: [...d.fields, ...added.map((k) => ({ field_name: k, field_role: 'COLUMN', label: '', format: 'auto' }))],
        }));
      }
      notify.success(rows.length
        ? `${rows.length}행 조회 — 필드 ${added.length}개 추가`
        : '조회는 됐지만 결과가 0건입니다');
    } catch (e) {
      notify.fail(e, '조회 실패', { provider: draft.provider });
    } finally {
      setSampling(false);
    }
  };

  const save = async () => {
    if (!draft.provider || !draft.model) { notify.error('API 를 먼저 고르세요'); return; }
    if (!draft.name.trim()) { notify.error('위젯 이름을 입력하세요'); return; }
    setSaving(true);
    try {
      const body = toDefinition(draft, codes.VIEW_TYPE);
      const saved = draft.widget_id ? await updateWidget(draft.widget_id, body) : await createWidget(body);
      notify.success(`'${saved.name}' 저장됨`);
      onDone(saved);
    } catch (e) {
      notify.fail(e, '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  // 고를 수 있는 종류 = 사용 중인 것 (+ 이 위젯이 이미 쓰고 있으면 숨긴 종류도)
  const viewTypes = codes.VIEW_TYPE.filter((t) => t.use_yn === 'Y' || t.value === draft.view_type);
  const kind = viewKind(codes.VIEW_TYPE.find((t) => t.value === draft.view_type)?.renderer);
  const roleHint = {
    table: '표는 숨김이 아닌 필드를 위에서부터 컬럼으로 보여 줍니다.',
    chart: '차트 가로축 하나와 차트 값을 하나 이상 고르세요. 둘 다 비우면 날짜·숫자 필드로 자동 지정합니다.',
    kv: '요약 타일로 고른 필드는 큰 숫자로, 나머지는 아래 표로 나옵니다 (첫 행 기준).',
  }[kind];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">{draft.widget_id ? '위젯 수정' : '새 위젯'}</h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCancel} className={BTN_SECONDARY}><X size={13} /> 취소</button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40 transition-colors"
          >
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />} 저장
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)] gap-4 items-start">
        <div className="space-y-4 min-w-0">

          {/* ① API ─────────────────────────────────────────────────────────── */}
          <Section step="①" title="API" hint="어떤 데이터를 가져올지, 어느 출처에서 받을지 고르고 파라미터마다 값을 어떻게 넣을지 정합니다.">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <div className="text-[11px] font-medium text-gray-400 mb-1">데이터</div>
                <Select
                  size="md" align="left" placeholder={catalog.length ? '데이터 선택' : '불러오는 중…'}
                  value={draft.model} options={modelOptions}
                  onChange={selectModel}
                />
              </div>
              <div>
                <div className="text-[11px] font-medium text-gray-400 mb-1">출처</div>
                <Select
                  size="md" align="left" placeholder={draft.model ? '출처 선택' : '데이터를 먼저 고르세요'}
                  value={draft.provider} options={providerOptions}
                  onChange={(v) => patch({ provider: v, params: [], fields: [] })}
                />
              </div>
            </div>

            {missingPair && (
              <p className="text-xs text-amber-400 mb-3">
                {draft.provider}/{draft.model} 은(는) 지금 데이터 카탈로그에 없습니다. 등록에서 빠졌거나 아직 동기화 전입니다 — 다른 데이터·출처로 바꾸는 것을 권합니다.
              </p>
            )}
            {apiKey && !schema && <p className="text-xs text-gray-500">API 정보를 불러오는 중…</p>}
            {schema && draft.params.length === 0 && <p className="text-xs text-gray-500">이 API 는 파라미터가 없습니다.</p>}
            {schema && draft.params.length > 0 && (
              <MpGrid
                rows={draft.params}
                options={{
                  rowKey: 'param_name', minWidth: 0, rowHeight: 0, scroll: false, valign: 'top',
                  columns: [
                    { id: 'param', header: '파라미터', width: '26%', wrap: true, render: (p) => {
                      const spec = specByName.get(p.param_name);
                      return (
                        <>
                          <div className="text-xs text-gray-200 font-mono pt-2">
                            {p.param_name}
                            {spec?.required && <span className="ml-1 text-amber-400" title="필수">*</span>}
                          </div>
                          {spec?.hint && <div className="text-[10px] text-gray-500 leading-tight">{spec.hint}</div>}
                        </>
                      );
                    } },
                    { id: 'bind', header: '값 넣는 방법', width: '24%', render: (p, _ctx, i) => (
                      <Select
                        size="md" align="left"
                        value={p.bind_type}
                        options={[{ value: UNUSED, label: '보내지 않음' }, ...codes.BIND_TYPE.map((c) => ({ value: c.value, label: c.name }))]}
                        onChange={(v) => setParam(i, { bind_type: v, var_name: v === 'VAR' ? (p.var_name || variables[0]?.name) : null })}
                      />
                    ) },
                    { id: 'value', header: '값', render: (p, _ctx, i) => {
                      const spec = specByName.get(p.param_name);
                      return (
                        <>
                          {p.bind_type === UNUSED && <div className="text-[11px] text-gray-600 pt-2">API 기본값 사용</div>}
                          {p.bind_type === 'FIXED' && (
                            <ValueInput spec={spec} value={p.param_value} placeholder="값" onChange={(v) => setParam(i, { param_value: v })} />
                          )}
                          {p.bind_type === 'INPUT' && (
                            <ValueInput spec={spec} value={p.param_value} placeholder="기본값 (위젯에서 바꿀 수 있음)" onChange={(v) => setParam(i, { param_value: v })} />
                          )}
                          {p.bind_type === 'VAR' && (
                            <div className="flex gap-2">
                              <div className="flex-1 min-w-0">
                                <Select
                                  size="md" align="left"
                                  value={p.var_name}
                                  options={variables.map((v) => ({ value: v.name, label: v.label }))}
                                  onChange={(v) => setParam(i, { var_name: v, param_value: v === 'period' ? (p.param_value || '1y') : '' })}
                                />
                              </div>
                              {p.var_name === 'period' && (
                                <div className="w-24">
                                  <Select
                                    size="md" align="left" title="처음 보여 줄 기간"
                                    value={p.param_value || '1y'} options={PERIOD_CHOICES}
                                    onChange={(v) => setParam(i, { param_value: v })}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      );
                    } },
                  ],
                }}
              />
            )}
          </Section>

          {/* ② 매핑 ────────────────────────────────────────────────────────── */}
          <Section
            step="②" title="매핑"
            hint={`응답 필드를 위젯의 어느 자리에 쓸지 정합니다. ${roleHint}`}
            action={(
              <button type="button" onClick={sampleFields} disabled={!schema || sampling} className={BTN_SECONDARY} title="API 를 한 번 불러 실제 응답의 필드를 목록에 보탭니다">
                {sampling ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />} 샘플 조회
              </button>
            )}
          >
            {!schema && <p className="text-xs text-gray-500">API 를 고르면 필드가 나옵니다.</p>}
            {schema && draft.fields.length === 0 && (
              <p className="text-xs text-gray-500">알려진 필드가 없습니다. 샘플 조회로 실제 응답에서 가져오세요.</p>
            )}
            {schema && draft.fields.length > 0 && (
              <MpGrid
                rows={draft.fields}
                options={{
                  rowKey: 'field_name', minWidth: 0, rowHeight: 0, scroll: false,
                  rowClassName: (f) => (f.field_role === 'HIDDEN' ? 'opacity-50' : ''),
                  columns: [
                    { id: 'order', header: '순서', width: 48, render: (f, _ctx, i) => (
                      <div className="flex">
                        <button type="button" onClick={() => moveField(i, -1)} disabled={i === 0} className="p-0.5 text-gray-500 hover:text-white disabled:opacity-20" aria-label="위로"><ArrowUp size={12} /></button>
                        <button type="button" onClick={() => moveField(i, 1)} disabled={i === draft.fields.length - 1} className="p-0.5 text-gray-500 hover:text-white disabled:opacity-20" aria-label="아래로"><ArrowDown size={12} /></button>
                      </div>
                    ) },
                    { id: 'field', header: '필드', width: '26%', render: (f) => {
                      const spec = fieldSpec.get(f.field_name);
                      return (
                        <span title={spec?.description || undefined}>
                          <span className="text-xs text-gray-200 font-mono">{f.field_name}</span>
                          {spec?.kind && <span className="ml-1.5 text-[10px] text-gray-600">{spec.kind}</span>}
                        </span>
                      );
                    } },
                    { id: 'role', header: '자리', width: '22%', render: (f, _ctx, i) => (
                      <Select
                        size="md" align="left" value={f.field_role}
                        options={codes.FIELD_ROLE.map((c) => ({ value: c.value, label: c.name }))}
                        onChange={(v) => setField(i, { field_role: v })}
                      />
                    ) },
                    { id: 'label', header: '표시 이름', render: (f, _ctx, i) => (
                      <input
                        type="text" className={INPUT_CLS} value={f.label || ''}
                        placeholder={titleCase(f.field_name)}
                        onChange={(e) => setField(i, { label: e.target.value })}
                      />
                    ) },
                    { id: 'format', header: '형식', width: '20%', render: (f, _ctx, i) => (
                      <Select
                        size="md" align="left" value={f.format}
                        options={codes.FIELD_FORMAT.map((c) => ({ value: c.value, label: c.name }))}
                        onChange={(v) => setField(i, { format: v })}
                      />
                    ) },
                  ],
                }}
              />
            )}
          </Section>

          {/* ③ 위젯 ────────────────────────────────────────────────────────── */}
          <Section step="③" title="위젯" hint="화면에 보여 줄 위젯 종류와 이름, 내놓을 화면을 정합니다.">
            <div className="text-[11px] font-medium text-gray-400 mb-1">보여 줄 위젯</div>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {viewTypes.map((c) => {
                const active = draft.view_type === c.value;
                return (
                  <button
                    key={c.value} type="button" onClick={() => patch({ view_type: c.value })}
                    aria-pressed={active}
                    className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                      active ? 'border-cyan-500 bg-cyan-600/20 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label htmlFor="uw-name" className="block text-[11px] font-medium text-gray-400 mb-1">이름</label>
                <input id="uw-name" type="text" className={INPUT_CLS} value={draft.name} maxLength={200} onChange={(e) => patch({ name: e.target.value })} />
              </div>
              <div>
                <label htmlFor="uw-group" className="block text-[11px] font-medium text-gray-400 mb-1">분류 (선택)</label>
                <input id="uw-group" type="text" className={INPUT_CLS} value={draft.group_name || ''} maxLength={100} placeholder="예: Rates" onChange={(e) => patch({ group_name: e.target.value })} />
              </div>
            </div>

            <div className="text-[11px] font-medium text-gray-400 mb-1">내놓을 화면 — 그 화면의 위젯 메뉴 "My Widgets" 에 나옵니다</div>
            <ScreenChips screens={draft.screens} onChange={(screens) => patch({ screens })} />
          </Section>
        </div>

        {/* 미리보기 ──────────────────────────────────────────────────────────── */}
        <div className="xl:sticky xl:top-[104px] min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-300">미리보기</span>
            <button type="button" onClick={refreshPreview} disabled={!schema} className={BTN_SECONDARY}>
              <Eye size={13} /> 설정 반영
            </button>
          </div>
          <div className="h-[440px]">
            {preview ? (
              <UniversalWidget
                key={preview.seq}
                widgetId="user/preview"
                config={preview.config}
                symbol={PREVIEW_SYMBOL}
              />
            ) : (
              <div className="h-full rounded-lg border border-dashed border-gray-700 flex items-center justify-center text-xs text-gray-500">
                API 를 고르면 여기에 위젯이 나옵니다
              </div>
            )}
          </div>
          <p className="text-[10px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
            종목 변수는 {PREVIEW_SYMBOL} 로 채워 보여 줍니다. 설정을 바꾼 뒤 "설정 반영" 을 누르세요.
          </p>
        </div>
      </div>
    </div>
  );
}
