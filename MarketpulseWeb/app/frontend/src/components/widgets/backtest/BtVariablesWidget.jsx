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
import useBacktestStore from '../../../store/backtestStore';
import { SERIES_CATALOG, GROUP_LABELS, resolveTemplate } from '../../backtest/seriesCatalog';
import { describeVariable, resolveOrder } from '../../backtest/engine/data';
import { ExprError } from '../../backtest/engine/expr';
import { inputCls, btnPrimary, btnGhost, Field, ErrorText, Empty, ExprInput, validateExpr, nameError } from '../../backtest/ui';

const STARTER = [
  { name: 'spy_close', description: 'S&P 500 ETF 종가', spec: { type: 'source', series: 'price-close', symbol: 'SPY' } },
  { name: 'vix', description: 'VIX 변동성 지수', spec: { type: 'source', series: 'vix' } },
  { name: 'us10y', description: '미 국채 10년 금리', spec: { type: 'source', series: 'treasury-10y' } },
  { name: 'spy_rsi14', description: 'SPY RSI(14)', spec: { type: 'formula', expr: 'rsi(spy_close, 14)' } },
  { name: 'spy_trend', description: 'SPY 50/200일 이동평균 괴리(%)', spec: { type: 'formula', expr: '(sma(spy_close, 50) / sma(spy_close, 200) - 1) * 100' } },
];

const FORMULA_PRESETS = [
  { label: 'RSI(14)', expr: 'rsi({x}, 14)' },
  { label: '이동평균 괴리 50/200 (%)', expr: '(sma({x}, 50) / sma({x}, 200) - 1) * 100' },
  { label: '1개월 변화율 (%)', expr: 'pct({x}, 21)' },
  { label: '1년 z-score', expr: 'zscore({x}, 252)' },
  { label: '고점 대비 낙폭 (%)', expr: 'drawdown({x})' },
  { label: '20일 변동성 (연율 %)', expr: 'std(pct({x}, 1), 20) * sqrt(252)' },
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
    if (otherNames.includes(draft.name)) return '같은 이름의 변수가 있습니다';
    if (draft.spec.type === 'formula') {
      const v = validateExpr(draft.spec.expr, { knownVariables: otherNames, allowEvents: false });
      if (!draft.spec.expr?.trim()) return '수식을 입력하세요';
      if (v.error) return v.error;
      try {
        // 저장하면 생길 의존 관계로 순환 참조를 미리 확인
        resolveOrder([draft.name], [...variables.filter((x) => x.item_id !== draft.item_id), { name: draft.name, spec: draft.spec }]);
      } catch (e) {
        if (e instanceof ExprError) return e.message;
      }
    } else {
      const entry = SERIES_CATALOG.find((e) => e.id === draft.spec.series);
      if (!entry) return '데이터 소스를 선택하세요';
      if (entry.needsSymbol && !draft.spec.symbol?.trim()) return '종목 심볼을 입력하세요';
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
    const warn = dependents.length ? `\n\n이 변수를 참조하는 수식 변수: ${dependents.map((d) => d.name).join(', ')}` : '';
    if (!window.confirm(`변수 '${item.name}' 을(를) 삭제할까요?${warn}`)) return;
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
      title="Variables"
      subtitle="사용자 변수 · 지표 수식"
      icon={Variable}
      onRemove={onRemove}
      loading={loading}
      onRefresh={() => load(true)}
      showViewToggle={false}
      showPeriodSelector={false}
      headerExtra={(
        <button onClick={() => { setDraft(blank()); setSaveError(null); }} className={btnGhost}>
          <Plus size={11} /> 변수
        </button>
      )}
    >
      <div className="flex flex-col h-full min-h-0">
        <ErrorText>{error}</ErrorText>

        {draft && (
          <div className="m-2 p-2.5 bg-[#0a0a0f] border border-cyan-800/50 rounded space-y-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-white">{draft.item_id ? '변수 수정' : '새 변수'}</span>
              <button onClick={() => setDraft(null)} className="text-gray-500 hover:text-white"><X size={12} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="이름 (수식에서 참조)">
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value.trim() })} placeholder="spy_close" className={`${inputCls} font-mono`} />
              </Field>
              <Field label="설명">
                <input value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <div className="flex gap-1">
              {[['source', '데이터 소스'], ['formula', '수식 / 지표']].map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => setSpec(t === 'formula' ? { type: 'formula', expr: draft.spec.expr || '' } : { type: 'source', series: draft.spec.series || 'price-close' })}
                  className={`px-2 py-0.5 rounded text-[11px] ${draft.spec.type === t ? 'bg-cyan-900/60 text-cyan-300' : 'text-gray-500 hover:text-gray-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {draft.spec.type === 'source' ? (
              <div className="grid grid-cols-[1fr_110px] gap-2">
                <Field label="시리즈">
                  <select value={draft.spec.series} onChange={(e) => setSpec({ series: e.target.value })} className={inputCls}>
                    {Object.entries(catalogGroups).map(([group, entries]) => (
                      <optgroup key={group} label={GROUP_LABELS[group] || group}>
                        {entries.map((e) => (
                          <option key={e.id} value={e.id}>{resolveTemplate(e.label, { symbol: '종목' })}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </Field>
                {SERIES_CATALOG.find((e) => e.id === draft.spec.series)?.needsSymbol && (
                  <Field label="심볼">
                    <input value={draft.spec.symbol || ''} onChange={(e) => setSpec({ symbol: e.target.value.toUpperCase() })} placeholder="SPY" className={`${inputCls} font-mono`} />
                  </Field>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <Field label="수식">
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
                    <span className="text-[10px] text-gray-600">프리셋:</span>
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
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto px-2 pb-2 space-y-1">
          {loaded && !variables.length && (
            <Empty>
              <div className="mb-2">아직 변수가 없습니다. 가격·매크로 시리즈를 변수로 등록하고 수식으로 지표를 만드세요.</div>
              <button onClick={addStarter} disabled={saving} className={`${btnPrimary} mx-auto`}>
                <Sparkles size={11} /> 기본 변수 세트 추가 (SPY·VIX·10Y·RSI·추세)
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
                    {v.spec?.type === 'formula' ? '수식' : '소스'}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      onClick={() => toggleExplorer(v.name)}
                      className={inExplorer ? 'text-cyan-400' : 'text-gray-600 hover:text-cyan-400'}
                      title={inExplorer ? '탐색기에서 빼기' : '탐색기에 추가'}
                    >
                      <LineChart size={11} />
                    </button>
                    <button onClick={() => { setDraft(structuredClone(v)); setSaveError(null); }} className="text-gray-600 hover:text-white opacity-0 group-hover:opacity-100" title="수정">
                      <Pencil size={11} />
                    </button>
                    <button onClick={() => remove(v)} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100" title="삭제">
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
