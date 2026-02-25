import React, { useState, useMemo, useRef } from 'react';
import {
  BookOpen, FolderOpen, Search, Cpu, FlaskConical,
  BarChart2, Activity, Table2, ChevronLeft, ChevronRight,
  GripVertical, X,
} from 'lucide-react';
import ChartWidget from '../components/widgets/ChartWidget';
import QuantPerformance from '../components/quant/QuantPerformance';
import EncyclopediaTab from '../components/quant/EncyclopediaTab';
import MyStrategiesTab from '../components/quant/MyStrategiesTab';
import ScannerTab from '../components/quant/ScannerTab';
import StrategyBuilderTab from '../components/quant/StrategyBuilderTab';
import FactorBuilderTab from '../components/quant/FactorBuilderTab';
import { quantAPI } from '../config/api';
import toast from 'react-hot-toast';

// ── Constants ────────────────────────────────────────────────────────────────

const PANEL_WIDTH = 400;
const SWIPE_THRESHOLD = 80;

const LEFT_TABS = [
  { id: 'builder',      label: 'Builder',       Icon: Cpu },
  { id: 'factors',      label: 'Factors',       Icon: FlaskConical },
  { id: 'encyclopedia', label: 'Encyclopedia',  Icon: BookOpen },
  { id: 'my',           label: 'My Strategies', Icon: FolderOpen },
  { id: 'scanner',      label: 'Scanner',       Icon: Search },
];

// Category tabs — styled like InstitutionalPortfolios CATEGORIES
const RESULT_TABS = [
  { id: 'chart',   label: 'Chart' },
  { id: 'metrics', label: 'Performance' },
  { id: 'trades',  label: 'Trades' },
];

// ── Main Component ────────────────────────────────────────────────────────────

const QuantResearchPage = () => {
  const [activeLeftTab, setActiveLeftTab]   = useState('builder');
  const [activeResult, setActiveResult]     = useState('chart');
  const [loading, setLoading]               = useState(false);
  const [signals, setSignals]               = useState([]);
  const [performance, setPerformance]       = useState(null);
  const [ticker, setTicker]                 = useState(null);
  const [chartKey, setChartKey]             = useState(0);
  const [chartSymbols, setChartSymbols]     = useState(['AAPL']);

  // Left panel open/close + swipe ──────────────────────────────────────────
  const [leftOpen, setLeftOpen]   = useState(true);
  const [dragX, setDragX]         = useState(0);
  const [dragging, setDragging]   = useState(false);
  const dragStart                 = useRef(0);

  const onSwipeStart = (e) => {
    if (e.target.closest('button, input, select, textarea, a, [role="button"]')) return;
    dragStart.current = e.clientX;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onSwipeMove = (e) => {
    if (!dragging) return;
    const delta = e.clientX - dragStart.current;
    setDragX(delta < 0 ? Math.max(delta, -PANEL_WIDTH) : 0);
  };
  const onSwipeEnd = () => {
    if (!dragging) return;
    if (dragX < -SWIPE_THRESHOLD) setLeftOpen(false);
    setDragging(false);
    setDragX(0);
  };

  // Run backtest ────────────────────────────────────────────────────────────
  const handleRun = async (payload) => {
    setLoading(true);
    setSignals([]);
    setPerformance(null);
    try {
      const res = await quantAPI.analyze(payload);
      const { ticker: sym, signals: sigs, performance: perf } = res.data;
      setTicker(sym);
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

  const referencePoints = useMemo(() =>
    signals.map(s => ({
      x: s.date,
      y: s.price,
      color: s.type === 'buy' ? '#22c55e' : '#ef4444',
      label: s.type === 'buy' ? '▲' : '▼',
      tooltip: `${s.type === 'buy' ? '▲ BUY' : '▼ SELL'}\n$${s.price.toFixed(2)}\n${s.reason}`,
    })),
    [signals]
  );

  return (
    <div
      className="flex h-full bg-[#0a0a0f] overflow-hidden"
      style={{ height: 'calc(100vh - 56px)' }}
    >

      {/* ── Left Panel (swipe-to-dismiss) ─────────────────────────────────── */}
      <div
        className="flex-shrink-0 overflow-hidden"
        style={{
          width: leftOpen ? PANEL_WIDTH : 0,
          transition: dragging ? 'none' : 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div
          className="flex flex-col h-full border-r border-gray-800 bg-[#0d0d12]"
          style={{
            width: PANEL_WIDTH,
            transform: `translateX(${dragging ? dragX : 0}px)`,
            transition: dragging ? 'none' : 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          }}
          onPointerDown={onSwipeStart}
          onPointerMove={onSwipeMove}
          onPointerUp={onSwipeEnd}
          onPointerCancel={onSwipeEnd}
        >
          {/* ── Left panel header ── */}
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <GripVertical size={14} className="text-gray-600" />
              <span className="text-sm font-semibold text-white">Strategy Builder</span>
            </div>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={() => setLeftOpen(false)}
              className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="닫기 (왼쪽으로 밀어도 닫힘)"
            >
              <X size={13} />
            </button>
          </div>

          {/* ── Left panel category tabs (pill style) ── */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800 overflow-x-auto shrink-0 cursor-grab active:cursor-grabbing select-none">
            {LEFT_TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onPointerDown={e => e.stopPropagation()}
                onClick={() => setActiveLeftTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded transition-colors ${
                  activeLeftTab === id
                    ? 'text-cyan-400 bg-cyan-400/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Icon size={11} />
                {label}
              </button>
            ))}
          </div>

          {/* ── Tab content ── */}
          <div className="flex-1 overflow-hidden">
            {activeLeftTab === 'builder'      && <StrategyBuilderTab onRun={handleRun} />}
            {activeLeftTab === 'factors'      && <FactorBuilderTab />}
            {activeLeftTab === 'encyclopedia' && <EncyclopediaTab onRun={handleRun} />}
            {activeLeftTab === 'my'           && <MyStrategiesTab onRun={handleRun} />}
            {activeLeftTab === 'scanner'      && <ScannerTab onRun={handleRun} />}
          </div>
        </div>
      </div>

      {/* ── Right Widget ─────────────────────────────────────────────────────── */}
      {/*  Matches InstitutionalPortfolios / TabWidgetWrapper pattern exactly  */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0d0d12] border border-gray-800">

        {/* Widget Header Row — title + controls */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            {/* Re-open left panel button */}
            {!leftOpen && (
              <button
                onClick={() => setLeftOpen(true)}
                className="p-1 rounded text-gray-500 hover:text-cyan-400 hover:bg-gray-800 transition-colors"
                title="패널 열기"
              >
                <ChevronRight size={14} />
              </button>
            )}
            {leftOpen && (
              <button
                onClick={() => setLeftOpen(false)}
                className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
                title="패널 닫기"
              >
                <ChevronLeft size={14} />
              </button>
            )}

            <span className="text-sm font-semibold text-white">Quant Research</span>

            {ticker && (
              <span className="text-[11px] font-medium text-cyan-400 bg-cyan-900/20 border border-cyan-800/40 rounded px-2 py-0.5 tabular-nums">
                {ticker}
              </span>
            )}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            {performance && (
              <span className="text-[11px]">
                {performance.trade_count} trades · {performance.total_return >= 0 ? '+' : ''}{performance.total_return?.toFixed(2)}% return
              </span>
            )}
          </div>
        </div>

        {/* Category Tab Row — LEFT-aligned pills, like InstitutionalPortfolios */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800 overflow-x-auto shrink-0">
          {RESULT_TABS.map(({ id, label }) => {
            const disabled = id !== 'chart' && !performance;
            return (
              <button
                key={id}
                onClick={() => !disabled && setActiveResult(id)}
                className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded transition-colors ${
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

          {/* Loading indicator */}
          {loading && (
            <div className="flex items-center gap-1.5 ml-2 text-xs text-cyan-400">
              <div className="w-3 h-3 border border-cyan-500 border-t-transparent rounded-full animate-spin" />
              <span>Running...</span>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-hidden">

          {/* Chart — always mounted to preserve state, hidden when not active */}
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

          {/* Performance Metrics */}
          {activeResult === 'metrics' && (
            <div className="h-full overflow-y-auto p-4">
              {performance ? (
                <QuantPerformance performance={performance} ticker={ticker} section="metrics" />
              ) : (
                <EmptyState message="전략을 선택하고 ▶ Run Backtest를 클릭하면 성과 지표가 여기 표시됩니다" />
              )}
            </div>
          )}

          {/* Trades History */}
          {activeResult === 'trades' && (
            <div className="h-full overflow-y-auto p-4">
              {performance?.trades?.length > 0 ? (
                <QuantPerformance performance={performance} ticker={ticker} section="trades" />
              ) : (
                <EmptyState message="백테스트 실행 후 거래 내역이 여기 표시됩니다" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Empty state ───────────────────────────────────────────────────────────────

const EmptyState = ({ message }) => (
  <div className="h-full flex items-center justify-center">
    <p className="text-[11px] text-gray-600 text-center max-w-xs leading-relaxed">{message}</p>
  </div>
);

export default QuantResearchPage;
