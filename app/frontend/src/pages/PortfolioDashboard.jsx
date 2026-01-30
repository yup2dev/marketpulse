/**
 * Portfolio Dashboard - Hyperliquid Style
 * Main portfolio management page with dark theme
 */
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, DollarSign, PieChart,
  ArrowUpRight, RefreshCw, Filter, ChevronDown
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart
} from 'recharts';
import toast from 'react-hot-toast';
import { portfolioAPI } from '../config/api';
import CreatePortfolioModal from '../components/portfolio/CreatePortfolioModal';

// Tab configuration - Analysis style tabs
const PORTFOLIO_TABS = [
  'Overview',
  'Balances',
  'Positions',
  'Open Orders',
  'Trade History',
  'Dividends',
  'Deposits & Withdrawals'
];

// Period options
const PERIOD_OPTIONS = [
  { id: '1D', label: '1D' },
  { id: '7D', label: '7D' },
  { id: '30D', label: '30D' },
  { id: '90D', label: '90D' },
  { id: '1Y', label: '1Y' },
  { id: 'ALL', label: 'ALL' },
];

// Account type options
const ACCOUNT_TYPES = [
  { id: 'all', label: 'All Accounts' },
  { id: 'stock', label: 'Stock Account' },
  { id: 'futures', label: 'Futures Account' },
  { id: 'earn', label: 'Earn Account' },
];

export default function PortfolioDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [portfolios, setPortfolios] = useState([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('30D');
  const [selectedAccountType, setSelectedAccountType] = useState('all');
  const [hideSmallBalances, setHideSmallBalances] = useState(false);
  const [chartTab, setChartTab] = useState('value'); // 'value' or 'pnl'

  // Get active tab from URL (default to 'overview')
  const activeTab = searchParams.get('tab') || 'overview';

  // Tab change handler - updates URL (converts tab name to URL-friendly format)
  const handleTabChange = (tabName) => {
    const tabId = tabName.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
    navigate(`/portfolios?tab=${tabId}`, { replace: true });
  };

  // Check if tab is active
  const isTabActive = (tabName) => {
    const tabId = tabName.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
    return activeTab === tabId;
  };

  // Mock data for demonstration
  const [stats, setStats] = useState({
    pnl: 0,
    volume: 0,
    maxDrawdown: 0,
    totalEquity: 0,
    stockEquity: 0,
    futuresEquity: 0,
    earnBalance: 0,
  });

  const [holdings, setHoldings] = useState([]);
  const [pnlHistory, setPnlHistory] = useState([]);

  useEffect(() => {
    loadPortfolios();
    loadMockData();
  }, []);

  const loadPortfolios = async () => {
    try {
      setIsLoading(true);
      const response = await portfolioAPI.getAll();
      setPortfolios(response.data || []);
      if (response.data?.length > 0) {
        setSelectedPortfolio(response.data[0]);
      }
    } catch (error) {
      console.error('Portfolio loading error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMockData = () => {
    // Mock PNL history data
    const mockPnlHistory = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      value: 10000 + Math.random() * 2000 - 500 + i * 50,
      pnl: Math.random() * 200 - 50 + i * 5,
    }));
    setPnlHistory(mockPnlHistory);

    // Mock holdings
    setHoldings([
      { symbol: 'AAPL', name: 'Apple Inc.', quantity: 100, avgCost: 150, currentPrice: 175, value: 17500, pnl: 2500, pnlPct: 16.67 },
      { symbol: 'NVDA', name: 'NVIDIA Corp.', quantity: 50, avgCost: 180, currentPrice: 240, value: 12000, pnl: 3000, pnlPct: 33.33 },
      { symbol: 'MSFT', name: 'Microsoft Corp.', quantity: 30, avgCost: 280, currentPrice: 310, value: 9300, pnl: 900, pnlPct: 10.71 },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', quantity: 20, avgCost: 120, currentPrice: 140, value: 2800, pnl: 400, pnlPct: 16.67 },
    ]);

    // Calculate stats
    setStats({
      pnl: 6800,
      volume: 45678,
      maxDrawdown: -5.23,
      totalEquity: 41600,
      stockEquity: 41600,
      futuresEquity: 0,
      earnBalance: 0,
    });
  };

  const handleCreatePortfolio = async (data) => {
    try {
      await portfolioAPI.create(data);
      toast.success('Portfolio created successfully');
      setShowCreateModal(false);
      loadPortfolios();
    } catch (error) {
      toast.error('Failed to create portfolio');
      console.error(error);
    }
  };

  const filteredHoldings = useMemo(() => {
    if (!hideSmallBalances) return holdings;
    return holdings.filter(h => h.value >= 10);
  }, [holdings, hideSmallBalances]);

  const formatCurrency = (value, decimals = 2) => {
    if (value === null || value === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return '0.00%';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  return (
    <div className="text-white bg-[#0a0a0f] min-h-screen">
      <div className="w-full px-4 py-4">
        {/* Page Header */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white">Portfolio</h2>
          <p className="text-sm text-gray-400">Manage your assets, positions, and trading history</p>
        </div>

        {/* Tabs - Analysis Style */}
        <div className="border-b border-gray-800 mb-6">
          <div className="flex gap-6">
            {PORTFOLIO_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                  isTabActive(tab)
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab}
                {isTabActive(tab) && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <>
            {/* Summary Cards Grid */}
            <div className="grid grid-cols-12 gap-4 mb-6">
              {/* Left Column - Volume & Fees */}
              <div className="col-span-12 lg:col-span-2 space-y-4">
                {/* Volume Card */}
                <div className="bg-[#0d0d12] rounded-lg p-4 border border-gray-800">
                  <div className="text-sm text-gray-400 mb-2">14 Day Volume</div>
                  <div className="text-2xl font-bold">{formatCurrency(stats.volume)}</div>
                  <button className="text-cyan-400 text-sm mt-2 hover:underline">
                    View Volume
                  </button>
                </div>

                {/* Fees Card */}
                <div className="bg-[#0d0d12] rounded-lg p-4 border border-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Fees (Taker / Maker)</span>
                    <ChevronDown size={16} className="text-gray-400" />
                  </div>
                  <div className="text-xl font-bold">0.10% / 0.05%</div>
                  <button className="text-cyan-400 text-sm mt-2 hover:underline">
                    View Fee Schedule
                  </button>
                </div>
              </div>

              {/* Center Column - Stats */}
              <div className="col-span-12 lg:col-span-4">
                <div className="bg-[#0d0d12] rounded-lg p-4 border border-gray-800 h-full">
                  {/* Header with dropdowns */}
                  <div className="flex items-center justify-between mb-4">
                    <select
                      value={selectedAccountType}
                      onChange={(e) => setSelectedAccountType(e.target.value)}
                      className="bg-transparent text-white text-sm border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-cyan-500"
                    >
                      {ACCOUNT_TYPES.map(type => (
                        <option key={type.id} value={type.id} className="bg-[#0d0d12]">
                          {type.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedPeriod}
                      onChange={(e) => setSelectedPeriod(e.target.value)}
                      className="bg-transparent text-white text-sm border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-cyan-500"
                    >
                      {PERIOD_OPTIONS.map(period => (
                        <option key={period.id} value={period.id} className="bg-[#0d0d12]">
                          {period.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Stats Grid */}
                  <div className="space-y-3">
                    <StatRow label="PNL" value={formatCurrency(stats.pnl)} positive={stats.pnl >= 0} />
                    <StatRow label="Volume" value={formatCurrency(stats.volume)} />
                    <StatRow label="Max Drawdown" value={formatPercent(stats.maxDrawdown)} negative={stats.maxDrawdown < 0} />
                    <StatRow label="Total Equity" value={formatCurrency(stats.totalEquity)} />
                    <StatRow label="Stock Equity" value={formatCurrency(stats.stockEquity)} />
                    <StatRow label="Futures Equity" value={formatCurrency(stats.futuresEquity)} />
                    <StatRow label="Earn Balance" value={formatCurrency(stats.earnBalance)} />
                  </div>
                </div>
              </div>

              {/* Right Column - Chart */}
              <div className="col-span-12 lg:col-span-6">
                <div className="bg-[#0d0d12] rounded-lg p-4 border border-gray-800 h-full">
                  {/* Chart Tabs */}
                  <div className="flex items-center gap-4 mb-4">
                    <button
                      onClick={() => setChartTab('value')}
                      className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                        chartTab === 'value'
                          ? 'text-white border-cyan-500'
                          : 'text-gray-400 border-transparent hover:text-gray-300'
                      }`}
                    >
                      Account Value
                    </button>
                    <button
                      onClick={() => setChartTab('pnl')}
                      className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                        chartTab === 'pnl'
                          ? 'text-white border-cyan-500'
                          : 'text-gray-400 border-transparent hover:text-gray-300'
                      }`}
                    >
                      PNL
                    </button>
                  </div>

                  {/* Chart */}
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={pnlHistory}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: '#666', fontSize: 11 }}
                          tickFormatter={(date) => date.slice(5)}
                        />
                        <YAxis
                          tick={{ fill: '#666', fontSize: 11 }}
                          tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #333',
                            borderRadius: '8px',
                          }}
                          labelStyle={{ color: '#888' }}
                        />
                        <Area
                          type="monotone"
                          dataKey={chartTab === 'value' ? 'value' : 'pnl'}
                          stroke="#22c55e"
                          fill="url(#colorValue)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Holdings */}
            <div className="bg-[#0d0d12] rounded-lg p-4 border border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Top Holdings</h3>
                <button
                  onClick={() => handleTabChange('Balances')}
                  className="text-cyan-400 text-sm hover:underline"
                >
                  View All
                </button>
              </div>
              <BalancesTable holdings={filteredHoldings.slice(0, 5)} formatCurrency={formatCurrency} formatPercent={formatPercent} />
            </div>
          </>
        )}

        {activeTab === 'balances' && (
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-lg font-semibold">Balances</h3>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-white">
                  <Filter size={16} />
                  Filter
                </button>
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hideSmallBalances}
                    onChange={(e) => setHideSmallBalances(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  Hide Small Balances
                </label>
              </div>
            </div>
            <div className="p-4">
              <BalancesTable holdings={filteredHoldings} formatCurrency={formatCurrency} formatPercent={formatPercent} />
            </div>
          </div>
        )}

        {activeTab === 'positions' && (
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-lg font-semibold">Positions</h3>
              <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-white">
                <Filter size={16} />
                Filter
              </button>
            </div>
            <div className="p-4">
              <PositionsTable holdings={filteredHoldings} formatCurrency={formatCurrency} formatPercent={formatPercent} />
            </div>
          </div>
        )}

        {activeTab === 'open-orders' && (
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
            <EmptyState message="No open orders" />
          </div>
        )}

        {activeTab === 'trade-history' && (
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
            <EmptyState message="No trade history" />
          </div>
        )}

        {activeTab === 'dividends' && (
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
            <EmptyState message="No dividend records" />
          </div>
        )}

        {activeTab === 'deposits-withdrawals' && (
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
            <EmptyState message="No deposit/withdrawal records" />
          </div>
        )}
      </div>

      {/* Create Portfolio Modal */}
      {showCreateModal && (
        <CreatePortfolioModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreatePortfolio}
        />
      )}
    </div>
  );
}

// Stat Row Component
function StatRow({ label, value, positive, negative }) {
  let valueClass = 'text-white';
  if (positive) valueClass = 'text-green-400';
  if (negative) valueClass = 'text-red-400';

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-400">{label}</span>
      <span className={`text-sm font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}

// Balances Table Component
function BalancesTable({ holdings, formatCurrency, formatPercent }) {
  if (holdings.length === 0) {
    return <EmptyState message="No balances yet" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
            <th className="pb-3 font-medium">Coin</th>
            <th className="pb-3 font-medium text-right">Total Balance</th>
            <th className="pb-3 font-medium text-right">Available Balance</th>
            <th className="pb-3 font-medium text-right">USD Value</th>
            <th className="pb-3 font-medium text-right">PNL (ROE %)</th>
            <th className="pb-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding) => (
            <tr key={holding.symbol} className="border-b border-gray-800/50 hover:bg-gray-800/30">
              <td className="py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold">
                    {holding.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-medium">{holding.symbol}</div>
                    <div className="text-xs text-gray-400">{holding.name}</div>
                  </div>
                </div>
              </td>
              <td className="py-4 text-right">{holding.quantity}</td>
              <td className="py-4 text-right">{holding.quantity}</td>
              <td className="py-4 text-right">{formatCurrency(holding.value)}</td>
              <td className="py-4 text-right">
                <div className={holding.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {formatCurrency(holding.pnl)}
                </div>
                <div className={`text-xs ${holding.pnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ({formatPercent(holding.pnlPct)})
                </div>
              </td>
              <td className="py-4 text-right">
                <button className="text-cyan-400 hover:text-cyan-300 text-sm">
                  Trade
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Positions Table Component
function PositionsTable({ holdings, formatCurrency, formatPercent }) {
  if (holdings.length === 0) {
    return <EmptyState message="No open positions" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
            <th className="pb-3 font-medium">Symbol</th>
            <th className="pb-3 font-medium text-right">Entry Price</th>
            <th className="pb-3 font-medium text-right">Current Price</th>
            <th className="pb-3 font-medium text-right">Quantity</th>
            <th className="pb-3 font-medium text-right">Unrealized PNL</th>
            <th className="pb-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding) => (
            <tr key={holding.symbol} className="border-b border-gray-800/50 hover:bg-gray-800/30">
              <td className="py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold">
                    {holding.symbol.slice(0, 2)}
                  </div>
                  <div className="font-medium">{holding.symbol}</div>
                </div>
              </td>
              <td className="py-4 text-right">{formatCurrency(holding.avgCost)}</td>
              <td className="py-4 text-right">{formatCurrency(holding.currentPrice)}</td>
              <td className="py-4 text-right">{holding.quantity}</td>
              <td className="py-4 text-right">
                <div className={holding.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {formatCurrency(holding.pnl)} ({formatPercent(holding.pnlPct)})
                </div>
              </td>
              <td className="py-4 text-right">
                <button className="text-red-400 hover:text-red-300 text-sm">
                  Close
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Empty State Component
function EmptyState({ message }) {
  return (
    <div className="text-center py-12">
      <div className="text-gray-500">{message}</div>
    </div>
  );
}
