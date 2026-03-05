import React, { useState } from 'react';
import { Play, ChevronDown } from 'lucide-react';
import DateRangePicker from '../common/DateRangePicker';

const STRATEGIES = [
  { id: 'ema_cross',   label: 'EMA Cross' },
  { id: 'rsi',         label: 'RSI' },
  { id: 'macd_cross',  label: 'MACD Cross' },
  { id: 'bb_breakout', label: 'BB Breakout' },
];

const defaultParams = {
  ema_cross:   { fast: 20, slow: 50 },
  rsi:         { rsi_period: 14, oversold: 30, overbought: 70 },
  macd_cross:  { fast: 12, slow: 26, signal: 9 },
  bb_breakout: { period: 20, std_dev: 2.0 },
};

const Label = ({ children }) => (
  <label className="block text-[11px] text-gray-400 mb-1">{children}</label>
);

const NumInput = ({ value, onChange, min, max, step = 1 }) => (
  <input
    type="number"
    value={value}
    onChange={(e) => onChange(Number(e.target.value))}
    min={min}
    max={max}
    step={step}
    className="w-full px-2 py-1.5 bg-[#0a0a0f] border border-gray-700 rounded text-xs text-white focus:outline-none focus:border-cyan-500 tabular-nums"
  />
);

const Section = ({ title, children }) => (
  <div className="space-y-2">
    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider pt-1">
      {title}
    </div>
    {children}
  </div>
);

const StrategyBuilder = ({ onRun, loading }) => {
  const [ticker, setTicker] = useState('AAPL');
  const [strategyType, setStrategyType] = useState('ema_cross');
  const [params, setParams] = useState(defaultParams);
  const [stopLoss, setStopLoss] = useState(5.0);
  const [takeProfit, setTakeProfit] = useState(15.0);
  const [initialCapital, setInitialCapital] = useState(10000);
  const [startDate, setStartDate] = useState('2022-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');

  const setParam = (key, val) =>
    setParams((p) => ({ ...p, [strategyType]: { ...p[strategyType], [key]: val } }));

  const handleRun = () => {
    const p = params[strategyType];
    onRun({
      ticker: ticker.trim().toUpperCase(),
      start_date: startDate,
      end_date: endDate,
      strategy: {
        type: strategyType,
        ...p,
        stop_loss_pct: stopLoss,
        take_profit_pct: takeProfit,
        initial_capital: initialCapital,
      },
    });
  };

  const cur = params[strategyType];

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      {/* Ticker */}
      <Section title="Ticker">
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="AAPL"
          className="w-full px-2 py-1.5 bg-[#0a0a0f] border border-gray-700 rounded text-xs text-white focus:outline-none focus:border-cyan-500 uppercase"
        />
      </Section>

      {/* Date Range */}
      <Section title="Date Range">
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
          presets={true}
        />
      </Section>

      {/* Strategy Type */}
      <Section title="Strategy">
        <div className="grid grid-cols-2 gap-1.5">
          {STRATEGIES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStrategyType(s.id)}
              className={`px-2 py-1.5 text-[11px] rounded border transition-all ${
                strategyType === s.id
                  ? 'bg-cyan-900/40 border-cyan-600 text-cyan-300'
                  : 'bg-[#0a0a0f] border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Strategy Parameters */}
      <Section title="Parameters">
        {strategyType === 'ema_cross' && (
          <div className="space-y-2">
            <div><Label>Fast EMA Period</Label><NumInput value={cur.fast} onChange={(v) => setParam('fast', v)} min={2} max={200} /></div>
            <div><Label>Slow EMA Period</Label><NumInput value={cur.slow} onChange={(v) => setParam('slow', v)} min={2} max={500} /></div>
          </div>
        )}
        {strategyType === 'rsi' && (
          <div className="space-y-2">
            <div><Label>RSI Period</Label><NumInput value={cur.rsi_period} onChange={(v) => setParam('rsi_period', v)} min={2} max={100} /></div>
            <div><Label>Oversold Level</Label><NumInput value={cur.oversold} onChange={(v) => setParam('oversold', v)} min={1} max={49} /></div>
            <div><Label>Overbought Level</Label><NumInput value={cur.overbought} onChange={(v) => setParam('overbought', v)} min={51} max={99} /></div>
          </div>
        )}
        {strategyType === 'macd_cross' && (
          <div className="space-y-2">
            <div><Label>Fast Period</Label><NumInput value={cur.fast} onChange={(v) => setParam('fast', v)} min={2} max={100} /></div>
            <div><Label>Slow Period</Label><NumInput value={cur.slow} onChange={(v) => setParam('slow', v)} min={2} max={200} /></div>
            <div><Label>Signal Period</Label><NumInput value={cur.signal} onChange={(v) => setParam('signal', v)} min={2} max={50} /></div>
          </div>
        )}
        {strategyType === 'bb_breakout' && (
          <div className="space-y-2">
            <div><Label>BB Period</Label><NumInput value={cur.period} onChange={(v) => setParam('period', v)} min={5} max={200} /></div>
            <div><Label>Std Dev Multiplier</Label><NumInput value={cur.std_dev} onChange={(v) => setParam('std_dev', v)} min={0.5} max={5} step={0.1} /></div>
          </div>
        )}
      </Section>

      {/* Risk Management */}
      <Section title="Risk Management">
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
            <NumInput value={initialCapital} onChange={setInitialCapital} min={1000} max={10000000} step={1000} />
          </div>
        </div>
      </Section>

      {/* Run Button */}
      <button
        onClick={handleRun}
        disabled={loading}
        className="flex items-center justify-center gap-2 w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded transition-colors mt-auto"
      >
        {loading ? (
          <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
        ) : (
          <Play size={14} />
        )}
        {loading ? 'Running…' : 'Run Strategy'}
      </button>
    </div>
  );
};

export default StrategyBuilder;
