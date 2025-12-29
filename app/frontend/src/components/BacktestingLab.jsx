import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Save,
  FolderOpen,
  TrendingUp,
  TrendingDown,
  Settings,
  Filter,
  BarChart3,
  Activity,
  DollarSign,
  Percent,
  Target,
  Zap,
  Shield,
  Calendar,
  Download,
  RefreshCw,
  Search,
  X,
  Plus
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart
} from 'recharts';
import TickerSearch from './TickerSearch';

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'http://localhost:8000/api';

/**
 * BacktestingLab - Advanced Backtesting Platform
 * Combines strategy configuration, technical analysis, and performance evaluation
 */
const BacktestingLab = () => {
  // Configuration state
  const [config, setConfig] = useState({
    strategy: 'buy-hold',
    symbols: 'AAPL, MSFT, GOOGL',
    benchmark: 'SPY',
    startDate: '2020-01-01',
    endDate: new Date().toISOString().split('T')[0],
    initialCapital: 100000,
    rebalancing: 'monthly',
    // Technical parameters
    longMA: 200,
    shortMA: 50,
    rsiPeriod: 14,
    rsiOverbought: 70,
    rsiOversold: 30,
    // Risk management
    stopLoss: 10,
    takeProfit: 25,
    maxPositionSize: 10,
    cashReserve: 5
  });

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [savedPresets, setSavedPresets] = useState([]);
  const [showSymbolSearch, setShowSymbolSearch] = useState(false);
  const [showBenchmarkSelector, setShowBenchmarkSelector] = useState(false);
  const [selectedSymbols, setSelectedSymbols] = useState([]);

  // Strategy definitions
  const strategies = [
    {
      id: 'buy-hold',
      name: 'Buy & Hold',
      icon: Shield,
      color: 'blue',
      description: 'Long-term passive investment',
      risk: 'Low',
      parameters: []
    },
    {
      id: 'momentum',
      name: 'Momentum',
      icon: TrendingUp,
      color: 'green',
      description: 'Follow strong price trends',
      risk: 'Medium',
      parameters: ['shortMA', 'longMA']
    },
    {
      id: 'mean-reversion',
      name: 'Mean Reversion',
      icon: Activity,
      color: 'purple',
      description: 'Buy oversold, sell overbought',
      risk: 'Medium',
      parameters: ['rsiPeriod', 'rsiOverbought', 'rsiOversold']
    },
    {
      id: 'moving-average',
      name: 'MA Crossover',
      icon: Zap,
      color: 'yellow',
      description: 'Moving average crossover signals',
      risk: 'Low-Medium',
      parameters: ['shortMA', 'longMA']
    }
  ];

  const currentStrategy = strategies.find(s => s.id === config.strategy);

  // Benchmark options
  const benchmarkOptions = [
    { symbol: 'SPY', name: 'S&P 500', description: 'Large Cap US Stocks' },
    { symbol: 'QQQ', name: 'NASDAQ 100', description: 'Tech & Growth' },
    { symbol: 'DIA', name: 'Dow Jones', description: 'Blue Chip Stocks' },
    { symbol: 'IWM', name: 'Russell 2000', description: 'Small Cap US' },
    { symbol: 'VTI', name: 'Total Market', description: 'Total US Market' },
    { symbol: 'EFA', name: 'Developed Intl', description: 'International' },
    { symbol: 'AGG', name: 'Total Bond', description: 'US Bonds' },
    { symbol: 'GLD', name: 'Gold', description: 'Gold ETF' }
  ];

  // Load saved presets
  useEffect(() => {
    const saved = localStorage.getItem('backtest-presets');
    if (saved) {
      try {
        setSavedPresets(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading presets:', e);
      }
    }

    // Parse initial symbols
    const symbols = config.symbols.split(',').map(s => s.trim()).filter(s => s);
    setSelectedSymbols(symbols);
  }, []);

  const updateConfig = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSymbolSelect = (symbol) => {
    if (!selectedSymbols.includes(symbol)) {
      const newSymbols = [...selectedSymbols, symbol];
      setSelectedSymbols(newSymbols);
      updateConfig('symbols', newSymbols.join(', '));
    }
    setShowSymbolSearch(false);
  };

  const removeSymbol = (symbol) => {
    const newSymbols = selectedSymbols.filter(s => s !== symbol);
    setSelectedSymbols(newSymbols);
    updateConfig('symbols', newSymbols.join(', '));
  };

  const runBacktest = async () => {
    setLoading(true);
    setResults(null);

    try {
      const symbols = config.symbols.split(',').map(s => s.trim()).filter(s => s);

      if (symbols.length === 0) {
        alert('Please enter at least one symbol');
        return;
      }

      const response = await fetch(`${API_BASE}/backtest/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols,
          start_date: config.startDate,
          end_date: config.endDate,
          rebalancing_period: config.rebalancing,
          initial_capital: config.initialCapital
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Backtest failed');
      }

      const data = await response.json();
      setResults(data.data);
    } catch (error) {
      console.error('Error running backtest:', error);
      alert(`Failed to run backtest: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const savePreset = () => {
    const name = prompt('Enter preset name:');
    if (!name) return;

    const preset = {
      id: Date.now(),
      name,
      config: { ...config },
      createdAt: new Date().toISOString()
    };

    const updated = [...savedPresets, preset];
    setSavedPresets(updated);
    localStorage.setItem('backtest-presets', JSON.stringify(updated));
  };

  const loadPreset = (preset) => {
    setConfig(preset.config);
  };

  return (
    <div className="h-screen flex bg-gradient-to-br from-[#0a0e14] via-[#0d1117] to-[#0a0e14] text-white">
      {/* Left Sidebar - Configuration Panel */}
      <div className="w-96 bg-[#161b22] border-r border-gray-800 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-800 bg-gradient-to-r from-blue-900/20 to-purple-900/20">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <BarChart3 className="text-blue-400" size={28} />
            Backtesting Lab
          </h2>
          <p className="text-sm text-gray-400 mt-1">Advanced strategy testing</p>
        </div>

        {/* Configuration Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Strategy Selection */}
          <section>
            <label className="block text-sm font-semibold text-gray-300 mb-3">Strategy</label>
            <div className="grid grid-cols-2 gap-2">
              {strategies.map((strategy) => (
                <button
                  key={strategy.id}
                  onClick={() => updateConfig('strategy', strategy.id)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    config.strategy === strategy.id
                      ? 'border-blue-500 bg-blue-900/30 shadow-lg shadow-blue-500/20'
                      : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                  }`}
                >
                  <strategy.icon size={20} className={`mx-auto mb-1 text-${strategy.color}-400`} />
                  <div className="text-xs font-medium">{strategy.name}</div>
                  <div className="text-[10px] text-gray-500 mt-1">{strategy.risk}</div>
                </button>
              ))}
            </div>
            {currentStrategy && (
              <div className="mt-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                <p className="text-xs text-gray-400">{currentStrategy.description}</p>
              </div>
            )}
          </section>

          {/* Symbols */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-300">Portfolio Symbols</label>
              <button
                onClick={() => setShowSymbolSearch(true)}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <Plus size={14} />
                Add Symbol
              </button>
            </div>

            {/* Selected Symbols */}
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedSymbols.map((symbol) => (
                <div
                  key={symbol}
                  className="px-3 py-1.5 bg-blue-900/30 border border-blue-500/50 rounded-lg text-sm font-medium text-blue-300 flex items-center gap-2 group"
                >
                  {symbol}
                  <button
                    onClick={() => removeSymbol(symbol)}
                    className="text-blue-400 hover:text-red-400 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {selectedSymbols.length === 0 && (
                <div className="text-xs text-gray-500 italic">No symbols selected</div>
              )}
            </div>

            <button
              onClick={() => setShowSymbolSearch(true)}
              className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-gray-400 hover:border-blue-500 hover:text-blue-400 transition-all flex items-center justify-center gap-2"
            >
              <Search size={16} />
              Search & Add Symbols
            </button>
          </section>

          {/* Benchmark */}
          <section>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Benchmark</label>
            <div className="relative">
              <button
                onClick={() => setShowBenchmarkSelector(!showBenchmarkSelector)}
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white hover:border-blue-500 transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{config.benchmark}</span>
                  <span className="text-xs text-gray-500">
                    {benchmarkOptions.find(b => b.symbol === config.benchmark)?.name}
                  </span>
                </div>
                <Filter size={16} className="text-gray-500" />
              </button>

              {/* Benchmark Dropdown */}
              {showBenchmarkSelector && (
                <div className="absolute z-50 w-full mt-2 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-h-64 overflow-y-auto">
                  {benchmarkOptions.map((benchmark) => (
                    <button
                      key={benchmark.symbol}
                      onClick={() => {
                        updateConfig('benchmark', benchmark.symbol);
                        setShowBenchmarkSelector(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-0 ${
                        config.benchmark === benchmark.symbol ? 'bg-blue-900/30' : ''
                      }`}
                    >
                      <div className="font-medium text-white">{benchmark.symbol} - {benchmark.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{benchmark.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Date Range */}
          <section className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Start Date</label>
              <input
                type="date"
                value={config.startDate}
                onChange={(e) => updateConfig('startDate', e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">End Date</label>
              <input
                type="date"
                value={config.endDate}
                onChange={(e) => updateConfig('endDate', e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </section>

          {/* Capital & Rebalancing */}
          <section className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Initial Capital</label>
              <div className="relative">
                <DollarSign size={16} className="absolute left-3 top-3 text-gray-500" />
                <input
                  type="number"
                  value={config.initialCapital}
                  onChange={(e) => updateConfig('initialCapital', parseInt(e.target.value))}
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Rebalancing</label>
              <select
                value={config.rebalancing}
                onChange={(e) => updateConfig('rebalancing', e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-all"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </section>

          {/* Strategy-Specific Parameters */}
          {currentStrategy?.parameters.length > 0 && (
            <section className="p-4 bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg">
              <h3 className="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
                <Settings size={16} />
                Strategy Parameters
              </h3>
              <div className="space-y-3">
                {currentStrategy.parameters.includes('shortMA') && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Short MA Period</label>
                    <input
                      type="number"
                      value={config.shortMA}
                      onChange={(e) => updateConfig('shortMA', parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-all"
                    />
                  </div>
                )}
                {currentStrategy.parameters.includes('longMA') && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Long MA Period</label>
                    <input
                      type="number"
                      value={config.longMA}
                      onChange={(e) => updateConfig('longMA', parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-all"
                    />
                  </div>
                )}
                {currentStrategy.parameters.includes('rsiPeriod') && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">RSI Period</label>
                      <input
                        type="number"
                        value={config.rsiPeriod}
                        onChange={(e) => updateConfig('rsiPeriod', parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-all"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">Overbought</label>
                        <input
                          type="number"
                          value={config.rsiOverbought}
                          onChange={(e) => updateConfig('rsiOverbought', parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">Oversold</label>
                        <input
                          type="number"
                          value={config.rsiOversold}
                          onChange={(e) => updateConfig('rsiOversold', parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-all"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {/* Risk Management */}
          <section className="p-4 bg-gradient-to-br from-red-900/20 to-orange-900/20 border border-red-500/30 rounded-lg">
            <h3 className="text-sm font-semibold text-red-300 mb-3 flex items-center gap-2">
              <Shield size={16} />
              Risk Management
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Stop Loss (%)</label>
                <input
                  type="number"
                  value={config.stopLoss}
                  onChange={(e) => updateConfig('stopLoss', parseFloat(e.target.value))}
                  step="0.5"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Take Profit (%)</label>
                <input
                  type="number"
                  value={config.takeProfit}
                  onChange={(e) => updateConfig('takeProfit', parseFloat(e.target.value))}
                  step="0.5"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Max Position (%)</label>
                <input
                  type="number"
                  value={config.maxPositionSize}
                  onChange={(e) => updateConfig('maxPositionSize', parseFloat(e.target.value))}
                  step="0.5"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Cash Reserve (%)</label>
                <input
                  type="number"
                  value={config.cashReserve}
                  onChange={(e) => updateConfig('cashReserve', parseFloat(e.target.value))}
                  step="0.5"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500 transition-all"
                />
              </div>
            </div>
          </section>

          {/* Saved Presets */}
          {savedPresets.length > 0 && (
            <section>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Saved Presets</label>
              <div className="space-y-2">
                {savedPresets.slice(-3).map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => loadPreset(preset)}
                    className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-left hover:bg-gray-700/50 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{preset.name}</span>
                      <FolderOpen size={14} className="text-gray-500 group-hover:text-blue-400" />
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(preset.createdAt).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-6 border-t border-gray-800 space-y-3 bg-[#161b22]">
          <button
            onClick={runBacktest}
            disabled={loading}
            className="w-full px-6 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
          >
            {loading ? (
              <>
                <RefreshCw size={20} className="animate-spin" />
                Running Backtest...
              </>
            ) : (
              <>
                <Play size={20} />
                Run Backtest
              </>
            )}
          </button>
          <button
            onClick={savePreset}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg hover:bg-gray-700 transition-all font-medium flex items-center justify-center gap-2"
          >
            <Save size={18} />
            Save Preset
          </button>
        </div>
      </div>

      {/* Symbol Search Modal */}
      {showSymbolSearch && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSymbolSearch(false);
            }
          }}
        >
          <div
            className="bg-[#161b22] border border-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden relative z-[101]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Search className="text-blue-400" size={24} />
                Search Symbols
              </h3>
              <button
                onClick={() => setShowSymbolSearch(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <TickerSearch
                onSelect={handleSymbolSelect}
                onClose={() => setShowSymbolSearch(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Results */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="px-8 py-5 border-b border-gray-800 bg-[#0d1117]">
          <h1 className="text-2xl font-bold">Backtest Results</h1>
          <p className="text-sm text-gray-400 mt-1">
            {results ? `${config.symbols} • ${config.startDate} to ${config.endDate}` : 'Configure and run a backtest to see results'}
          </p>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-8">
          {!results ? (
            <EmptyState onRun={runBacktest} loading={loading} />
          ) : (
            <ResultsDashboard results={results} config={config} />
          )}
        </div>
      </div>
    </div>
  );
};

// Empty State Component
const EmptyState = ({ onRun, loading }) => (
  <div className="h-full flex items-center justify-center">
    <div className="text-center max-w-md">
      <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
        <BarChart3 size={48} className="text-blue-400" />
      </div>
      <h3 className="text-2xl font-bold mb-3">Ready to Backtest</h3>
      <p className="text-gray-400 mb-6">
        Configure your strategy parameters and click "Run Backtest" to analyze performance
      </p>
      {loading && (
        <div className="flex items-center justify-center gap-3 text-blue-400">
          <RefreshCw size={20} className="animate-spin" />
          <span>Running backtest...</span>
        </div>
      )}
    </div>
  </div>
);

// Results Dashboard Component
const ResultsDashboard = ({ results, config }) => {
  const stats = results.statistics || {};
  const portfolioValues = results.portfolio_values || [];
  const benchmarkValues = results.benchmark_values || [];

  // Merge portfolio and benchmark data for Recharts
  const chartData = portfolioValues.map((p, idx) => ({
    date: p.date,
    portfolio: p.value,
    benchmark: benchmarkValues[idx]?.value || null
  }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900/95 border border-gray-700 rounded-lg p-3 shadow-xl">
          <p className="text-sm text-gray-300 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-400">{entry.name}:</span>
              <span className="text-white font-semibold">
                ${entry.value?.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Format Y-axis
  const formatYAxis = (value) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value}`;
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Return"
          value={`${stats.totalReturn >= 0 ? '+' : ''}${stats.totalReturn}%`}
          trend={stats.totalReturn >= 0 ? 'up' : 'down'}
          icon={TrendingUp}
        />
        <MetricCard
          label="Annual Return"
          value={`${stats.annualizedReturn >= 0 ? '+' : ''}${stats.annualizedReturn}%`}
          trend={stats.annualizedReturn >= 0 ? 'up' : 'down'}
          icon={Percent}
        />
        <MetricCard
          label="Sharpe Ratio"
          value={stats.sharpeRatio || '0.00'}
          icon={Activity}
        />
        <MetricCard
          label="Max Drawdown"
          value={`${stats.maxDrawdown}%`}
          trend="down"
          icon={TrendingDown}
        />
      </div>

      {/* Equity Curve Chart */}
      <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="text-blue-400" size={20} />
            Equity Curve
          </h3>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-gray-400">Portfolio</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-gray-400">Benchmark</span>
            </div>
          </div>
        </div>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorBenchmark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis
                dataKey="date"
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getFullYear().toString().slice(2)}`;
                }}
              />
              <YAxis
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                tickFormatter={formatYAxis}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="portfolio"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#colorPortfolio)"
                name="Portfolio"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="benchmark"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#colorBenchmark)"
                name="Benchmark"
                strokeDasharray="5 5"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Performance Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Summary */}
        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 shadow-xl">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="text-purple-400" size={20} />
            Performance Summary
          </h3>
          <div className="space-y-4">
            <StatRow label="Volatility" value={stats.volatility ? `${stats.volatility}%` : 'N/A'} />
            <StatRow label="Win Rate" value={stats.winRate ? `${stats.winRate}%` : 'N/A'} />
            <StatRow label="Profit Factor" value={stats.profitFactor || 'N/A'} />
            <StatRow label="Recovery Factor" value={stats.recoveryFactor || 'N/A'} />
            <StatRow label="Beta" value={stats.beta || 'N/A'} />
            <StatRow label="Alpha" value={stats.alpha || 'N/A'} />
          </div>
        </div>

        {/* Capital Overview */}
        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 shadow-xl">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="text-green-400" size={20} />
            Capital Overview
          </h3>
          <div className="space-y-4">
            <StatRow
              label="Initial Capital"
              value={`$${config.initialCapital.toLocaleString()}`}
            />
            <StatRow
              label="Final Value"
              value={portfolioValues.length > 0
                ? `$${portfolioValues[portfolioValues.length - 1].value.toLocaleString()}`
                : 'N/A'}
            />
            <StatRow
              label="Total P/L"
              value={portfolioValues.length > 0
                ? `$${(portfolioValues[portfolioValues.length - 1].value - config.initialCapital).toLocaleString()}`
                : 'N/A'}
            />
            <StatRow
              label="Peak Value"
              value={portfolioValues.length > 0
                ? `$${Math.max(...portfolioValues.map(p => p.value)).toLocaleString()}`
                : 'N/A'}
            />
          </div>
        </div>
      </div>

      {/* Yearly Returns Table */}
      {results.yearly_returns && results.yearly_returns.length > 0 && (
        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 shadow-xl">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="text-yellow-400" size={20} />
            Yearly Returns
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Year</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Portfolio</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Benchmark</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Alpha</th>
                </tr>
              </thead>
              <tbody>
                {results.yearly_returns.map((year, idx) => (
                  <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-3 px-4 font-medium">{year.year}</td>
                    <td className={`text-right py-3 px-4 font-semibold ${year.return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {year.return >= 0 ? '+' : ''}{year.return}%
                    </td>
                    <td className="text-right py-3 px-4 text-gray-400">
                      {year.benchmark >= 0 ? '+' : ''}{year.benchmark}%
                    </td>
                    <td className={`text-right py-3 px-4 font-semibold ${year.alpha >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {year.alpha >= 0 ? '+' : ''}{year.alpha}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Metric Card Component
const MetricCard = ({ label, value, trend, icon: Icon }) => {
  const trendColors = {
    up: 'text-green-400',
    down: 'text-red-400',
    neutral: 'text-gray-400'
  };

  const color = trend ? trendColors[trend] : 'text-white';

  return (
    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-5 shadow-xl hover:shadow-2xl transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-400">{label}</span>
        {Icon && <Icon size={18} className="text-gray-600" />}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
};

// Stat Row Component
const StatRow = ({ label, value }) => (
  <div className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
    <span className="text-sm text-gray-400">{label}</span>
    <span className="text-sm font-semibold text-white">{value}</span>
  </div>
);

export default BacktestingLab;
