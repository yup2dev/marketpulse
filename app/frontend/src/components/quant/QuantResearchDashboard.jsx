/**
 * QuantResearchDashboard — Strategy Execution
 *
 * Left panel  : strategy selector + execution settings + run
 * Right panel : chart · performance · trades results
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Play, RefreshCw, ChevronLeft, ChevronRight,
  FlaskConical, ExternalLink, TrendingUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ChartWidget from '../widgets/ChartWidget';
import QuantPerformance from './QuantPerformance';
import { quantAPI } from '../../config/api';

// ── Constants ─────────────────────────────────────────────────────────────────

const RESULT_TABS = [
  { id: 'chart',   label: 'Chart' },
  { id: 'metrics', label: 'Performance' },
  { id: 'trades',  label: 'Trades' },
];

const STRATEGY_TYPE_LABELS = {
  ema_cross:   'EMA Cross',
  rsi:         'RSI',
  macd_cross:  'MACD',
  bb_breakout: 'BB Breakout',
  custom:      'Custom',
};

// ── Empty State ───────────────────────────────────────────────────────────────

const EmptyState = ({ message }) => (
  <div className="h-full flex flex-col items-center justify-center text-center px-8">
    <TrendingUp size={36} className="text-gray-700 mb-3" />
    <p className="text-xs text-gray-600 leading-relaxed max-w-xs">{message}</p>
  </div>
);

// ── Field helpers ─────────────────────────────────────────────────────────────

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

const SavedSelector = ({ strategies, selectedId, onSelect }) => {
  if (!strategies.length) {
    return (
      <div className="text-[11px] text-gray-600 italic py-2">저장된 전략이 없습니다</div>
    );
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
          {s.name}  [{STRATEGY_TYPE_LABELS[s.strategy_type] || s.strategy_type}]
        </option>
      ))}
    </select>
  );
};

// ── Execution Settings ────────────────────────────────────────────────────────

const ExecutionSettings = ({
  ticker, setTicker,
  startDate, setStartDate,
  endDate, setEndDate,
  stopLoss, setStopLoss,
  takeProfit, setTakeProfit,
  capital, setCapital,
}) => (
  <div className="space-y-3">
    <div className="flex flex-col gap-1">
      <FieldLabel>Ticker</FieldLabel>
      <TextInput
        value={ticker}
        onChange={e => setTicker(e.target.value.toUpperCase())}
        placeholder="AAPL"
        className="w-full uppercase"
      />
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
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Stop Loss %', val: stopLoss,   set: setStopLoss,   step: 0.5 },
          { label: 'Take Profit %', val: takeProfit, set: setTakeProfit, step: 0.5 },
          { label: 'Capital $',   val: capital,    set: setCapital,    step: 1000 },
        ].map(({ label, val, set, step }) => (
          <div key={label} className="flex flex-col gap-1">
            <span className="text-[8px] text-gray-600 uppercase leading-tight">{label}</span>
            <input
              type="number"
              value={val}
              onChange={e => set(Number(e.target.value))}
              step={step}
              className="w-full px-1.5 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500 tabular-nums"
            />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────

const QuantResearchDashboard = () => {
  const navigate = useNavigate();

  const [leftOpen, setLeftOpen] = useState(true);
  const [activeResult, setActiveResult] = useState('chart');
  const [loading,      setLoading]      = useState(false);
  const [signals,      setSignals]      = useState([]);
  const [performance,  setPerformance]  = useState(null);
  const [ticker,       setResultTicker] = useState(null);
  const [chartKey,     setChartKey]     = useState(0);
  const [chartSymbols, setChartSymbols] = useState(['AAPL']);

  const [strategies,    setStrategies]    = useState([]);
  const [selectedId,    setSelectedId]    = useState('');

  const [ticker2,     setTicker2]     = useState('AAPL');
  const [startDate,   setStartDate]   = useState('2022-01-01');
  const [endDate,     setEndDate]     = useState('2024-12-31');
  const [stopLoss,    setStopLoss]    = useState(5);
  const [takeProfit,  setTakeProfit]  = useState(15);
  const [capital,     setCapital]     = useState(10000);

  useEffect(() => {
    quantAPI.listStrategies()
      .then(res => setStrategies(res.data || []))
      .catch(() => {});
  }, []);

  const runBacktest = async (payload) => {
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
      setActiveResult('chart');
    } catch (err) {
      toast.error(err.message || '백테스트 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleSavedRun = () => {
    const strategy = strategies.find(s => String(s.id) === String(selectedId));
    if (!strategy) { toast.error('전략을 선택하세요'); return; }

    let params = {};
    try { params = JSON.parse(strategy.parameters || '{}'); } catch {}

    const { stop_loss_pct: _sl, take_profit_pct: _tp, initial_capital: _ic, factor_ids: _fi, ...condParams } = params;

    runBacktest({
      ticker:     ticker2,
      start_date: startDate,
      end_date:   endDate,
      strategy: {
        type:            strategy.strategy_type,
        stop_loss_pct:   stopLoss,
        take_profit_pct: takeProfit,
        initial_capital: capital,
        ...condParams,
      },
    });
  };

  const referencePoints = useMemo(() =>
    signals.map(s => ({
      x: s.date,
      y: s.price,
      color: s.type === 'buy' ? '#22c55e' : '#ef4444',
      label: s.type === 'buy' ? '▲' : '▼',
      tooltip: `${s.type === 'buy' ? '▲ BUY' : '▼ SELL'}\n$${s.price.toFixed(2)}\n${s.reason}`,
    })),
    [signals],
  );

  const selectedStrategy = strategies.find(s => String(s.id) === String(selectedId));

  return (
    <div className="flex bg-[#0a0a0f] overflow-hidden" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── Left Panel ─────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 overflow-hidden border-r border-gray-800"
        style={{
          width: leftOpen ? 300 : 0,
          transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div className="flex flex-col h-full bg-[#0d0d12]" style={{ width: 300 }}>

          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
            <span className="text-xs font-semibold text-white">Backtest</span>
            <button
              onClick={() => navigate('/strategy')}
              className="flex items-center gap-1 text-[10px] text-cyan-500 hover:text-cyan-300 transition-colors"
              title="Strategy Lab으로 이동"
            >
              <FlaskConical size={11} /> Strategy Lab
              <ExternalLink size={10} className="ml-0.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <FieldLabel>Strategy</FieldLabel>
                <button
                  onClick={() => { quantAPI.listStrategies().then(r => setStrategies(r.data || [])).catch(() => {}); }}
                  className="p-1 text-gray-600 hover:text-gray-400 transition-colors"
                  title="새로고침"
                >
                  <RefreshCw size={10} />
                </button>
              </div>
              <SavedSelector
                strategies={strategies}
                selectedId={selectedId}
                onSelect={setSelectedId}
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
                </div>
              )}
            </section>

            <section className="space-y-2">
              <FieldLabel>Execution Settings</FieldLabel>
              <ExecutionSettings
                ticker={ticker2}      setTicker={setTicker2}
                startDate={startDate} setStartDate={setStartDate}
                endDate={endDate}     setEndDate={setEndDate}
                stopLoss={stopLoss}   setStopLoss={setStopLoss}
                takeProfit={takeProfit} setTakeProfit={setTakeProfit}
                capital={capital}     setCapital={setCapital}
              />
            </section>

            <button
              onClick={handleSavedRun}
              disabled={loading || !selectedId}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-xs font-semibold rounded transition-colors"
            >
              {loading
                ? <><span className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" /> Running…</>
                : <><Play size={13} /> Run Backtest</>
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── Right Panel ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0d0d12]">

        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLeftOpen(o => !o)}
              className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              title={leftOpen ? '패널 닫기' : '패널 열기'}
            >
              {leftOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>

            <span className="text-sm font-semibold text-white">Quant Research</span>

            {ticker && (
              <span className="text-[11px] font-medium text-cyan-400 bg-cyan-900/20 border border-cyan-800/40 rounded px-2 py-0.5 tabular-nums">
                {ticker}
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
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800 shrink-0">
          {RESULT_TABS.map(({ id, label }) => {
            const disabled = id !== 'chart' && !performance;
            return (
              <button
                key={id}
                onClick={() => !disabled && setActiveResult(id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  activeResult === id
                    ? 'text-cyan-400 bg-cyan-400/10'
                    : disabled
                      ? 'text-gray-600 cursor-not-allowed'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {label}
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

        <div className="flex-1 min-h-0 overflow-hidden">

          <div className={`h-full ${activeResult === 'chart' ? '' : 'hidden'}`}>
            <ChartWidget
              key={chartKey}
              widgetId="quant-research-chart"
              initialSymbols={chartSymbols}
              referencePoints={referencePoints}
              showAddStock={false}
              showPairAnalysis={false}
            />
          </div>

          {activeResult === 'metrics' && (
            <div className="h-full overflow-y-auto p-5">
              {performance ? (
                <QuantPerformance performance={performance} ticker={ticker} section="metrics" />
              ) : (
                <EmptyState message="전략을 선택하고 ▶ Run Backtest를 클릭하면 성과 지표가 표시됩니다" />
              )}
            </div>
          )}

          {activeResult === 'trades' && (
            <div className="h-full overflow-y-auto p-5">
              {performance?.trades?.length > 0 ? (
                <QuantPerformance performance={performance} ticker={ticker} section="trades" />
              ) : (
                <EmptyState message="백테스트 실행 후 거래 내역이 표시됩니다" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuantResearchDashboard;
