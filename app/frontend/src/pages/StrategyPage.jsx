/**
 * StrategyPage — Factor-Based Strategy Builder
 *
 * Layout:
 *   Header  : 전략 선택 드롭다운 + New/Save/Run 버튼
 *   Tab bar : All | Macro | Micro | Stock | Alt Data | My Strategy
 *   Content : 팩터 테이블 (WidgetTable) 또는 비주얼 조건 빌더
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Save, RefreshCw, Play, X, ChevronDown, Settings,
  FlaskConical, ExternalLink, Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import WidgetTable from '../components/widgets/common/WidgetTable';
import { quantAPI } from '../config/api';
import {
  STRATEGY_FACTORS,
  CATEGORY_META,
  AVAILABILITY_META,
} from '../data/strategyFactors';

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'all',      label: 'All Factors' },
  { id: 'macro',    label: 'Macro' },
  { id: 'micro',    label: 'Micro' },
  { id: 'stock',    label: 'Stock' },
  { id: 'alt',      label: 'Alt Data' },
];

const TAB_CATEGORY_MAP = {
  macro: 'Macro',
  micro: 'Micro',
  stock: 'Stock',
  alt:   'Alt',
};

// ── Condition builder constants ───────────────────────────────────────────────

/**
 * Maps new strategyFactors.js IDs → backend _compute_factor names.
 * Each entry is an array of {back, label} to support multi-line factors (MACD, BB).
 */
const FACTOR_BACKEND_EXPANSIONS = {
  ema:            [{ back: 'EMA',            label: 'EMA'          }],
  sma:            [{ back: 'SMA',            label: 'SMA'          }],
  rsi:            [{ back: 'RSI',            label: 'RSI'          }],
  macd:           [
    { back: 'MACD_LINE',   label: 'MACD Line'   },
    { back: 'MACD_SIGNAL', label: 'MACD Signal' },
    { back: 'MACD_HIST',   label: 'MACD Hist'   },
  ],
  bb:             [
    { back: 'BB_UPPER', label: 'BB Upper' },
    { back: 'BB_MID',   label: 'BB Mid'   },
    { back: 'BB_LOWER', label: 'BB Lower' },
  ],
  vwap_intraday:  [{ back: 'VWAP',           label: 'VWAP'         }],
  news_sentiment: [{ back: 'NEWS_SENTIMENT',  label: 'News Sent.'  }],
  sentiment_delta:[{ back: 'SENTIMENT_DELTA', label: 'Sent. Delta' }],
};

const PRICE_VAR_OPTIONS = [
  { key: 'p:CLOSE',  label: 'Close',  factorDef: { factor: 'CLOSE',  params: {} } },
  { key: 'p:HIGH',   label: 'High',   factorDef: { factor: 'HIGH',   params: {} } },
  { key: 'p:LOW',    label: 'Low',    factorDef: { factor: 'LOW',    params: {} } },
  { key: 'p:OPEN',   label: 'Open',   factorDef: { factor: 'OPEN',   params: {} } },
  { key: 'p:VOLUME', label: 'Volume', factorDef: { factor: 'VOLUME', params: {} } },
];

const COND_OPERATORS = [
  { id: 'crosses_above', label: 'crosses above' },
  { id: 'crosses_below', label: 'crosses below' },
  { id: '>',             label: '>'             },
  { id: '<',             label: '<'             },
  { id: '>=',            label: '>='            },
  { id: '<=',            label: '<='            },
  { id: '==',            label: '=='            },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const parseParams = (raw) => {
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
};

const makeVarName = (factor) =>
  factor.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');

/** Build variable option list from selected factors + constant price vars */
function buildVarOptions(selectedFactors) {
  const opts = [];
  for (const sf of selectedFactors) {
    const expansions = FACTOR_BACKEND_EXPANSIONS[sf.factorId];
    if (!expansions) continue;
    for (const exp of expansions) {
      const paramStr = Object.values(sf.params || {}).join(', ');
      opts.push({
        key: `f:${sf.factorId}::${exp.back}`,
        label: paramStr
          ? `${sf.varName} · ${exp.label}(${paramStr})`
          : `${sf.varName} · ${exp.label}`,
        factorDef: { factor: exp.back, params: sf.params || {} },
      });
    }
  }
  return [...opts, ...PRICE_VAR_OPTIONS];
}

/** Convert a condition row to backend-compatible {left, op, right} */
function toBECond(row, varOptions) {
  const leftOpt  = varOptions.find(o => o.key === row.leftKey)  || varOptions[0];
  let right;
  if (row.rightType === 'value') {
    right = { factor: 'VALUE', value: Number(row.rightValue) };
  } else {
    const rightOpt = varOptions.find(o => o.key === row.rightKey)
      || varOptions.find(o => o.key !== row.leftKey)
      || varOptions[0];
    right = rightOpt?.factorDef || { factor: 'CLOSE', params: {} };
  }
  return {
    left: leftOpt?.factorDef || { factor: 'CLOSE', params: {} },
    op:   row.op,
    right,
  };
}

const mkCondRow = () => ({
  id:         `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  leftKey:    '',
  op:         'crosses_above',
  rightType:  'factor',
  rightKey:   '',
  rightValue: 0,
});

// ── Sub-components ────────────────────────────────────────────────────────────

/** Availability badge */
const AvailBadge = ({ status }) => {
  const m = AVAILABILITY_META[status] || AVAILABILITY_META.available;
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${m.color}`}>
      {m.label}
    </span>
  );
};

/** Category colored pill */
const CatBadge = ({ category, sub }) => {
  const m = CATEGORY_META[category] || {};
  return (
    <span className={`text-[10px] font-medium ${m.color || 'text-gray-400'}`}>
      {sub}
    </span>
  );
};

// ── Condition row (visual builder) ────────────────────────────────────────────

const ConditionRow = ({ row, varOptions, onUpdate, onRemove }) => {
  const sel = 'px-1.5 py-1 bg-[#060608] border border-gray-700/80 rounded text-[10px] text-white focus:outline-none focus:border-cyan-500 transition-colors';
  const firstKey  = varOptions[0]?.key  || '';
  const secondKey = varOptions[1]?.key  || varOptions[0]?.key || '';

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Left factor */}
      <select
        value={row.leftKey || firstKey}
        onChange={e => onUpdate({ ...row, leftKey: e.target.value })}
        className={`${sel} flex-1 min-w-[130px] max-w-[180px]`}
      >
        {varOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>

      {/* Operator */}
      <select
        value={row.op}
        onChange={e => onUpdate({ ...row, op: e.target.value })}
        className={`${sel} w-[120px]`}
      >
        {COND_OPERATORS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>

      {/* Right type toggle */}
      <select
        value={row.rightType}
        onChange={e => onUpdate({ ...row, rightType: e.target.value })}
        className={`${sel} w-[66px]`}
      >
        <option value="factor">Factor</option>
        <option value="value">Value</option>
      </select>

      {/* Right factor or value */}
      {row.rightType === 'factor' ? (
        <select
          value={row.rightKey || secondKey}
          onChange={e => onUpdate({ ...row, rightKey: e.target.value })}
          className={`${sel} flex-1 min-w-[130px] max-w-[180px]`}
        >
          {varOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      ) : (
        <input
          type="number"
          value={row.rightValue}
          onChange={e => onUpdate({ ...row, rightValue: e.target.value })}
          className={`${sel} w-20 tabular-nums`}
          step="any"
          placeholder="0"
        />
      )}

      {/* Remove */}
      <button
        onClick={onRemove}
        className="p-0.5 text-gray-700 hover:text-red-400 transition-colors shrink-0"
      >
        <X size={10} />
      </button>
    </div>
  );
};

// ── Condition section (Buy / Sell) ────────────────────────────────────────────

const ConditionSection = ({ title, color, conditions, logic, varOptions, onAdd, onChange, onRemove, onLogicChange }) => (
  <div>
    <div className="flex items-center gap-2 mb-2">
      <span className={`text-[10px] font-semibold ${color}`}>{title}</span>
      {conditions.length > 1 && (
        <button
          onClick={() => onLogicChange(logic === 'AND' ? 'OR' : 'AND')}
          className="text-[9px] px-1.5 py-0.5 border border-gray-700 rounded text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          title="AND / OR 토글"
        >
          {logic}
        </button>
      )}
      <button
        onClick={onAdd}
        disabled={varOptions.length === 0}
        className="ml-auto text-[9px] px-1.5 py-0.5 text-cyan-400 border border-cyan-800/50 bg-cyan-900/10 hover:bg-cyan-900/20 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        + Condition
      </button>
    </div>

    {conditions.length === 0 ? (
      <div className="text-[10px] text-gray-700 italic py-1">
        {varOptions.length === 0
          ? '먼저 팩터 탭에서 변수를 추가하세요'
          : '조건 없음 — + Condition 추가'}
      </div>
    ) : (
      <div className="space-y-2">
        {conditions.map((row, i) => (
          <div key={row.id} className="flex items-start gap-2">
            <span className="text-[9px] text-gray-700 w-5 text-center mt-1.5 shrink-0">
              {i === 0 ? '' : logic}
            </span>
            <div className="flex-1">
              <ConditionRow
                row={row}
                varOptions={varOptions}
                onUpdate={upd => onChange(i, upd)}
                onRemove={() => onRemove(i)}
              />
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ── Factor table columns ──────────────────────────────────────────────────────

const buildFactorColumns = (selectedIds, onToggle) => [
  {
    key: 'name',
    header: 'Factor',
    sortable: true,
    sortValue: r => r.name,
    render: r => (
      <div>
        <div className="text-[11px] font-medium text-white">{r.name}</div>
        <div className="text-[10px] text-gray-600 mt-0.5">{r.nameKo}</div>
      </div>
    ),
  },
  {
    key: 'sub',
    header: 'Category',
    width: 130,
    render: r => <CatBadge category={r.category} sub={r.sub} />,
  },
  {
    key: 'desc',
    header: 'Description',
    render: r => (
      <span className="text-[11px] text-gray-400 leading-relaxed">{r.desc}</span>
    ),
  },
  {
    key: 'examples',
    header: 'Indicators',
    render: r => (
      <span className="text-[10px] text-gray-600">{r.examples}</span>
    ),
  },
  {
    key: 'strategic',
    header: 'Strategic Use',
    render: r => (
      <span className="text-[10px] text-gray-500 leading-relaxed">{r.strategic}</span>
    ),
  },
  {
    key: 'availability',
    header: 'Status',
    width: 90,
    render: r => <AvailBadge status={r.availability} />,
  },
  {
    key: '_toggle',
    header: '',
    width: 80,
    render: r => {
      const added = selectedIds.has(r.id);
      return (
        <button
          onClick={e => { e.stopPropagation(); onToggle(r); }}
          className={`text-[10px] font-medium px-2.5 py-1 rounded border transition-colors ${
            added
              ? 'text-red-400/80 border-red-800/40 bg-red-900/10 hover:bg-red-900/20'
              : 'text-cyan-400 border-cyan-800/50 bg-cyan-900/10 hover:bg-cyan-900/20'
          }`}
        >
          {added ? 'Remove' : '+ Add'}
        </button>
      );
    },
  },
];

// ── Added factor row ──────────────────────────────────────────────────────────

const AddedFactorRow = ({ item, factor, onUpdate, onRemove }) => {
  const setParam = (key, val) => {
    onUpdate({ ...item, params: { ...item.params, [key]: Number(val) } });
  };

  const catMeta = CATEGORY_META[factor?.category] || {};

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-[#060608] border border-gray-800 rounded-lg hover:border-gray-700 transition-colors group">
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${catMeta.color?.replace('text-', 'bg-') || 'bg-gray-500'}`} />
      <code className="text-[11px] text-cyan-300 font-mono w-[100px] shrink-0">{item.varName}</code>
      <span className="text-[11px] text-gray-300 w-[140px] shrink-0 truncate">{factor?.name || item.factorId}</span>

      <div className="flex items-center gap-2 flex-1 flex-wrap">
        {(factor?.params || []).map(p => (
          <div key={p.name} className="flex items-center gap-1">
            <span className="text-[9px] text-gray-600">{p.label}</span>
            <input
              type="number"
              value={item.params?.[p.name] ?? p.default}
              onChange={e => setParam(p.name, e.target.value)}
              min={p.min}
              max={p.max}
              step={p.step ?? 1}
              className="w-14 px-1.5 py-0.5 bg-[#0a0a0f] border border-gray-700 rounded text-[10px] text-gray-200 focus:outline-none focus:border-cyan-500 tabular-nums"
            />
          </div>
        ))}
        {(!factor?.params || factor.params.length === 0) && (
          <span className="text-[10px] text-gray-700 italic">no params</span>
        )}
      </div>

      <span className="text-[9px] text-gray-700 shrink-0 hidden group-hover:block">{factor?.sub}</span>

      <button
        onClick={onRemove}
        className="p-0.5 text-gray-700 hover:text-red-400 transition-colors shrink-0 ml-auto"
      >
        <X size={11} />
      </button>
    </div>
  );
};

// ── Strategy editor (My Strategy tab) ────────────────────────────────────────

const StrategyEditor = ({
  selectedFactors, onUpdateFactor, onRemoveFactor,
  name, setName,
  buyConditions, sellConditions,
  buyLogic, sellLogic,
  onAddBuy, onChangeBuy, onRemoveBuy, onBuyLogicChange,
  onAddSell, onChangeSell, onRemoveSell, onSellLogicChange,
  varOptions,
  stopLoss, setStopLoss,
  takeProfit, setTakeProfit,
  capital, setCapital,
  notes, setNotes,
  onSave, onSaveNew, saving,
}) => {
  const factorById = useMemo(() => {
    const m = {};
    STRATEGY_FACTORS.forEach(f => { m[f.id] = f; });
    return m;
  }, []);

  const inputCls = 'w-full px-2.5 py-1.5 bg-[#0a0a0f] border border-gray-700/80 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500/70 transition-colors';

  const SectionLabel = ({ children }) => (
    <div className="text-[9px] font-semibold text-gray-600 uppercase tracking-widest mb-2 pb-1.5 border-b border-gray-800/60">
      {children}
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden">

      {/* Left: Variables */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-800">
        <div className="px-4 py-3 border-b border-gray-800 shrink-0 flex items-center gap-2">
          <span className="text-xs font-semibold text-white">Variables</span>
          <span className="text-[10px] text-gray-600">({selectedFactors.length})</span>
          <span className="text-[10px] text-gray-700 ml-2">팩터 탭에서 + Add로 추가</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {selectedFactors.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <FlaskConical size={28} className="text-gray-800 mb-3" />
              <p className="text-xs text-gray-700">
                Macro / Micro / Stock / Alt Data 탭에서<br />팩터를 추가하면 여기에 표시됩니다
              </p>
            </div>
          ) : (
            selectedFactors.map(item => (
              <AddedFactorRow
                key={item.factorId}
                item={item}
                factor={factorById[item.factorId]}
                onUpdate={upd => onUpdateFactor(item.factorId, upd)}
                onRemove={() => onRemoveFactor(item.factorId)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right: Conditions + Risk + Save */}
      <div className="w-[420px] flex-shrink-0 flex flex-col overflow-hidden bg-[#0d0d12]">
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Strategy name */}
          <div>
            <SectionLabel>Strategy Name</SectionLabel>
            <input
              className={inputCls}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. EMA Momentum + CPI Filter"
            />
          </div>

          {/* Variable reference (quick lookup) */}
          {varOptions.filter(o => !o.key.startsWith('p:')).length > 0 && (
            <div>
              <SectionLabel>Variable Reference</SectionLabel>
              <div className="space-y-1">
                {varOptions.filter(o => !o.key.startsWith('p:')).map(o => (
                  <div key={o.key} className="flex items-center gap-2 text-[10px]">
                    <code className="text-cyan-400 font-mono">{o.label.split(' · ')[0]}</code>
                    <span className="text-gray-700">=</span>
                    <span className="text-gray-500">{o.label.split(' · ').slice(1).join(' · ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buy Conditions */}
          <div>
            <SectionLabel>Buy Conditions</SectionLabel>
            <ConditionSection
              title="BUY"
              color="text-green-400"
              conditions={buyConditions}
              logic={buyLogic}
              varOptions={varOptions}
              onAdd={onAddBuy}
              onChange={onChangeBuy}
              onRemove={onRemoveBuy}
              onLogicChange={onBuyLogicChange}
            />
          </div>

          {/* Sell Conditions */}
          <div>
            <SectionLabel>Sell Conditions</SectionLabel>
            <ConditionSection
              title="SELL"
              color="text-red-400"
              conditions={sellConditions}
              logic={sellLogic}
              varOptions={varOptions}
              onAdd={onAddSell}
              onChange={onChangeSell}
              onRemove={onRemoveSell}
              onLogicChange={onSellLogicChange}
            />
          </div>

          {/* Risk */}
          <div>
            <SectionLabel>Risk Management</SectionLabel>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Stop Loss %',   val: stopLoss,   set: setStopLoss,   step: 0.5, min: 0.1 },
                { label: 'Take Profit %', val: takeProfit, set: setTakeProfit, step: 0.5, min: 0.1 },
                { label: 'Capital $',     val: capital,    set: setCapital,    step: 1000, min: 100 },
              ].map(({ label, val, set, step, min }) => (
                <div key={label} className="flex flex-col gap-1">
                  <span className="text-[9px] text-gray-600">{label}</span>
                  <input
                    type="number"
                    className={`${inputCls} tabular-nums`}
                    value={val}
                    onChange={e => set(Number(e.target.value))}
                    step={step}
                    min={min}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <SectionLabel>Research Notes</SectionLabel>
            <textarea
              className={`${inputCls} resize-none leading-relaxed`}
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Market conditions, assumptions, edge cases…"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800 flex items-center gap-2 shrink-0">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-xs font-semibold rounded transition-colors"
          >
            <Save size={12} />
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onSaveNew}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs rounded transition-colors"
          >
            <Plus size={12} /> Save as New
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Strategy dropdown ─────────────────────────────────────────────────────────

const StrategyDropdown = ({ strategies, currentId, onLoad, onDelete }) => {
  const [open, setOpen] = useState(false);
  const active = strategies.find(s => s.id === currentId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[11px] font-medium transition-colors ${
          active
            ? 'bg-cyan-900/30 border-cyan-700/50 text-white'
            : 'bg-gray-800/40 border-gray-700/40 text-gray-400 hover:text-white hover:border-gray-600'
        }`}
      >
        <span className="max-w-[140px] truncate">{active ? active.name : '전략 선택…'}</span>
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-[#0d0d12] border border-gray-700 rounded-lg shadow-xl overflow-hidden min-w-[220px]">
            {strategies.length === 0 ? (
              <div className="px-3 py-4 text-[11px] text-gray-600 italic text-center">저장된 전략 없음</div>
            ) : (
              strategies.map(s => (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors group ${
                    s.id === currentId
                      ? 'bg-cyan-900/20 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                  onClick={() => { onLoad(s); setOpen(false); }}
                >
                  <span className="flex-1 text-[11px] truncate">{s.name}</span>
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(s.id); setOpen(false); }}
                    className="p-0.5 text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    title="삭제"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const StrategyPage = () => {
  const navigate = useNavigate();

  const [activeTab,   setActiveTab]   = useState('all');
  const [strategies,  setStrategies]  = useState([]);
  const [currentId,   setCurrentId]   = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [saving,      setSaving]      = useState(false);

  // Strategy state
  const [selectedFactors, setSelectedFactors] = useState([]);
  const [name,            setName]            = useState('');
  const [buyConditions,   setBuyConditions]   = useState([]);
  const [sellConditions,  setSellConditions]  = useState([]);
  const [buyLogic,        setBuyLogic]        = useState('AND');
  const [sellLogic,       setSellLogic]       = useState('OR');
  const [stopLoss,        setStopLoss]        = useState(5);
  const [takeProfit,      setTakeProfit]      = useState(15);
  const [capital,         setCapital]         = useState(10000);
  const [notes,           setNotes]           = useState('');

  const selectedIds = useMemo(
    () => new Set(selectedFactors.map(f => f.factorId)),
    [selectedFactors],
  );

  /** Variable options for condition builder (derived from selected factors) */
  const varOptions = useMemo(() => buildVarOptions(selectedFactors), [selectedFactors]);

  // ── Load strategies ──────────────────────────────────────────────────────────
  const loadStrategies = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await quantAPI.listStrategies();
      setStrategies(res.data || []);
    } catch { /* no-op */ } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { loadStrategies(); }, [loadStrategies]);

  // ── Load strategy into editor ─────────────────────────────────────────────
  const loadStrategy = (strategy) => {
    setCurrentId(strategy.id);
    setName(strategy.name || '');
    setNotes(strategy.notes || '');
    const p = parseParams(strategy.parameters);
    setStopLoss(p.stop_loss_pct ?? 5);
    setTakeProfit(p.take_profit_pct ?? 15);
    setCapital(p.initial_capital ?? 10000);
    setBuyConditions(p.buy_conditions  || []);
    setSellConditions(p.sell_conditions || []);
    setBuyLogic(p.buy_logic  || 'AND');
    setSellLogic(p.sell_logic || 'OR');
    try {
      const vars = JSON.parse(strategy.variables || '[]');
      setSelectedFactors(Array.isArray(vars) ? vars : []);
    } catch {
      setSelectedFactors([]);
    }
    setActiveTab('strategy');
  };

  const clearEditor = () => {
    setCurrentId(null);
    setName('');
    setBuyConditions([]);
    setSellConditions([]);
    setBuyLogic('AND');
    setSellLogic('OR');
    setNotes('');
    setStopLoss(5);
    setTakeProfit(15);
    setCapital(10000);
    setSelectedFactors([]);
  };

  // ── Toggle factor ─────────────────────────────────────────────────────────
  const handleToggleFactor = useCallback((factor) => {
    setSelectedFactors(prev => {
      if (prev.find(f => f.factorId === factor.id)) {
        return prev.filter(f => f.factorId !== factor.id);
      }
      const params = {};
      factor.params.forEach(p => { params[p.name] = p.default; });
      return [...prev, { factorId: factor.id, varName: makeVarName(factor), params }];
    });
  }, []);

  const handleUpdateFactor = (factorId, upd) => {
    setSelectedFactors(prev => prev.map(f => f.factorId === factorId ? upd : f));
  };

  const handleRemoveFactor = (factorId) => {
    setSelectedFactors(prev => prev.filter(f => f.factorId !== factorId));
  };

  // ── Condition handlers ────────────────────────────────────────────────────
  const onAddBuy  = () => setBuyConditions(p => [...p, mkCondRow()]);
  const onAddSell = () => setSellConditions(p => [...p, mkCondRow()]);

  const onChangeBuy  = (i, upd) => setBuyConditions(p => p.map((r, idx) => idx === i ? upd : r));
  const onChangeSell = (i, upd) => setSellConditions(p => p.map((r, idx) => idx === i ? upd : r));

  const onRemoveBuy  = (i) => setBuyConditions(p => p.filter((_, idx) => idx !== i));
  const onRemoveSell = (i) => setSellConditions(p => p.filter((_, idx) => idx !== i));

  // ── Save ──────────────────────────────────────────────────────────────────
  const buildPayload = () => {
    const buy_conditions  = buyConditions.map(r => toBECond(r, varOptions));
    const sell_conditions = sellConditions.map(r => toBECond(r, varOptions));
    return {
      name:           name.trim(),
      strategy_type:  'custom',
      buy_condition:  buy_conditions.map(c =>
        `${c.left.factor} ${c.op} ${c.right.factor ?? c.right.value}`
      ).join(` ${buyLogic} `),
      sell_condition: sell_conditions.map(c =>
        `${c.left.factor} ${c.op} ${c.right.factor ?? c.right.value}`
      ).join(` ${sellLogic} `),
      formula:   '',
      variables: JSON.stringify(selectedFactors),
      parameters: JSON.stringify({
        stop_loss_pct:   stopLoss,
        take_profit_pct: takeProfit,
        initial_capital: capital,
        factor_ids:      selectedFactors.map(f => f.factorId),
        buy_conditions,
        sell_conditions,
        buy_logic:  buyLogic,
        sell_logic: sellLogic,
      }),
      notes,
    };
  };

  const handleSave = async (forceNew = false) => {
    if (!name.trim()) {
      toast.error('전략 이름을 입력하세요');
      setActiveTab('strategy');
      return;
    }
    if (buyConditions.length === 0) {
      toast.error('매수 조건을 하나 이상 추가하세요');
      setActiveTab('strategy');
      return;
    }
    setSaving(true);
    try {
      if (currentId && !forceNew) {
        await quantAPI.updateStrategy(currentId, buildPayload());
        toast.success('저장됐습니다');
      } else {
        const res = await quantAPI.createStrategy(buildPayload());
        setCurrentId(res.data?.id || null);
        toast.success('전략이 생성됐습니다');
      }
      loadStrategies();
    } catch (err) {
      toast.error(err.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNew = () => handleSave(true);

  const handleDelete = async (id) => {
    if (!window.confirm('전략을 삭제하시겠습니까?')) return;
    try {
      await quantAPI.deleteStrategy(id);
      if (currentId === id) clearEditor();
      toast.success('삭제됐습니다');
      loadStrategies();
    } catch (err) {
      toast.error(err.message || '삭제 실패');
    }
  };

  // ── Factor data ───────────────────────────────────────────────────────────
  const filteredFactors = useMemo(() => {
    const cat = TAB_CATEGORY_MAP[activeTab];
    const base = cat
      ? STRATEGY_FACTORS.filter(f => f.category === cat)
      : STRATEGY_FACTORS;
    return base.map(f => ({ ...f, _key: f.id }));
  }, [activeTab]);

  const columns = useMemo(
    () => buildFactorColumns(selectedIds, handleToggleFactor),
    [selectedIds, handleToggleFactor],
  );

  const addedCount = selectedFactors.length;

  return (
    <div className="flex flex-col bg-[#0a0a0f] overflow-hidden" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-[#0d0d12] shrink-0">

        {/* Left: title + dropdown */}
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
            <FlaskConical size={14} className="text-cyan-400" />
            <span className="font-semibold text-white text-sm">Strategy Builder</span>
          </div>

          <div className="w-px h-4 bg-gray-800 shrink-0" />

          <StrategyDropdown
            strategies={strategies}
            currentId={currentId}
            onLoad={loadStrategy}
            onDelete={handleDelete}
          />

          {/* New button — goes directly to My Strategy editor */}
          <button
            onClick={() => { clearEditor(); setActiveTab('strategy'); }}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-cyan-400 border border-cyan-800/50 bg-cyan-900/10 hover:bg-cyan-900/20 rounded transition-colors shrink-0"
          >
            <Plus size={11} /> New
          </button>

          {loadingList && (
            <div className="w-3.5 h-3.5 border border-cyan-500 border-t-transparent rounded-full animate-spin shrink-0" />
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          {addedCount > 0 && (
            <span className="text-[10px] text-gray-500 tabular-nums">
              {addedCount} factor{addedCount > 1 ? 's' : ''} selected
            </span>
          )}

          <button
            onClick={loadStrategies}
            className="p-1.5 rounded text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={13} />
          </button>

          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-xs font-semibold rounded transition-colors"
          >
            <Save size={12} />
            {saving ? 'Saving…' : 'Save'}
          </button>

          <button
            onClick={() => navigate('/quant')}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 text-xs rounded transition-colors"
          >
            <Play size={12} className="text-cyan-400" />
            Run in Quant
            <ExternalLink size={10} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* ── Category tabs ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800 bg-[#0d0d12] shrink-0">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded transition-colors ${
              activeTab === id
                ? 'text-cyan-400 bg-cyan-400/10'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {label}
          </button>
        ))}

        <div className="w-px h-4 bg-gray-800 mx-1" />

        {/* My Strategy tab */}
        <button
          onClick={() => setActiveTab('strategy')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded transition-colors ${
            activeTab === 'strategy'
              ? 'text-white bg-cyan-600/20 border border-cyan-700/50'
              : 'text-gray-300 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Settings size={11} />
          My Strategy
          {addedCount > 0 && (
            <span className="text-[9px] bg-cyan-500 text-white px-1.5 py-0.5 rounded-full tabular-nums leading-none">
              {addedCount}
            </span>
          )}
        </button>

        {/* Sub-categories */}
        {activeTab !== 'strategy' && activeTab !== 'all' && (
          <div className="ml-auto flex items-center gap-1.5">
            {(CATEGORY_META[TAB_CATEGORY_MAP[activeTab]]?.subs || []).map(sub => (
              <span key={sub} className="text-[10px] text-gray-600 px-2 py-0.5 bg-gray-800/40 rounded">
                {sub}
              </span>
            ))}
          </div>
        )}

        {activeTab === 'all' && (
          <span className="ml-auto text-[10px] text-gray-700 tabular-nums">
            {STRATEGY_FACTORS.length} factors
          </span>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">

        {activeTab !== 'strategy' && (
          <div className="h-full overflow-auto">
            <WidgetTable
              columns={columns}
              data={filteredFactors}
              size="compact"
              showRowNumbers
              emptyMessage="해당 카테고리의 팩터가 없습니다."
              rowClassName={r =>
                selectedIds.has(r.id)
                  ? 'bg-cyan-900/[0.07] border-l-2 border-l-cyan-600/50'
                  : 'border-l-2 border-l-transparent'
              }
            />
          </div>
        )}

        {activeTab === 'strategy' && (
          <StrategyEditor
            selectedFactors={selectedFactors}
            onUpdateFactor={handleUpdateFactor}
            onRemoveFactor={handleRemoveFactor}
            name={name}             setName={setName}
            buyConditions={buyConditions}   sellConditions={sellConditions}
            buyLogic={buyLogic}             sellLogic={sellLogic}
            onAddBuy={onAddBuy}             onAddSell={onAddSell}
            onChangeBuy={onChangeBuy}       onChangeSell={onChangeSell}
            onRemoveBuy={onRemoveBuy}       onRemoveSell={onRemoveSell}
            onBuyLogicChange={setBuyLogic}  onSellLogicChange={setSellLogic}
            varOptions={varOptions}
            stopLoss={stopLoss}     setStopLoss={setStopLoss}
            takeProfit={takeProfit} setTakeProfit={setTakeProfit}
            capital={capital}       setCapital={setCapital}
            notes={notes}           setNotes={setNotes}
            onSave={() => handleSave()}
            onSaveNew={handleSaveNew}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
};

export default StrategyPage;
