/**
 * StrategyBuilderTab — Two-section Strategy Builder
 *
 * Section 1 — Variables: define named factor instances (let fast_ema = EMA(9))
 * Section 2 — Logic: compose BUY/SELL conditions from defined variables
 */
import React, { useState, useCallback } from 'react';
import { Plus, X, Save, Play, ChevronDown, Zap, FlaskConical } from 'lucide-react';
import {
  FACTORS, FACTOR_GROUPS, OPERATORS,
  factorLabel, GROUP_META, defaultFactorState,
} from '../../data/factorDefinitions';
import { quantAPI } from '../../config/api';
import toast from 'react-hot-toast';

// ── uid ──────────────────────────────────────────────────────────────────────
let _uid = 0;
const uid = () => `u${++_uid}`;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Auto-generate a unique variable name like "ema_9", "rsi_14" */
const autoVarName = (factor, params, existingNames) => {
  const def = FACTORS[factor] || {};
  const base = (def.label || factor).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
  const firstParam = def.params?.[0];
  const suffix = firstParam && params[firstParam.name] != null ? `_${params[firstParam.name]}` : '';
  let name = `${base}${suffix}`;
  let i = 2;
  while (existingNames.includes(name)) name = `${base}${suffix}_${i++}`;
  return name;
};

/** Resolve a condition side ref to { factor, params } for the API payload */
const resolveRef = (ref, variables) => {
  if (!ref) return null;
  if (ref.isValue) return { factor: 'VALUE', params: { value: ref.value ?? 0 }, value: ref.value ?? 0 };
  const v = variables.find(v => v.id === ref.varId);
  if (!v) return null;
  return { factor: v.factor, params: v.params };
};

/** Human-readable label for a ref */
const refLabel = (ref, variables) => {
  if (!ref) return '?';
  if (ref.isValue) return String(ref.value ?? 0);
  return variables.find(v => v.id === ref.varId)?.name || '?';
};

// ── Factor Palette (clickable chips to add a variable) ────────────────────

const PALETTE_GROUPS = [
  { group: 'Trend',      factors: ['EMA', 'SMA', 'VWAP'] },
  { group: 'Momentum',   factors: ['RSI', 'MACD_LINE', 'MACD_SIGNAL', 'STOCH_K', 'STOCH_D'] },
  { group: 'Volatility', factors: ['BB_UPPER', 'BB_LOWER', 'BB_MID', 'ATR'] },
  { group: 'Statistical',factors: ['ZSCORE', 'PERCENTILE'] },
  { group: 'Price',      factors: ['CLOSE', 'OPEN', 'HIGH', 'LOW'] },
];

const FactorPalette = ({ onAdd }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] bg-cyan-900/30 border border-cyan-700/40 text-cyan-300 rounded hover:bg-cyan-900/50 transition-colors"
      >
        <Plus size={11} />
        변수 추가
        <ChevronDown size={9} className="text-cyan-600" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-[#0d0d12] border border-gray-700 rounded-lg shadow-2xl w-64 overflow-y-auto max-h-72 py-1">
            {PALETTE_GROUPS.map(({ group, factors }) => {
              const meta = GROUP_META[group] || {};
              return (
                <div key={group}>
                  <div className="px-3 py-1 text-[9px] text-gray-600 uppercase tracking-wider bg-[#060608] sticky top-0 flex items-center gap-1">
                    <span>{meta.icon}</span>
                    <span className={meta.color}>{group}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 px-2 py-1.5">
                    {factors.map(fId => {
                      const f = FACTORS[fId];
                      if (!f) return null;
                      return (
                        <button
                          key={fId}
                          type="button"
                          onClick={() => { onAdd(fId); setOpen(false); }}
                          className="px-2 py-0.5 text-[10px] rounded border border-gray-700 text-gray-300 hover:border-cyan-600 hover:text-cyan-300 hover:bg-cyan-900/20 transition-colors"
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// ── Variable Row ──────────────────────────────────────────────────────────────

const VariableRow = ({ variable, variables, onChange, onRemove }) => {
  const [factorOpen, setFactorOpen] = useState(false);
  const def  = FACTORS[variable.factor] || {};
  const meta = GROUP_META[def.group]    || {};

  const changeFactor = (fId) => {
    const newDef = FACTORS[fId] || {};
    const params = {};
    newDef.params?.forEach(p => { params[p.name] = p.default; });
    const existingNames = variables.filter(v => v.id !== variable.id).map(v => v.name);
    onChange({ ...variable, factor: fId, params, name: autoVarName(fId, params, existingNames) });
    setFactorOpen(false);
  };

  const setParam = (pName, val) => {
    const p = def.params?.find(p => p.name === pName);
    onChange({ ...variable, params: { ...variable.params, [pName]: p?.type === 'text' ? val : Number(val) } });
  };

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-2 bg-[#060608] border border-gray-800 rounded-lg hover:border-gray-700 transition-colors group">

      {/* = name */}
      <span className="text-[10px] text-gray-600 shrink-0 font-mono">let</span>
      <input
        value={variable.name}
        onChange={e => onChange({ ...variable, name: e.target.value.replace(/\s/g, '_').toLowerCase() })}
        className="w-[88px] px-1.5 py-0.5 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
        placeholder="var_name"
      />
      <span className="text-[10px] text-gray-600 shrink-0 font-mono">=</span>

      {/* Factor selector */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setFactorOpen(o => !o)}
          className="flex items-center gap-1 px-2 py-0.5 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] hover:border-gray-600 transition-colors"
        >
          <span className="text-[10px]">{meta.icon}</span>
          <span className={`${meta.color || 'text-gray-300'}`}>{def.label || variable.factor}</span>
          <ChevronDown size={9} className="text-gray-600" />
        </button>
        {factorOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setFactorOpen(false)} />
            <div className="absolute top-full left-0 mt-1 z-50 bg-[#0d0d12] border border-gray-700 rounded-lg shadow-2xl w-44 max-h-56 overflow-y-auto">
              {PALETTE_GROUPS.map(({ group, factors }) => {
                const gMeta = GROUP_META[group] || {};
                return (
                  <div key={group}>
                    <div className="px-2 py-1 text-[9px] text-gray-600 uppercase tracking-wider bg-[#060608] sticky top-0">
                      {gMeta.icon} {group}
                    </div>
                    {factors.map(fId => (
                      <button key={fId} type="button" onClick={() => changeFactor(fId)}
                        className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-gray-800 transition-colors ${variable.factor === fId ? 'text-cyan-300' : 'text-gray-300'}`}>
                        {FACTORS[fId]?.label}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Param inputs */}
      {def.params?.map(p => (
        <div key={p.name} className="flex items-center gap-0.5">
          <span className="text-[9px] text-gray-600">{p.label[0].toUpperCase()}=</span>
          <input
            type={p.type === 'text' ? 'text' : 'number'}
            value={variable.params?.[p.name] ?? p.default}
            onChange={e => setParam(p.name, e.target.value)}
            step={p.step ?? 1} min={p.min} max={p.max}
            title={p.label}
            className={`${p.type === 'text' ? 'w-10' : 'w-10'} px-1 py-0.5 bg-[#0a0a0f] border border-gray-700 rounded text-[10px] text-gray-300 focus:outline-none focus:border-cyan-500 tabular-nums`}
          />
        </div>
      ))}

      {/* Formula hint */}
      {def.formula && (
        <span className="text-[9px] text-gray-700 font-mono truncate max-w-[90px] hidden group-hover:block" title={def.formula}>
          {def.formula}
        </span>
      )}

      <button type="button" onClick={onRemove}
        className="p-0.5 text-gray-700 hover:text-red-400 transition-colors shrink-0 ml-auto">
        <X size={11} />
      </button>
    </div>
  );
};

// ── Variable Dropdown (for condition sides) ───────────────────────────────────

const VarDropdown = ({ value, variables, onChange }) => {
  const [open, setOpen] = useState(false);
  const v = variables.find(v => v.id === value?.varId);
  const isVal = value?.isValue;
  const def  = v ? FACTORS[v.factor] : null;
  const meta = def ? GROUP_META[def.group] : null;

  const label = isVal ? `${value.value ?? 0}` : v ? v.name : '— select —';
  const labelColor = v ? (meta?.color || 'text-gray-300') : isVal ? 'text-gray-400' : 'text-gray-600';

  const select = (opt) => { onChange(opt); setOpen(false); };

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 px-2 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] hover:border-cyan-600 transition-colors ${labelColor}`}>
        {v && <span className="text-[9px]">{meta?.icon}</span>}
        <span>{label}</span>
        <ChevronDown size={9} className="text-gray-600" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-[#0d0d12] border border-gray-700 rounded-lg shadow-2xl min-w-[150px] max-h-52 overflow-y-auto">
            <div className="px-2 py-1 text-[9px] text-gray-600 uppercase tracking-wider bg-[#060608]">Variables</div>
            {variables.length === 0 && (
              <div className="px-3 py-2 text-[10px] text-gray-600 italic">변수를 먼저 정의하세요</div>
            )}
            {variables.map(v => {
              const vDef  = FACTORS[v.factor];
              const vMeta = GROUP_META[vDef?.group] || {};
              const paramHint = factorLabel({ factor: v.factor, params: v.params });
              return (
                <button key={v.id} type="button" onClick={() => select({ varId: v.id })}
                  className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-gray-800 transition-colors flex items-center justify-between gap-2">
                  <span className={vMeta.color || 'text-gray-300'}>
                    <span className="text-[9px] mr-1">{vMeta.icon}</span>{v.name}
                  </span>
                  <span className="text-[9px] text-gray-600 tabular-nums">{paramHint}</span>
                </button>
              );
            })}
            <div className="px-2 py-1 text-[9px] text-gray-600 uppercase tracking-wider bg-[#060608] border-t border-gray-800">Constant</div>
            <button type="button" onClick={() => select({ isValue: true, value: 0 })}
              className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-gray-800 transition-colors text-gray-400">
              Value (숫자)
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ── Condition Row ─────────────────────────────────────────────────────────────

const ConditionRow = ({ cond, variables, onChange, onRemove }) => (
  <div className="flex items-center gap-1.5 p-2 bg-[#060608] border border-gray-800 rounded-lg flex-wrap">
    <VarDropdown value={cond.left} variables={variables}
      onChange={left => onChange({ ...cond, left })} />
    {cond.left?.isValue && (
      <input type="number" value={cond.left.value ?? 0}
        onChange={e => onChange({ ...cond, left: { ...cond.left, value: Number(e.target.value) } })}
        step="any"
        className="w-16 px-1.5 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500 tabular-nums" />
    )}

    <select value={cond.op} onChange={e => onChange({ ...cond, op: e.target.value })}
      className="px-1.5 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-yellow-300 focus:outline-none focus:border-yellow-600">
      {OPERATORS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>

    <VarDropdown value={cond.right} variables={variables}
      onChange={right => onChange({ ...cond, right })} />
    {cond.right?.isValue && (
      <input type="number" value={cond.right.value ?? 0}
        onChange={e => onChange({ ...cond, right: { ...cond.right, value: Number(e.target.value) } })}
        step="any"
        className="w-16 px-1.5 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500 tabular-nums" />
    )}

    <button type="button" onClick={onRemove}
      className="ml-auto p-1 text-gray-600 hover:text-red-400 transition-colors shrink-0">
      <X size={12} />
    </button>
  </div>
);

// ── Condition Section ─────────────────────────────────────────────────────────

const ConditionSection = ({ title, color, dot, conditions, logic, variables, onAdd, onChange, onRemove, onLogicChange }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2">
      <span className={`text-[11px] font-semibold ${color} flex items-center gap-1`}>
        <span>{dot}</span> {title}
      </span>
      <select value={logic} onChange={e => onLogicChange(e.target.value)}
        className="px-1.5 py-0.5 bg-[#0a0a0f] border border-gray-700 rounded text-[10px] text-gray-300 focus:outline-none">
        <option value="AND">AND</option>
        <option value="OR">OR</option>
      </select>
      <span className="text-[9px] text-gray-700">{logic === 'AND' ? '모두 충족' : '하나라도 충족'}</span>
    </div>

    {conditions.map(c => (
      <ConditionRow key={c.id} cond={c} variables={variables}
        onChange={upd => onChange(c.id, upd)}
        onRemove={() => onRemove(c.id)} />
    ))}

    {conditions.length === 0 && (
      <div className="text-[11px] text-gray-600 border border-dashed border-gray-800 rounded-lg px-3 py-2.5 text-center">
        조건 없음
      </div>
    )}

    <button type="button" onClick={onAdd}
      className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-cyan-300 transition-colors">
      <Plus size={11} /> 조건 추가
    </button>
  </div>
);

// ── Strategy Preview ──────────────────────────────────────────────────────────

const StrategyPreview = ({ buyConds, buyLogic, sellConds, sellLogic, variables }) => {
  const hasAny = buyConds.length > 0 || sellConds.length > 0;
  if (!hasAny) return null;

  const fmtCond = (c) => {
    const l = refLabel(c.left, variables);
    const r = refLabel(c.right, variables);
    const op = OPERATORS.find(o => o.id === c.op)?.label || c.op;
    return `${l} ${op} ${r}`;
  };

  return (
    <div className="border border-gray-800/80 rounded-lg p-3 bg-[#060608] font-mono space-y-1.5">
      <div className="text-[9px] text-gray-600 uppercase tracking-wide flex items-center gap-1 mb-1">
        <Zap size={9} className="text-cyan-400" /> Preview
      </div>
      {buyConds.length > 0 && (
        <div className="text-[11px] leading-relaxed">
          <span className="text-green-400 font-bold">BUY  </span>
          <span className="text-gray-500">if  </span>
          <span className="text-gray-200">
            {buyConds.map((c, i) => (
              <span key={c.id}>
                {i > 0 && <span className="text-yellow-500 mx-1">{buyLogic}</span>}
                {fmtCond(c)}
              </span>
            ))}
          </span>
        </div>
      )}
      {sellConds.length > 0 && (
        <div className="text-[11px] leading-relaxed">
          <span className="text-red-400 font-bold">SELL </span>
          <span className="text-gray-500">if  </span>
          <span className="text-gray-200">
            {sellConds.map((c, i) => (
              <span key={c.id}>
                {i > 0 && <span className="text-yellow-500 mx-1">{sellLogic}</span>}
                {fmtCond(c)}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
};

// ── Step Header ───────────────────────────────────────────────────────────────

const StepHeader = ({ step, title, sub }) => (
  <div className="flex items-center gap-2 mb-2">
    <span className="w-5 h-5 rounded-full bg-cyan-900/50 border border-cyan-700/50 text-cyan-400 text-[10px] font-bold flex items-center justify-center shrink-0">
      {step}
    </span>
    <div>
      <div className="text-[11px] font-semibold text-white">{title}</div>
      {sub && <div className="text-[9px] text-gray-600">{sub}</div>}
    </div>
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────

const initState = () => {
  const v0 = uid(), v1 = uid();
  return {
    variables: [
      { id: v0, name: 'fast_ema', factor: 'EMA',  params: { period: 9  } },
      { id: v1, name: 'slow_ema', factor: 'EMA',  params: { period: 21 } },
    ],
    buyConds: [{ id: uid(), left: { varId: v0 }, op: 'crosses_above', right: { varId: v1 } }],
    sellConds: [{ id: uid(), left: { varId: v0 }, op: 'crosses_below', right: { varId: v1 } }],
  };
};

const StrategyBuilderTab = ({ onRun }) => {
  const [state] = useState(initState);
  const [variables, setVariables] = useState(state.variables);
  const [buyConds,  setBuyConds]  = useState(state.buyConds);
  const [sellConds, setSellConds] = useState(state.sellConds);
  const [buyLogic,  setBuyLogic]  = useState('AND');
  const [sellLogic, setSellLogic] = useState('OR');

  // Settings
  const [name,       setName]       = useState('');
  const [ticker,     setTicker]     = useState('AAPL');
  const [startDate,  setStartDate]  = useState('2022-01-01');
  const [endDate,    setEndDate]    = useState('2024-12-31');
  const [stopLoss,   setStopLoss]   = useState(5);
  const [takeProfit, setTakeProfit] = useState(15);
  const [capital,    setCapital]    = useState(10000);
  const [saving,     setSaving]     = useState(false);

  // ── Variable management ─────────────────────────────────────────────────
  const addVariable = useCallback((factorId) => {
    const def = FACTORS[factorId] || {};
    const params = {};
    def.params?.forEach(p => { params[p.name] = p.default; });
    const name = autoVarName(factorId, params, variables.map(v => v.name));
    setVariables(vs => [...vs, { id: uid(), name, factor: factorId, params }]);
  }, [variables]);

  const updateVariable = useCallback((id, upd) =>
    setVariables(vs => vs.map(v => v.id === id ? upd : v)), []);

  const removeVariable = useCallback((id) => {
    setVariables(vs => vs.filter(v => v.id !== id));
    // Clear conditions that reference this variable
    const nullRef = (ref) => ref?.varId === id ? null : ref;
    setBuyConds(cs => cs.map(c => ({ ...c, left: nullRef(c.left), right: nullRef(c.right) })));
    setSellConds(cs => cs.map(c => ({ ...c, left: nullRef(c.left), right: nullRef(c.right) })));
  }, []);

  // ── Condition management ────────────────────────────────────────────────
  const newCond = useCallback(() => {
    const l = variables[0]?.id;
    const r = variables[1]?.id || variables[0]?.id;
    return {
      id: uid(),
      left:  l ? { varId: l } : null,
      op:    'crosses_above',
      right: r ? { varId: r } : null,
    };
  }, [variables]);

  const addBuy    = () => setBuyConds(cs => [...cs, newCond()]);
  const addSell   = () => setSellConds(cs => [...cs, newCond()]);
  const updBuy    = (id, upd) => setBuyConds(cs => cs.map(c => c.id === id ? upd : c));
  const updSell   = (id, upd) => setSellConds(cs => cs.map(c => c.id === id ? upd : c));
  const remBuy    = (id) => setBuyConds(cs => cs.filter(c => c.id !== id));
  const remSell   = (id) => setSellConds(cs => cs.filter(c => c.id !== id));

  // ── Build payload ───────────────────────────────────────────────────────
  const buildPayload = useCallback(() => {
    const mapCond = ({ id: _id, ...c }) => ({
      left:  resolveRef(c.left,  variables),
      op:    c.op,
      right: resolveRef(c.right, variables),
    });
    return {
      ticker,
      start_date: startDate,
      end_date:   endDate,
      strategy: {
        type:             'custom',
        buy_logic:        buyLogic,
        sell_logic:       sellLogic,
        buy_conditions:   buyConds.map(mapCond).filter(c => c.left && c.right),
        sell_conditions:  sellConds.map(mapCond).filter(c => c.left && c.right),
        stop_loss_pct:    stopLoss,
        take_profit_pct:  takeProfit,
        initial_capital:  capital,
      },
    };
  }, [variables, buyConds, sellConds, buyLogic, sellLogic, ticker, startDate, endDate, stopLoss, takeProfit, capital]);

  const handleRun = () => {
    if (!buyConds.length) { toast.error('매수 조건을 하나 이상 추가하세요'); return; }
    const payload = buildPayload();
    const valid = payload.strategy.buy_conditions.filter(c => c.left && c.right);
    if (!valid.length) { toast.error('유효한 매수 조건이 없습니다 — 변수를 할당하세요'); return; }
    onRun(payload);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('전략 이름을 입력하세요'); return; }
    if (!buyConds.length) { toast.error('매수 조건을 하나 이상 추가하세요'); return; }
    setSaving(true);
    try {
      const payload = buildPayload();
      await quantAPI.createStrategy({
        name: name.trim(),
        strategy_type: 'custom',
        formula: buyConds.map(c => `${refLabel(c.left, variables)} ${c.op} ${refLabel(c.right, variables)}`).join(` ${buyLogic} `),
        variables: JSON.stringify(variables),
        buy_condition:  buyConds.map(c => `${refLabel(c.left, variables)} ${c.op} ${refLabel(c.right, variables)}`).join(` ${buyLogic} `),
        sell_condition: sellConds.map(c => `${refLabel(c.left, variables)} ${c.op} ${refLabel(c.right, variables)}`).join(` ${sellLogic} `),
        parameters: JSON.stringify({ ...payload.strategy, ticker, start_date: startDate, end_date: endDate }),
        notes: '',
      });
      toast.success(`"${name}" 저장 완료`);
    } catch (err) {
      toast.error(err.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Settings bar ─────────────────────────────────────────────────── */}
      <div className="px-4 py-2.5 border-b border-gray-800 shrink-0 bg-[#060608]">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Ticker */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-gray-600 uppercase">Ticker</span>
            <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
              className="w-14 px-1.5 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white uppercase focus:outline-none focus:border-cyan-500" />
          </div>
          {/* Dates */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-gray-600 uppercase">From</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="px-1.5 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-gray-600 uppercase">To</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="px-1.5 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500" />
          </div>
        </div>
      </div>

      {/* ── Scrollable body ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* ── STEP 1: Variables ─────────────────────────────────────────── */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <StepHeader step="1" title="Variables" sub="팩터 클릭 → 변수 정의" />
            <FactorPalette onAdd={addVariable} />
          </div>

          {variables.length === 0 ? (
            <div className="text-[11px] text-gray-600 border border-dashed border-gray-800 rounded-lg px-3 py-4 text-center">
              위 버튼으로 팩터를 추가하세요
            </div>
          ) : (
            <div className="space-y-1.5">
              {variables.map(v => (
                <VariableRow
                  key={v.id}
                  variable={v}
                  variables={variables}
                  onChange={upd => updateVariable(v.id, upd)}
                  onRemove={() => removeVariable(v.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── STEP 2: Strategy Logic ────────────────────────────────────── */}
        <section className="space-y-4">
          <StepHeader step="2" title="Strategy Logic" sub="정의된 변수로 조건 구성" />

          <ConditionSection
            title="매수 조건" color="text-green-400" dot="▲"
            conditions={buyConds} logic={buyLogic} variables={variables}
            onAdd={addBuy} onChange={updBuy} onRemove={remBuy} onLogicChange={setBuyLogic}
          />

          <ConditionSection
            title="매도 조건" color="text-red-400" dot="▼"
            conditions={sellConds} logic={sellLogic} variables={variables}
            onAdd={addSell} onChange={updSell} onRemove={remSell} onLogicChange={setSellLogic}
          />
        </section>

        {/* ── STEP 3: Risk ──────────────────────────────────────────────── */}
        <section className="space-y-2">
          <StepHeader step="3" title="Risk & Execution" />
          <div className="flex gap-3 flex-wrap">
            {[
              { label: 'Stop Loss %',   val: stopLoss,   set: setStopLoss,   step: 0.5 },
              { label: 'Take Profit %', val: takeProfit, set: setTakeProfit, step: 0.5 },
              { label: 'Capital $',     val: capital,    set: setCapital,    step: 1000 },
            ].map(({ label, val, set, step }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="text-[9px] text-gray-600 uppercase">{label}</span>
                <input type="number" value={val} onChange={e => set(Number(e.target.value))} step={step}
                  className="w-24 px-1.5 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500 tabular-nums" />
              </div>
            ))}
          </div>
        </section>

        {/* ── Preview ───────────────────────────────────────────────────── */}
        <StrategyPreview
          buyConds={buyConds} buyLogic={buyLogic}
          sellConds={sellConds} sellLogic={sellLogic}
          variables={variables}
        />

        {/* ── Save name + Actions ───────────────────────────────────────── */}
        <section className="space-y-2 pt-1 border-t border-gray-800/60">
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="전략 이름 (저장 시 필요)"
            className="w-full px-2 py-1.5 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500"
          />
          <div className="flex gap-2">
            <button onClick={handleRun}
              className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded transition-colors">
              <Play size={13} /> Run Backtest
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs rounded transition-colors">
              <Save size={13} /> {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </section>

      </div>
    </div>
  );
};

export default StrategyBuilderTab;
