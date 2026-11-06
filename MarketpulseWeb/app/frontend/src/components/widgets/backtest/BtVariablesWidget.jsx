/**
 * BtVariablesWidget — 사용자 변수 관리 (Backtest Lab · Variables 탭).
 *
 *   source  : 시리즈 카탈로그(가격·매크로·퀀트 등) + 종목 심볼
 *   formula : 다른 변수를 참조하는 지표 수식 — 예) rsi(spy_close, 14), sma(spy_close, 50) - sma(spy_close, 200)
 * 정의는 사용자별로 서버에 저장되고, 계산은 브라우저에서 한다.
 */
import { useEffect, useMemo, useState } from 'react';
import { Variable, Plus, Pencil, Trash2, LineChart, Sparkles, X } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import { Select, INPUT_CLS as inputCls, SegmentedControl } from '../ui';
import useBacktestStore from '../../../store/backtestStore';
import { SERIES_CATALOG, GROUP_LABELS, resolveTemplate } from '../../backtest/seriesCatalog';
import { describeVariable, resolveOrder } from '../../backtest/engine/data';
import { ExprError } from '../../backtest/engine/expr';
import { btnPrimary, btnGhost, Field, ErrorText, Empty, ExprInput, validateExpr, nameError } from '../../backtest/ui';

const STARTER = [
  { name: 'spy_close', description: 'S&P 500 ETF close', spec: { type: 'source', series: 'price-close', symbol: 'SPY' } },
  { name: 'vix', description: 'VIX volatility index', spec: { type: 'source', series: 'vix' } },
  { name: 'us10y', description: 'US 10Y Treasury yield', spec: { type: 'source', series: 'treasury-10y' } },
  { name: 'spy_rsi14', description: 'SPY RSI(14)', spec: { type: 'formula', expr: 'rsi(spy_close, 14)' } },
  { name: 'spy_trend', description: 'SPY 50/200-day MA spread (%)', spec: { type: 'formula', expr: '(sma(spy_close, 50) / sma(spy_close, 200) - 1) * 100' } },
];

const FORMULA_PRESETS = [
  { label: 'RSI(14)', expr: 'rsi({x}, 14)' },
  { label: 'MA spread 50/200 (%)', expr: '(sma({x}, 50) / sma({x}, 200) - 1) * 100' },
  { label: '1M change (%)', expr: 'pct({x}, 21)' },
  { label: '1Y z-score', expr: 'zscore({x}, 252)' },
  { label: 'Drawdown from peak (%)', expr: 'drawdown({x})' },
  { label: '20-day volatility (ann. %)', expr: 'std(pct({x}, 1), 20) * sqrt(252)' },
];

const blank = () => ({ item_id: null, name: '', description: '', spec: { type: 'source', series: 'price-close', symbol: '' } });

export default function BtVariablesWidget({ onRemove }) {
  const { items, loaded, loading, error, load, saveItem, deleteItem, explorer, toggleExplorer } = useBacktestStore();
  const variables = items.variable;
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => { load(); }, [load]);

  const catalogGroups = useMemo(() => {
    const groups = {};
    for (const e of SERIES_CATALOG) (groups[e.group] ||= []).push(e);
    return groups;
  }, []);

  const otherNames = useMemo(
    () => variables.filter((v) => v.item_id !== draft?.item_id).map((v) => v.name),
    [variables, draft?.item_id],
  );

  const draftProblem = useMemo(() => {
    if (!draft) return null;
    const ne = nameError(draft.name);
    if (ne) return ne;
    if (otherNames.includes(draft.name)) return 'A variable with this name already exists';
    if (draft.spec.type === 'formula') {
      const v = validateExpr(draft.spec.expr, { knownVariables: otherNames, allowEvents: false });
      if (!draft.spec.expr?.trim()) return 'Enter an expression';
      if (v.error) return v.error;
      try {
        // 저장하면 생길 의존 관계로 순환 참조를 미리 확인
        resolveOrder([draft.name], [...variables.filter((x) => x.item_id !== draft.item_id), { name: draft.name, spec: draft.spec }]);
      } catch (e) {
        if (e instanceof ExprError) return e.message;
      }
    } else {
      const entry = SERIES_CATALOG.find((e) => e.id === draft.spec.series);
      if (!entry) return 'Pick a data source';
      if (entry.needsSymbol && !draft.spec.symbol?.trim()) return 'Enter a symbol';
    }
    return null;
  }, [draft, otherNames, variables]);

  const setSpec = (patch) => setDraft((d) => ({ ...d, spec: { ...d.spec, ...patch } }));

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const spec = draft.spec.type === 'formula'
        ? { type: 'formula', expr: draft.spec.expr.trim() }
        : { type: 'source', series: draft.spec.series, ...(draft.spec.symbol ? { symbol: draft.spec.symbol.trim().toUpperCase() } : {}) };
      await saveItem('variable', { item_id: draft.item_id, name: draft.name, description: draft.description, spec });
      setDraft(null);
    } catch (e) {
      setSaveError(e.detail || e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    const dependents = variables.filter((v) => v.spec?.type === 'formula' && validateExpr(v.spec.expr, { allowEvents: false }).variables.includes(item.name));
    const warn = dependents.length ? `\n\nExpression variables that use it: ${dependents.map((d) => d.name).join(', ')}` : '';
    if (!window.confirm(`Delete variable '${item.name}'?${warn}`)) return;
    try { await deleteItem(item); } catch (e) { setSaveError(e.detail || e.message); }
  };

  const addStarter = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      for (const s of STARTER) {
        if (!variables.some((v) => v.name === s.name)) await saveItem('variable', s);
      }
    } catch (e) {
      setSaveError(e.detail || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseWidget
      source="user"
      sourceNote="your variable definitions"
      title="Variables"
      subtitle="Your variables · indicator expressions"
      icon={Variable}
      onRemove={onRemove}
      loading={loading}
      onRefresh={() => load(true)}
      showPeriodSelector={false}
      headerExtra={(
        <button onClick={() => { setDraft(blank()); setSaveError(null); }} className={btnGhost}>
          <Plus size={11} /> Variable
        </button>
      )}
    >
      <div className="flex flex-col h-full min-h-0">
        <ErrorText>{error}</ErrorText>

        {draft && (
          <div className="m-2 p-2.5 bg-[#0a0a0f] border border-cyan-800/50 rounded space-y-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-white">{draft.item_id ? 'Edit variable' : 'New variable'}</span>
              <button onClick={() => setDraft(null)} className="text-gray-500 hover:text-white"><X size={12} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Name (used in expressions)">
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value.trim() })} placeholder="spy_close" className={`${inputCls} font-mono`} />
              </Field>
              <Field label="Description">
                <input value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <SegmentedControl value={draft.spec.type} ariaLabel="Variable type"
              onChange={(t) => setSpec(t === 'formula' ? { type: 'formula', expr: draft.spec.expr || '' } : { type: 'source', series: draft.spec.series || 'price-close' })}
              options={[{ value: 'source', label: 'Data source' }, { value: 'formula', label: 'Expression / indicator' }]} />

            {draft.spec.type === 'source' ? (
              <div className="grid grid-cols-[1fr_110px] gap-2">
                <Field label="Series">
                  <Select size="md" align="left" value={draft.spec.series} onChange={(v) => setSpec({ series: v })}
                    options={Object.entries(catalogGroups).flatMap(([group, entries]) => entries.map((e) => ({
                      value: e.id, label: resolveTemplate(e.label, { symbol: 'Symbol' }), group: GROUP_LABELS[group] || group,
                    })))} />
                </Field>
                {SERIES_CATALOG.find((e) => e.id === draft.spec.series)?.needsSymbol && (
                  <Field label="Symbol">
                    <input value={draft.spec.symbol || ''} onChange={(e) => setSpec({ symbol: e.target.value.toUpperCase() })} placeholder="SPY" className={`${inputCls} font-mono`} />
                  </Field>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <Field label="Expression">
                  <ExprInput
                    value={draft.spec.expr || ''}
                    onChange={(expr) => setSpec({ expr })}
                    knownVariables={otherNames}
                    allowEvents={false}
                    placeholder="rsi(spy_close, 14)"
                  />
                </Field>
                {otherNames.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] text-gray-600">Presets:</span>
                    {FORMULA_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        onClick={() => setSpec({ expr: p.expr.replaceAll('{x}', otherNames[0]) })}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800/60 text-gray-400 hover:text-cyan-300"
                        title={p.expr}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <ErrorText>{saveError}</ErrorText>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-amber-400/80">{draftProblem}</span>
              <button onClick={save} disabled={!!draftProblem || saving} className={btnPrimary}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto px-2 pb-2 space-y-1">
          {loaded && !variables.length && (
            <Empty>
              <div className="mb-2">No variables yet. Register price or macro series as variables, then build indicators with expressions.</div>
              <button onClick={addStarter} disabled={saving} className={`${btnPrimary} mx-auto`}>
                <Sparkles size={11} /> Add starter set (SPY·VIX·10Y·RSI·trend)
              </button>
            </Empty>
          )}
          {variables.map((v) => {
            const inExplorer = explorer.names.includes(v.name);
            return (
              <div key={v.item_id} className="group bg-[#0a0a0f] border border-gray-800/80 rounded px-2.5 py-1.5 hover:border-gray-700">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-white">{v.name}</span>
                  <span className={`text-[9px] px-1 rounded ${v.spec?.type === 'formula' ? 'bg-purple-900/40 text-purple-300' : 'bg-cyan-900/40 text-cyan-300'}`}>
                    {v.spec?.type === 'formula' ? 'Expression' : 'Source'}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      onClick={() => toggleExplorer(v.name)}
                      className={inExplorer ? 'text-cyan-400' : 'text-gray-600 hover:text-cyan-400'}
                      title={inExplorer ? 'Remove from explorer' : 'Add to explorer'}
                    >
                      <LineChart size={11} />
                    </button>
                    <button onClick={() => { setDraft(structuredClone(v)); setSaveError(null); }} className="text-gray-600 hover:text-white opacity-0 group-hover:opacity-100" title="Edit">
                      <Pencil size={11} />
                    </button>
                    <button onClick={() => remove(v)} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100" title="Delete">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                <div className="text-[10px] text-gray-500 font-mono truncate" title={describeVariable(v)}>{describeVariable(v)}</div>
                {v.description && <div className="text-[10px] text-gray-600 truncate">{v.description}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </BaseWidget>
  );
}
