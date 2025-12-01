import React, { useState, useEffect } from 'react';
import { TrendingUp, Zap, Shield, BarChart3, Play, Settings, Calendar, DollarSign, RefreshCw } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

/**
 * TradingStrategy Component
 * Preset strategies with customizable parameters
 */
const TradingStrategy = () => {
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [backtestResults, setBacktestResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [universes, setUniverses] = useState([]);

  // Customizable parameters
  const [params, setParams] = useState({
    universe: 'sp500',
    numStocks: 20,
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    initialCapital: 10000,
    rebalancingPeriod: 'monthly'
  });

  // Load universes on mount
  useEffect(() => {
    fetchUniverses();
  }, []);

  const fetchUniverses = async () => {
    try {
      const response = await fetch(`${API_BASE}/backtest/universes`);
      if (response.ok) {
        const data = await response.json();
        setUniverses(data.universes || []);
      }
    } catch (error) {
      console.error('Error fetching universes:', error);
    }
  };

  // Preset trading strategies
  const strategies = [
    {
      id: 'buy-hold',
      name: 'Buy & Hold',
      icon: <Shield className="text-blue-500" size={28} />,
      description: 'Long-term passive investment with quarterly rebalancing',
      color: 'blue',
      defaultRebalancing: 'quarterly',
      risk: 'Low',
      timeframe: 'Long-term',
    },
    {
      id: 'momentum',
      name: 'Momentum',
      icon: <TrendingUp className="text-green-500" size={28} />,
      description: 'Follow strong performers with monthly rebalancing',
      color: 'green',
      defaultRebalancing: 'monthly',
      risk: 'Medium',
      timeframe: 'Medium-term',
    },
    {
      id: 'value',
      name: 'Value Investing',
      icon: <BarChart3 className="text-purple-500" size={28} />,
      description: 'Focus on undervalued stocks with yearly rebalancing',
      color: 'purple',
      defaultRebalancing: 'yearly',
      risk: 'Medium',
      timeframe: 'Long-term',
    },
    {
      id: 'balanced',
      name: 'Balanced',
      icon: <Zap className="text-yellow-500" size={28} />,
      description: 'Risk-adjusted portfolio with quarterly rebalancing',
      color: 'yellow',
      defaultRebalancing: 'quarterly',
      risk: 'Low-Medium',
      timeframe: 'Medium-term',
    },
  ];

  const rebalancingOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  const handleStrategySelect = (strategy) => {
    setSelectedStrategy(strategy);
    setParams({
      ...params,
      rebalancingPeriod: strategy.defaultRebalancing
    });
  };

  const runBacktest = async () => {
    if (!selectedStrategy) {
      alert('Please select a strategy first');
      return;
    }

    setLoading(true);
    setBacktestResults(null);

    try {
      // Get universe stocks
      const universeResponse = await fetch(`${API_BASE}/backtest/universe/${params.universe}`);
      if (!universeResponse.ok) throw new Error('Failed to fetch universe');

      const universeData = await universeResponse.json();
      const symbols = universeData.stocks.slice(0, params.numStocks).map(s => s.symbol);

      // Run backtest
      const backtestResponse = await fetch(`${API_BASE}/backtest/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols,
          start_date: params.startDate,
          end_date: params.endDate,
          rebalancing_period: params.rebalancingPeriod,
          initial_capital: params.initialCapital,
        }),
      });

      if (!backtestResponse.ok) throw new Error('Backtest failed');

      const backtestData = await backtestResponse.json();
      setBacktestResults(backtestData.data);
    } catch (error) {
      console.error('Error running backtest:', error);
      alert('Failed to run backtest. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk) => {
    if (risk.includes('Low')) return 'text-green-400';
    if (risk.includes('Medium')) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="flex flex-col h-full gap-6 p-6 bg-[#0a0e14] overflow-y-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <TrendingUp className="text-blue-500" size={32} />
          Trading Strategies
        </h1>
        <p className="text-sm text-gray-400 mt-2">
          Choose a strategy template and customize parameters for backtesting
        </p>
      </div>

      {/* Strategy Templates */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">1. Select Strategy Template</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {strategies.map((strategy) => (
            <div
              key={strategy.id}
              className={`bg-[#1a1f2e] border-2 rounded-lg p-4 transition-all cursor-pointer hover:shadow-lg ${
                selectedStrategy?.id === strategy.id
                  ? 'border-blue-500 shadow-blue-500/20'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
              onClick={() => handleStrategySelect(strategy)}
            >
              <div className="flex items-center gap-2 mb-3">
                {strategy.icon}
                <div>
                  <h3 className="text-lg font-bold text-white">{strategy.name}</h3>
                  <span className={`text-xs ${getRiskColor(strategy.risk)} font-semibold`}>
                    {strategy.risk}
                  </span>
                </div>
              </div>
              <p className="text-gray-400 text-xs mb-2">{strategy.description}</p>
              <div className="text-xs text-gray-500">
                {strategy.timeframe} • {strategy.defaultRebalancing}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Parameters Panel */}
      {selectedStrategy && (
        <div className="bg-[#1a1f2e] rounded-lg p-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="text-blue-500" size={24} />
            <h2 className="text-xl font-semibold text-white">2. Customize Parameters</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Universe Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Stock Universe
              </label>
              <select
                value={params.universe}
                onChange={(e) => setParams({ ...params, universe: e.target.value })}
                className="w-full px-3 py-2 bg-[#0a0e14] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                {universes.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.count} stocks)
                  </option>
                ))}
              </select>
            </div>

            {/* Number of Stocks */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Number of Stocks
              </label>
              <input
                type="number"
                value={params.numStocks}
                onChange={(e) => setParams({ ...params, numStocks: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-[#0a0e14] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                min="5"
                max="50"
              />
              <p className="text-xs text-gray-500 mt-1">5-50 stocks recommended</p>
            </div>

            {/* Rebalancing Period */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <RefreshCw size={16} />
                Rebalancing Period
              </label>
              <select
                value={params.rebalancingPeriod}
                onChange={(e) => setParams({ ...params, rebalancingPeriod: e.target.value })}
                className="w-full px-3 py-2 bg-[#0a0e14] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                {rebalancingOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Calendar size={16} />
                Start Date
              </label>
              <input
                type="date"
                value={params.startDate}
                onChange={(e) => setParams({ ...params, startDate: e.target.value })}
                className="w-full px-3 py-2 bg-[#0a0e14] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Calendar size={16} />
                End Date
              </label>
              <input
                type="date"
                value={params.endDate}
                onChange={(e) => setParams({ ...params, endDate: e.target.value })}
                className="w-full px-3 py-2 bg-[#0a0e14] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Initial Capital */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <DollarSign size={16} />
                Initial Capital
              </label>
              <input
                type="number"
                value={params.initialCapital}
                onChange={(e) => setParams({ ...params, initialCapital: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-[#0a0e14] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                min="1000"
                step="1000"
              />
            </div>
          </div>

          {/* Run Backtest Button */}
          <div className="mt-6">
            <button
              onClick={runBacktest}
              disabled={loading}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Running Backtest...
                </>
              ) : (
                <>
                  <Play size={20} />
                  Run Backtest
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Backtest Results */}
      {backtestResults && (
        <div className="bg-[#1a1f2e] rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Backtest Results</h2>
            <div className="text-sm text-gray-400">
              {params.numStocks} stocks • {params.startDate} to {params.endDate}
            </div>
          </div>

          {/* Strategy Summary */}
          <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              {selectedStrategy?.icon}
              <div>
                <h3 className="text-lg font-semibold text-white">{selectedStrategy?.name}</h3>
                <p className="text-sm text-gray-300">
                  {params.universe.toUpperCase()} • {params.rebalancingPeriod} rebalancing • ${params.initialCapital.toLocaleString()} initial
                </p>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-[#0a0e14] p-4 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">Total Return</div>
              <div className={`text-2xl font-bold ${
                backtestResults.statistics?.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {backtestResults.statistics?.totalReturn >= 0 ? '+' : ''}
                {backtestResults.statistics?.totalReturn}%
              </div>
            </div>

            <div className="bg-[#0a0e14] p-4 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">Annual Return</div>
              <div className={`text-2xl font-bold ${
                backtestResults.statistics?.annualizedReturn >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {backtestResults.statistics?.annualizedReturn >= 0 ? '+' : ''}
                {backtestResults.statistics?.annualizedReturn}%
              </div>
            </div>

            <div className="bg-[#0a0e14] p-4 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">Sharpe Ratio</div>
              <div className="text-2xl font-bold text-white">
                {backtestResults.statistics?.sharpeRatio}
              </div>
            </div>

            <div className="bg-[#0a0e14] p-4 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">Max Drawdown</div>
              <div className="text-2xl font-bold text-red-400">
                {backtestResults.statistics?.maxDrawdown}%
              </div>
            </div>

            <div className="bg-[#0a0e14] p-4 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">Volatility</div>
              <div className="text-2xl font-bold text-white">
                {backtestResults.statistics?.volatility}%
              </div>
            </div>

            <div className="bg-[#0a0e14] p-4 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">Win Rate</div>
              <div className="text-2xl font-bold text-blue-400">
                {backtestResults.statistics?.winRate}%
              </div>
            </div>
          </div>

          {/* Final Value */}
          <div className="mt-6 bg-[#0a0e14] p-4 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-400">Initial Capital</div>
                <div className="text-xl font-bold text-white">
                  ${params.initialCapital.toLocaleString()}
                </div>
              </div>
              <div className="text-3xl text-gray-600">→</div>
              <div>
                <div className="text-sm text-gray-400">Final Value</div>
                <div className={`text-xl font-bold ${
                  backtestResults.portfolio_values?.[backtestResults.portfolio_values.length - 1]?.value >= params.initialCapital
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}>
                  ${backtestResults.portfolio_values?.[backtestResults.portfolio_values.length - 1]?.value.toLocaleString() || 0}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Profit/Loss</div>
                <div className={`text-xl font-bold ${
                  (backtestResults.portfolio_values?.[backtestResults.portfolio_values.length - 1]?.value - params.initialCapital) >= 0
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}>
                  {(backtestResults.portfolio_values?.[backtestResults.portfolio_values.length - 1]?.value - params.initialCapital) >= 0 ? '+' : ''}
                  ${((backtestResults.portfolio_values?.[backtestResults.portfolio_values.length - 1]?.value || 0) - params.initialCapital).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingStrategy;
