import React, { useState, useMemo } from 'react';
import { BookOpen, FolderOpen, Search, Cpu } from 'lucide-react';
import ChartWidget from '../components/widgets/ChartWidget';
import QuantPerformance from '../components/quant/QuantPerformance';
import EncyclopediaTab from '../components/quant/EncyclopediaTab';
import MyStrategiesTab from '../components/quant/MyStrategiesTab';
import ScannerTab from '../components/quant/ScannerTab';
import StrategyBuilderTab from '../components/quant/StrategyBuilderTab';
import { quantAPI } from '../config/api';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'builder',      label: 'Builder',       Icon: Cpu },
  { id: 'encyclopedia', label: 'Encyclopedia',  Icon: BookOpen },
  { id: 'my',           label: 'My Strategies', Icon: FolderOpen },
  { id: 'scanner',      label: 'Scanner',       Icon: Search },
];

const QuantResearchPage = () => {
  const [activeTab, setActiveTab] = useState('builder');
  const [loading, setLoading] = useState(false);
  const [signals, setSignals] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [ticker, setTicker] = useState(null);
  const [chartKey, setChartKey] = useState(0);
  const [chartSymbols, setChartSymbols] = useState(['AAPL']);

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
    } catch (err) {
      toast.error(err.message || '백테스트 실패');
    } finally {
      setLoading(false);
    }
  };

  // Convert signals → referencePoints for ChartWidget
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
    <div className="flex h-full bg-[#0a0a0f] overflow-hidden" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── Left Panel ────────────────────────────────────────────────────── */}
      <div className="w-[420px] min-w-[420px] border-r border-gray-800 bg-[#0d0d12] flex flex-col overflow-hidden">

        {/* Tab Bar */}
        <div className="flex border-b border-gray-800 shrink-0">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-medium transition-colors border-b-2 ${
                activeTab === id
                  ? 'border-cyan-500 text-cyan-300 bg-cyan-900/10'
                  : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'builder'      && <StrategyBuilderTab onRun={handleRun} />}
          {activeTab === 'encyclopedia' && <EncyclopediaTab onRun={handleRun} />}
          {activeTab === 'my'           && <MyStrategiesTab onRun={handleRun} />}
          {activeTab === 'scanner'      && <ScannerTab onRun={handleRun} />}
        </div>
      </div>

      {/* ── Right Panel ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Loading bar */}
        {loading && (
          <div className="h-0.5 bg-gray-800 shrink-0">
            <div className="h-full bg-cyan-500 animate-pulse" style={{ width: '60%' }} />
          </div>
        )}

        {/* Chart */}
        <div className="flex-1 min-h-0">
          <ChartWidget
            key={chartKey}
            widgetId="quant-research-chart"
            initialSymbols={chartSymbols}
            referencePoints={referencePoints}
            showAddStock={false}
            showPairAnalysis={false}
          />
        </div>

        {/* Performance (after run) */}
        {performance ? (
          <div className="border-t border-gray-800 bg-[#0d0d12] p-4 overflow-y-auto"
            style={{ maxHeight: '45%', minHeight: '120px' }}>
            <QuantPerformance performance={performance} ticker={ticker} />
          </div>
        ) : (
          <div className="border-t border-gray-800 bg-[#0d0d12] flex items-center justify-center shrink-0 h-16">
            <p className="text-[11px] text-gray-600">
              {loading
                ? '백테스트 실행 중…'
                : '전략을 선택하고 ▶ Run Backtest를 클릭하면 결과가 여기 표시됩니다'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuantResearchPage;
