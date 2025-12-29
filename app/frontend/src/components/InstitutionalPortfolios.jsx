import { useState, useEffect } from 'react';
import {
  Building2,
  TrendingUp,
  TrendingDown,
  Search,
  ChevronDown,
  ChevronUp,
  BarChart3,
  PieChart,
  Activity,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Card from './widgets/common/Card';
import MetricCard from './widgets/common/MetricCard';
import SectionHeader from './widgets/common/SectionHeader';

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'http://localhost:8000/api';

/**
 * InstitutionalPortfolios Component
 * Displays 13F institutional holdings with pagination and filtering
 */
const InstitutionalPortfolios = () => {
  // State management
  const [institutions, setInstitutions] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  const [filteredPortfolios, setFilteredPortfolios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPortfolio, setExpandedPortfolio] = useState(null);
  const [sortBy, setSortBy] = useState('total_value');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedInstitution, setSelectedInstitution] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Load institutions list only on mount (no portfolio data)
  useEffect(() => {
    fetchInstitutions();
  }, []);

  // Filter and sort portfolios when search or sort changes
  useEffect(() => {
    filterAndSortPortfolios();
  }, [portfolios, searchTerm, sortBy, sortOrder]);

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredPortfolios]);

  const fetchInstitutions = async () => {
    setInitialLoading(true);
    try {
      const response = await fetch(`${API_BASE}/portfolio/13f/institutions`);
      if (response.ok) {
        const data = await response.json();
        setInstitutions(data.institutions || []);
      }
    } catch (error) {
      console.error('Error fetching institutions:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const fetchPortfolio = async (institutionKey) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/portfolio/13f/${institutionKey}`);
      if (response.ok) {
        const data = await response.json();

        // Add or update portfolio in list
        setPortfolios(prev => {
          const filtered = prev.filter(p => p.id !== data.id);
          return [...filtered, data];
        });
      }
    } catch (error) {
      console.error('Error fetching portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortPortfolios = () => {
    let result = [...portfolios];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(term) ||
        p.manager?.toLowerCase().includes(term) ||
        p.institution_key?.toLowerCase().includes(term)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal = a[sortBy] || 0;
      let bVal = b[sortBy] || 0;

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setFilteredPortfolios(result);
  };

  const togglePortfolio = (portfolioId) => {
    setExpandedPortfolio(expandedPortfolio === portfolioId ? null : portfolioId);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Pagination calculations
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentPortfolios = filteredPortfolios.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredPortfolios.length / itemsPerPage);

  const goToPage = (page) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  };

  return (
    <div className="flex flex-col h-full gap-6 p-6 bg-[#0a0e14]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Building2 className="text-blue-500" size={32} />
            Institutional Holdings
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            Track the portfolios of top institutional investors
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">
            {institutions.length}
          </div>
          <div className="text-xs text-gray-400">Institutions Available</div>
        </div>
      </div>

      {/* Institution Selector */}
      <Card>
        <div className="p-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-300 whitespace-nowrap">Select Institution:</label>
            <select
              value={selectedInstitution}
              onChange={(e) => {
                setSelectedInstitution(e.target.value);
                if (e.target.value) {
                  fetchPortfolio(e.target.value);
                }
              }}
              className="flex-1 px-3 py-2 bg-[#0a0e14] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 hover:border-gray-600 transition-colors"
              disabled={loading || initialLoading}
            >
              <option value="">Choose from {institutions.length} institutions...</option>
              {institutions.map(inst => (
                <option key={inst.key} value={inst.key}>
                  {inst.manager} - {inst.name}
                </option>
              ))}
            </select>
            {loading && (
              <div className="flex items-center gap-2 text-blue-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                <span className="text-sm">Loading...</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Search and Filter Bar */}
      {portfolios.length > 0 && (
        <Card>
          <div className="p-4">
            <div className="flex gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-[#0a0e14] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 hover:border-gray-600 transition-colors"
                    placeholder="Search by manager or institution name..."
                  />
                </div>
              </div>

              {/* Sort */}
              <div className="w-64">
                <select
                  value={sortBy}
                  onChange={(e) => handleSort(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0e14] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 hover:border-gray-600 transition-colors"
                >
                  <option value="total_value">Sort by Total Value</option>
                  <option value="num_holdings">Sort by Holdings Count</option>
                  <option value="value_change_pct">Sort by Change %</option>
                </select>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Initial Loading State */}
      {initialLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
            <p className="text-white text-lg font-semibold">Loading Institutions</p>
            <p className="text-gray-400 text-sm mt-2">Please wait...</p>
          </div>
        </div>
      )}

      {/* Portfolios List */}
      {!initialLoading && (
        <div className="flex-1 overflow-y-auto space-y-4">
          {portfolios.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Building2 size={48} className="mx-auto mb-4 opacity-50" />
              <p className="mb-2">No portfolios loaded yet</p>
              <p className="text-sm">Select an institution from the dropdown above to view their holdings</p>
            </div>
          ) : currentPortfolios.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Building2 size={48} className="mx-auto mb-4 opacity-50" />
              <p className="mb-2">No portfolios found</p>
              <p className="text-sm">Try adjusting your search criteria</p>
            </div>
          ) : (
            currentPortfolios.map(portfolio => (
              <PortfolioCard
                key={portfolio.id}
                portfolio={portfolio}
                isExpanded={expandedPortfolio === portfolio.id}
                onToggle={() => togglePortfolio(portfolio.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <div className="flex items-center justify-between p-4">
            <div className="text-sm text-gray-400">
              Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredPortfolios.length)} of {filteredPortfolios.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-2 bg-[#0a0e14] text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={i}
                    onClick={() => goToPage(pageNum)}
                    className={`px-3 py-2 rounded-lg transition-colors ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#0a0e14] text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 bg-[#0a0e14] text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

/**
 * Portfolio Card Component
 * Displays individual portfolio with expandable holdings
 */
const PortfolioCard = ({ portfolio, isExpanded, onToggle }) => {
  return (
    <Card hover gradient={isExpanded}>
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-2xl font-bold text-white">{portfolio.manager}</h3>
              <span className="text-xs bg-purple-900/30 text-purple-400 px-3 py-1 rounded-full">
                13F Filing
              </span>
            </div>
            <p className="text-sm text-gray-300 mb-1">{portfolio.name}</p>
            <p className="text-xs text-gray-400">{portfolio.description}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">
              ${(portfolio.total_value / 1000000000).toFixed(1)}B
            </div>
            <div className="text-xs text-gray-400">Total Value</div>
            {portfolio.value_change_pct !== undefined && (
              <div className={`flex items-center justify-end gap-1 mt-1 text-sm ${
                portfolio.value_change_pct > 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {portfolio.value_change_pct > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {portfolio.value_change_pct > 0 ? '+' : ''}{portfolio.value_change_pct.toFixed(1)}% QoQ
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>Filed: {portfolio.filing_date}</span>
          <span>•</span>
          <span>Period: {portfolio.period_end}</span>
          <span>•</span>
          <span>{portfolio.num_holdings} Holdings</span>
        </div>
      </div>

      {/* Performance Metrics */}
      {portfolio.performance && (
        <PerformanceSection performance={portfolio.performance} />
      )}

      {/* Sector Allocation */}
      {portfolio.top_sectors && (
        <SectorAllocation sectors={portfolio.top_sectors} />
      )}

      {/* Toggle Holdings Button */}
      <div className="p-6">
        <button
          onClick={onToggle}
          className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-semibold flex items-center justify-center gap-2"
        >
          {isExpanded ? (
            <>
              <ChevronUp size={18} />
              Hide Holdings
            </>
          ) : (
            <>
              <ChevronDown size={18} />
              View Top Holdings ({portfolio.stocks?.length || 0})
            </>
          )}
        </button>

        {/* Holdings Table */}
        {isExpanded && portfolio.stocks && portfolio.stocks.length > 0 && (
          <HoldingsTable stocks={portfolio.stocks} />
        )}
      </div>
    </Card>
  );
};

/**
 * Performance Section Component
 */
const PerformanceSection = ({ performance }) => {
  if (!performance) return null;

  return (
    <div className="p-6 border-b border-gray-700 bg-gradient-to-r from-blue-900/10 to-purple-900/10">
      <SectionHeader
        icon={BarChart3}
        title="Performance Metrics"
        iconColor="text-blue-400"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard
          label="YTD Return"
          value={performance.ytd_return || 0}
          suffix="%"
          showTrend
          size="md"
        />
        <MetricCard
          label="1 Year"
          value={performance.return_1y || 0}
          suffix="%"
          showTrend
          size="md"
        />
        <MetricCard
          label="3 Year"
          value={performance.return_3y || 0}
          suffix="%"
          showTrend
          size="md"
        />
        <MetricCard
          label="5 Year"
          value={performance.return_5y || 0}
          suffix="%"
          showTrend
          size="md"
        />
        <MetricCard
          label="Sharpe Ratio"
          value={performance.sharpe_ratio || 0}
          size="md"
          color="text-white"
        />
        <MetricCard
          label="Volatility"
          value={performance.volatility || 0}
          suffix="%"
          icon={Activity}
          size="md"
          color="text-white"
        />
      </div>

      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-700/50">
        <MetricCard
          label="Alpha"
          value={performance.alpha || 0}
          showTrend
          size="sm"
        />
        <MetricCard
          label="Beta"
          value={performance.beta || 0}
          size="sm"
          color="text-white"
        />
        <MetricCard
          label="Max Drawdown"
          value={performance.max_drawdown || 0}
          suffix="%"
          size="sm"
          color="text-red-400"
        />
      </div>
    </div>
  );
};

/**
 * Sector Allocation Component
 */
const SectorAllocation = ({ sectors }) => {
  if (!sectors || sectors.length === 0) return null;

  const sectorColors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-cyan-500'
  ];

  return (
    <div className="p-6 border-b border-gray-700">
      <SectionHeader
        icon={PieChart}
        title="Sector Allocation"
        iconColor="text-blue-400"
      />
      <div className="space-y-3">
        {sectors.map((sector, idx) => (
          <div key={idx} className="flex items-center justify-between group">
            <div className="flex items-center gap-3 flex-1">
              <div className="text-sm text-gray-300 w-32 font-medium">{sector.name}</div>
              <div className="flex-1 bg-gray-700/50 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`${sectorColors[idx % sectorColors.length]} h-2.5 rounded-full transition-all duration-500 group-hover:opacity-80`}
                  style={{ width: `${sector.weight}%` }}
                ></div>
              </div>
            </div>
            <div className="text-sm font-bold text-white ml-4 w-16 text-right">
              {sector.weight}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Holdings Table Component
 */
const HoldingsTable = ({ stocks }) => {
  if (!stocks || stocks.length === 0) return null;

  return (
    <div className="mt-4 bg-[#0a0e14] rounded-lg overflow-hidden border border-gray-700">
      <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gradient-to-r from-gray-800 to-gray-800/80 text-xs font-semibold text-gray-300">
        <div className="col-span-1">#</div>
        <div className="col-span-4">Symbol / Name</div>
        <div className="col-span-2 text-right">Value</div>
        <div className="col-span-2 text-right">Shares</div>
        <div className="col-span-1 text-right">Weight</div>
        <div className="col-span-1 text-right">Change</div>
        <div className="col-span-1 text-right">YTD</div>
      </div>
      <div className="max-h-96 overflow-y-auto custom-scrollbar">
        {stocks.map((stock, idx) => (
          <div
            key={stock.symbol || stock.cusip || idx}
            className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-gradient-to-r hover:from-gray-800/30 hover:to-blue-900/10 transition-all border-b border-gray-800/50 text-sm group"
          >
            <div className="col-span-1 text-gray-500 font-mono text-xs">{idx + 1}</div>
            <div className="col-span-4">
              <div className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                {stock.symbol || stock.cusip}
              </div>
              <div className="text-xs text-gray-400 truncate">{stock.name}</div>
            </div>
            <div className="col-span-2 text-right text-white font-medium">
              ${stock.value ? (stock.value / 1000000).toFixed(1) : '0.0'}M
            </div>
            <div className="col-span-2 text-right text-gray-300">
              {stock.shares ? (stock.shares / 1000000).toFixed(1) : '0.0'}M
            </div>
            <div className="col-span-1 text-right text-blue-400 font-bold">
              {stock.weight || 0}%
            </div>
            <div className={`col-span-1 text-right font-medium flex items-center justify-end gap-1 ${
              (stock.change_pct || 0) > 0 ? 'text-green-400' :
              (stock.change_pct || 0) < 0 ? 'text-red-400' : 'text-gray-400'
            }`}>
              {(stock.change_pct || 0) > 0 && <TrendingUp size={12} />}
              {(stock.change_pct || 0) < 0 && <TrendingDown size={12} />}
              {(stock.change_pct || 0) > 0 ? '+' : ''}{stock.change_pct || 0}%
            </div>
            <div className={`col-span-1 text-right font-medium flex items-center justify-end gap-1 ${
              (stock.return_ytd || 0) > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {(stock.return_ytd || 0) > 0 && <TrendingUp size={12} />}
              {(stock.return_ytd || 0) < 0 && <TrendingDown size={12} />}
              {(stock.return_ytd || 0) > 0 ? '+' : ''}{stock.return_ytd || 0}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InstitutionalPortfolios;
