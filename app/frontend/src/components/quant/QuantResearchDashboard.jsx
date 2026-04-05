/**
 * QuantResearchDashboard — Strategy Execution + Optimization Loop
 *
 * Flow:
 *   1. Strategy Lab에서 전략 생성 → 여기서 전략 선택
 *   2. Run Backtest → Chart / Equity / Performance / Trades 확인
 *   3. 3D Scan 탭 → 파라미터 범위 스캔 → 최적 파라미터 적용
 *   4. 적용 즉시 백테스트 재실행 → Performance 탭으로 자동 전환
 *   5. History 탭 → 모든 실행 이력 비교 (어느 파라미터가 최선인지)
 *   → 반복하여 좋은 결과를 추출
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Play, RefreshCw, ChevronLeft, ChevronRight,
  FlaskConical, TrendingUp, ArrowRight, History,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ChartWidget from '../widgets/ChartWidget';
import QuantPerformance from './QuantPerformance';
import EquityCurveChart from './EquityCurveChart';
import StrategyScanner3D from './StrategyScanner3D';
import { quantAPI } from '../../config/api';

// ── Helpers for custom strategy param application ─────────────────────────────

// factorId → backend factor names (mirrors StrategyScanner3D / strategy/constants.js)
const FACTOR_BACKEND_NAMES = {
  ema: ['EMA'], sma: ['SMA'], rsi: ['RSI'],
  macd: ['MACD_LINE', 'MACD_SIGNAL', 'MACD_HIST'],
  bb: ['BB_UPPER', 'BB_MID', 'BB_LOWER'],
  vwap_intraday: ['VWAP'],
};

function paramsMatch(a = {}, b = {}) {
  const ak = Object.keys(a || {}), bk = Object.keys(b || {});
  if (ak.length !== bk.length) return false;
  return ak.every(k => String(a[k]) === String(b[k]));
}

// Deep-substitute ##placeholder## strings in a JSON tree
function substituteTemplate(obj, params) {
  if (typeof obj === 'string') {
    return obj.replace(/##(\w+)##/g, (_, k) => (k in params ? params[k] : obj));
  }
  if (Array.isArray(obj)) return obj.map(item => substituteTemplate(item, params));
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(obj)) result[k] = substituteTemplate(v, params);
    return result;
  }
  return obj;
}

// Build condition templates with ##varName_paramKey## / ##threshold_N## placeholders
// (client-side mirror of StrategyScanner3D's extractFactorScanParams)
function buildConditionTemplates(selectedFactors = [], buyConds = [], sellConds = []) {
  const instances = selectedFactors.map(sf => ({
    varName:      sf.varName,
    backendNames: FACTOR_BACKEND_NAMES[sf.factorId] || [sf.factorId.toUpperCase()],
    params:       sf.params || {},
  }));

  function templateFactorDef(fd) {
    if (!fd || fd.factor === 'VALUE') return fd;
    const inst = instances.find(fi =>
      fi.backendNames.includes(fd.factor) && paramsMatch(fi.params, fd.params),
    );
    if (!inst) return fd;
    const newParams = {};
    for (const [k, v] of Object.entries(fd.params || {})) {
      newParams[k] = typeof v === 'number' ? `##${inst.varName}_${k}##` : v;
    }
    return { ...fd, params: newParams };
  }

  let threshIdx = 0;
  function templateCond(cond) {
    const nc = { ...cond, left: templateFactorDef(cond.left) };
    if (cond.right?.factor === 'VALUE' && typeof cond.right.value === 'number') {
      nc.right = { factor: 'VALUE', value: `##threshold_${threshIdx++}##` };
    } else {
      nc.right = templateFactorDef(cond.right);
    }
    return nc;
  }

  return {
    buyTemplate:  (buyConds  || []).map(templateCond),
    sellTemplate: (sellConds || []).map(templateCond),
  };
}

// Update selectedFactors params from varName_paramKey scan results
function applyParamsToFactors(selectedFactors, newParams) {
  return selectedFactors.map(sf => {
    const updated = { ...sf, params: { ...sf.params } };
    for (const [key, val] of Object.entries(newParams)) {
      if (/^threshold_\d+$/.test(key)) continue;
      const parts = key.split('_');
      // varName is everything except last segment (paramKey)
      const varName  = parts.slice(0, -1).join('_');
      const paramKey = parts[parts.length - 1];
      if (varName === sf.varName && paramKey in updated.params) {
        updated.params[paramKey] = val;
      }
    }
    return updated;
  });
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RESULT_TABS = [
  { id: 'chart',   label: 'Chart' },
  { id: 'equity',  label: 'Equity Curve' },
  { id: 'metrics', label: 'Performance' },
  { id: 'trades',  label: 'Trades' },
  { id: 'scan3d',  label: '3D Scan', color: 'purple' },
  { id: 'history', label: 'History', color: 'amber' },
];

const labelOf = (strategyTypes, key) =>
  strategyTypes.find(s => s.key === key)?.label ?? key;

// ── Empty State ───────────────────────────────────────────────────────────────
const EmptyState = ({ message }) => (
  <div className="h-full flex flex-col items-center justify-center text-center px-8">
    <TrendingUp size={36} className="text-gray-700 mb-3" />
    <p className="text-xs text-gray-600 leading-relaxed max-w-xs">{message}</p>
  </div>
);

const FieldLabel = ({ children }) => (
  <span className="text-[9px] text-gray-500 uppercase tracking-wider">{children}</span>
);

const TextInput = ({ value, onChange, className = '', ...rest }) => (
  <input
    value={value}
    onChange={onChange}
    className={`px-2 py-1.5 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500 ${className}`}
    {...rest}
  />
);

// ── Saved Strategy Selector ───────────────────────────────────────────────────
const SavedSelector = ({ strategies, selectedId, onSelect, strategyTypes }) => {
  if (!strategies.length) {
    return <div className="text-[11px] text-gray-600 italic py-2">저장된 전략이 없습니다</div>;
  }
  return (
    <select
      value={selectedId || ''}
      onChange={e => onSelect(e.target.value)}
      className="w-full px-2 py-1.5 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500"
    >
      <option value="">— 전략 선택 —</option>
      {strategies.map(s => (
        <option key={s.id} value={s.id}>
          {s.name}  [{labelOf(strategyTypes, s.strategy_type)}]
        </option>
      ))}
    </select>
  );
};

// ── Execution Settings ────────────────────────────────────────────────────────
const ExecutionSettings = ({
  ticker, setTicker, startDate, setStartDate, endDate, setEndDate,
  stopLoss, setStopLoss, takeProfit, setTakeProfit, capital, setCapital,
  commission, setCommission,
}) => (
  <div className="space-y-3">
    <div className="flex flex-col gap-1">
      <FieldLabel>Ticker</FieldLabel>
      <TextInput value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} placeholder="AAPL" className="w-full uppercase" />
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div className="flex flex-col gap-1">
        <FieldLabel>From</FieldLabel>
        <TextInput type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full" />
      </div>
      <div className="flex flex-col gap-1">
        <FieldLabel>To</FieldLabel>
        <TextInput type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full" />
      </div>
    </div>
    <div className="space-y-1.5">
      <FieldLabel>Risk Management</FieldLabel>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Stop Loss %',    val: stopLoss,    set: setStopLoss,    step: 0.5  },
          { label: 'Take Profit %',  val: takeProfit,  set: setTakeProfit,  step: 0.5  },
          { label: 'Capital $',      val: capital,     set: setCapital,     step: 1000 },
          { label: 'Commission %',   val: commission,  set: setCommission,  step: 0.05 },
        ].map(({ label, val, set, step }) => (
          <div key={label} className="flex flex-col gap-1">
            <span className="text-[8px] text-gray-600 uppercase leading-tight">{label}</span>
            <input type="number" value={val} onChange={e => set(Number(e.target.value))}
              step={step} min={0}
              className="w-full px-1.5 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500 tabular-nums"
            />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ── Optimization History Panel ────────────────────────────────────────────────
function RunHistoryPanel({ history, onViewRun }) {
  if (!history.length) {
    return <EmptyState message="Run Backtest를 실행하면 최적화 이력이 여기 표시됩니다" />;
  }

  const bestIdx = history.reduce((bIdx, run, i) =>
    (run.performance?.sharpe ?? -999) > (history[bIdx]?.performance?.sharpe ?? -999) ? i : bIdx
  , 0);

  const firstReturn = history[0]?.performance?.total_return ?? 0;
  const lastReturn  = history[history.length - 1]?.performance?.total_return ?? 0;
  const bestSharpe  = history[bestIdx]?.performance?.sharpe ?? 0;
  const totalDelta  = lastReturn - firstReturn;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Summary strip */}
      <div className="flex items-center gap-6 px-5 py-3 border-b border-gray-800 shrink-0 bg-[#0d0d12]">
        <div className="text-center">
          <div className="text-[9px] text-gray-600 uppercase mb-0.5">총 실행</div>
          <div className="text-base font-bold text-white tabular-nums">{history.length}회</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-gray-600 uppercase mb-0.5">첫 실행 수익</div>
          <div className={`text-base font-bold tabular-nums ${firstReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {firstReturn >= 0 ? '+' : ''}{firstReturn.toFixed(1)}%
          </div>
        </div>
        <ArrowRight size={14} className="text-gray-700 shrink-0" />
        <div className="text-center">
          <div className="text-[9px] text-gray-600 uppercase mb-0.5">최신 수익</div>
          <div className={`text-base font-bold tabular-nums ${lastReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {lastReturn >= 0 ? '+' : ''}{lastReturn.toFixed(1)}%
          </div>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded bg-opacity-20 shrink-0"
          style={{ backgroundColor: totalDelta > 0 ? 'rgba(34,197,94,0.1)' : totalDelta < 0 ? 'rgba(239,68,68,0.1)' : 'rgba(107,114,128,0.1)' }}>
          <span className={`text-sm font-bold tabular-nums ${totalDelta > 0 ? 'text-green-400' : totalDelta < 0 ? 'text-red-400' : 'text-gray-500'}`}>
            {totalDelta > 0 ? '↑' : totalDelta < 0 ? '↓' : '—'} {Math.abs(totalDelta).toFixed(1)}%p
          </span>
          <span className="text-[9px] text-gray-600 ml-1">변화</span>
        </div>
        <div className="ml-auto text-center">
          <div className="text-[9px] text-gray-600 uppercase mb-0.5">Best Sharpe</div>
          <div className={`text-base font-bold tabular-nums ${bestSharpe >= 1 ? 'text-green-400' : bestSharpe >= 0 ? 'text-gray-300' : 'text-red-400'}`}>
            {bestSharpe.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Iteration table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[10px]">
          <thead className="sticky top-0 bg-[#0d0d12] border-b border-gray-800">
            <tr>
              <th className="px-3 py-2 text-left text-gray-600 w-8">#</th>
              <th className="px-3 py-2 text-left text-gray-600">출처</th>
              <th className="px-3 py-2 text-right text-gray-600">수익률</th>
              <th className="px-3 py-2 text-right text-gray-600 text-[9px]">Δ 전회비</th>
              <th className="px-3 py-2 text-right text-gray-600">Sharpe</th>
              <th className="px-3 py-2 text-right text-gray-600">Max DD</th>
              <th className="px-3 py-2 text-right text-gray-600">Trades</th>
              <th className="px-3 py-2 text-right text-gray-600">Win%</th>
              <th className="px-3 py-2 text-left text-gray-600">파라미터</th>
            </tr>
          </thead>
          <tbody>
            {history.map((run, i) => {
              const isBest   = i === bestIdx;
              const isLatest = i === history.length - 1;
              const prevRet  = i > 0 ? (history[i - 1].performance?.total_return ?? 0) : null;
              const delta    = prevRet !== null ? (run.performance?.total_return ?? 0) - prevRet : null;
              const ret      = run.performance?.total_return ?? 0;
              const sharpe   = run.performance?.sharpe ?? 0;

              return (
                <tr key={run.id}
                  className={`border-b border-gray-800/40 hover:bg-gray-800/20 cursor-pointer transition-colors ${
                    isBest   ? 'bg-green-900/15 border-l-2 border-l-green-500/50' :
                    isLatest ? 'bg-cyan-900/10  border-l-2 border-l-cyan-600/40'  : ''
                  }`}
                  onClick={() => onViewRun?.(run)}
                >
                  <td className="px-3 py-2 tabular-nums">
                    {isBest
                      ? <span className="text-green-400 font-bold">★</span>
                      : isLatest
                        ? <span className="text-cyan-400">●</span>
                        : <span className="text-gray-600">{i + 1}</span>
                    }
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                      run.source === '3d-scan'
                        ? 'bg-purple-900/40 text-purple-300 border border-purple-700/30'
                        : 'bg-gray-800/60 text-gray-400 border border-gray-700/30'
                    }`}>
                      {run.source === '3d-scan' ? '3D Scan' : 'Manual'}
                    </span>
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${ret >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {ret >= 0 ? '+' : ''}{ret.toFixed(2)}%
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums text-[9px] ${
                    delta === null ? 'text-gray-700' : delta > 0 ? 'text-green-500' : delta < 0 ? 'text-red-500' : 'text-gray-600'
                  }`}>
                    {delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${sharpe >= 1 ? 'text-green-400' : sharpe >= 0 ? 'text-gray-300' : 'text-red-400'}`}>
                    {sharpe.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-400">
                    {(run.performance?.max_drawdown ?? 0).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-400">
                    {run.performance?.trade_count ?? 0}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-400">
                    {(run.performance?.win_rate ?? 0).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 max-w-[220px]">
                    <span className="text-gray-600 font-mono text-[9px] truncate block">
                      {Object.entries(run.params || {})
                        .filter(([k, v]) =>
                          !['stop_loss_pct','take_profit_pct','initial_capital','commission_pct',
                            'type','buy_conditions','sell_conditions','buy_logic','sell_logic'].includes(k)
                          && typeof v !== 'object'
                        )
                        .map(([k, v]) => `${k}=${v}`)
                        .join('  ') || '—'
                      }
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer hint */}
      <div className="px-5 py-2 border-t border-gray-800 shrink-0 text-[9px] text-gray-700">
        ★ Best Sharpe  ·  ● 최신 실행  ·  행 클릭 → 해당 결과로 이동
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function QuantResearchDashboard() {
  const navigate = useNavigate();
  const [leftOpen,     setLeftOpen]     = useState(true);
  const [activeResult, setActiveResult] = useState('chart');
  const [loading,      setLoading]      = useState(false);
  const [signals,      setSignals]      = useState([]);
  const [performance,  setPerformance]  = useState(null);
  const [resultTicker, setResultTicker] = useState(null);
  const [chartKey,     setChartKey]     = useState(0);
  const [chartSymbols, setChartSymbols] = useState(['AAPL']);

  // Optimization history — tracks every backtest run
  const [runHistory,   setRunHistory]   = useState([]);

  const [strategies,    setStrategies]    = useState([]);
  const [selectedId,    setSelectedId]    = useState('');
  const [strategyTypes, setStrategyTypes] = useState([]);
  // Passed to 3D Scanner so it mirrors current backtest strategy/params
  const [strategyCtx,  setStrategyCtx]   = useState(null);

  const [ticker,     setTicker]     = useState('AAPL');
  const [startDate,  setStartDate]  = useState('2022-01-01');
  const [endDate,    setEndDate]    = useState('2024-12-31');
  const [stopLoss,   setStopLoss]   = useState(5);
  const [takeProfit, setTakeProfit] = useState(15);
  const [capital,    setCapital]    = useState(10000);
  const [commission, setCommission] = useState(0.1);

  const loadStrategies = () =>
    quantAPI.listStrategies().then(res => setStrategies(res.data || [])).catch(() => {});

  useEffect(() => {
    loadStrategies();
    quantAPI.strategyTypes().then(res => setStrategyTypes(res.data || [])).catch(() => {});
  }, []);

  // ── Core backtest runner ──────────────────────────────────────────────────
  // afterTab  : which tab to switch to after success
  // historyEntry: if provided, adds run to optimization history
  const runBacktest = useCallback(async (payload, { afterTab = 'chart', historyEntry = null } = {}) => {
    setLoading(true);
    setSignals([]);
    setPerformance(null);
    try {
      const res = await quantAPI.analyze(payload);
      const { ticker: sym, signals: sigs, performance: perf } = res.data;
      setResultTicker(sym);
      setSignals(sigs || []);
      setPerformance(perf || null);
      if (sym !== chartSymbols[0]) {
        setChartSymbols([sym]);
        setChartKey(k => k + 1);
      }
      setActiveResult(afterTab);

      // Record this run in history
      if (historyEntry) {
        setRunHistory(prev => [...prev, {
          id:          Date.now(),
          source:      historyEntry.source,
          ticker:      sym,
          stratType:   historyEntry.stratType,
          params:      historyEntry.params,
          performance: perf,
        }]);
      }

      toast.success(`${sym} 백테스트 완료 — ${perf?.trade_count ?? 0}개 거래`);
    } catch (err) {
      toast.error(err.message || '백테스트 실패');
    } finally {
      setLoading(false);
    }
  }, [chartSymbols]);

  // ── Manual Run Backtest ───────────────────────────────────────────────────
  const handleRun = () => {
    const strategy = strategies.find(s => String(s.id) === String(selectedId));
    if (!strategy) { toast.error('전략을 선택하세요'); return; }
    if (!ticker)   { toast.error('Ticker를 입력하세요'); return; }

    let params = {};
    try { params = JSON.parse(strategy.parameters || '{}'); } catch {}

    const {
      stop_loss_pct: _sl, take_profit_pct: _tp, initial_capital: _ic, commission_pct: _cp,
      buy_conditions: buyConds, sell_conditions: sellConds,
      buy_logic: buyLogic, sell_logic: sellLogic,
      ...numericParams
    } = params;

    const fullStrategy = {
      type:            strategy.strategy_type,
      stop_loss_pct:   stopLoss,
      take_profit_pct: takeProfit,
      initial_capital: capital,
      commission_pct:  commission,
      buy_conditions:  buyConds,
      sell_conditions: sellConds,
      buy_logic:       buyLogic,
      sell_logic:      sellLogic,
      ...numericParams,
    };

    // Sync 3D scanner — include conditions + selectedFactors for named param scanning
    let selectedFactors = [];
    try { selectedFactors = JSON.parse(strategy.variables || '[]'); } catch {}

    setStrategyCtx({
      type:            strategy.strategy_type,
      params:          numericParams,
      buy_conditions:  buyConds,
      sell_conditions: sellConds,
      buy_logic:       buyLogic,
      sell_logic:      sellLogic,
      selectedFactors,
    });

    runBacktest(
      { ticker, start_date: startDate, end_date: endDate, strategy: fullStrategy },
      {
        afterTab:     'chart',
        historyEntry: { source: 'manual', stratType: strategy.strategy_type, params: fullStrategy },
      },
    );
  };

  // ── Apply params from 3D Scan → update DB + re-run ───────────────────────
  const handleApplyParams = async (newParams) => {
    const strategy = strategies.find(s => String(s.id) === String(selectedId));
    if (!strategy) { toast.error('전략이 선택되지 않았습니다'); return; }
    if (!ticker)   { toast.error('Ticker를 입력하세요'); return; }

    let existing = {};
    try { existing = JSON.parse(strategy.parameters || '{}'); } catch {}

    let updatedVariables = strategy.variables;
    let buyConds    = existing.buy_conditions;
    let sellConds   = existing.sell_conditions;
    const buyLogic  = existing.buy_logic  || 'AND';
    const sellLogic = existing.sell_logic || 'OR';

    let selectedFactors = [];
    try { selectedFactors = JSON.parse(strategy.variables || '[]'); } catch {}

    if (strategy.strategy_type === 'custom' && selectedFactors.length > 0) {
      // Custom strategy: substitute scan params back into condition templates
      // and update selectedFactors with new param values
      const { buyTemplate, sellTemplate } = buildConditionTemplates(
        selectedFactors, buyConds, sellConds,
      );
      buyConds  = substituteTemplate(buyTemplate,  newParams);
      sellConds = substituteTemplate(sellTemplate, newParams);
      const updatedFactors = applyParamsToFactors(selectedFactors, newParams);
      updatedVariables = JSON.stringify(updatedFactors);
      selectedFactors  = updatedFactors;
    }

    const merged = {
      ...existing,
      buy_conditions:  buyConds,
      sell_conditions: sellConds,
      buy_logic:       buyLogic,
      sell_logic:      sellLogic,
      // For preset strategies: also merge numeric scan params directly
      ...(strategy.strategy_type !== 'custom' ? newParams : {}),
    };

    try {
      await quantAPI.updateStrategy(selectedId, {
        name:           strategy.name,
        strategy_type:  strategy.strategy_type,
        formula:        strategy.formula,
        variables:      updatedVariables,
        buy_condition:  strategy.buy_condition,
        sell_condition: strategy.sell_condition,
        parameters:     JSON.stringify(merged),
        notes:          strategy.notes,
      });
      loadStrategies();
    } catch (err) {
      toast.error(err.message || '전략 업데이트 실패');
      return;
    }

    const {
      stop_loss_pct: _sl, take_profit_pct: _tp, initial_capital: _ic, commission_pct: _cp,
      buy_conditions: _bc, sell_conditions: _sc, buy_logic: _bl, sell_logic: _sl2,
      ...numericParams
    } = merged;

    const fullStrategy = {
      type:            strategy.strategy_type,
      stop_loss_pct:   stopLoss,
      take_profit_pct: takeProfit,
      initial_capital: capital,
      commission_pct:  commission,
      buy_conditions:  buyConds,
      sell_conditions: sellConds,
      buy_logic:       buyLogic,
      sell_logic:      sellLogic,
      ...numericParams,
    };

    setStrategyCtx({
      type:            strategy.strategy_type,
      params:          numericParams,
      buy_conditions:  buyConds,
      sell_conditions: sellConds,
      buy_logic:       buyLogic,
      sell_logic:      sellLogic,
      selectedFactors,
    });

    toast.success('파라미터 적용 — 백테스트 재실행 중…');

    runBacktest(
      { ticker, start_date: startDate, end_date: endDate, strategy: fullStrategy },
      {
        afterTab:     'metrics',
        historyEntry: { source: '3d-scan', stratType: strategy.strategy_type, params: fullStrategy },
      },
    );
  };

  // ── History row click → show that run's metrics ───────────────────────────
  const handleViewRun = useCallback((run) => {
    if (run.performance) {
      setPerformance(run.performance);
      setActiveResult('metrics');
    }
  }, []);

  const referencePoints = useMemo(() =>
    signals.map(s => ({
      x: s.date, y: s.price,
      color:   s.type === 'buy' ? '#22c55e' : '#ef4444',
      label:   s.type === 'buy' ? '▲' : '▼',
      tooltip: `${s.type === 'buy' ? '▲ BUY' : '▼ SELL'}\n$${s.price?.toFixed(2)}\n${s.reason}`,
    })),
    [signals],
  );

  const selectedStrategy = strategies.find(s => String(s.id) === String(selectedId));

  // ── Tab disabled logic ────────────────────────────────────────────────────
  const isTabDisabled = (id) => {
    if (id === 'chart')   return false;
    if (id === 'history') return runHistory.length === 0;
    if (id === 'scan3d')  return !strategyCtx;
    return !performance;
  };

  return (
    <div className="flex bg-[#0a0a0f] overflow-hidden" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── Left Panel ─────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 overflow-hidden border-r border-gray-800"
        style={{ width: leftOpen ? 300 : 0, transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)' }}
      >
        <div className="flex flex-col h-full bg-[#0d0d12]" style={{ width: 300 }}>

          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
            <span className="text-xs font-semibold text-white">Quant Research</span>
            <button
              onClick={() => navigate('/strategy')}
              className="flex items-center gap-1 text-[10px] text-cyan-500 hover:text-cyan-300 transition-colors"
              title="Strategy Lab에서 전략 편집"
            >
              <FlaskConical size={11} /> Strategy Lab
            </button>
          </div>

          {/* Optimization flow guide */}
          <div className="px-4 py-2.5 border-b border-gray-800/50 bg-[#060608] shrink-0">
            <div className="flex items-center gap-1.5 text-[9px] text-gray-600">
              <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">1</span>
              <span>전략 선택</span>
              <ArrowRight size={8} className="text-gray-700" />
              <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">2</span>
              <span>Backtest</span>
              <ArrowRight size={8} className="text-gray-700" />
              <span className="px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-500">3</span>
              <span className="text-purple-600">3D Scan</span>
              <ArrowRight size={8} className="text-gray-700" />
              <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">4</span>
              <span>반복</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">

            {/* Strategy selection */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <FieldLabel>Strategy</FieldLabel>
                <button onClick={loadStrategies} className="p-1 text-gray-600 hover:text-gray-400 transition-colors" title="Refresh">
                  <RefreshCw size={10} />
                </button>
              </div>
              <SavedSelector
                strategies={strategies}
                selectedId={selectedId}
                onSelect={setSelectedId}
                strategyTypes={strategyTypes}
              />

              {selectedStrategy && (
                <div className="bg-[#060608] border border-gray-800 rounded-lg p-3 space-y-1.5">
                  {selectedStrategy.buy_condition && (
                    <div className="text-[10px]">
                      <span className="text-green-400 font-mono">▲ </span>
                      <span className="text-gray-400">{selectedStrategy.buy_condition}</span>
                    </div>
                  )}
                  {selectedStrategy.sell_condition && (
                    <div className="text-[10px]">
                      <span className="text-red-400 font-mono">▼ </span>
                      <span className="text-gray-400">{selectedStrategy.sell_condition}</span>
                    </div>
                  )}
                  {(() => {
                    let p = {};
                    try { p = JSON.parse(selectedStrategy.parameters || '{}'); } catch {}
                    // Only show scalar (numeric/string) params — skip condition objects/arrays
                    const SKIP_KEYS = ['stop_loss_pct','take_profit_pct','initial_capital',
                      'commission_pct','buy_conditions','sell_conditions','buy_logic','sell_logic'];
                    const entries = Object.entries(p).filter(([k, v]) =>
                      !SKIP_KEYS.includes(k) && typeof v !== 'object'
                    );
                    if (!entries.length) return null;
                    return (
                      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-800/50">
                        {entries.map(([k, v]) => (
                          <span key={k} className="text-[9px] font-mono text-cyan-700">
                            {k}=<span className="text-cyan-400">{String(v)}</span>
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </section>

            {/* Execution settings */}
            <section className="space-y-2">
              <FieldLabel>Execution Settings</FieldLabel>
              <ExecutionSettings
                ticker={ticker}       setTicker={setTicker}
                startDate={startDate} setStartDate={setStartDate}
                endDate={endDate}     setEndDate={setEndDate}
                stopLoss={stopLoss}   setStopLoss={setStopLoss}
                takeProfit={takeProfit} setTakeProfit={setTakeProfit}
                capital={capital}     setCapital={setCapital}
                commission={commission} setCommission={setCommission}
              />
            </section>

            <button
              onClick={handleRun}
              disabled={loading || !selectedId}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-xs font-semibold rounded transition-colors"
            >
              {loading
                ? <><span className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" /> Running…</>
                : <><Play size={13} /> Run Backtest</>
              }
            </button>

            {/* Quick jump hints after first run */}
            {strategyCtx && (
              <div className="space-y-1.5 pt-1">
                <button
                  onClick={() => setActiveResult('scan3d')}
                  className="w-full flex items-center justify-center gap-1.5 py-2 border border-purple-800/50 text-purple-400 hover:bg-purple-900/20 text-[11px] font-medium rounded transition-colors"
                >
                  <span className="text-[10px]">⬡</span> 3D Scan으로 최적화
                </button>
                {runHistory.length > 0 && (
                  <button
                    onClick={() => setActiveResult('history')}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    <History size={11} /> 실행 이력 {runHistory.length}회
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Right Panel ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0d0d12]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setLeftOpen(o => !o)}
              className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors">
              {leftOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
            <span className="text-sm font-semibold text-white">Quant Research</span>
            {resultTicker && (
              <span className="text-[11px] font-medium text-cyan-400 bg-cyan-900/20 border border-cyan-800/40 rounded px-2 py-0.5 tabular-nums">
                {resultTicker}
              </span>
            )}
            {runHistory.length > 1 && (
              <span className="text-[10px] text-gray-600">
                최적화 {runHistory.length}회 실행
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            {performance && !loading && (
              <span>
                {performance.trade_count} trades ·
                <span className={performance.total_return >= 0 ? ' text-green-400' : ' text-red-400'}>
                  {' '}{performance.total_return >= 0 ? '+' : ''}{performance.total_return?.toFixed(2)}%
                </span>
                {' '}· Sharpe{' '}
                <span className={(performance.sharpe ?? 0) >= 1 ? 'text-green-400' : 'text-gray-400'}>
                  {(performance.sharpe ?? 0).toFixed(2)}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800 shrink-0">
          {RESULT_TABS.map(({ id, label, color }) => {
            const disabled = isTabDisabled(id);
            const isActive = activeResult === id;
            const colorMap = {
              purple: { active: 'text-purple-400 bg-purple-400/10', idle: 'text-purple-500 hover:text-purple-300 hover:bg-purple-900/20' },
              amber:  { active: 'text-amber-400 bg-amber-400/10',   idle: 'text-amber-600  hover:text-amber-400  hover:bg-amber-900/20'  },
            };
            const colorCls = color ? colorMap[color] : null;
            return (
              <button
                key={id}
                onClick={() => !disabled && setActiveResult(id)}
                className={`relative px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  isActive
                    ? (colorCls ? colorCls.active : 'text-cyan-400 bg-cyan-400/10')
                    : disabled
                      ? 'text-gray-700 cursor-not-allowed'
                      : (colorCls ? colorCls.idle : 'text-gray-400 hover:text-white hover:bg-gray-800')
                }`}
              >
                {label}
                {id === 'history' && runHistory.length > 0 && (
                  <span className="ml-1 text-[8px] bg-amber-900/50 text-amber-400 rounded-full px-1 tabular-nums">
                    {runHistory.length}
                  </span>
                )}
              </button>
            );
          })}
          {loading && (
            <div className="flex items-center gap-1.5 ml-3 text-xs text-cyan-400">
              <span className="w-3 h-3 border border-cyan-500 border-t-transparent rounded-full animate-spin" />
              Running…
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">

          {/* Chart — always mounted to preserve state */}
          <div className={`h-full ${activeResult === 'chart' ? '' : 'hidden'}`}>
            <ChartWidget
              key={chartKey}
              widgetId="quant-chart"
              initialSymbols={chartSymbols}
              referencePoints={referencePoints}
              showAddStock={false}
              showPairAnalysis={false}
            />
          </div>

          {activeResult === 'equity' && (
            <div className="h-full">
              <EquityCurveChart
                equityCurve={performance?.equity_curve ?? null}
                performance={performance}
                ticker={resultTicker}
              />
            </div>
          )}

          {activeResult === 'metrics' && (
            <div className="h-full overflow-y-auto p-5">
              {performance
                ? <>
                    {/* Before/After comparison strip when multiple runs exist */}
                    {runHistory.length >= 2 && (() => {
                      const prev = runHistory[runHistory.length - 2];
                      const curr = runHistory[runHistory.length - 1];
                      if (!prev || !curr) return null;
                      const retDelta    = (curr.performance?.total_return  ?? 0) - (prev.performance?.total_return  ?? 0);
                      const sharpeDelta = (curr.performance?.sharpe        ?? 0) - (prev.performance?.sharpe        ?? 0);
                      const ddDelta     = (curr.performance?.max_drawdown  ?? 0) - (prev.performance?.max_drawdown  ?? 0);
                      return (
                        <div className="mb-5 p-3 bg-[#060608] border border-gray-800 rounded-lg">
                          <div className="text-[9px] text-gray-600 uppercase mb-2 tracking-wider">전회 대비 변화</div>
                          <div className="flex items-center gap-4 flex-wrap">
                            {[
                              { label: '수익률', val: retDelta,    fmt: v => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`  },
                              { label: 'Sharpe', val: sharpeDelta, fmt: v => `${v > 0 ? '+' : ''}${v.toFixed(3)}`   },
                              { label: 'Max DD', val: -ddDelta,    fmt: v => `${v > 0 ? '+' : ''}${(-v).toFixed(1)}%` },
                            ].map(({ label, val, fmt }) => (
                              <div key={label} className="text-center">
                                <div className="text-[9px] text-gray-600 mb-0.5">{label}</div>
                                <div className={`text-sm font-bold tabular-nums ${val > 0 ? 'text-green-400' : val < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                  {fmt(val)}
                                </div>
                              </div>
                            ))}
                            {curr.source === '3d-scan' && (
                              <span className="ml-auto text-[9px] px-2 py-1 rounded bg-purple-900/30 text-purple-400 border border-purple-700/30">
                                3D Scan 적용 결과
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    <QuantPerformance performance={performance} ticker={resultTicker} section="metrics" />
                  </>
                : <EmptyState message="전략을 선택하고 Run Backtest를 클릭하면 성과 지표가 표시됩니다" />
              }
            </div>
          )}

          {activeResult === 'trades' && (
            <div className="h-full overflow-y-auto p-5">
              {performance?.trades?.length > 0
                ? <QuantPerformance performance={performance} ticker={resultTicker} section="trades" />
                : <EmptyState message="백테스트 실행 후 거래 내역이 표시됩니다" />
              }
            </div>
          )}

          {/* 3D Scan — keep mounted to preserve results across tab switches */}
          {strategyCtx && (
            <div className="h-full overflow-hidden" style={{ display: activeResult === 'scan3d' ? 'flex' : 'none', flexDirection: 'column' }}>
              <StrategyScanner3D
                ticker={ticker}
                startDate={startDate}
                endDate={endDate}
                strategyCtx={strategyCtx}
                strategyTypes={strategyTypes}
                commission={commission}
                onApplyParams={handleApplyParams}
              />
            </div>
          )}

          {/* Optimization History */}
          {activeResult === 'history' && (
            <RunHistoryPanel history={runHistory} onViewRun={handleViewRun} />
          )}
        </div>
      </div>
    </div>
  );
}
