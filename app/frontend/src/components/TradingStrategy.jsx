import React, { useState, useEffect } from 'react';
import { Play, TrendingUp, BarChart3, DollarSign, Calendar, Percent } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'http://localhost:8000/api';

/**
 * TradingStrategy Component - Backtesting Interface
 */
const TradingStrategy = () => {
  // Strategy configuration
  const [strategyConfig, setStrategyConfig] = useState({
    strategy: 'buy-hold',
    market: 'INDU, ADA, MSFT',
    period: '2020-01-01',
    endPeriod: new Date().toISOString().split('T')[0],
    complexity: '15',
    longMA: '50',
    shortMA: '20',
    stopLoss: '-10.0',
    takeProfit: '15.0',
    initialCapital: 10000
  });

  const [universes, setUniverses] = useState([]);
  const [backtestResults, setBacktestResults] = useState(null);
  const [loading, setLoading] = useState(false);

  // Available strategies
  const strategies = [
    { value: 'buy-hold', label: 'Buy & Hold' },
    { value: 'momentum', label: 'Momentum' },
    { value: 'mean-reversion', label: 'Mean Reversion' },
    { value: 'moving-average', label: 'Moving Average Crossover' },
    { value: 'rsi', label: 'RSI Strategy' },
    { value: 'bollinger', label: 'Bollinger Bands' }
  ];

  // Load universes
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

  const handleInputChange = (field, value) => {
    setStrategyConfig(prev => ({ ...prev, [field]: value }));
  };

  const runBacktest = async () => {
    setLoading(true);
    setBacktestResults(null);

    try {
      // Parse symbols from market field
      const symbols = strategyConfig.market
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      if (symbols.length === 0) {
        alert('Please enter at least one symbol');
        return;
      }

      const response = await fetch(`${API_BASE}/backtest/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols,
          start_date: strategyConfig.period,
          end_date: strategyConfig.endPeriod,
          rebalancing_period: 'monthly',
          initial_capital: strategyConfig.initialCapital
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Backtest failed');
      }

      const data = await response.json();
      setBacktestResults(data.data);
    } catch (error) {
      console.error('Error running backtest:', error);
      alert(`Failed to run backtest: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0e14] text-white">
      {/* Left Sidebar - Strategy Setup */}
      <div className="w-80 bg-[#1a1f2e] border-r border-gray-800 p-6 overflow-y-auto">
        <h2 className="text-xl font-bold mb-6">Strategy Setup</h2>

        {/* Strategy Selection */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">Strategy</label>
          <select
            value={strategyConfig.strategy}
            onChange={(e) => handleInputChange('strategy', e.target.value)}
            className="w-full px-3 py-2 bg-[#0a0e14] border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
          >
            {strategies.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Market Selection */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">Market</label>
          <input
            type="text"
            value={strategyConfig.market}
            onChange={(e) => handleInputChange('market', e.target.value)}
            placeholder="AAPL, MSFT, GOOGL"
            className="w-full px-3 py-2 bg-[#0a0e14] border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">Comma-separated symbols</p>
        </div>

        {/* Period */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">Start Date</label>
          <input
            type="date"
            value={strategyConfig.period}
            onChange={(e) => handleInputChange('period', e.target.value)}
            className="w-full px-3 py-2 bg-[#0a0e14] border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">End Date</label>
          <input
            type="date"
            value={strategyConfig.endPeriod}
            onChange={(e) => handleInputChange('endPeriod', e.target.value)}
            className="w-full px-3 py-2 bg-[#0a0e14] border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Strategy-specific parameters */}
        {strategyConfig.strategy === 'moving-average' && (
          <>
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">Long MA</label>
              <input
                type="number"
                value={strategyConfig.longMA}
                onChange={(e) => handleInputChange('longMA', e.target.value)}
                className="w-full px-3 py-2 bg-[#0a0e14] border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">Short MA</label>
              <input
                type="number"
                value={strategyConfig.shortMA}
                onChange={(e) => handleInputChange('shortMA', e.target.value)}
                className="w-full px-3 py-2 bg-[#0a0e14] border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </>
        )}

        {/* Risk Management */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">Stop Loss (%)</label>
          <input
            type="number"
            value={strategyConfig.stopLoss}
            onChange={(e) => handleInputChange('stopLoss', e.target.value)}
            step="0.1"
            className="w-full px-3 py-2 bg-[#0a0e14] border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">Take Profit (%)</label>
          <input
            type="number"
            value={strategyConfig.takeProfit}
            onChange={(e) => handleInputChange('takeProfit', e.target.value)}
            step="0.1"
            className="w-full px-3 py-2 bg-[#0a0e14] border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Run Backtest Button */}
        <button
          onClick={runBacktest}
          disabled={loading}
          className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Running...
            </>
          ) : (
            <>
              <Play size={20} />
              Run Backtest
            </>
          )}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 overflow-y-auto">
        <h1 className="text-3xl font-bold mb-6">Backtesting</h1>

        {!backtestResults ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center text-gray-500">
              <BarChart3 size={64} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg">Configure your strategy and run a backtest</p>
              <p className="text-sm mt-2">Results will appear here</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Backtest Execution */}
            <BacktestExecution results={backtestResults} config={strategyConfig} />

            {/* Backtest Evaluation */}
            <BacktestEvaluation results={backtestResults} />

            {/* Equity Curve */}
            <div className="lg:col-span-2">
              <EquityCurve results={backtestResults} />
            </div>

            {/* Performance Summary */}
            <PerformanceSummary results={backtestResults} />

            {/* Yearly Returns */}
            <YearlyReturns results={backtestResults} />
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Backtest Execution Panel
 */
const BacktestExecution = ({ results, config }) => {
  return (
    <div className="bg-[#1a1f2e] border border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Backtest Execution</h3>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Strategy:</span>
          <span className="font-medium">{config.strategy}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Market:</span>
          <span className="font-medium">{config.market}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Period:</span>
          <span className="font-medium">{config.period} to {config.endPeriod}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Initial Capital:</span>
          <span className="font-medium">${config.initialCapital.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Final Value:</span>
          <span className="font-medium text-green-400">
            ${results.portfolio_values?.[results.portfolio_values.length - 1]?.value?.toLocaleString() || '0'}
          </span>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-700">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Status:</span>
          <span className="px-3 py-1 bg-green-900/30 text-green-400 rounded-full text-xs font-medium">
            Completed
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Backtest Evaluation Panel
 */
const BacktestEvaluation = ({ results }) => {
  const stats = results.statistics || {};

  return (
    <div className="bg-[#1a1f2e] border border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Backtest Evaluation</h3>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Total Return:</span>
          <span className={`font-bold ${stats.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {stats.totalReturn >= 0 ? '+' : ''}{stats.totalReturn}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Annual Return:</span>
          <span className={`font-bold ${stats.annualizedReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {stats.annualizedReturn >= 0 ? '+' : ''}{stats.annualizedReturn}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Sharpe Ratio:</span>
          <span className="font-medium">{stats.sharpeRatio || '0.00'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Max Drawdown:</span>
          <span className="font-medium text-red-400">{stats.maxDrawdown}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Volatility:</span>
          <span className="font-medium">{stats.volatility}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Win Rate:</span>
          <span className="font-medium text-blue-400">{stats.winRate}%</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Equity Curve Chart
 */
const EquityCurve = ({ results }) => {
  const chartData = {
    labels: results.portfolio_values?.map(p => p.date) || [],
    datasets: [
      {
        label: 'Portfolio Value',
        data: results.portfolio_values?.map(p => p.value) || [],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Benchmark',
        data: results.benchmark_values?.map(b => b.value) || [],
        borderColor: 'rgb(156, 163, 175)',
        backgroundColor: 'rgba(156, 163, 175, 0.05)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: { color: '#9ca3af' }
      },
      title: {
        display: true,
        text: 'Equity Curve',
        color: '#ffffff',
        font: { size: 16, weight: 'bold' }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(75, 85, 99, 0.2)' },
        ticks: { color: '#9ca3af' }
      },
      y: {
        grid: { color: 'rgba(75, 85, 99, 0.2)' },
        ticks: { color: '#9ca3af' }
      }
    }
  };

  return (
    <div className="bg-[#1a1f2e] border border-gray-700 rounded-lg p-6">
      <div className="h-80">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
};

/**
 * Performance Summary
 */
const PerformanceSummary = ({ results }) => {
  const stats = results.statistics || {};

  return (
    <div className="bg-[#1a1f2e] border border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Performance Summary</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#0a0e14] p-4 rounded-lg">
          <div className="text-xs text-gray-400 mb-1">Profit Factor</div>
          <div className="text-2xl font-bold text-white">{stats.profitFactor || '1.00'}</div>
        </div>
        <div className="bg-[#0a0e14] p-4 rounded-lg">
          <div className="text-xs text-gray-400 mb-1">Recovery Factor</div>
          <div className="text-2xl font-bold text-white">{stats.recoveryFactor || '1.00'}</div>
        </div>
        <div className="bg-[#0a0e14] p-4 rounded-lg">
          <div className="text-xs text-gray-400 mb-1">Total Trades</div>
          <div className="text-2xl font-bold text-white">{stats.totalTrades || '0'}</div>
        </div>
        <div className="bg-[#0a0e14] p-4 rounded-lg">
          <div className="text-xs text-gray-400 mb-1">Avg Trade</div>
          <div className="text-2xl font-bold text-white">{stats.avgTrade || '0'}%</div>
        </div>
      </div>
    </div>
  );
};

/**
 * Yearly Returns Table
 */
const YearlyReturns = ({ results }) => {
  const yearlyReturns = results.yearly_returns || [];

  return (
    <div className="bg-[#1a1f2e] border border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Yearly Returns</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 text-gray-400">Year</th>
              <th className="text-right py-2 text-gray-400">Return</th>
              <th className="text-right py-2 text-gray-400">Benchmark</th>
              <th className="text-right py-2 text-gray-400">Alpha</th>
            </tr>
          </thead>
          <tbody>
            {yearlyReturns.map((year, idx) => (
              <tr key={idx} className="border-b border-gray-800">
                <td className="py-2">{year.year}</td>
                <td className={`text-right py-2 font-medium ${year.return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {year.return >= 0 ? '+' : ''}{year.return}%
                </td>
                <td className="text-right py-2 text-gray-400">
                  {year.benchmark >= 0 ? '+' : ''}{year.benchmark}%
                </td>
                <td className={`text-right py-2 font-medium ${year.alpha >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {year.alpha >= 0 ? '+' : ''}{year.alpha}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TradingStrategy;
