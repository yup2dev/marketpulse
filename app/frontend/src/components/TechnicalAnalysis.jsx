import { useState, useEffect } from 'react';
import { Play, Calendar, TrendingUp, Filter, Settings, Download, X, Save, FolderOpen, Bookmark } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import TickerSearch from './TickerSearch';

const API_BASE = 'http://localhost:8000/api';

// Rebalancing periods
const REBALANCING_PERIODS = [
  { id: 'daily', name: 'Daily' },
  { id: 'weekly', name: 'Weekly' },
  { id: 'monthly', name: 'Monthly' },
  { id: 'quarterly', name: 'Quarterly' },
  { id: 'yearly', name: 'Yearly' }
];

// Benchmark options (indices)
const BENCHMARK_OPTIONS = [
  { id: 'SPY', name: 'S&P 500 (SPY)', description: 'Large Cap US Stocks' },
  { id: 'QQQ', name: 'NASDAQ 100 (QQQ)', description: 'Tech & Growth' },
  { id: 'DIA', name: 'Dow Jones (DIA)', description: 'Blue Chip Stocks' },
  { id: 'IWM', name: 'Russell 2000 (IWM)', description: 'Small Cap US' },
  { id: 'VTI', name: 'Total Market (VTI)', description: 'Total US Market' },
  { id: 'EFA', name: 'Developed Int\'l (EFA)', description: 'International Stocks' },
  { id: 'AGG', name: 'Total Bond (AGG)', description: 'US Bond Market' }
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
  const [rebalancingPeriod, setRebalancingPeriod] = useState('monthly');
  const [selectedStocks, setSelectedStocks] = useState([]);
  const [filters, setFilters] = useState({});
  const [selectedIndicators, setSelectedIndicators] = useState(['sma_50', 'sma_200']);

  // Benchmark selection
  const [selectedBenchmark, setSelectedBenchmark] = useState('SPY');
  const [showBenchmarkSelector, setShowBenchmarkSelector] = useState(false);

  // Date range
  const [startDate, setStartDate] = useState('2020-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Results
  const [backtestResults, setBacktestResults] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [stockChartData, setStockChartData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Portfolio management
  const [portfolioName, setPortfolioName] = useState('');
  const [savedPortfolios, setSavedPortfolios] = useState([]);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);

  // Load saved portfolios from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('saved-portfolios');
    if (saved) {
      try {
        setSavedPortfolios(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading portfolios:', e);
      }
    }
  }, []);

  const handleStockSelect = (stock) => {
    // Check if stock already exists
    if (!selectedStocks.find(s => s.symbol === stock.symbol)) {
      setSelectedStocks([...selectedStocks, stock]);
    }
  };

  const removeStock = (symbol) => {
    setSelectedStocks(selectedStocks.filter(s => s.symbol !== symbol));
  };

  const handleFilterChange = (filterId, value) => {
    setFilters(prev => ({ ...prev, [filterId]: value }));
  };

  const savePortfolio = () => {
    if (!portfolioName.trim()) {
      alert('Please enter a portfolio name');
      return;
    }
    if (selectedStocks.length === 0) {
      alert('Please select at least one stock');
      return;
    }

    const newPortfolio = {
      id: Date.now(),
      name: portfolioName,
      stocks: selectedStocks,
      benchmark: selectedBenchmark,
      rebalancing: rebalancingPeriod,
      created: new Date().toISOString()
    };

    const updated = [...savedPortfolios, newPortfolio];
    setSavedPortfolios(updated);
    localStorage.setItem('saved-portfolios', JSON.stringify(updated));
    setPortfolioName('');
    setShowPortfolioModal(false);
    alert(`Portfolio "${portfolioName}" saved successfully!`);
  };

  const loadPortfolio = (portfolio) => {
    setSelectedStocks(portfolio.stocks);
    setSelectedBenchmark(portfolio.benchmark);
    setRebalancingPeriod(portfolio.rebalancing);
    setShowPortfolioModal(false);
  };

  const deletePortfolio = (portfolioId) => {
    if (confirm('Are you sure you want to delete this portfolio?')) {
      const updated = savedPortfolios.filter(p => p.id !== portfolioId);
      setSavedPortfolios(updated);
      localStorage.setItem('saved-portfolios', JSON.stringify(updated));
    }
  };

  const fetchStockData = async (symbols, startDate, endDate) => {
    try {
      const dataPromises = symbols.map(async (symbol) => {
        // Use start_date and end_date parameters instead of period=max
        const response = await fetch(
          `${API_BASE}/stock/history/${symbol}?start_date=${startDate}&end_date=${endDate}`
        );
        if (response.ok) {
          const data = await response.json();
          return { symbol, data: data.data };
        }
        return { symbol, data: [] };
      });

      const results = await Promise.all(dataPromises);

      // Format for chart (no need to filter since we're using date range in API)
      const formattedData = {};
      results.forEach(({ symbol, data }) => {
        formattedData[symbol] = data.map(d => ({
          date: d.date.substring(0, 10), // Normalize to YYYY-MM-DD
          value: d.close
        }));
      });

      return formattedData;
    } catch (error) {
      console.error('Error fetching stock data:', error);
      return {};
    }
  };

  const runBacktest = async () => {
    if (selectedStocks.length === 0) {
      alert('Please select at least one stock');
      return;
    }

    setLoading(true);
    try {
      // Fetch backtest results
      const backtestResponse = await fetch(`${API_BASE}/backtest/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbols: selectedStocks.map(s => s.symbol),
          startDate: startDate,
          endDate: endDate,
          rebalancingPeriod: rebalancingPeriod,
          initialCapital: 10000.0
        })
      });

      if (!backtestResponse.ok) {
        throw new Error('Backtest failed');
      }

      const result = await backtestResponse.json();

      // Fetch individual stock data for the date range
      const stockData = await fetchStockData(
        selectedStocks.map(s => s.symbol),
        startDate,
        endDate
      );

      // Fetch benchmark data using date range
      const benchmarkResponse = await fetch(
        `${API_BASE}/stock/history/${selectedBenchmark}?start_date=${startDate}&end_date=${endDate}`
      );
      let benchmarkData = [];
      if (benchmarkResponse.ok) {
        const benchData = await benchmarkResponse.json();
        benchmarkData = benchData.data.map(d => ({
          date: d.date.substring(0, 10), // Normalize to YYYY-MM-DD
          value: d.close
        }));
      }

      // Normalize benchmark to start at 100
      if (benchmarkData.length > 0) {
        const benchmarkStart = benchmarkData[0].value;
        benchmarkData = benchmarkData.map(d => ({
          date: d.date,
          value: (d.value / benchmarkStart) * 100
        }));
      }

      // Normalize portfolio data to start at 100
      const portfolioStart = result.portfolioData.length > 0 ? result.portfolioData[0].value : 1;

      // Create date maps for faster lookup
      const benchmarkMap = {};
      benchmarkData.forEach(b => {
        benchmarkMap[b.date] = b.value;
      });

      const stockMaps = {};
      Object.keys(stockData).forEach(symbol => {
        stockMaps[symbol] = {};
        const symbolData = stockData[symbol];
        if (symbolData.length > 0) {
          const firstValue = symbolData[0].value;
          symbolData.forEach(s => {
            stockMaps[symbol][s.date] = (s.value / firstValue) * 100;
          });
        }
      });

      // Process portfolio values for chart
      const chartPoints = result.portfolioData.map((pv, idx) => {
        // Normalize date to YYYY-MM-DD
        const normalizedDate = pv.date.substring(0, 10);

        const point = {
          date: normalizedDate,
          portfolio: (pv.value / portfolioStart) * 100,  // Normalize to start at 100
        };

        // Add benchmark data
        if (benchmarkMap[normalizedDate] !== undefined) {
          point.benchmark = benchmarkMap[normalizedDate];
        }

        // Add individual stock data
        selectedStocks.forEach(stock => {
          if (stockMaps[stock.symbol] && stockMaps[stock.symbol][normalizedDate] !== undefined) {
            point[stock.symbol] = stockMaps[stock.symbol][normalizedDate];
          }
        });

        return point;
      });

      // Debug logging
      console.log('=== Backtest Debug Info ===');
      console.log('Selected stocks:', selectedStocks.map(s => s.symbol));
      console.log('Stock data keys:', Object.keys(stockData));
      console.log('Stock data samples:', Object.keys(stockData).map(k => ({
        symbol: k,
        count: stockData[k]?.length || 0,
        firstDate: stockData[k]?.[0]?.date,
        firstValue: stockData[k]?.[0]?.value
      })));
      console.log('Benchmark data length:', benchmarkData.length);
      console.log('Benchmark sample:', benchmarkData.slice(0, 2));
      console.log('Chart points count:', chartPoints.length);
      console.log('First chart point:', chartPoints[0]);
      console.log('Last chart point:', chartPoints[chartPoints.length - 1]);

      setChartData(chartPoints);
      setStockChartData(stockData);

      // Set results
      setBacktestResults({
        yearlyReturns: result.yearlyReturns,
        stats: result.stats
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
            <h3 className="text-lg font-semibold text-white mb-4">Add Stocks</h3>

            {/* Stock Search */}
            <TickerSearch
              onSelect={handleStockSelect}
              placeholder="Search stocks to add..."
            />

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

          {/* Selected Stocks List */}
          <div className="flex-1 overflow-y-auto p-4">
            <h4 className="text-sm font-semibold text-gray-400 mb-3">Selected Stocks ({selectedStocks.length})</h4>
            {selectedStocks.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                Search and add stocks to begin
              </div>
            ) : (
              <div className="space-y-2">
                {selectedStocks.map(stock => (
                  <div
                    key={stock.symbol}
                    className="flex items-center justify-between p-2 rounded bg-gray-800/50 border border-gray-700 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium text-sm">{stock.symbol}</div>
                      <div className="text-gray-500 text-xs truncate">{stock.name}</div>
                    </div>
                    <button
                      onClick={() => removeStock(stock.symbol)}
                      className="ml-2 p-1 hover:bg-red-600/20 rounded text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stock Count Summary & Portfolio Actions */}
          <div className="p-4 border-t border-gray-800 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Total Stocks</span>
              <span className="text-white font-semibold">{selectedStocks.length}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPortfolioModal(true)}
                disabled={selectedStocks.length === 0}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-green-600/20 hover:bg-green-600/30 disabled:bg-gray-700/20 disabled:cursor-not-allowed rounded text-green-500 disabled:text-gray-500 text-xs font-medium transition-colors"
                title="Save Portfolio"
              >
                <Save size={14} />
                Save
              </button>
              <button
                onClick={() => setShowPortfolioModal('load')}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-blue-600/20 hover:bg-blue-600/30 rounded text-blue-500 text-xs font-medium transition-colors"
                title="Load Portfolio"
              >
                <FolderOpen size={14} />
                Load
              </button>
            </div>
          </div>
        </div>

        {/* Center Panel: Chart */}
        <div className="col-span-6 bg-[#1a1a1a] rounded-lg border border-gray-800 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Portfolio Performance</h3>
              <p className="text-xs text-gray-500">
                {startDate} to {endDate}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowBenchmarkSelector(!showBenchmarkSelector)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300 transition-colors border border-gray-700"
                >
                  <Bookmark size={14} />
                  {BENCHMARK_OPTIONS.find(b => b.id === selectedBenchmark)?.name || 'Select Benchmark'}
                </button>
                {showBenchmarkSelector && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
                    <div className="p-2 border-b border-gray-700">
                      <p className="text-xs font-semibold text-gray-400">Select Benchmark</p>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {BENCHMARK_OPTIONS.map(bench => (
                        <button
                          key={bench.id}
                          onClick={() => {
                            setSelectedBenchmark(bench.id);
                            setShowBenchmarkSelector(false);
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-gray-700 transition-colors ${
                            selectedBenchmark === bench.id ? 'bg-blue-600/20' : ''
                          }`}
                        >
                          <div className="text-sm font-medium text-white">{bench.name}</div>
                          <div className="text-xs text-gray-400">{bench.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
                  <YAxis tick={{ fill: '#666', fontSize: 11 }} label={{ value: 'Normalized (Start = 100)', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value) => value.toFixed(2)}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="portfolio" stroke="#22c55e" strokeWidth={3} name="Portfolio" dot={false} />
                  <Line type="monotone" dataKey="benchmark" stroke="#6366f1" strokeWidth={2} name={selectedBenchmark} dot={false} strokeDasharray="5 5" />
                  {selectedStocks.map((stock, idx) => (
                    <Line
                      key={stock.symbol}
                      type="monotone"
                      dataKey={stock.symbol}
                      stroke={`hsl(${(idx * 360) / selectedStocks.length}, 70%, 60%)`}
                      strokeWidth={1.5}
                      name={stock.symbol}
                      dot={false}
                      opacity={0.6}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <TrendingUp className="mx-auto mb-4 text-gray-600" size={48} />
                  <p className="text-gray-400">Select stocks and run backtest to see performance</p>
                  <p className="text-gray-500 text-sm mt-2">Portfolio vs {selectedBenchmark} vs Individual Stocks</p>
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
              disabled={loading || selectedStocks.length === 0}
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

      {/* Portfolio Modal */}
      {showPortfolioModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPortfolioModal(false)}>
          <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            {showPortfolioModal === 'load' ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Load Portfolio</h3>
                  <button
                    onClick={() => setShowPortfolioModal(false)}
                    className="text-gray-400 hover:text-white p-1"
                  >
                    <X size={20} />
                  </button>
                </div>
                {savedPortfolios.length === 0 ? (
                  <div className="text-center py-8">
                    <Bookmark className="mx-auto mb-3 text-gray-600" size={40} />
                    <p className="text-gray-400">No saved portfolios</p>
                    <p className="text-gray-500 text-sm mt-1">Create and save a portfolio to get started</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {savedPortfolios.map(portfolio => (
                      <div
                        key={portfolio.id}
                        className="p-3 bg-gray-800/50 rounded border border-gray-700 hover:border-gray-600 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="text-white font-medium">{portfolio.name}</h4>
                            <p className="text-xs text-gray-500">
                              {new Date(portfolio.created).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => loadPortfolio(portfolio)}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-xs font-medium transition-colors"
                            >
                              Load
                            </button>
                            <button
                              onClick={() => deletePortfolio(portfolio.id)}
                              className="p-1 hover:bg-red-600/20 rounded text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {portfolio.stocks.slice(0, 5).map(stock => (
                            <span key={stock.symbol} className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">
                              {stock.symbol}
                            </span>
                          ))}
                          {portfolio.stocks.length > 5 && (
                            <span className="px-2 py-0.5 text-xs text-gray-500">
                              +{portfolio.stocks.length - 5} more
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                          <span>Benchmark: {portfolio.benchmark}</span>
                          <span>•</span>
                          <span>Rebal: {portfolio.rebalancing}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Save Portfolio</h3>
                  <button
                    onClick={() => setShowPortfolioModal(false)}
                    className="text-gray-400 hover:text-white p-1"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Portfolio Name</label>
                    <input
                      type="text"
                      value={portfolioName}
                      onChange={(e) => setPortfolioName(e.target.value)}
                      placeholder="e.g., Tech Growth Portfolio"
                      className="w-full bg-gray-800 text-white rounded px-3 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <div className="bg-gray-800/50 rounded p-3">
                    <div className="text-sm text-gray-400 mb-2">Portfolio Details</div>
                    <div className="space-y-1 text-xs text-gray-300">
                      <div className="flex justify-between">
                        <span>Stocks:</span>
                        <span className="font-medium text-white">{selectedStocks.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Benchmark:</span>
                        <span className="font-medium text-white">{selectedBenchmark}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Rebalancing:</span>
                        <span className="font-medium text-white capitalize">{rebalancingPeriod}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowPortfolioModal(false)}
                      className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors text-white font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={savePortfolio}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition-colors text-white font-medium"
                    >
                      Save Portfolio
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicalAnalysis;
