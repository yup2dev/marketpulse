import React, { useState } from 'react';
import { Play, Save, DollarSign, Briefcase, ChevronDown, RefreshCw } from 'lucide-react';
import PortfolioStockSelector from './PortfolioStockSelector';
import {
  DateRangePicker,
  BenchmarkSelector,
  RebalancingSelector
} from '../common';

const SectionLabel = ({ children }) => (
  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{children}</span>
);

const ConfigPanel = ({
  config,
  onConfigChange,
  onRun,
  onSave,
  loading = false,
  portfolios = [],
  loadingPortfolios = false,
  onLoadPortfolio,
}) => {
  const [showPortfolioMenu, setShowPortfolioMenu] = useState(false);

  /* ── Stock handlers ──────────────────────────────────────────────────── */
  const handleStockAdd = (stock) => {
    if (config.symbols.includes(stock.symbol)) return;
    const newSymbols = [...config.symbols, stock.symbol];
    const eq = parseFloat((100 / newSymbols.length).toFixed(4));
    const newWeights = newSymbols.reduce((acc, s) => ({ ...acc, [s]: eq }), {});
    onConfigChange({ ...config, symbols: newSymbols, weights: newWeights });
  };

  const handleStockRemove = (symbol) => {
    const newSymbols = config.symbols.filter(s => s !== symbol);
    if (newSymbols.length === 0) {
      onConfigChange({ ...config, symbols: [], weights: {} });
      return;
    }
    const eq = parseFloat((100 / newSymbols.length).toFixed(4));
    const newWeights = newSymbols.reduce((acc, s) => ({ ...acc, [s]: eq }), {});
    onConfigChange({ ...config, symbols: newSymbols, weights: newWeights });
  };

  const handleWeightChange = (symbol, weight) => {
    onConfigChange({ ...config, weights: { ...config.weights, [symbol]: weight } });
  };

  /* ── Derived ─────────────────────────────────────────────────────────── */
  const selectedStocks = config.symbols.map(sym => ({
    symbol: sym,
    name: sym,
    weight: config.weights[sym] ?? 0,
  }));

  const totalWeight = selectedStocks.reduce((sum, s) => sum + (s.weight || 0), 0);
  const weightOk = config.symbols.length === 0 || Math.abs(totalWeight - 100) < 0.5;
  const canRun = !loading && config.symbols.length > 0 && weightOk;

  return (
    <div className="p-4 space-y-5">

      {/* ── Import from Portfolio ──────────────────────────────────────────── */}
      <div className="space-y-2">
        <SectionLabel>포트폴리오 불러오기</SectionLabel>
        <div className="relative">
          <button
            onClick={() => setShowPortfolioMenu(v => !v)}
            disabled={loadingPortfolios}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-blue-500/10 border border-blue-800/50 hover:bg-blue-500/20 text-blue-300 rounded-lg text-sm transition-colors"
          >
            <div className="flex items-center gap-2">
              <Briefcase size={14} />
              <span>내 포트폴리오에서 불러오기</span>
            </div>
            {loadingPortfolios
              ? <RefreshCw size={12} className="animate-spin opacity-60" />
              : <ChevronDown size={13} className={`transition-transform ${showPortfolioMenu ? 'rotate-180' : ''}`} />
            }
          </button>

          {showPortfolioMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowPortfolioMenu(false)} />
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#18181f] border border-gray-700 rounded-lg shadow-2xl z-20 overflow-hidden">
                {portfolios.length === 0 ? (
                  <div className="px-3 py-4 text-center">
                    <p className="text-xs text-gray-500">저장된 포트폴리오가 없습니다</p>
                  </div>
                ) : (
                  portfolios.map(p => (
                    <button
                      key={p.portfolio_id}
                      onClick={() => {
                        onLoadPortfolio(p.portfolio_id);
                        setShowPortfolioMenu(false);
                      }}
                      className="w-full px-3 py-2.5 text-left hover:bg-gray-800 transition-colors flex items-center justify-between border-b border-gray-800 last:border-0"
                    >
                      <div>
                        <div className="text-sm text-white font-medium">{p.name}</div>
                        {p.description && (
                          <div className="text-xs text-gray-500 truncate max-w-[180px]">{p.description}</div>
                        )}
                      </div>
                      <span className="text-xs text-blue-400 ml-2 flex-shrink-0">불러오기</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-gray-800" />

      {/* ── Stock Selector ────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <SectionLabel>종목 구성</SectionLabel>
          {config.symbols.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
              weightOk ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'
            }`}>
              {totalWeight.toFixed(0)}%
            </span>
          )}
        </div>
        <PortfolioStockSelector
          selectedStocks={selectedStocks}
          onAdd={handleStockAdd}
          onRemove={handleStockRemove}
          showWeights={true}
          onWeightChange={handleWeightChange}
          maxStocks={20}
        />
      </div>

      <div className="border-t border-gray-800" />

      {/* ── Benchmark ─────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <SectionLabel>벤치마크</SectionLabel>
        <BenchmarkSelector
          value={config.benchmark}
          onChange={(value) => onConfigChange({ ...config, benchmark: value })}
        />
      </div>

      <div className="border-t border-gray-800" />

      {/* ── Date Range ────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <SectionLabel>기간 설정</SectionLabel>
        <DateRangePicker
          startDate={config.startDate}
          endDate={config.endDate}
          onChange={(s, e) => onConfigChange({ ...config, startDate: s, endDate: e })}
          presets={true}
        />
      </div>

      <div className="border-t border-gray-800" />

      {/* ── Rebalancing ───────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <SectionLabel>리밸런싱 주기</SectionLabel>
        <RebalancingSelector
          value={config.rebalancing}
          onChange={(value) => onConfigChange({ ...config, rebalancing: value })}
        />
      </div>

      <div className="border-t border-gray-800" />

      {/* ── Initial Capital ───────────────────────────────────────────────── */}
      <div className="space-y-2">
        <SectionLabel>초기 투자금액</SectionLabel>
        <div className="relative">
          <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="number"
            min="1000"
            step="1000"
            value={config.initialCapital}
            onChange={(e) => onConfigChange({ ...config, initialCapital: parseFloat(e.target.value) || 0 })}
            className="w-full pl-8 pr-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="space-y-2 pt-1">
        {!weightOk && config.symbols.length > 0 && (
          <p className="text-[11px] text-yellow-400 text-center">
            비중 합계가 100%가 되어야 합니다 (현재 {totalWeight.toFixed(1)}%)
          </p>
        )}

        <button
          onClick={onRun}
          disabled={!canRun}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition-all ${
            canRun
              ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-900/20'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
        >
          {loading ? (
            <><RefreshCw size={14} className="animate-spin" /><span>실행 중...</span></>
          ) : (
            <><Play size={14} /><span>백테스트 실행</span></>
          )}
        </button>

        <button
          onClick={onSave}
          disabled={config.symbols.length === 0}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 hover:bg-gray-800/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save size={13} />
          <span>프리셋 저장</span>
        </button>
      </div>
    </div>
  );
};

export default ConfigPanel;
