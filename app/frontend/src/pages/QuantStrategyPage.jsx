import React, { useState, useMemo, useRef } from 'react';
import ChartWidget from '../components/widgets/ChartWidget';
import StrategyBuilder from '../components/quant/StrategyBuilder';
import QuantPerformance from '../components/quant/QuantPerformance';
import { quantAPI } from '../config/api';
import toast from 'react-hot-toast';

const QuantStrategyPage = () => {
  const [loading, setLoading]       = useState(false);
  const [signals, setSignals]       = useState([]);
  const [performance, setPerformance] = useState(null);
  const [ticker, setTicker]         = useState(null);

  // key trick: re-mount ChartWidget when ticker changes so it loads fresh data
  const [chartKey, setChartKey]     = useState(0);
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

      // Update chart if ticker changed
      if (sym !== chartSymbols[0]) {
        setChartSymbols([sym]);
        setChartKey((k) => k + 1);
      }
    } catch (err) {
      toast.error(err.message || 'Strategy analysis failed');
    } finally {
      setLoading(false);
    }
  };

  // Convert signals → referencePoints for ChartWidget
  const referencePoints = useMemo(() =>
    signals.map((s) => ({
      x: s.date,
      y: s.price,
      color: s.type === 'buy' ? '#22c55e' : '#ef4444',
      label: s.type === 'buy' ? '▲' : '▼',
      tooltip: `${s.type === 'buy' ? '▲ BUY' : '▼ SELL'}\n$${s.price.toFixed(2)}\n${s.reason}`,
    })),
    [signals]
  );

  return (
    <div className="flex h-full bg-[#0a0a0f] overflow-hidden">
      {/* ── Left Panel: Strategy Builder ─────────────────────────────────── */}
      <div
        className="w-[280px] min-w-[280px] border-r border-gray-800 bg-[#0d0d12] flex flex-col overflow-y-auto"
        style={{ height: '100%' }}
      >
        <div className="px-4 pt-4 pb-2 border-b border-gray-800">
          <div className="text-sm font-semibold text-white">Quant Strategy Builder</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Single-ticker backtesting</div>
        </div>
        <StrategyBuilder onRun={handleRun} loading={loading} />
      </div>

      {/* ── Right Panel: Chart + Performance ─────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Chart */}
        <div className="flex-1 min-h-0">
          <ChartWidget
            key={chartKey}
            widgetId="quant-chart"
            initialSymbols={chartSymbols}
            referencePoints={referencePoints}
            showAddStock={false}
            showPairAnalysis={false}
          />
        </div>

        {/* Performance (shown only after running) */}
        {performance && (
          <div className="border-t border-gray-800 bg-[#0d0d12] p-4 overflow-y-auto max-h-[45%]">
            <QuantPerformance performance={performance} ticker={ticker} />
          </div>
        )}

        {/* Empty state */}
        {!performance && !loading && (
          <div className="border-t border-gray-800 bg-[#0d0d12] flex items-center justify-center h-24">
            <p className="text-xs text-gray-500">Configure a strategy and click <span className="text-cyan-400">Run Strategy</span> to see results.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuantStrategyPage;
