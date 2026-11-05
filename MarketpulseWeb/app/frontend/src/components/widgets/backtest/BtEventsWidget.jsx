/**
 * BtEventsWidget — 이벤트 정의 (Backtest Lab · Event Mapping 탭).
 *
 *   manual    : 날짜 목록 ("YYYY-MM-DD 라벨" 한 줄씩) — FOMC·CPI 발표일, 실적일, 사건 등
 *   condition : 변수 조건식이 참이 되는 순간 — 예) vix > 30, cross_above(sma(spy_close,50), sma(spy_close,200))
 * 정의한 이벤트는 스터디(이벤트 전후 흐름)와 전략 수식의 event('이름') 으로 쓴다.
 */
import { useEffect, useMemo, useState } from 'react';
import { Flag, Plus, Pencil, Trash2, X, Crosshair } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import { INPUT_CLS as inputCls, SegmentedControl } from '../ui';
import useBacktestStore from '../../../store/backtestStore';
import { parseManualDates, formatManualDates } from '../../backtest/engine/events';
import { btnPrimary, btnGhost, Field, ErrorText, Empty, ExprInput, validateExpr, nameError } from '../../backtest/ui';

const COLORS = ['#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];

const CONDITION_PRESETS = [
  { label: 'VIX crosses 30', expr: 'vix > 30', needs: ['vix'] },
  { label: 'Golden cross 50/200', expr: 'cross_above(sma(spy_close, 50), sma(spy_close, 200))', needs: ['spy_close'] },
  { label: 'Death cross 50/200', expr: 'cross_below(sma(spy_close, 50), sma(spy_close, 200))', needs: ['spy_close'] },
  { label: 'SPY -10% from peak', expr: 'drawdown(spy_close) < -10', needs: ['spy_close'] },
  { label: 'RSI below 30', expr: 'rsi(spy_close, 14) < 30', needs: ['spy_close'] },
];

const blank = () => ({ item_id: null, name: '', description: '', spec: { type: 'manual', dates: [], color: COLORS[0] }, datesText: '' });

export default function BtEventsWidget({ onRemove }) {
  const { items, loaded, loading, error, load, saveItem, deleteItem, study, setStudy } = useBacktestStore();
  const events = items.event;
  const variableNames = useMemo(() => items.variable.map((v) => v.name), [items.variable]);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => { load(); }, [load]);

  const parsedDates = useMemo(() => (draft?.spec.type === 'manual' ? parseManualDates(draft.datesText) : null), [draft]);

  const draftProblem = useMemo(() => {
    if (!draft) return null;
    const ne = nameError(draft.name);
    if (ne) return ne;
    if (events.some((e) => e.name === draft.name && e.item_id !== draft.item_id)) return 'An event with this name already exists';
    if (draft.spec.type === 'manual') {
      if (parsedDates.errors.length) return parsedDates.errors[0];
      if (!parsedDates.dates.length) return 'Enter one date per line';
    } else {
      if (!draft.spec.expr?.trim()) return 'Enter a condition';
      const v = validateExpr(draft.spec.expr, { knownVariables: variableNames, allowEvents: false });
      if (v.error) return v.error;
    }
    return null;
  }, [draft, parsedDates, events, variableNames]);

  const setSpec = (patch) => setDraft((d) => ({ ...d, spec: { ...d.spec, ...patch } }));

  const edit = (ev) => {
    setSaveError(null);
    setDraft({ ...structuredClone(ev), datesText: formatManualDates(ev.spec?.dates) });
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const { color } = draft.spec;
      const spec = draft.spec.type === 'manual'
        ? { type: 'manual', color, dates: parsedDates.dates }
        : { type: 'condition', color, expr: draft.spec.expr.trim(), cooldown: Math.max(0, Math.floor(Number(draft.spec.cooldown) || 0)) };
      await saveItem('event', { item_id: draft.item_id, name: draft.name, description: draft.description, spec });
      setDraft(null);
    } catch (e) {
      setSaveError(e.detail || e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (ev) => {
    if (!window.confirm(`Delete event '${ev.name}'?`)) return;
    try { await deleteItem(ev); } catch (e) { setSaveError(e.detail || e.message); }
  };

  return (
    <BaseWidget
      title="Events"
      subtitle="Event definitions · mapping"
      icon={Flag}
      onRemove={onRemove}
      loading={loading}
      onRefresh={() => load(true)}
      showPeriodSelector={false}
      headerExtra={(
        <button onClick={() => { setDraft(blank()); setSaveError(null); }} className={btnGhost}>
          <Plus size={11} /> Event
        </button>
      )}
    >
      <div className="flex flex-col h-full min-h-0">
        <ErrorText>{error}</ErrorText>

        {draft && (
          <div className="m-2 p-2.5 bg-[#0a0a0f] border border-cyan-800/50 rounded space-y-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-white">{draft.item_id ? 'Edit event' : 'New event'}</span>
              <button onClick={() => setDraft(null)} className="text-gray-500 hover:text-white"><X size={12} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Name (referenced as event('name'))">
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value.trim() })} placeholder="fomc" className={`${inputCls} font-mono`} />
              </Field>
              <Field label="Description">
                <input value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <SegmentedControl value={draft.spec.type} onChange={(t) => setSpec({ type: t })} ariaLabel="Event type"
                options={[{ value: 'manual', label: 'Dates' }, { value: 'condition', label: 'Condition' }]} />
              <div className="flex gap-1 ml-auto">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSpec({ color: c })}
                    className={`w-3.5 h-3.5 rounded-full border-2 ${draft.spec.color === c ? 'border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {draft.spec.type === 'manual' ? (
              <Field label="Date list" hint={`${parsedDates.dates.length} parsed · holidays map to the next trading day`}>
                <textarea
                  value={draft.datesText}
                  onChange={(e) => setDraft({ ...draft, datesText: e.target.value })}
                  rows={5}
                  spellCheck={false}
                  placeholder={'2026-01-28 FOMC hold\n2026-03-18 FOMC cut'}
                  className={`${inputCls} font-mono resize-y`}
                />
              </Field>
            ) : (
              <div className="space-y-1.5">
                <Field label="Condition (fires on the bar where it turns false → true)">
                  <ExprInput value={draft.spec.expr || ''} onChange={(expr) => setSpec({ expr })} knownVariables={variableNames} allowEvents={false} placeholder="vix > 30" />
                </Field>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-gray-600">Presets:</span>
                  {CONDITION_PRESETS.filter((p) => p.needs.every((n) => variableNames.includes(n))).map((p) => (
                    <button key={p.label} onClick={() => setSpec({ expr: p.expr })} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800/60 text-gray-400 hover:text-cyan-300" title={p.expr}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <Field label="Cooldown (bars)" hint="Ignore repeats within this many bars — removes duplicate signals">
                  <input type="number" min={0} value={draft.spec.cooldown ?? 0} onChange={(e) => setSpec({ cooldown: e.target.value })} className={`${inputCls} !w-24`} />
                </Field>
              </div>
            )}

            <ErrorText>{saveError}</ErrorText>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-amber-400/80">{draftProblem}</span>
              <button onClick={save} disabled={!!draftProblem || saving} className={btnPrimary}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto px-2 pb-2 space-y-1">
          {loaded && !events.length && (
            <Empty>No events yet. Define one from a date list (e.g. release dates) or a condition on variables.</Empty>
          )}
          {events.map((ev) => (
            <div key={ev.item_id} className={`group bg-[#0a0a0f] border rounded px-2.5 py-1.5 ${study.event === ev.name ? 'border-cyan-800' : 'border-gray-800/80 hover:border-gray-700'}`}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ev.spec?.color || COLORS[0] }} />
                <span className="font-mono text-[11px] text-white">{ev.name}</span>
                <span className={`text-[9px] px-1 rounded ${ev.spec?.type === 'condition' ? 'bg-purple-900/40 text-purple-300' : 'bg-amber-900/40 text-amber-300'}`}>
                  {ev.spec?.type === 'condition' ? 'Condition' : `${ev.spec?.dates?.length || 0} dates`}
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  <button onClick={() => setStudy({ event: ev.name })} className={study.event === ev.name ? 'text-cyan-400' : 'text-gray-600 hover:text-cyan-400'} title="Open in event study">
                    <Crosshair size={11} />
                  </button>
                  <button onClick={() => edit(ev)} className="text-gray-600 hover:text-white opacity-0 group-hover:opacity-100" title="Edit"><Pencil size={11} /></button>
                  <button onClick={() => remove(ev)} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100" title="Delete"><Trash2 size={11} /></button>
                </div>
              </div>
              <div className="text-[10px] text-gray-500 font-mono truncate">
                {ev.spec?.type === 'condition'
                  ? `${ev.spec.expr}${ev.spec.cooldown ? ` · cooldown ${ev.spec.cooldown} bars` : ''}`
                  : (ev.spec?.dates || []).slice(-3).map((d) => d.date).join(', ') + ((ev.spec?.dates?.length || 0) > 3 ? ' …' : '')}
              </div>
              {ev.description && <div className="text-[10px] text-gray-600 truncate">{ev.description}</div>}
            </div>
          ))}
        </div>
      </div>
    </BaseWidget>
  );
}
