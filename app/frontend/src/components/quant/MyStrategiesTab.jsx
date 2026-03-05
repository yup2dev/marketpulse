import React, { useState, useEffect } from 'react';
import { Plus, Play, Edit2, Trash2, Save, X, ChevronDown } from 'lucide-react';
import { quantAPI } from '../../config/api';
import toast from 'react-hot-toast';

const STRATEGY_TYPE_OPTIONS = [
  { id: 'ema_cross',   label: 'EMA Cross' },
  { id: 'rsi',         label: 'RSI Reversal' },
  { id: 'macd_cross',  label: 'MACD Cross' },
  { id: 'bb_breakout', label: 'BB Breakout' },
  { id: 'custom',      label: 'Custom' },
];

const EMPTY_FORM = {
  name: '',
  strategy_type: 'ema_cross',
  formula: '',
  variables: '',
  buy_condition: '',
  sell_condition: '',
  parameters: '{"fast":20,"slow":50,"stop_loss_pct":5,"take_profit_pct":15,"initial_capital":10000}',
  notes: '',
};

const TA = ({ label, name, value, onChange, rows = 2, placeholder = '' }) => (
  <div>
    <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">{label}</label>
    <textarea
      name={name}
      value={value}
      onChange={onChange}
      rows={rows}
      placeholder={placeholder}
      className="w-full px-2 py-1.5 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500 resize-none leading-relaxed"
    />
  </div>
);

const TF = ({ label, name, value, onChange, placeholder = '' }) => (
  <div>
    <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">{label}</label>
    <input
      type="text"
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-2 py-1.5 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500"
    />
  </div>
);

// ── Strategy form (create / edit) ──────────────────────────────────────────────
const StrategyForm = ({ initial = EMPTY_FORM, onSave, onCancel }) => {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = e => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('전략 이름을 입력하세요'); return; }
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 border border-gray-800 rounded-lg bg-[#0d0d12]">
      <div className="text-xs font-semibold text-white mb-1">{initial.id ? '전략 수정' : '새 전략 등록'}</div>

      <TF label="전략명 *" name="name" value={form.name} onChange={handleChange} placeholder="My EMA Cross Strategy" />

      {/* Strategy Type */}
      <div>
        <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">전략 타입</label>
        <select
          name="strategy_type"
          value={form.strategy_type}
          onChange={handleChange}
          className="w-full px-2 py-1.5 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500"
        >
          {STRATEGY_TYPE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>

      <TA label="수식 (Formula)" name="formula" value={form.formula} onChange={handleChange}
        placeholder={"EMA(n) = P × k + EMA₋₁ × (1 - k)\nk = 2 / (n + 1)"} rows={2} />

      <TA label="변수 정의 (Variables)" name="variables" value={form.variables} onChange={handleChange}
        placeholder={"fast=20 : 단기 EMA 기간\nslow=50 : 장기 EMA 기간"} rows={3} />

      <div className="grid grid-cols-2 gap-2">
        <TA label="매수 조건" name="buy_condition" value={form.buy_condition} onChange={handleChange}
          placeholder="EMA(fast) > EMA(slow) 골든크로스" rows={2} />
        <TA label="매도 조건" name="sell_condition" value={form.sell_condition} onChange={handleChange}
          placeholder="EMA(fast) < EMA(slow) 데드크로스" rows={2} />
      </div>

      <TA label="백테스트 파라미터 (JSON)" name="parameters" value={form.parameters} onChange={handleChange}
        placeholder='{"fast":20,"slow":50,"stop_loss_pct":5,"initial_capital":10000}' rows={2} />

      <TA label="리서치 노트" name="notes" value={form.notes} onChange={handleChange}
        placeholder="강세장에서 유효, 변동성 높은 구간에서는 SL 강화 필요…" rows={3} />

      <div className="flex gap-2 pt-1">
        <button type="submit"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold rounded transition-colors">
          <Save size={11} /> 저장
        </button>
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-[11px] rounded transition-colors">
          <X size={11} /> 취소
        </button>
      </div>
    </form>
  );
};

// ── Per-type fallback display info (shown when DB fields are empty) ────────────
const STRATEGY_DEFAULTS = {
  ema_cross: (p) => ({
    formula: `EMA(n) = P × k + EMA₋₁ × (1 − k)\nk = 2 / (n + 1)`,
    variables: `fast=${p.fast ?? 20} : 단기 EMA 기간\nslow=${p.slow ?? 50} : 장기 EMA 기간\nSL=${p.stop_loss_pct ?? 5}%  /  TP=${p.take_profit_pct ?? 15}%`,
    buy_condition: `EMA(${p.fast ?? 20}) > EMA(${p.slow ?? 50})\n→ 골든크로스 진입`,
    sell_condition: `EMA(${p.fast ?? 20}) < EMA(${p.slow ?? 50})\n→ 데드크로스 청산`,
  }),
  rsi: (p) => ({
    formula: `RSI = 100 − 100 / (1 + RS)\nRS = Avg Gain / Avg Loss (기간: ${p.period ?? 14})`,
    variables: `period=${p.period ?? 14}\noversold=${p.oversold ?? 30}  overbought=${p.overbought ?? 70}\nSL=${p.stop_loss_pct ?? 5}%  /  TP=${p.take_profit_pct ?? 15}%`,
    buy_condition: `RSI(${p.period ?? 14}) < ${p.oversold ?? 30}\n→ 과매도 반등 매수`,
    sell_condition: `RSI(${p.period ?? 14}) > ${p.overbought ?? 70}\n→ 과매수 구간 청산`,
  }),
  macd_cross: (p) => ({
    formula: `MACD = EMA(${p.fast ?? 12}) − EMA(${p.slow ?? 26})\nSignal = EMA(${p.signal ?? 9}, MACD)`,
    variables: `fast=${p.fast ?? 12}  slow=${p.slow ?? 26}  signal=${p.signal ?? 9}\nSL=${p.stop_loss_pct ?? 5}%  /  TP=${p.take_profit_pct ?? 20}%`,
    buy_condition: `MACD Line > Signal Line\n→ 골든크로스 진입`,
    sell_condition: `MACD Line < Signal Line\n→ 데드크로스 청산`,
  }),
  bb_breakout: (p) => ({
    formula: `Upper = MA(${p.period ?? 20}) + ${p.std_dev ?? 2}σ\nLower = MA(${p.period ?? 20}) − ${p.std_dev ?? 2}σ`,
    variables: `period=${p.period ?? 20}  std_dev=${p.std_dev ?? 2}\nSL=${p.stop_loss_pct ?? 5}%  /  TP=${p.take_profit_pct ?? 15}%`,
    buy_condition: `Price < Lower Band\n→ 하단 이탈 반등 매수`,
    sell_condition: `Price > Upper Band\n→ 상단 이탈 청산`,
  }),
  heston_vol_regime: (p) => ({
    formula: `dV = κ(θ − V)dt + ξ√V dW\nEntry: RealVol < θ × entry_ratio`,
    variables: `theta=${p.theta ?? 0.04}  lookback=${p.lookback ?? 20}\nentry_ratio=${p.entry_ratio ?? 0.8}  exit_ratio=${p.exit_ratio ?? 1.2}\nSL=${p.stop_loss_pct ?? 5}%  /  TP=${p.take_profit_pct ?? 25}%`,
    buy_condition: `RealizedVol < θ × ${p.entry_ratio ?? 0.8}\n→ 저변동성 구간 진입`,
    sell_condition: `RealizedVol > θ × ${p.exit_ratio ?? 1.2}\n→ 고변동성 전환 청산`,
  }),
  heston_delta_signal: (p) => ({
    formula: `Delta = ∂C/∂S (Heston 모델 기반)\n방향성 신호로 활용`,
    variables: `lookback=${p.lookback ?? 20}\nSL=${p.stop_loss_pct ?? 5}%  /  TP=${p.take_profit_pct ?? 15}%`,
    buy_condition: `Heston Delta > 임계값\n→ 상승 방향성 신호`,
    sell_condition: `Heston Delta < 임계값\n→ 하락 방향성 신호`,
  }),
  heston_price_ratio: (p) => ({
    formula: `Price / Fair Value (Heston)\n모형가 대비 시장가 비율`,
    variables: `SL=${p.stop_loss_pct ?? 5}%  /  TP=${p.take_profit_pct ?? 15}%`,
    buy_condition: `Market Price < Fair Value × entry_ratio\n→ 저평가 진입`,
    sell_condition: `Market Price > Fair Value × exit_ratio\n→ 고평가 청산`,
  }),
  heston_variance_gap: (p) => ({
    formula: `Variance Gap = Implied Vol² − RealizedVol²`,
    variables: `SL=${p.stop_loss_pct ?? 5}%  /  TP=${p.take_profit_pct ?? 15}%`,
    buy_condition: `Var Gap > threshold\n→ 내재변동성 프리미엄 진입`,
    sell_condition: `Var Gap < −threshold\n→ 변동성 역전 청산`,
  }),
};

// ── Strategy card (saved) ──────────────────────────────────────────────────────
const SavedCard = ({ strategy, onEdit, onDelete, onRun }) => {
  const [expanded, setExpanded] = useState(false);
  let params = {};
  try { params = JSON.parse(strategy.parameters || '{}'); } catch {}

  const typeLabel = STRATEGY_TYPE_OPTIONS.find(o => o.id === strategy.strategy_type)?.label || strategy.strategy_type;

  // Fill in display fields from per-type defaults when DB fields are empty
  const defaults = STRATEGY_DEFAULTS[strategy.strategy_type]?.(params) ?? {};
  const dispFormula    = strategy.formula        || defaults.formula;
  const dispVariables  = strategy.variables      || defaults.variables;
  const dispBuy        = strategy.buy_condition  || defaults.buy_condition;
  const dispSell       = strategy.sell_condition || defaults.sell_condition;

  return (
    <div className="border border-gray-800 rounded-lg bg-[#0d0d12] hover:border-gray-700 transition-colors">
      <div className="flex items-start gap-2 p-3">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(e => !e)}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white truncate">{strategy.name}</span>
            <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded shrink-0">{typeLabel}</span>
            <ChevronDown size={12} className={`ml-auto text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {new Date(strategy.created_at).toLocaleDateString('ko-KR')}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onRun(strategy)} title="Run Backtest"
            className="p-1 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/20 rounded transition-colors">
            <Play size={13} />
          </button>
          <button onClick={() => onEdit(strategy)} title="Edit"
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
            <Edit2 size={13} />
          </button>
          <button onClick={() => onDelete(strategy.id)} title="Delete"
            className="p-1 text-red-500/70 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-800 px-3 pb-3 pt-2 space-y-2">
          {dispFormula && (
            <div>
              <div className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Formula</div>
              <pre className="text-[10px] text-cyan-300 font-mono bg-[#060608] border border-gray-800 rounded px-2 py-1.5 whitespace-pre-wrap">{dispFormula}</pre>
            </div>
          )}
          {dispVariables && (
            <div>
              <div className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Variables</div>
              <pre className="text-[10px] text-yellow-300/80 font-mono bg-[#060608] border border-gray-800 rounded px-2 py-1.5 whitespace-pre-wrap">{dispVariables}</pre>
            </div>
          )}
          {(dispBuy || dispSell) && (
            <div className="grid grid-cols-2 gap-2">
              {dispBuy && (
                <div className="bg-green-900/10 border border-green-800/30 rounded p-2">
                  <div className="text-[9px] text-green-400 mb-0.5">▲ BUY</div>
                  <div className="text-[10px] text-gray-300 whitespace-pre-wrap">{dispBuy}</div>
                </div>
              )}
              {dispSell && (
                <div className="bg-red-900/10 border border-red-800/30 rounded p-2">
                  <div className="text-[9px] text-red-400 mb-0.5">▼ SELL</div>
                  <div className="text-[10px] text-gray-300 whitespace-pre-wrap">{dispSell}</div>
                </div>
              )}
            </div>
          )}
          {strategy.notes && (
            <div>
              <div className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Notes</div>
              <div className="text-[10px] text-gray-400 leading-relaxed whitespace-pre-wrap">{strategy.notes}</div>
            </div>
          )}
          {Object.keys(params).length > 0 && (
            <div>
              <div className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Parameters</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(params).map(([k, v]) => (
                  <span key={k} className="text-[10px] text-gray-300 bg-gray-800 px-1.5 py-0.5 rounded font-mono">
                    {k}={v}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const MyStrategiesTab = ({ onRun }) => {
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await quantAPI.listStrategies();
      setStrategies(res.data || []);
    } catch { /* no-op */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (form) => {
    try {
      if (editTarget) {
        await quantAPI.updateStrategy(editTarget.id, form);
        toast.success('전략이 수정됐습니다');
      } else {
        await quantAPI.createStrategy(form);
        toast.success('전략이 저장됐습니다');
      }
      setShowForm(false);
      setEditTarget(null);
      load();
    } catch (err) {
      toast.error(err.message || '저장 실패');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('이 전략을 삭제할까요?')) return;
    try {
      await quantAPI.deleteStrategy(id);
      toast.success('삭제됐습니다');
      load();
    } catch (err) {
      toast.error(err.message || '삭제 실패');
    }
  };

  const handleRun = (strategy) => {
    let params = {};
    try { params = JSON.parse(strategy.parameters || '{}'); } catch {}
    onRun({
      ticker: params.ticker || 'AAPL',
      start_date: params.start_date || '2022-01-01',
      end_date: params.end_date || '2024-12-31',
      strategy: {
        type: strategy.strategy_type,
        ...params,
      },
    });
  };

  const handleEdit = (strategy) => {
    setEditTarget(strategy);
    setShowForm(true);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2 shrink-0">
        <span className="text-xs font-semibold text-white">My Strategies</span>
        <span className="text-[10px] text-gray-500">({strategies.length})</span>
        <button
          onClick={() => { setEditTarget(null); setShowForm(s => !s); }}
          className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-700/50 text-cyan-300 text-[11px] rounded transition-colors"
        >
          <Plus size={12} /> New
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Form */}
        {showForm && (
          <StrategyForm
            initial={editTarget || EMPTY_FORM}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditTarget(null); }}
          />
        )}

        {/* List */}
        {loading ? (
          <div className="text-center py-8 text-gray-500 text-xs">로딩 중…</div>
        ) : strategies.length === 0 && !showForm ? (
          <div className="text-center py-12 text-gray-600 text-xs">
            저장된 전략이 없습니다.<br />
            <button onClick={() => setShowForm(true)} className="mt-2 text-cyan-500 hover:text-cyan-400">+ New 버튼으로 전략을 추가해보세요</button>
          </div>
        ) : (
          strategies.map(s => (
            <SavedCard
              key={s.id}
              strategy={s}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onRun={handleRun}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default MyStrategiesTab;
