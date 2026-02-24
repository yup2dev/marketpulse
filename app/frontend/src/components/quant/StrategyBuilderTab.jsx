import React, { useState, useCallback } from 'react';
import { Plus, X, Save, Play, ChevronDown } from 'lucide-react';
import {
  FACTORS, FACTOR_GROUPS, OPERATORS,
  defaultFactorState, factorLabel,
} from '../../data/factorDefinitions';
import { quantAPI } from '../../config/api';
import toast from 'react-hot-toast';

// ── Helpers ───────────────────────────────────────────────────────────────────
let _id = 0;
const uid = () => `c${++_id}`;

const newCond = () => ({
  id: uid(),
  left:  defaultFactorState('EMA'),
  op:    'crosses_above',
  right: defaultFactorState('EMA'),
});

// ── Factor Selector ───────────────────────────────────────────────────────────
const FactorSelector = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const def = FACTORS[value.factor] || {};

  const setFactor = (fId) => {
    onChange(defaultFactorState(fId));
    setOpen(false);
  };

  const setParam = (name, val) =>
    onChange({ ...value, params: { ...value.params, [name]: Number(val) } });

  const isValue = def.isValue;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Factor dropdown trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1 px-2 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-cyan-300 hover:border-cyan-600 transition-colors"
        >
          {def.label || value.factor}
          <ChevronDown size={10} />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-[#0d0d12] border border-gray-700 rounded-lg shadow-2xl w-48 max-h-72 overflow-y-auto">
            {FACTOR_GROUPS.map(group => {
              const items = Object.entries(FACTORS).filter(([, v]) => v.group === group);
              if (!items.length) return null;
              return (
                <div key={group}>
                  <div className="px-2 py-1 text-[9px] text-gray-600 uppercase tracking-wider bg-[#060608] sticky top-0">
                    {group}
                  </div>
                  {items.map(([id, f]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFactor(id)}
                      className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-gray-800 transition-colors ${
                        value.factor === id ? 'text-cyan-300' : 'text-gray-300'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Param inputs */}
      {isValue ? (
        <input
          type="number"
          value={value.value ?? value.params?.value ?? 0}
          onChange={e => onChange({ ...value, value: Number(e.target.value), params: { value: Number(e.target.value) } })}
          step="any"
          className="w-16 px-1.5 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500 tabular-nums"
        />
      ) : (
        def.params?.map(p => (
          <input
            key={p.name}
            type="number"
            title={p.label}
            value={value.params?.[p.name] ?? p.default}
            onChange={e => setParam(p.name, e.target.value)}
            step={p.step ?? 1}
            min={p.min}
            max={p.max}
            className="w-12 px-1 py-1 bg-[#0a0a0f] border border-gray-600 rounded text-[10px] text-gray-300 focus:outline-none focus:border-cyan-500 tabular-nums"
            placeholder={p.label}
          />
        ))
      )}
    </div>
  );
};

// ── Condition Row ─────────────────────────────────────────────────────────────
const ConditionRow = ({ cond, onChange, onRemove }) => (
  <div className="flex items-center gap-2 p-2 bg-[#060608] border border-gray-800 rounded-lg flex-wrap">
    <FactorSelector
      value={cond.left}
      onChange={left => onChange({ ...cond, left })}
    />

    {/* Operator */}
    <select
      value={cond.op}
      onChange={e => onChange({ ...cond, op: e.target.value })}
      className="px-1.5 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-yellow-300 focus:outline-none focus:border-yellow-600"
    >
      {OPERATORS.map(o => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
    </select>

    <FactorSelector
      value={cond.right}
      onChange={right => onChange({ ...cond, right })}
    />

    <button
      type="button"
      onClick={onRemove}
      className="ml-auto p-1 text-gray-600 hover:text-red-400 transition-colors shrink-0"
    >
      <X size={12} />
    </button>
  </div>
);

// ── Condition Section ─────────────────────────────────────────────────────────
const ConditionSection = ({ title, color, conditions, logic, onAdd, onChange, onRemove, onLogicChange }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2">
      <span className={`text-[11px] font-semibold ${color}`}>{title}</span>
      <select
        value={logic}
        onChange={e => onLogicChange(e.target.value)}
        className="px-1.5 py-0.5 bg-[#0a0a0f] border border-gray-700 rounded text-[10px] text-gray-300 focus:outline-none"
      >
        <option value="AND">AND (모두 충족)</option>
        <option value="OR">OR (하나라도 충족)</option>
      </select>
      <span className="text-[10px] text-gray-600 ml-1">
        {logic === 'AND' ? '— 아래 조건 전부 만족 시 신호' : '— 아래 조건 중 하나라도 만족 시 신호'}
      </span>
    </div>

    {conditions.map(c => (
      <ConditionRow
        key={c.id}
        cond={c}
        onChange={updated => onChange(c.id, updated)}
        onRemove={() => onRemove(c.id)}
      />
    ))}

    {conditions.length === 0 && (
      <div className="text-[11px] text-gray-600 border border-dashed border-gray-800 rounded-lg px-3 py-3 text-center">
        조건이 없습니다. 아래 버튼으로 추가하세요.
      </div>
    )}

    <button
      type="button"
      onClick={onAdd}
      className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-cyan-300 transition-colors"
    >
      <Plus size={12} /> 조건 추가
    </button>
  </div>
);

// ── Preview ───────────────────────────────────────────────────────────────────
const Preview = ({ buyConds, buyLogic, sellConds, sellLogic }) => {
  if (!buyConds.length && !sellConds.length) return null;
  const fmt = (cond) =>
    `${factorLabel(cond.left)} ${cond.op.replace('crosses_above','↑').replace('crosses_below','↓')} ${factorLabel(cond.right)}`;

  return (
    <div className="border border-gray-800 rounded-lg p-3 bg-[#060608] text-[10px] font-mono space-y-1">
      <div className="text-gray-500 uppercase text-[9px] mb-1 tracking-wide">Strategy Preview</div>
      {buyConds.length > 0 && (
        <div>
          <span className="text-green-400">BUY if </span>
          <span className="text-gray-300">{buyConds.map(c => fmt(c)).join(` ${buyLogic} `)}</span>
        </div>
      )}
      {sellConds.length > 0 && (
        <div>
          <span className="text-red-400">SELL if </span>
          <span className="text-gray-300">{sellConds.map(c => fmt(c)).join(` ${sellLogic} `)}</span>
        </div>
      )}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const StrategyBuilderTab = ({ onRun }) => {
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('AAPL');
  const [startDate, setStartDate] = useState('2022-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');
  const [buyConds, setBuyConds] = useState([newCond()]);
  const [sellConds, setSellConds] = useState([newCond()]);
  const [buyLogic, setBuyLogic] = useState('AND');
  const [sellLogic, setSellLogic] = useState('OR');
  const [stopLoss, setStopLoss] = useState(5);
  const [takeProfit, setTakeProfit] = useState(15);
  const [capital, setCapital] = useState(10000);
  const [saving, setSaving] = useState(false);

  const addBuy  = () => setBuyConds(c => [...c, newCond()]);
  const addSell = () => setSellConds(c => [...c, newCond()]);

  const updateBuy  = (id, upd) => setBuyConds(c => c.map(x => x.id === id ? upd : x));
  const updateSell = (id, upd) => setSellConds(c => c.map(x => x.id === id ? upd : x));

  const removeBuy  = (id) => setBuyConds(c => c.filter(x => x.id !== id));
  const removeSell = (id) => setSellConds(c => c.filter(x => x.id !== id));

  const buildStrategy = useCallback(() => ({
    type: 'custom',
    buy_logic: buyLogic,
    sell_logic: sellLogic,
    buy_conditions: buyConds.map(({ id, ...rest }) => rest),
    sell_conditions: sellConds.map(({ id, ...rest }) => rest),
    stop_loss_pct: stopLoss,
    take_profit_pct: takeProfit,
    initial_capital: capital,
  }), [buyConds, sellConds, buyLogic, sellLogic, stopLoss, takeProfit, capital]);

  const handleRun = () => {
    if (!buyConds.length) { toast.error('매수 조건을 하나 이상 추가하세요'); return; }
    onRun({ ticker, start_date: startDate, end_date: endDate, strategy: buildStrategy() });
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('전략 이름을 입력하세요'); return; }
    if (!buyConds.length) { toast.error('매수 조건을 하나 이상 추가하세요'); return; }
    setSaving(true);
    try {
      const strategy = buildStrategy();
      const buyStr = buyConds.map(c =>
        `${factorLabel(c.left)} ${c.op} ${factorLabel(c.right)}`).join(` ${buyLogic} `);
      const sellStr = sellConds.map(c =>
        `${factorLabel(c.left)} ${c.op} ${factorLabel(c.right)}`).join(` ${sellLogic} `);
      await quantAPI.createStrategy({
        name: name.trim(),
        strategy_type: 'custom',
        formula: `Custom Block Strategy`,
        variables: JSON.stringify(
          [...buyConds, ...sellConds].flatMap(c => [c.left, c.right])
            .filter(f => f.factor !== 'VALUE')
            .map(f => ({ factor: f.factor, params: f.params }))
        ),
        buy_condition: buyStr,
        sell_condition: sellStr,
        parameters: JSON.stringify({ ...strategy, ticker, start_date: startDate, end_date: endDate }),
        notes: '',
      });
      toast.success('전략이 저장됐습니다');
    } catch (err) {
      toast.error(err.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 shrink-0">
        <div className="text-xs font-semibold text-white">Custom Strategy Builder</div>
        <div className="text-[10px] text-gray-500 mt-0.5">팩터 블록으로 매수/매도 조건 구성</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Name + Ticker + Dates */}
        <div className="space-y-2">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">전략 이름</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Custom Strategy"
              className="w-full px-2 py-1.5 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'Ticker', val: ticker, set: v => setTicker(v.toUpperCase()), w: 'w-16', upper: true },
            ].map(({ label, val, set, w, upper }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="text-[9px] text-gray-500 uppercase">{label}</span>
                <input value={val} onChange={e => set(e.target.value)}
                  className={`${w} px-1.5 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500 ${upper ? 'uppercase' : ''}`} />
              </div>
            ))}
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] text-gray-500 uppercase">Start</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="px-1.5 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] text-gray-500 uppercase">End</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="px-1.5 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500" />
            </div>
          </div>
        </div>

        {/* Buy Conditions */}
        <ConditionSection
          title="▲ 매수 조건"
          color="text-green-400"
          conditions={buyConds}
          logic={buyLogic}
          onAdd={addBuy}
          onChange={updateBuy}
          onRemove={removeBuy}
          onLogicChange={setBuyLogic}
        />

        {/* Sell Conditions */}
        <ConditionSection
          title="▼ 매도 조건"
          color="text-red-400"
          conditions={sellConds}
          logic={sellLogic}
          onAdd={addSell}
          onChange={updateSell}
          onRemove={removeSell}
          onLogicChange={setSellLogic}
        />

        {/* Preview */}
        <Preview buyConds={buyConds} buyLogic={buyLogic} sellConds={sellConds} sellLogic={sellLogic} />

        {/* Risk params */}
        <div className="space-y-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Risk Management</div>
          <div className="flex gap-3 flex-wrap">
            {[
              { label: 'Stop Loss %', val: stopLoss, set: setStopLoss, step: 0.5 },
              { label: 'Take Profit %', val: takeProfit, set: setTakeProfit, step: 0.5 },
              { label: 'Capital $', val: capital, set: setCapital, step: 1000 },
            ].map(({ label, val, set, step }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="text-[9px] text-gray-500 uppercase">{label}</span>
                <input type="number" value={val} onChange={e => set(Number(e.target.value))} step={step}
                  className="w-24 px-1.5 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500 tabular-nums" />
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleRun}
            className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded transition-colors"
          >
            <Play size={13} /> Run Backtest
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs rounded transition-colors"
          >
            <Save size={13} /> {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StrategyBuilderTab;
