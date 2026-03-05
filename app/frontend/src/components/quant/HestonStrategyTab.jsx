/**
 * HestonStrategyTab
 * ────────────────────────────────────────────────────────────────────────────
 * 4 Heston Model FFT–based preset trading strategies:
 *
 *  1. Vol Regime      — realised vol vs. Heston θ (long-run mean)
 *  2. Delta Momentum  — stochastic-vol call delta as directional signal
 *  3. Price Premium   — normalised call-price z-score mean-reversion
 *  4. Variance Gap    — κ mean-reversion: gap(v₀ − θ) contraction/expansion
 */
import React, { useState } from 'react';
import { Play, Info } from 'lucide-react';
import DateRangePicker from '../common/DateRangePicker';

// ── Strategy catalogue ────────────────────────────────────────────────────────

const HESTON_STRATEGIES = [
  {
    id:    'heston_vol_regime',
    label: 'Vol Regime',
    labelKo: '변동성 레짐',
    color: 'violet',
    desc:  '롤링 실현변동성 vs. Heston 장기 분산(θ)을 비교해 저변동성 진입 / 변동성 스파이크 청산.',
    formula: 'rv_t / √θ < entry_mult → BUY  |  rv_t / √θ > exit_mult → SELL',
    params: [
      { key: 'theta',      label: 'θ Long-run Var %', default: 4.0,  min: 0.1, max: 100, step: 0.1, unit: '%²' },
      { key: 'lookback',   label: 'RV Lookback (days)', default: 30, min: 5,   max: 120, step: 1   },
      { key: 'entry_mult', label: 'Entry Mult',        default: 0.80, min: 0.1, max: 0.99, step: 0.05 },
      { key: 'exit_mult',  label: 'Exit Mult',         default: 1.50, min: 1.0, max: 4.0,  step: 0.10 },
    ],
  },
  {
    id:    'heston_delta_signal',
    label: 'Delta Momentum',
    labelKo: '델타 모멘텀',
    color: 'cyan',
    desc:  '롤링 실현분산을 v₀로 사용해 매 바(bar)마다 Heston δ를 재계산. 델타 임계값 크로스가 방향성 신호.',
    formula: 'Δ_t crosses above δ_buy → BUY  |  crosses below δ_sell → SELL',
    params: [
      { key: 'r',          label: 'Risk-Free Rate %', default: 5.0,  min: 0,    max: 20,  step: 0.1  },
      { key: 'T',          label: 'Expiry (yr)',       default: 0.25, min: 0.05, max: 2,   step: 0.05 },
      { key: 'moneyness',  label: 'Moneyness %',       default: 0.0,  min: -30,  max: 30,  step: 1    },
      { key: 'kappa',      label: 'κ Mean-Rev Speed',  default: 2.0,  min: 0.1,  max: 20,  step: 0.1  },
      { key: 'theta',      label: 'θ Long-run Var %',  default: 4.0,  min: 0.1,  max: 100, step: 0.1  },
      { key: 'xi',         label: 'ξ Vol-of-Vol',      default: 0.50, min: 0.01, max: 5,   step: 0.05 },
      { key: 'rho',        label: 'ρ Correlation',     default: -0.7, min: -0.99,max: 0.99,step: 0.05 },
      { key: 'lookback',   label: 'RV Lookback (days)',default: 30,   min: 5,    max: 120, step: 1    },
      { key: 'delta_buy',  label: 'δ Buy Threshold',   default: 0.60, min: 0.3,  max: 0.9, step: 0.01 },
      { key: 'delta_sell', label: 'δ Sell Threshold',  default: 0.40, min: 0.1,  max: 0.7, step: 0.01 },
    ],
  },
  {
    id:    'heston_price_ratio',
    label: 'Price Premium',
    labelKo: '프리미엄 역발상',
    color: 'amber',
    desc:  '헤스톤 콜 가격 / 기초자산 비율의 z-score. 프리미엄 급등(공포 정점) → 역발상 매수, 프리미엄 붕괴 → 청산.',
    formula: 'z(C/S) > entry_z → BUY (contrarian)  |  z(C/S) < −exit_z → SELL',
    params: [
      { key: 'r',                label: 'Risk-Free Rate %', default: 5.0,  min: 0,    max: 20,  step: 0.1  },
      { key: 'T',                label: 'Expiry (yr)',       default: 0.25, min: 0.05, max: 2,   step: 0.05 },
      { key: 'moneyness',        label: 'Moneyness %',       default: 0.0,  min: -30,  max: 30,  step: 1    },
      { key: 'kappa',            label: 'κ Mean-Rev Speed',  default: 2.0,  min: 0.1,  max: 20,  step: 0.1  },
      { key: 'theta',            label: 'θ Long-run Var %',  default: 4.0,  min: 0.1,  max: 100, step: 0.1  },
      { key: 'xi',               label: 'ξ Vol-of-Vol',      default: 0.50, min: 0.01, max: 5,   step: 0.05 },
      { key: 'rho',              label: 'ρ Correlation',     default: -0.7, min: -0.99,max: 0.99,step: 0.05 },
      { key: 'lookback',         label: 'RV Lookback (days)',default: 30,   min: 5,    max: 120, step: 1    },
      { key: 'premium_lookback', label: 'Premium Window',    default: 60,   min: 10,   max: 252, step: 5    },
      { key: 'entry_z',          label: 'Entry z-score',     default: 1.5,  min: 0.5,  max: 4,   step: 0.1  },
      { key: 'exit_z',           label: 'Exit z-score',      default: 0.5,  min: 0.0,  max: 3,   step: 0.1  },
    ],
  },
  {
    id:    'heston_variance_gap',
    label: 'Variance Gap',
    labelKo: '분산 갭 평균회귀',
    color: 'rose',
    desc:  'g_t = v₀_t − θ (분산 갭). κ에 의한 평균회귀: 갭이 스파이크 후 수렴 → 매수, 갭이 음수로 깊어짐 → 청산.',
    formula: 'gap contracts from ≥ spike → BUY  |  gap < −low_thresh → SELL',
    params: [
      { key: 'theta',        label: 'θ Long-run Var %',  default: 4.0, min: 0.1, max: 100, step: 0.1  },
      { key: 'lookback',     label: 'RV Lookback (days)', default: 30, min: 5,   max: 120, step: 1    },
      { key: 'spike_thresh', label: 'Spike Thresh %',    default: 1.5, min: 0.1, max: 20,  step: 0.1  },
      { key: 'low_thresh',   label: 'Low Thresh %',      default: 0.5, min: 0.0, max: 10,  step: 0.1  },
    ],
  },
];

const COLOR_MAP = {
  violet: { chip: 'bg-violet-900/40 border-violet-600 text-violet-300', accent: 'text-violet-400', dot: 'bg-violet-400' },
  cyan:   { chip: 'bg-cyan-900/40   border-cyan-600   text-cyan-300',   accent: 'text-cyan-400',   dot: 'bg-cyan-400'   },
  amber:  { chip: 'bg-amber-900/40  border-amber-600  text-amber-300',  accent: 'text-amber-400',  dot: 'bg-amber-400'  },
  rose:   { chip: 'bg-rose-900/40   border-rose-600   text-rose-300',   accent: 'text-rose-400',   dot: 'bg-rose-400'   },
};

const INACTIVE_CHIP = 'bg-[#0a0a0f] border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300';

// ── Helpers ───────────────────────────────────────────────────────────────────

const Label = ({ children }) => (
  <label className="block text-[10px] text-gray-500 mb-0.5 leading-tight">{children}</label>
);

const NumInput = ({ value, onChange, min, max, step = 1 }) => (
  <input
    type="number"
    value={value}
    onChange={e => onChange(Number(e.target.value))}
    min={min}
    max={max}
    step={step}
    className="w-full px-2 py-1.5 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500 tabular-nums"
  />
);

const SectionTitle = ({ children }) => (
  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider pt-1 pb-0.5">
    {children}
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────

const buildDefaultParams = () => {
  const out = {};
  HESTON_STRATEGIES.forEach(s => {
    out[s.id] = {};
    s.params.forEach(p => { out[s.id][p.key] = p.default; });
  });
  return out;
};

const HestonStrategyTab = ({ onRun, loading }) => {
  const [strategyId, setStrategyId] = useState('heston_vol_regime');
  const [params, setParams]         = useState(buildDefaultParams);
  const [ticker, setTicker]         = useState('AAPL');
  const [startDate, setStartDate]   = useState('2021-01-01');
  const [endDate, setEndDate]       = useState('2024-12-31');
  const [stopLoss, setStopLoss]     = useState(5.0);
  const [takeProfit, setTakeProfit] = useState(20.0);
  const [capital, setCapital]       = useState(10000);
  const [showInfo, setShowInfo]     = useState(false);

  const strategy  = HESTON_STRATEGIES.find(s => s.id === strategyId);
  const colors    = COLOR_MAP[strategy.color];

  const setParam = (key, val) =>
    setParams(p => ({ ...p, [strategyId]: { ...p[strategyId], [key]: val } }));

  const handleRun = () => {
    const p = params[strategyId];
    onRun({
      ticker:     ticker.trim().toUpperCase(),
      start_date: startDate,
      end_date:   endDate,
      strategy: {
        type:            strategyId,
        ...p,
        stop_loss_pct:   stopLoss,
        take_profit_pct: takeProfit,
        initial_capital: capital,
      },
    });
  };

  const cur = params[strategyId];

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">

      {/* ── Header badge ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
          <span className="text-[11px] font-semibold text-white">Heston Model FFT</span>
        </div>
        <button
          onClick={() => setShowInfo(v => !v)}
          className="p-1 text-gray-600 hover:text-gray-400 transition-colors"
          title="전략 설명"
        >
          <Info size={13} />
        </button>
      </div>

      {/* ── Info panel ───────────────────────────────────────────────────── */}
      {showInfo && (
        <div className="bg-[#060608] border border-gray-800 rounded-lg p-3 space-y-1.5 text-[10px] leading-relaxed">
          <p className="text-gray-400">{strategy.desc}</p>
          <div className={`font-mono ${colors.accent} border border-gray-800 rounded px-2 py-1 bg-[#0a0a0f]`}>
            {strategy.formula}
          </div>
          <p className="text-gray-600">
            헤스톤 모형: dS=μS dt+√v·S·dW₁, dv=κ(θ−v)dt+ξ√v·dW₂, corr=ρ
          </p>
        </div>
      )}

      {/* ── Ticker ───────────────────────────────────────────────────────── */}
      <div>
        <SectionTitle>Ticker</SectionTitle>
        <input
          type="text"
          value={ticker}
          onChange={e => setTicker(e.target.value.toUpperCase())}
          placeholder="AAPL"
          className="w-full px-2 py-1.5 bg-[#0a0a0f] border border-gray-700 rounded text-xs text-white focus:outline-none focus:border-cyan-500 uppercase"
        />
      </div>

      {/* ── Date Range ───────────────────────────────────────────────────── */}
      <div>
        <SectionTitle>Date Range</SectionTitle>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
          presets
        />
      </div>

      {/* ── Strategy selector ────────────────────────────────────────────── */}
      <div>
        <SectionTitle>Strategy</SectionTitle>
        <div className="grid grid-cols-2 gap-1.5">
          {HESTON_STRATEGIES.map(s => {
            const c = COLOR_MAP[s.color];
            const active = s.id === strategyId;
            return (
              <button
                key={s.id}
                onClick={() => setStrategyId(s.id)}
                className={`px-2 py-2 text-[10px] rounded border transition-all text-left leading-tight ${
                  active ? c.chip : INACTIVE_CHIP
                }`}
              >
                <span className="font-semibold block">{s.label}</span>
                <span className="text-[9px] opacity-70">{s.labelKo}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Parameters ───────────────────────────────────────────────────── */}
      <div>
        <SectionTitle>Parameters</SectionTitle>
        <div className="space-y-2">
          {strategy.params.map(p => (
            <div key={p.key}>
              <Label>
                {p.label}
                {p.unit && <span className="text-gray-700 ml-1">({p.unit})</span>}
              </Label>
              <NumInput
                value={cur[p.key] ?? p.default}
                onChange={v => setParam(p.key, v)}
                min={p.min}
                max={p.max}
                step={p.step}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Risk Management ──────────────────────────────────────────────── */}
      <div>
        <SectionTitle>Risk Management</SectionTitle>
        <div className="space-y-2">
          <div>
            <Label>Stop Loss %</Label>
            <NumInput value={stopLoss} onChange={setStopLoss} min={0} max={50} step={0.5} />
          </div>
          <div>
            <Label>Take Profit %</Label>
            <NumInput value={takeProfit} onChange={setTakeProfit} min={0} max={200} step={0.5} />
          </div>
          <div>
            <Label>Initial Capital ($)</Label>
            <NumInput value={capital} onChange={setCapital} min={1000} max={10000000} step={1000} />
          </div>
        </div>
      </div>

      {/* ── Signal legend ────────────────────────────────────────────────── */}
      <div className="bg-[#060608] border border-gray-800/60 rounded-lg px-3 py-2 space-y-1">
        <div className={`text-[9px] uppercase tracking-wider ${colors.accent} font-semibold mb-1`}>
          Signal Logic
        </div>
        {strategy.id === 'heston_vol_regime' && (
          <>
            <div className="text-[10px] text-gray-400">
              <span className="text-green-400 font-mono">▲ BUY  </span>
              when RealVol / √θ &lt; <span className="text-white">{cur.entry_mult}</span>
              <span className="text-gray-600"> (low-vol regime)</span>
            </div>
            <div className="text-[10px] text-gray-400">
              <span className="text-red-400 font-mono">▼ SELL </span>
              when RealVol / √θ &gt; <span className="text-white">{cur.exit_mult}</span>
              <span className="text-gray-600"> (vol spike)</span>
            </div>
          </>
        )}
        {strategy.id === 'heston_delta_signal' && (
          <>
            <div className="text-[10px] text-gray-400">
              <span className="text-green-400 font-mono">▲ BUY  </span>
              Heston Δ crosses above <span className="text-white">{cur.delta_buy}</span>
            </div>
            <div className="text-[10px] text-gray-400">
              <span className="text-red-400 font-mono">▼ SELL </span>
              Heston Δ crosses below <span className="text-white">{cur.delta_sell}</span>
            </div>
          </>
        )}
        {strategy.id === 'heston_price_ratio' && (
          <>
            <div className="text-[10px] text-gray-400">
              <span className="text-green-400 font-mono">▲ BUY  </span>
              Premium z-score &gt; <span className="text-white">{cur.entry_z}</span>
              <span className="text-gray-600"> (fear peak, contrarian)</span>
            </div>
            <div className="text-[10px] text-gray-400">
              <span className="text-red-400 font-mono">▼ SELL </span>
              Premium z-score &lt; <span className="text-white">{-(cur.exit_z)}</span>
              <span className="text-gray-600"> (premium collapse)</span>
            </div>
          </>
        )}
        {strategy.id === 'heston_variance_gap' && (
          <>
            <div className="text-[10px] text-gray-400">
              <span className="text-green-400 font-mono">▲ BUY  </span>
              VarGap contracts from &ge; <span className="text-white">{cur.spike_thresh}%</span>
              <span className="text-gray-600"> (vol compressing)</span>
            </div>
            <div className="text-[10px] text-gray-400">
              <span className="text-red-400 font-mono">▼ SELL </span>
              VarGap &lt; −<span className="text-white">{cur.low_thresh}%</span>
              <span className="text-gray-600"> (spike risk)</span>
            </div>
          </>
        )}
      </div>

      {/* ── Save ─────────────────────────────────────────────────────────── */}
      <div className="space-y-2 pt-1 border-t border-gray-800/60">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="전략 이름 (저장 시 필요)"
          className="w-full px-2 py-1.5 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-violet-500"
        />
        <div className="flex gap-2">
          <button
            onClick={handleRun}
            disabled={loading}
            className={`flex items-center gap-1.5 flex-1 justify-center py-2 text-white text-xs font-semibold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              loading ? 'bg-gray-700' : 'bg-violet-700 hover:bg-violet-600'
            }`}
          >
            {loading
              ? <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
              : <Play size={13} />
            }
            {loading ? 'Running…' : 'Run'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs rounded transition-colors"
          >
            <Save size={13} />
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>

    </div>
  );
};

export default HestonStrategyTab;
