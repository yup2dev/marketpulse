import { useState, useEffect } from 'react';
import { Play, Calendar, TrendingUp, Filter, Settings, Download } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_BASE = 'http://localhost:8000/api';

// Sample universe options
const UNIVERSES = [
  { id: 'sp500', name: 'S&P 500', description: 'Top 500 US companies' },
  { id: 'nasdaq100', name: 'NASDAQ 100', description: 'Top 100 tech companies' },
  { id: 'dow30', name: 'DOW 30', description: 'Dow Jones Industrial Average' },
  { id: 'custom', name: 'Custom List', description: 'Your custom stock list' }
];

// Rebalancing periods
const REBALANCING_PERIODS = [
  { id: 'daily', name: 'Daily' },
  { id: 'weekly', name: 'Weekly' },
  { id: 'monthly', name: 'Monthly' },
  { id: 'quarterly', name: 'Quarterly' },
  { id: 'yearly', name: 'Yearly' }
];

// Financial filters/indicators
const FINANCIAL_FILTERS = [
  { id: 'per', name: 'P/E Ratio', min: 0, max: 100 },
  { id: 'pbr', name: 'P/B Ratio', min: 0, max: 10 },
  { id: 'roe', name: 'ROE (%)', min: -100, max: 100 },
  { id: 'debt_ratio', name: 'Debt Ratio', min: 0, max: 500 },
  { id: 'current_ratio', name: 'Current Ratio', min: 0, max: 10 },
  { id: 'market_cap', name: 'Market Cap (B)', min: 0, max: 5000 },
  { id: 'volume', name: 'Avg Volume (M)', min: 0, max: 1000 },
  { id: 'dividend_yield', name: 'Dividend Yield (%)', min: 0, max: 20 }
];

// Technical indicators
const TECHNICAL_INDICATORS = [
  { id: 'sma_50', name: '50-day SMA', type: 'overlay' },
  { id: 'sma_200', name: '200-day SMA', type: 'overlay' },
  { id: 'ema_20', name: '20-day EMA', type: 'overlay' },
  { id: 'bollinger', name: 'Bollinger Bands', type: 'overlay' },
  { id: 'rsi', name: 'RSI (14)', type: 'oscillator' },
  { id: 'macd', name: 'MACD', type: 'oscillator' },
  { id: 'stochastic', name: 'Stochastic', type: 'oscillator' }
];

const TechnicalAnalysis = ({ symbol = 'SPY' }) => {
  // State management
  const [selectedUniverse, setSelectedUniverse] = useState('sp500');
  const [rebalancingPeriod, setRebalancingPeriod] = useState('monthly');
  const [stockList, setStockList] = useState([]);
  const [selectedStocks, setSelectedStocks] = useState(new Set());
  const [filters, setFilters] = useState({});
  const [selectedIndicators, setSelectedIndicators] = useState(['sma_50', 'sma_200']);

  // Date range
  const [startDate, setStartDate] = useState('2020-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Results
  const [backtestResults, setBacktestResults] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load stock list based on universe
  useEffect(() => {
    loadStockList();
  }, [selectedUniverse]);

  const loadStockList = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/backtest/universe/${selectedUniverse}`);
      if (!response.ok) {
        throw new Error('Failed to load stock list');
      }
      const data = await response.json();
      setStockList(data.stocks || []);
    } catch (error) {
      console.error('Error loading stock list:', error);
      // Fallback to demo data
      const popularStocks = [
        { symbol: 'AAPL', name: 'Apple Inc.', price: 185.50, change: 2.3 },
        { symbol: 'MSFT', name: 'Microsoft Corporation', price: 378.25, change: 1.8 },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 141.20, change: -0.5 },
        { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 155.30, change: 3.1 },
        { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 495.80, change: 4.2 },
        { symbol: 'TSLA', name: 'Tesla Inc.', price: 242.15, change: -1.2 },
        { symbol: 'META', name: 'Meta Platforms Inc.', price: 352.90, change: 2.7 },
        { symbol: 'JPM', name: 'JPMorgan Chase & Co.', price: 158.40, change: 0.9 }
      ];
      setStockList(popularStocks);
    } finally {
      setLoading(false);
    }
  };

  const toggleStock = (symbol) => {
    const newSelected = new Set(selectedStocks);
    if (newSelected.has(symbol)) {
      newSelected.delete(symbol);
    } else {
      newSelected.add(symbol);
    }
    setSelectedStocks(newSelected);
  };

  const handleFilterChange = (filterId, value) => {
    setFilters(prev => ({ ...prev, [filterId]: value }));
  };

  const runBacktest = async () => {
    if (selectedStocks.size === 0) {
      alert('Please select at least one stock');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/backtest/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbols: Array.from(selectedStocks),
          start_date: startDate,
          end_date: endDate,
          rebalancing_period: rebalancingPeriod,
          initial_capital: 10000.0
        })
      });

      if (!response.ok) {
        throw new Error('Backtest failed');
      }

      const result = await response.json();
      const data = result.data;

      // Process portfolio values for chart
      const chartPoints = data.portfolio_values.map((pv, idx) => ({
        date: pv.date,
        portfolio: pv.value / 100,  // Normalize to start at 100
        benchmark: data.benchmark_values[idx]?.value / 100 || 100
      }));

      setChartData(chartPoints);

      // Set results
      setBacktestResults({
        yearlyReturns: data.yearly_returns,
        stats: data.statistics
      });

    } catch (error) {
      console.error('Error running backtest:', error);
      alert('Failed to run backtest. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 p-6 bg-[#0a0e14]">
      {/* Top Section: 3-column layout */}
      <div className="grid grid-cols-12 gap-4" style={{ height: '500px' }}>
        {/* Left Panel: Stock Selection */}
        <div className="col-span-3 bg-[#1a1a1a] rounded-lg border border-gray-800 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-lg font-semibold text-white mb-4">Universe</h3>
            <select
              value={selectedUniverse}
              onChange={(e) => setSelectedUniverse(e.target.value)}
              className="w-full bg-gray-800 text-white rounded px-3 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none"
            >
              {UNIVERSES.map(universe => (
                <option key={universe.id} value={universe.id}>
                  {universe.name}
                </option>
              ))}
            </select>

            <div className="mt-4">
              <label className="text-sm text-gray-400 mb-2 block">Rebalancing</label>
              <select
                value={rebalancingPeriod}
                onChange={(e) => setRebalancingPeriod(e.target.value)}
                className="w-full bg-gray-800 text-white rounded px-3 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none"
              >
                {REBALANCING_PERIODS.map(period => (
                  <option key={period.id} value={period.id}>
                    {period.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stock List */}
          <div className="flex-1 overflow-y-auto p-4">
            <h4 className="text-sm font-semibold text-gray-400 mb-3">Stocks ({stockList.length})</h4>
            <div className="space-y-1">
              {stockList.map(stock => (
                <div
                  key={stock.symbol}
                  onClick={() => toggleStock(stock.symbol)}
                  className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                    selectedStocks.has(stock.symbol)
                      ? 'bg-blue-600/20 border border-blue-500'
                      : 'hover:bg-gray-800 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedStocks.has(stock.symbol)}
                      onChange={() => {}}
                      className="accent-blue-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium text-sm">{stock.symbol}</div>
                      <div className="text-gray-500 text-xs truncate">{stock.name}</div>
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <div className="text-white text-sm">${stock.price}</div>
                    <div className={`text-xs ${stock.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {stock.change >= 0 ? '+' : ''}{stock.change}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filter Summary */}
          <div className="p-4 border-t border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Selected Stocks</span>
              <span className="text-white font-semibold">{selectedStocks.size}</span>
            </div>
          </div>
        </div>

        {/* Center Panel: Chart */}
        <div className="col-span-6 bg-[#1a1a1a] rounded-lg border border-gray-800 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Portfolio Performance</h3>
            <div className="flex items-center gap-2">
              {TECHNICAL_INDICATORS.filter(ind => ind.type === 'overlay').map(indicator => (
                <button
                  key={indicator.id}
                  onClick={() => {
                    setSelectedIndicators(prev =>
                      prev.includes(indicator.id)
                        ? prev.filter(id => id !== indicator.id)
                        : [...prev, indicator.id]
                    );
                  }}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    selectedIndicators.includes(indicator.id)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {indicator.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#666', fontSize: 11 }}
                    tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                  />
                  <YAxis tick={{ fill: '#666', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="portfolio" stroke="#22c55e" strokeWidth={2} name="Portfolio" dot={false} />
                  <Line type="monotone" dataKey="benchmark" stroke="#6366f1" strokeWidth={2} name="Benchmark" dot={false} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <TrendingUp className="mx-auto mb-4 text-gray-600" size={48} />
                  <p className="text-gray-400">Run backtest to see portfolio performance</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Controls & Filters */}
        <div className="col-span-3 bg-[#1a1a1a] rounded-lg border border-gray-800 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-lg font-semibold text-white mb-4">Settings</h3>

            {/* Date Range */}
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-gray-800 text-white rounded px-3 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-gray-800 text-white rounded px-3 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
                />
              </div>
            </div>

            {/* Run Button */}
            <button
              onClick={runBacktest}
              disabled={loading || selectedStocks.size === 0}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors text-white font-semibold"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Running...
                </>
              ) : (
                <>
                  <Play size={18} />
                  Run Backtest
                </>
              )}
            </button>
          </div>

          {/* Financial Filters */}
          <div className="flex-1 overflow-y-auto p-4">
            <h4 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
              <Filter size={16} />
              Financial Filters
            </h4>
            <div className="space-y-3">
              {FINANCIAL_FILTERS.map(filter => (
                <div key={filter.id} className="bg-gray-800/50 rounded p-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-300">{filter.name}</label>
                    <span className="text-xs text-gray-500">{filters[filter.id] || filter.min} - {filter.max}</span>
                  </div>
                  <input
                    type="range"
                    min={filter.min}
                    max={filter.max}
                    value={filters[filter.id] || filter.min}
                    onChange={(e) => handleFilterChange(filter.id, parseFloat(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Results */}
      {backtestResults && (
        <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Backtest Results</h3>
            <button className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded transition-colors text-gray-300 text-sm">
              <Download size={16} />
              Export
            </button>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Yearly Returns Chart */}
            <div className="col-span-8">
              <h4 className="text-sm font-semibold text-gray-400 mb-4">Annual Returns</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={backtestResults.yearlyReturns}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="year" tick={{ fill: '#666' }} />
                  <YAxis tick={{ fill: '#666' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value) => `${value}%`}
                  />
                  <Legend />
                  <Bar dataKey="return" fill="#3b82f6" name="Portfolio" />
                  <Bar dataKey="benchmark" fill="#6366f1" name="Benchmark" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Statistics */}
            <div className="col-span-4">
              <h4 className="text-sm font-semibold text-gray-400 mb-4">Performance Statistics</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800/50 rounded p-3">
                  <div className="text-xs text-gray-400 mb-1">Total Return</div>
                  <div className="text-lg font-bold text-green-500">+{backtestResults.stats.totalReturn}%</div>
                </div>
                <div className="bg-gray-800/50 rounded p-3">
                  <div className="text-xs text-gray-400 mb-1">Annual Return</div>
                  <div className="text-lg font-bold text-white">{backtestResults.stats.annualizedReturn}%</div>
                </div>
                <div className="bg-gray-800/50 rounded p-3">
                  <div className="text-xs text-gray-400 mb-1">Volatility</div>
                  <div className="text-lg font-bold text-white">{backtestResults.stats.volatility}%</div>
                </div>
                <div className="bg-gray-800/50 rounded p-3">
                  <div className="text-xs text-gray-400 mb-1">Sharpe Ratio</div>
                  <div className="text-lg font-bold text-white">{backtestResults.stats.sharpeRatio}</div>
                </div>
                <div className="bg-gray-800/50 rounded p-3">
                  <div className="text-xs text-gray-400 mb-1">Max Drawdown</div>
                  <div className="text-lg font-bold text-red-500">{backtestResults.stats.maxDrawdown}%</div>
                </div>
                <div className="bg-gray-800/50 rounded p-3">
                  <div className="text-xs text-gray-400 mb-1">Win Rate</div>
                  <div className="text-lg font-bold text-white">{backtestResults.stats.winRate}%</div>
                </div>
                <div className="bg-gray-800/50 rounded p-3">
                  <div className="text-xs text-gray-400 mb-1">Total Trades</div>
                  <div className="text-lg font-bold text-white">{backtestResults.stats.trades}</div>
                </div>
                <div className="bg-gray-800/50 rounded p-3">
                  <div className="text-xs text-gray-400 mb-1">Avg Hold (days)</div>
                  <div className="text-lg font-bold text-white">{backtestResults.stats.avgHoldingPeriod}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicalAnalysis;
