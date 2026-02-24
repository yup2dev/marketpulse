import React, { useState } from 'react';
import { Search, TrendingUp, TrendingDown, Star } from 'lucide-react';
import { quantAPI } from '../../config/api';
import toast from 'react-hot-toast';

const STRATEGY_SCANNER_CONFIG = {
  ema_cross: {
    label: 'EMA Cross',
    params: [
      { name: 'fast', label: 'Fast EMA', min: 5, max: 50, step: 5, defaultMin: 10, defaultMax: 30 },
      { name: 'slow', label: 'Slow EMA', min: 20, max: 300, step: 10, defaultMin: 40, defaultMax: 150 },
    ],
  },
  rsi: {
    label: 'RSI Reversal',
    params: [
      { name: 'rsi_period', label: 'RSI Period', min: 5, max: 30, step: 1, defaultMin: 10, defaultMax: 20 },
      { name: 'oversold', label: 'Oversold', min: 10, max: 40, step: 5, defaultMin: 20, defaultMax: 35 },
    ],
  },
  macd_cross: {
    label: 'MACD Cross',
    params: [
      { name: 'fast', label: 'Fast', min: 5, max: 20, step: 1, defaultMin: 8, defaultMax: 16 },
      { name: 'slow', label: 'Slow', min: 15, max: 50, step: 1, defaultMin: 20, defaultMax: 30 },
      { name: 'signal', label: 'Signal', min: 5, max: 15, step: 1, defaultMin: 7, defaultMax: 12 },
    ],
  },
  bb_breakout: {
    label: 'BB Breakout',
    params: [
      { name: 'period', label: 'Period', min: 5, max: 50, step: 5, defaultMin: 10, defaultMax: 30 },
      { name: 'std_dev', label: 'Std Dev', min: 1.0, max: 3.5, step: 0.5, defaultMin: 1.5, defaultMax: 2.5 },
    ],
  },
};

const RangeInput = ({ config, value, onChange }) => (
  <div className="flex items-center gap-2">
    <span className="text-[10px] text-gray-400 w-20 shrink-0">{config.label}</span>
    <div className="flex items-center gap-1">
      <span className="text-[9px] text-gray-600">Min</span>
      <input
        type="number"
        value={value.min}
        onChange={e => onChange({ ...value, min: Number(e.target.value) })}
        step={config.step}
        className="w-14 px-1.5 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500 tabular-nums"
      />
    </div>
    <div className="flex items-center gap-1">
      <span className="text-[9px] text-gray-600">Max</span>
      <input
        type="number"
        value={value.max}
        onChange={e => onChange({ ...value, max: Number(e.target.value) })}
        step={config.step}
        className="w-14 px-1.5 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500 tabular-nums"
      />
    </div>
    <div className="flex items-center gap-1">
      <span className="text-[9px] text-gray-600">Step</span>
      <input
        type="number"
        value={value.step}
        onChange={e => onChange({ ...value, step: Number(e.target.value) })}
        step={config.step}
        min={config.step}
        className="w-14 px-1.5 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500 tabular-nums"
      />
    </div>
    {/* preview count */}
    {(() => {
      const count = Math.floor((value.max - value.min) / value.step) + 1;
      return (
        <span className="text-[9px] text-gray-600">{count > 0 ? `${count}개` : '—'}</span>
      );
    })()}
  </div>
);

// ── Results table ──────────────────────────────────────────────────────────────
const ScanResults = ({ results, best, paramKeys, onRowRun, strategyType }) => {
  const [sortKey, setSortKey] = useState('sharpe');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = [...results].sort((a, b) => {
    const diff = (a[sortKey] ?? 0) - (b[sortKey] ?? 0);
    return sortAsc ? diff : -diff;
  });

  const toggleSort = (key) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const Th = ({ k, children }) => (
    <th
      onClick={() => toggleSort(k)}
      className="px-2 py-2 text-left text-[10px] text-gray-400 font-medium cursor-pointer hover:text-white whitespace-nowrap select-none"
    >
      {children} {sortKey === k ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  );

  const pctColor = v => v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-gray-400';

  const isBest = row => best && paramKeys.every(k => row[k] === best[k]);

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead className="bg-[#0d0d12] sticky top-0 z-10">
            <tr>
              {paramKeys.map(k => <Th key={k} k={k}>{k}</Th>)}
              <Th k="total_return">Return</Th>
              <Th k="annualized_return">Ann.</Th>
              <Th k="sharpe">Sharpe</Th>
              <Th k="max_drawdown">MDD</Th>
              <Th k="win_rate">Win%</Th>
              <Th k="trade_count">#</Th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const best_ = isBest(row);
              return (
                <tr
                  key={i}
                  className={`border-t border-gray-800/50 hover:bg-gray-800/20 transition-colors ${best_ ? 'bg-cyan-900/10' : ''}`}
                >
                  {paramKeys.map(k => (
                    <td key={k} className="px-2 py-1.5 text-gray-200 tabular-nums font-mono">{row[k]}</td>
                  ))}
                  <td className={`px-2 py-1.5 tabular-nums font-medium ${pctColor(row.total_return)}`}>
                    {row.total_return >= 0 ? '+' : ''}{row.total_return?.toFixed(1)}%
                  </td>
                  <td className={`px-2 py-1.5 tabular-nums ${pctColor(row.annualized_return)}`}>
                    {row.annualized_return >= 0 ? '+' : ''}{row.annualized_return?.toFixed(1)}%
                  </td>
                  <td className={`px-2 py-1.5 tabular-nums font-medium ${row.sharpe >= 1 ? 'text-green-400' : row.sharpe < 0 ? 'text-red-400' : 'text-gray-300'}`}>
                    {row.sharpe?.toFixed(2)}
                    {best_ && <Star size={9} className="inline ml-1 text-yellow-400 fill-yellow-400" />}
                  </td>
                  <td className={`px-2 py-1.5 tabular-nums ${pctColor(row.max_drawdown)}`}>
                    {row.max_drawdown?.toFixed(1)}%
                  </td>
                  <td className={`px-2 py-1.5 tabular-nums ${row.win_rate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                    {row.win_rate?.toFixed(1)}%
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-gray-400">{row.trade_count}</td>
                  <td className="px-2 py-1.5">
                    <button
                      onClick={() => onRowRun(row, strategyType)}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 hover:underline"
                    >
                      ▶
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const ScannerTab = ({ onRun }) => {
  const [ticker, setTicker] = useState('AAPL');
  const [startDate, setStartDate] = useState('2022-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');
  const [strategyType, setStrategyType] = useState('ema_cross');
  const [stopLoss, setStopLoss] = useState(0);
  const [takeProfit, setTakeProfit] = useState(0);
  const [initialCapital, setInitialCapital] = useState(10000);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const cfg = STRATEGY_SCANNER_CONFIG[strategyType];

  // Param ranges state
  const [ranges, setRanges] = useState(() => {
    const init = {};
    cfg.params.forEach(p => { init[p.name] = { min: p.defaultMin, max: p.defaultMax, step: p.step }; });
    return init;
  });

  const handleStrategyChange = (type) => {
    setStrategyType(type);
    setResults(null);
    const c = STRATEGY_SCANNER_CONFIG[type];
    const init = {};
    c.params.forEach(p => { init[p.name] = { min: p.defaultMin, max: p.defaultMax, step: p.step }; });
    setRanges(init);
  };

  const setRange = (name, val) => setRanges(r => ({ ...r, [name]: val }));

  // Estimate combination count
  const totalCombos = cfg.params.reduce((acc, p) => {
    const r = ranges[p.name] || {};
    const count = Math.max(1, Math.floor((r.max - r.min) / r.step) + 1);
    return acc * count;
  }, 1);

  const handleScan = async () => {
    if (totalCombos > 200) {
      if (!window.confirm(`${totalCombos}개 조합 실행. 시간이 걸릴 수 있습니다. 계속할까요?`)) return;
    }
    setLoading(true);
    setResults(null);
    try {
      const param_ranges = {};
      cfg.params.forEach(p => { param_ranges[p.name] = ranges[p.name]; });
      const res = await quantAPI.scan({
        ticker: ticker.trim().toUpperCase(),
        start_date: startDate,
        end_date: endDate,
        strategy_type: strategyType,
        param_ranges,
        stop_loss_pct: stopLoss,
        take_profit_pct: takeProfit,
        initial_capital: initialCapital,
      });
      setResults(res.data);
    } catch (err) {
      toast.error(err.message || '스캔 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleRowRun = (row, type) => {
    const { total_return, annualized_return, sharpe, max_drawdown, win_rate, trade_count, ...params } = row;
    onRun({
      ticker,
      start_date: startDate,
      end_date: endDate,
      strategy: {
        type,
        ...params,
        stop_loss_pct: stopLoss,
        take_profit_pct: takeProfit,
        initial_capital: initialCapital,
      },
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2 shrink-0">
        <Search size={14} className="text-cyan-400" />
        <span className="text-xs font-semibold text-white">Parameter Scanner</span>
        <span className="text-[10px] text-gray-500 ml-1">최적 파라미터 탐색</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Config */}
        <div className="space-y-3">
          {/* Row 1: Ticker + Strategy */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] text-gray-500 uppercase">Ticker</span>
              <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
                className="w-16 px-2 py-1.5 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500 uppercase" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] text-gray-500 uppercase">Start</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="px-2 py-1.5 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] text-gray-500 uppercase">End</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="px-2 py-1.5 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500" />
            </div>
          </div>

          {/* Strategy type */}
          <div>
            <span className="text-[9px] text-gray-500 uppercase block mb-1">Strategy</span>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(STRATEGY_SCANNER_CONFIG).map(([id, c]) => (
                <button
                  key={id}
                  onClick={() => handleStrategyChange(id)}
                  className={`px-2.5 py-1 text-[11px] rounded border transition-all ${
                    strategyType === id
                      ? 'bg-cyan-900/40 border-cyan-600 text-cyan-300'
                      : 'bg-[#0a0a0f] border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Parameter ranges */}
          <div className="border border-gray-800 rounded-lg p-3 space-y-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Parameter Ranges</div>
            {cfg.params.map(p => (
              <RangeInput
                key={p.name}
                config={p}
                value={ranges[p.name] || { min: p.defaultMin, max: p.defaultMax, step: p.step }}
                onChange={val => setRange(p.name, val)}
              />
            ))}
            <div className="text-[10px] text-gray-600 pt-1">
              총 <span className="text-cyan-400 font-semibold">{totalCombos}</span>개 조합
            </div>
          </div>

          {/* Risk params */}
          <div className="flex gap-3 flex-wrap">
            {[
              { label: 'Stop Loss %', val: stopLoss, set: setStopLoss },
              { label: 'Take Profit %', val: takeProfit, set: setTakeProfit },
              { label: 'Capital $', val: initialCapital, set: setInitialCapital },
            ].map(({ label, val, set }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="text-[9px] text-gray-500 uppercase">{label}</span>
                <input type="number" value={val} onChange={e => set(Number(e.target.value))}
                  className="w-20 px-1.5 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500 tabular-nums" />
              </div>
            ))}
          </div>

          {/* Run button */}
          <button
            onClick={handleScan}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-xs font-semibold rounded transition-colors"
          >
            {loading ? (
              <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
            ) : <Search size={13} />}
            {loading ? '스캔 중…' : 'Run Scanner'}
          </button>
        </div>

        {/* Results */}
        {results && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Results — {results.total_combinations}개 조합
              </div>
              {results.best && (
                <div className="flex items-center gap-1 text-[10px] text-yellow-400">
                  <Star size={10} className="fill-yellow-400" />
                  Best Sharpe: {results.best.sharpe?.toFixed(2)}
                </div>
              )}
            </div>
            <ScanResults
              results={results.results}
              best={results.best}
              paramKeys={cfg.params.map(p => p.name)}
              onRowRun={handleRowRun}
              strategyType={strategyType}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ScannerTab;
