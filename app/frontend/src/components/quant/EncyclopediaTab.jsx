import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Play, BookOpen } from 'lucide-react';
import { STRATEGY_ENCYCLOPEDIA } from '../../data/strategyEncyclopedia';

const TICKER_DEFAULT = 'AAPL';
const DATE_DEFAULTS = { start: '2022-01-01', end: '2024-12-31' };

// ── Inline number input ────────────────────────────────────────────────────────
const Num = ({ label, value, onChange, step = 1 }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[9px] text-gray-500 uppercase tracking-wide">{label}</span>
    <input
      type="number"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      step={step}
      className="w-16 px-1.5 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500 tabular-nums"
    />
  </div>
);

// ── Single strategy card ───────────────────────────────────────────────────────
const StrategyCard = ({ strategy, onRun }) => {
  const [expanded, setExpanded] = useState(false);
  const [params, setParams] = useState({ ...strategy.defaultParams });
  const [ticker, setTicker] = useState(TICKER_DEFAULT);
  const [start, setStart] = useState(DATE_DEFAULTS.start);
  const [end, setEnd] = useState(DATE_DEFAULTS.end);

  const setParam = (k, v) => setParams(p => ({ ...p, [k]: v }));

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden bg-[#0d0d12] hover:border-gray-700 transition-colors">
      {/* Header */}
      <div
        className="flex items-start justify-between p-4 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${strategy.categoryColor}`}>
              {strategy.category}
            </span>
          </div>
          <div className="text-sm font-semibold text-white">{strategy.name}</div>
          <div className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{strategy.description}</div>
        </div>
        <div className="ml-3 text-gray-500 shrink-0 mt-0.5">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-800 px-4 pb-4 pt-3 space-y-4">
          {/* Formula */}
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Formula</div>
            <pre className="text-[11px] text-cyan-300 font-mono bg-[#060608] border border-gray-800 rounded px-3 py-2 whitespace-pre-wrap leading-relaxed">
              {strategy.formula}
            </pre>
          </div>

          {/* Variables */}
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Variables</div>
            <div className="space-y-1.5">
              {strategy.variables.map(v => (
                <div key={v.name} className="flex items-start gap-2">
                  <code className="text-[11px] text-yellow-400 font-mono bg-yellow-900/10 px-1.5 py-0.5 rounded shrink-0">{v.label}</code>
                  <span className="text-[11px] text-gray-400 leading-tight">{v.desc}</span>
                  <span className="text-[10px] text-gray-600 ml-auto shrink-0">default: {v.default}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Buy/Sell Conditions */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-green-900/10 border border-green-800/40 rounded-lg p-2.5">
              <div className="text-[10px] text-green-400 font-semibold mb-1">▲ BUY Condition</div>
              <div className="text-[11px] text-gray-300 leading-relaxed">{strategy.buy}</div>
            </div>
            <div className="bg-red-900/10 border border-red-800/40 rounded-lg p-2.5">
              <div className="text-[10px] text-red-400 font-semibold mb-1">▼ SELL Condition</div>
              <div className="text-[11px] text-gray-300 leading-relaxed">{strategy.sell}</div>
            </div>
          </div>

          {/* Pros/Cons */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <div className="text-[10px] text-gray-500 uppercase mb-1">장점</div>
              <ul className="space-y-0.5">
                {strategy.pros.map((p, i) => (
                  <li key={i} className="flex gap-1 text-green-400/80"><span>+</span><span className="text-gray-400">{p}</span></li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase mb-1">단점</div>
              <ul className="space-y-0.5">
                {strategy.cons.map((c, i) => (
                  <li key={i} className="flex gap-1 text-red-400/80"><span>−</span><span className="text-gray-400">{c}</span></li>
                ))}
              </ul>
            </div>
          </div>

          {strategy.note && (
            <div className="text-[10px] text-gray-500 italic bg-gray-800/20 rounded px-2 py-1">{strategy.note}</div>
          )}

          {/* Inline Run Form */}
          <div className="border-t border-gray-800 pt-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Run Backtest</div>
            <div className="flex flex-wrap gap-2 items-end">
              {/* Ticker */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-gray-500 uppercase tracking-wide">Ticker</span>
                <input
                  value={ticker}
                  onChange={e => setTicker(e.target.value.toUpperCase())}
                  className="w-16 px-1.5 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500 uppercase"
                />
              </div>
              {/* Date range compact */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-gray-500 uppercase tracking-wide">Start</span>
                <input type="date" value={start} onChange={e => setStart(e.target.value)}
                  className="px-1.5 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-gray-500 uppercase tracking-wide">End</span>
                <input type="date" value={end} onChange={e => setEnd(e.target.value)}
                  className="px-1.5 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500" />
              </div>
              {/* Strategy params */}
              {strategy.variables.map(v => (
                <Num
                  key={v.name}
                  label={v.label.split(' ')[0]}
                  value={params[v.name] ?? v.default}
                  onChange={val => setParam(v.name, val)}
                  step={typeof v.default === 'number' && v.default % 1 !== 0 ? 0.1 : 1}
                />
              ))}
              <Num label="SL%" value={params.stop_loss_pct ?? 5} onChange={v => setParam('stop_loss_pct', v)} step={0.5} />
              <Num label="TP%" value={params.take_profit_pct ?? 15} onChange={v => setParam('take_profit_pct', v)} step={0.5} />
            </div>

            <button
              onClick={() => onRun({
                ticker,
                start_date: start,
                end_date: end,
                strategy: { ...params },
              })}
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold rounded transition-colors"
            >
              <Play size={11} /> Run Backtest
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const EncyclopediaTab = ({ onRun }) => {
  const [filter, setFilter] = useState('');
  const filtered = STRATEGY_ENCYCLOPEDIA.filter(s =>
    !filter || s.category.toLowerCase().includes(filter.toLowerCase()) || s.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2 shrink-0">
        <BookOpen size={14} className="text-cyan-400" />
        <span className="text-xs font-semibold text-white">Strategy Encyclopedia</span>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter…"
          className="ml-auto w-28 px-2 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filtered.map(s => (
          <StrategyCard key={s.id} strategy={s} onRun={onRun} />
        ))}
      </div>
    </div>
  );
};

export default EncyclopediaTab;
