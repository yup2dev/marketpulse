import React, { useState, useMemo } from 'react';
import ChartWidget from '../widgets/ChartWidget';
import StrategyBuilder from './StrategyBuilder';
import HestonStrategyTab from './HestonStrategyTab';
import QuantPerformance from './QuantPerformance';
import { quantAPI } from '../../config/api';
import toast from 'react-hot-toast';

const MODES = [
  { id: 'preset',  label: 'Preset' },
  { id: 'heston',  label: 'Heston FFT' },
];

const QuantStrategyDashboard = () => {
  const [mode, setMode]             = useState('preset');
  const [loading, setLoading]       = useState(false);
  const [signals, setSignals]       = useState([]);
  const [performance, setPerformance] = useState(null);
  const [ticker, setTicker]         = useState(null);

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
        className="w-[280px] min-w-[280px] border-r border-gray-800 bg-[#0d0d12] flex flex-col overflow-hidden"
        style={{ height: '100%' }}
      >
        {/* Mode switcher */}
        <div className="px-4 pt-4 pb-2 border-b border-gray-800 shrink-0">
          <div className="text-sm font-semibold text-white mb-2">Quant Strategy Builder</div>
          <div className="flex gap-1">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex-1 py-1 text-[10px] font-semibold rounded border transition-all ${
                  mode === m.id
                    ? m.id === 'heston'
                      ? 'bg-violet-900/40 border-violet-600 text-violet-300'
                      : 'bg-cyan-900/40 border-cyan-600 text-cyan-300'
                    : 'bg-[#0a0a0f] border-gray-700 text-gray-500 hover:border-gray-600'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {mode === 'preset'
            ? <StrategyBuilder onRun={handleRun} loading={loading} />
            : <HestonStrategyTab onRun={handleRun} loading={loading} />
          }
        </div>
      </div>

      {/* ── Right Panel: Chart + Performance ─────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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

        {performance && (
          <div className="border-t border-gray-800 bg-[#0d0d12] p-4 overflow-y-auto max-h-[45%]">
            <QuantPerformance performance={performance} ticker={ticker} />
          </div>
        )}

        {!performance && !loading && (
          <div className="border-t border-gray-800 bg-[#0d0d12] flex items-center justify-center h-24">
            <p className="text-xs text-gray-500">Configure a strategy and click <span className="text-cyan-400">Run Strategy</span> to see results.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuantStrategyDashboard;
