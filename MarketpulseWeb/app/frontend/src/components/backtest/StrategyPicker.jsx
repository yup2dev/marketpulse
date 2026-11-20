/**
 * StrategyPicker — 백테스트 머리줄 왼쪽: 전략 드롭다운 + 새 전략 · 편집 · 삭제.
 *
 * 지금 있는 전략(기본 제공 + 내 전략, /api/strategies)을 보여 주고, 고르면 화면 변수 strategy 를 바꾼다.
 * 결과 위젯(bt-run-* · bt-compare — DB 행)이 같은 변수로 /api/strategies/* 를 다시 부른다.
 * 기간 · 벤치마크 · 거래비용은 따로 고르지 않는다 — 서버 기본값(전체 기간 · S&P 500 · 10bp).
 * 기본 제공 전략은 고칠 수 없어 '복제해서 편집' 으로 내 전략을 만든다.
 */
import { useCallback, useEffect, useState } from 'react';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { apiClient, API_BASE } from '../../common';
import { setShared, useShared } from '../../mp-widgets/shared';
import { usePopover } from '../widgets/ui';
import StrategyEditor, { GHOST, blank, summary } from './StrategyEditor';

const bump = () => setShared('bt_rev', String(Date.now()));   // 결과 위젯이 다시 부르게 (같은 전략을 고쳤을 때도)

export default function StrategyPicker() {
  const shared = useShared();
  const [list, setList] = useState(null);
  const [meta, setMeta] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get(`${API_BASE}/strategies`);
      setList(res.results || []);
      setMeta(res.metadata || {});
      return res;
    } catch {
      setList([]);
      return null;
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const fallback = meta?.default || list?.[0]?.strategy_id || '';
  const value = list?.some((s) => s.strategy_id === shared.strategy) ? shared.strategy : fallback;
  const selected = list?.find((s) => s.strategy_id === value);
  const pick = (id) => { setShared('strategy', id); bump(); };

  // ── 편집 ──
  const pop = usePopover();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const openEditor = (mode) => {
    setFormError(null);
    if (mode === 'new') setForm(blank(meta));
    else if (selected) {
      const base = {
        name: selected.name, description: selected.description || '', score_kind: selected.score_kind,
        model: selected.model || 'stack', factors: selected.factors.map((f) => ({ ...f })),
        top_n: selected.top_n, rebalance: selected.rebalance,
      };
      setForm(mode === 'edit' && selected.editable ? { ...base, id: selected.strategy_id } : { ...base, name: `${selected.name} 복사본` });
    }
    pop.setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setFormError(null);
    const { id, ...body } = form;
    if (body.score_kind === 'ml') body.factors = [];
    try {
      const res = id
        ? await apiClient.put(`${API_BASE}/strategies/${id}`, body)
        : await apiClient.post(`${API_BASE}/strategies`, body);
      await load();
      pop.close();
      setForm(null);
      if (res.results?.[0]) pick(res.results[0].strategy_id);
    } catch (e) {
      setFormError(e.detail || e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected?.editable) return;
    try {
      await apiClient.del(`${API_BASE}/strategies/${selected.strategy_id}`);
      const res = await load();
      pick(res?.metadata?.default || '');
    } catch {
      /* 목록은 그대로 — 다시 시도할 수 있다 */
    }
  };

  if (!list?.length) return null;
  const builtin = list.filter((s) => s.builtin);
  const mine = list.filter((s) => !s.builtin);

  return (
    <div className="relative flex items-center gap-1" ref={pop.ref}>
      <select
        aria-label="전략"
        title={selected ? summary(selected, meta) : '백테스트할 전략'}
        value={value}
        onChange={(e) => pick(e.target.value)}
        className="h-7 max-w-[260px] px-2 rounded border border-gray-700 bg-transparent text-xs font-semibold text-gray-200 outline-none hover:border-gray-500 focus:border-cyan-500 [&_optgroup]:bg-gray-900 [&_option]:bg-gray-900"
      >
        <optgroup label="기본 제공">
          {builtin.map((s) => <option key={s.strategy_id} value={s.strategy_id}>{s.name}</option>)}
        </optgroup>
        {mine.length > 0 && (
          <optgroup label="내 전략">
            {mine.map((s) => <option key={s.strategy_id} value={s.strategy_id}>{s.name}</option>)}
          </optgroup>
        )}
      </select>
      <span className="hidden lg:inline text-[11px] text-gray-500 max-w-[220px] truncate">{summary(selected, meta)}</span>

      <button type="button" className={GHOST} onClick={() => openEditor('new')} title="새 전략 만들기">
        <Plus size={12} />새 전략
      </button>
      <button
        type="button"
        className={GHOST}
        onClick={() => openEditor(selected?.editable ? 'edit' : 'copy')}
        title={selected?.editable ? '이 전략 고치기' : '기본 제공 전략은 복제해서 고쳐요'}
      >
        {selected?.editable ? <><Pencil size={12} />편집</> : <><Copy size={12} />복제해서 편집</>}
      </button>
      {selected?.editable && (
        <button type="button" className={GHOST} onClick={remove} aria-label="이 전략 지우기" title="이 전략 지우기">
          <Trash2 size={12} />
        </button>
      )}

      {pop.open && form && (
        <StrategyEditor
          form={form}
          setForm={setForm}
          catalog={meta}
          saving={saving}
          error={formError}
          onSave={save}
          onCopy={form.id ? () => setForm({ ...form, id: undefined, name: `${form.name} 복사본` }) : null}
          onClose={pop.close}
        />
      )}
    </div>
  );
}
