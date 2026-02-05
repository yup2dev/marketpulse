/**
 * Institutional Portfolios - 13F Institutional Holdings
 * Design based on ComparisonAnalysisTab terminal style
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  X,
  RefreshCw,
  Copy,
  MoreVertical,
  Building2,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Search,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { API_BASE } from '../config/api';

// Category tabs for different data views
const CATEGORIES = [
  { id: 'overview', name: 'Overview' },
  { id: 'holdings', name: 'Top Holdings' },
  { id: 'activity', name: 'Portfolio Activity' },
];

// Sort options
const SORT_OPTIONS = [
  { id: 'total_value', label: 'AUM' },
  { id: 'num_holdings', label: 'Holdings' },
  { id: 'value_change_pct', label: 'Change %' },
];

// Colors for institution indicators
const INST_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

const InstitutionalPortfolios = ({ symbol = null }) => {
  const [institutions, setInstitutions] = useState([]);
  const [selectedInstitutions, setSelectedInstitutions] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingKeys, setLoadingKeys] = useState(new Set());
  const [activeCategory, setActiveCategory] = useState('overview');
  const [sortBy, setSortBy] = useState('total_value');
  const [symbolFilter, setSymbolFilter] = useState(symbol || '');
  const [showAddInst, setShowAddInst] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const addInstRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (addInstRef.current && !addInstRef.current.contains(event.target)) {
        setShowAddInst(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load featured institutions list on mount (use_dynamic=false for the 20 supported institutions)
  useEffect(() => {
    fetchInstitutions();
  }, []);

  // Update symbolFilter when symbol prop changes
  useEffect(() => {
    if (symbol) setSymbolFilter(symbol);
  }, [symbol]);

  const fetchInstitutions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/portfolio/13f/institutions?use_dynamic=false`);
      if (res.ok) {
        const data = await res.json();
        setInstitutions(data.institutions || []);
      }
    } catch (error) {
      console.error('Error fetching institutions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPortfolio = useCallback(async (instKey) => {
    setLoadingKeys(prev => new Set([...prev, instKey]));
    try {
      const res = await fetch(`${API_BASE}/portfolio/13f/${instKey}`);
      if (res.ok) {
        const data = await res.json();
        setPortfolios(prev => {
          const filtered = prev.filter(p => p.id !== data.id);
          return [...filtered, data];
        });
      }
    } catch (error) {
      console.error('Error fetching portfolio:', error);
    } finally {
      setLoadingKeys(prev => {
        const next = new Set(prev);
        next.delete(instKey);
        return next;
      });
    }
  }, []);

  const addInstitution = (inst) => {
    if (!selectedInstitutions.find(s => s.key === inst.key) && selectedInstitutions.length < 10) {
      setSelectedInstitutions(prev => [...prev, inst]);
      fetchPortfolio(inst.key);
    }
    setShowAddInst(false);
    setSearchTerm('');
  };

  const removeInstitution = (instKey) => {
    setSelectedInstitutions(prev => prev.filter(s => s.key !== instKey));
    setPortfolios(prev => prev.filter(p => p.institution_key !== instKey));
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined) return '-';
    if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toLocaleString()}`;
  };

  const formatShares = (val) => {
    if (!val) return '-';
    if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
    if (val >= 1e3) return (val / 1e3).toFixed(1) + 'K';
    return val.toLocaleString();
  };

  // Filter institutions search
  const filteredInstitutions = institutions.filter(inst => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    return (
      inst.manager?.toLowerCase().includes(term) ||
      inst.name?.toLowerCase().includes(term) ||
      inst.key?.toLowerCase().includes(term)
    );
  });

  // Filter portfolios by symbol if symbolFilter is set
  const displayPortfolios = symbolFilter
    ? portfolios.filter(p =>
        p.stocks?.some(s => s.symbol?.toUpperCase() === symbolFilter.toUpperCase())
      )
    : portfolios;

  // Sort portfolios
  const sortedPortfolios = [...displayPortfolios].sort((a, b) => {
    const aVal = a[sortBy] || 0;
    const bVal = b[sortBy] || 0;
    return bVal - aVal;
  });

  // Get all unique holdings across portfolios for the "holdings" view
  const getAllHoldings = () => {
    const holdingsMap = {};
    sortedPortfolios.forEach((portfolio) => {
      (portfolio.stocks || []).forEach(stock => {
        const sym = stock.symbol?.toUpperCase();
        if (!sym) return;
        if (!holdingsMap[sym]) {
          holdingsMap[sym] = {
            symbol: sym,
            name: stock.name,
            totalValue: 0,
            totalShares: 0,
            holders: 0,
            weights: [],
            institutions: [],
          };
        }
        holdingsMap[sym].totalValue += stock.value || 0;
        holdingsMap[sym].totalShares += stock.shares || 0;
        holdingsMap[sym].holders += 1;
        holdingsMap[sym].weights.push(stock.weight || 0);
        holdingsMap[sym].institutions.push(portfolio.manager);
      });
    });

    return Object.values(holdingsMap)
      .map(h => ({
        ...h,
        avgWeight: h.weights.length ? (h.weights.reduce((a, b) => a + b, 0) / h.weights.length) : 0,
      }))
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 50);
  };

  const isAnyLoading = loadingKeys.size > 0 || loading;

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Institution chips */}
          <div className="flex items-center gap-1 flex-wrap">
            {selectedInstitutions.length === 0 && (
              <div className="flex items-center gap-2 px-2 py-1 text-xs text-gray-500">
                <Building2 size={14} />
                <span>No institution selected</span>
              </div>
            )}
            {selectedInstitutions.map((inst, idx) => (
              <div
                key={inst.key}
                className="flex items-center gap-1 px-2 py-1 bg-gray-800 rounded text-xs"
              >
                <span className="text-cyan-400 font-medium">{idx + 1}</span>
                <span className="text-white truncate max-w-[120px]" title={inst.manager}>
                  {inst.manager}
                </span>
                {loadingKeys.has(inst.key) && (
                  <RefreshCw size={10} className="animate-spin text-cyan-400 ml-1" />
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); removeInstitution(inst.key); }}
                  className="ml-1 text-gray-500 hover:text-red-400"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Add institution */}
          <div className="relative" ref={addInstRef}>
            <button
              onClick={() => setShowAddInst(!showAddInst)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-cyan-400 hover:bg-gray-800 rounded"
            >
              <Plus size={14} />
              Add Institution
            </button>

            {showAddInst && (
              <div className="absolute top-full left-0 mt-1 w-80 bg-[#1a1a1f] border border-gray-700 rounded-lg shadow-xl z-50">
                <div className="p-2 border-b border-gray-700">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 text-gray-500" size={14} />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search institutions..."
                      className="w-full pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {filteredInstitutions.map(inst => {
                    const isSelected = !!selectedInstitutions.find(s => s.key === inst.key);
                    return (
                      <button
                        key={inst.key}
                        onClick={() => !isSelected && addInstitution(inst)}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-800 transition-colors ${
                          isSelected ? 'opacity-40 cursor-not-allowed' : ''
                        }`}
                        disabled={isSelected}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="text-white font-medium truncate">{inst.manager}</div>
                            <div className="text-gray-500 truncate">{inst.name}</div>
                          </div>
                          {isSelected && (
                            <span className="text-cyan-400 text-[10px] ml-2 shrink-0">Added</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {filteredInstitutions.length === 0 && (
                    <div className="px-3 py-4 text-xs text-gray-500 text-center">No institutions found</div>
                  )}
                </div>
                {selectedInstitutions.length >= 10 && (
                  <div className="p-2 border-t border-gray-700">
                    <p className="text-xs text-yellow-500 text-center">Maximum 10 institutions</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Symbol filter */}
          {symbolFilter && (
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-900/30 border border-blue-800/50 rounded text-xs">
              <span className="text-gray-400">Holding:</span>
              <span className="text-blue-400 font-medium">{symbolFilter}</span>
              <button
                onClick={() => setSymbolFilter('')}
                className="ml-1 text-gray-500 hover:text-red-400"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Sort selector */}
          <div className="flex items-center gap-0.5 bg-gray-800 rounded p-0.5">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setSortBy(opt.id)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  sortBy === opt.id
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{institutions.length} available</span>
          <button
            onClick={fetchInstitutions}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded">
            <Copy size={14} />
          </button>
          <button className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded">
            <MoreVertical size={14} />
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800 overflow-x-auto">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded transition-colors ${
              activeCategory === cat.id
                ? 'text-cyan-400 bg-cyan-400/10'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {cat.name}
          </button>
        ))}

        {/* Loading indicator */}
        {isAnyLoading && (
          <div className="flex items-center gap-1.5 ml-2 px-2 py-1 text-xs text-cyan-400">
            <RefreshCw size={12} className="animate-spin" />
            <span>Loading...</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {sortedPortfolios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Building2 size={32} className="mb-3 opacity-50" />
            {isAnyLoading ? (
              <>
                <p className="text-sm text-cyan-400">Fetching portfolio data from SEC EDGAR...</p>
                <p className="text-xs mt-1 text-gray-600">This may take a few seconds</p>
              </>
            ) : (
              <>
                <p className="text-sm">No institutions loaded</p>
                <p className="text-xs mt-1 text-gray-600">Click "+ Add Institution" to view 13F holdings</p>
              </>
            )}
          </div>
        ) : activeCategory === 'overview' ? (
          <OverviewTable
            portfolios={sortedPortfolios}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            formatNumber={formatNumber}
            formatShares={formatShares}
            symbolFilter={symbolFilter}
          />
        ) : activeCategory === 'holdings' ? (
          <HoldingsTable
            holdings={getAllHoldings()}
            formatNumber={formatNumber}
            formatShares={formatShares}
            portfolios={sortedPortfolios}
          />
        ) : activeCategory === 'activity' ? (
          <ActivityTable
            portfolios={sortedPortfolios}
            formatNumber={formatNumber}
          />
        ) : null}
      </div>
    </div>
  );
};

/**
 * Overview Table - Institutions list with expandable holdings
 */
const OverviewTable = ({ portfolios, expandedId, setExpandedId, formatNumber, formatShares, symbolFilter }) => (
  <div>
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-[#0d0d12] z-10">
        <tr className="border-b border-gray-800">
          <th className="text-left py-3 px-4 text-gray-400 font-medium min-w-[250px]">Institution</th>
          <th className="text-right py-3 px-4 text-gray-400 font-medium min-w-[120px]">Total Value</th>
          <th className="text-right py-3 px-4 text-gray-400 font-medium min-w-[100px]">Holdings</th>
          <th className="text-right py-3 px-4 text-gray-400 font-medium min-w-[100px]">Change QoQ</th>
          <th className="text-right py-3 px-4 text-gray-400 font-medium min-w-[100px]">Turnover</th>
          <th className="text-right py-3 px-4 text-gray-400 font-medium min-w-[120px]">Filing Date</th>
          <th className="text-center py-3 px-4 text-gray-400 font-medium w-[60px]"></th>
        </tr>
      </thead>
      <tbody>
        {portfolios.map((portfolio, idx) => (
          <OverviewRow
            key={portfolio.id}
            portfolio={portfolio}
            idx={idx}
            isExpanded={expandedId === portfolio.id}
            onToggle={() => setExpandedId(expandedId === portfolio.id ? null : portfolio.id)}
            formatNumber={formatNumber}
            formatShares={formatShares}
            symbolFilter={symbolFilter}
          />
        ))}
      </tbody>
    </table>
  </div>
);

const OverviewRow = ({ portfolio, idx, isExpanded, onToggle, formatNumber, formatShares, symbolFilter }) => (
  <>
    <tr
      className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer"
      onClick={onToggle}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div
            className="w-1 h-10 rounded"
            style={{ backgroundColor: INST_COLORS[idx % INST_COLORS.length] }}
          />
          <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center">
            <Building2 size={14} className="text-gray-400" />
          </div>
          <div>
            <div className="font-semibold text-white">{portfolio.manager}</div>
            <div className="text-xs text-gray-400 truncate max-w-[180px]">{portfolio.name}</div>
          </div>
        </div>
      </td>
      <td className="text-right py-3 px-4 text-white tabular-nums font-medium">
        {formatNumber(portfolio.total_value)}
      </td>
      <td className="text-right py-3 px-4 text-white tabular-nums">
        {portfolio.num_holdings || '-'}
      </td>
      <td className="text-right py-3 px-4 tabular-nums">
        {portfolio.value_change_pct != null ? (
          <span className={`flex items-center justify-end gap-1 ${
            portfolio.value_change_pct > 0 ? 'text-green-400' : portfolio.value_change_pct < 0 ? 'text-red-400' : 'text-gray-400'
          }`}>
            {portfolio.value_change_pct > 0 && <TrendingUp size={12} />}
            {portfolio.value_change_pct < 0 && <TrendingDown size={12} />}
            {portfolio.value_change_pct > 0 ? '+' : ''}{portfolio.value_change_pct.toFixed(1)}%
          </span>
        ) : (
          <span className="text-gray-500">-</span>
        )}
      </td>
      <td className="text-right py-3 px-4 text-gray-300 tabular-nums text-xs">
        {portfolio.turnover != null ? `${portfolio.turnover.toFixed(1)}%` : '-'}
      </td>
      <td className="text-right py-3 px-4 text-gray-400 text-xs tabular-nums">
        {portfolio.filing_date || '-'}
      </td>
      <td className="text-center py-3 px-4">
        {isExpanded ? (
          <ChevronUp size={14} className="text-gray-400 mx-auto" />
        ) : (
          <ChevronDown size={14} className="text-gray-400 mx-auto" />
        )}
      </td>
    </tr>

    {/* Expanded holdings sub-table */}
    {isExpanded && portfolio.stocks && (
      <tr>
        <td colSpan={7} className="p-0">
          <div className="bg-[#08080d] border-b border-gray-800">
            {/* Position summary bar */}
            <div className="flex items-center gap-4 px-4 py-2 bg-gray-800/20 text-xs border-b border-gray-800/50">
              <span className="text-gray-400">
                Period: <span className="text-white">{portfolio.period_end || '-'}</span>
              </span>
              {portfolio.num_new_positions > 0 && (
                <span className="text-green-400">+{portfolio.num_new_positions} new</span>
              )}
              {portfolio.num_sold_out > 0 && (
                <span className="text-red-400">-{portfolio.num_sold_out} sold</span>
              )}
              {portfolio.num_increased > 0 && (
                <span className="text-cyan-400">{portfolio.num_increased} increased</span>
              )}
              {portfolio.num_decreased > 0 && (
                <span className="text-yellow-400">{portfolio.num_decreased} decreased</span>
              )}
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-800/40">
                  <th className="text-left py-2 px-4 text-gray-500 font-medium w-10">#</th>
                  <th className="text-left py-2 px-4 text-gray-500 font-medium">Symbol</th>
                  <th className="text-left py-2 px-4 text-gray-500 font-medium">Name</th>
                  <th className="text-right py-2 px-4 text-gray-500 font-medium">Value</th>
                  <th className="text-right py-2 px-4 text-gray-500 font-medium">Shares</th>
                  <th className="text-right py-2 px-4 text-gray-500 font-medium">Weight</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.stocks.slice(0, 30).map((stock, sIdx) => {
                  const isCurrentSymbol = symbolFilter && stock.symbol?.toUpperCase() === symbolFilter.toUpperCase();
                  return (
                    <tr
                      key={stock.symbol || stock.cusip || sIdx}
                      className={`border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors ${
                        isCurrentSymbol ? 'bg-cyan-900/10' : ''
                      }`}
                    >
                      <td className="py-2 px-4 text-gray-600 tabular-nums">{sIdx + 1}</td>
                      <td className="py-2 px-4">
                        <span className={`font-medium ${isCurrentSymbol ? 'text-cyan-400' : 'text-white'}`}>
                          {stock.symbol || stock.cusip}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-gray-400 truncate max-w-[200px]">{stock.name}</td>
                      <td className="py-2 px-4 text-right text-white tabular-nums">{formatNumber(stock.value)}</td>
                      <td className="py-2 px-4 text-right text-gray-300 tabular-nums">{formatShares(stock.shares)}</td>
                      <td className="py-2 px-4 text-right text-cyan-400 font-medium tabular-nums">{stock.weight || 0}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {portfolio.stocks.length > 30 && (
              <div className="px-4 py-2 text-center text-xs text-gray-600">
                Showing top 30 of {portfolio.stocks.length} holdings
              </div>
            )}
          </div>
        </td>
      </tr>
    )}
  </>
);

/**
 * Holdings Table - Aggregated holdings across all loaded institutions
 */
const HoldingsTable = ({ holdings, formatNumber, formatShares, portfolios }) => (
  <table className="w-full text-sm">
    <thead className="sticky top-0 bg-[#0d0d12] z-10">
      <tr className="border-b border-gray-800">
        <th className="text-left py-3 px-4 text-gray-400 font-medium w-10">#</th>
        <th className="text-left py-3 px-4 text-gray-400 font-medium min-w-[200px]">Stock</th>
        <th className="text-right py-3 px-4 text-gray-400 font-medium min-w-[130px]">Total Value</th>
        <th className="text-right py-3 px-4 text-gray-400 font-medium min-w-[120px]">Total Shares</th>
        <th className="text-right py-3 px-4 text-gray-400 font-medium min-w-[90px]">Holders</th>
        <th className="text-right py-3 px-4 text-gray-400 font-medium min-w-[100px]">Avg Weight</th>
        <th className="text-left py-3 px-4 text-gray-400 font-medium min-w-[150px]">Held By</th>
      </tr>
    </thead>
    <tbody>
      {holdings.map((h, idx) => (
        <tr
          key={h.symbol}
          className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
        >
          <td className="py-3 px-4 text-gray-600 text-xs tabular-nums">{idx + 1}</td>
          <td className="py-3 px-4">
            <div className="flex items-center gap-3">
              <div
                className="w-1 h-10 rounded"
                style={{ backgroundColor: INST_COLORS[idx % INST_COLORS.length] }}
              />
              <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center text-xs font-bold text-white">
                {h.symbol.slice(0, 2)}
              </div>
              <div>
                <div className="font-semibold text-white">{h.symbol}</div>
                <div className="text-xs text-gray-400 truncate max-w-[150px]">{h.name}</div>
              </div>
            </div>
          </td>
          <td className="text-right py-3 px-4 text-white tabular-nums font-medium">{formatNumber(h.totalValue)}</td>
          <td className="text-right py-3 px-4 text-white tabular-nums">{formatShares(h.totalShares)}</td>
          <td className="text-right py-3 px-4 text-cyan-400 tabular-nums font-medium">
            {h.holders}/{portfolios.length}
          </td>
          <td className="text-right py-3 px-4 text-white tabular-nums">{h.avgWeight.toFixed(1)}%</td>
          <td className="py-3 px-4">
            <div className="flex items-center gap-1 flex-wrap">
              {h.institutions.slice(0, 3).map((inst, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-gray-800 rounded text-[10px] text-gray-400 truncate max-w-[80px]">
                  {inst}
                </span>
              ))}
              {h.institutions.length > 3 && (
                <span className="text-[10px] text-gray-500">+{h.institutions.length - 3}</span>
              )}
            </div>
          </td>
        </tr>
      ))}
      {holdings.length === 0 && (
        <tr>
          <td colSpan={7} className="py-12 text-center text-gray-500 text-sm">
            No holdings data available
          </td>
        </tr>
      )}
    </tbody>
  </table>
);

/**
 * Activity Table - Portfolio-level position changes and activity metrics
 */
const ActivityTable = ({ portfolios, formatNumber }) => (
  <table className="w-full text-sm">
    <thead className="sticky top-0 bg-[#0d0d12] z-10">
      <tr className="border-b border-gray-800">
        <th className="text-left py-3 px-4 text-gray-400 font-medium min-w-[250px]">Institution</th>
        <th className="text-right py-3 px-4 text-gray-400 font-medium min-w-[110px]">Value Change</th>
        <th className="text-right py-3 px-4 text-gray-400 font-medium min-w-[90px]">Change %</th>
        <th className="text-right py-3 px-4 text-gray-400 font-medium min-w-[80px]">New</th>
        <th className="text-right py-3 px-4 text-gray-400 font-medium min-w-[80px]">Sold</th>
        <th className="text-right py-3 px-4 text-gray-400 font-medium min-w-[90px]">Increased</th>
        <th className="text-right py-3 px-4 text-gray-400 font-medium min-w-[90px]">Decreased</th>
        <th className="text-right py-3 px-4 text-gray-400 font-medium min-w-[90px]">Turnover</th>
      </tr>
    </thead>
    <tbody>
      {portfolios.map((p, idx) => {
        const valueChange = p.value_change || (p.previous_value ? p.total_value - p.previous_value : null);
        return (
          <tr
            key={p.id}
            className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
          >
            <td className="py-3 px-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-1 h-10 rounded"
                  style={{ backgroundColor: INST_COLORS[idx % INST_COLORS.length] }}
                />
                <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center">
                  <Building2 size={14} className="text-gray-400" />
                </div>
                <div>
                  <div className="font-semibold text-white">{p.manager}</div>
                  <div className="text-xs text-gray-400">{p.filing_date || ''}</div>
                </div>
              </div>
            </td>
            <td className="text-right py-3 px-4 tabular-nums">
              {valueChange != null ? (
                <span className={valueChange > 0 ? 'text-green-400' : valueChange < 0 ? 'text-red-400' : 'text-gray-400'}>
                  {valueChange > 0 ? '+' : ''}{formatNumber(valueChange)}
                </span>
              ) : (
                <span className="text-gray-500">-</span>
              )}
            </td>
            <td className="text-right py-3 px-4 tabular-nums">
              {p.value_change_pct != null ? (
                <span className={`flex items-center justify-end gap-1 font-medium ${
                  p.value_change_pct > 0 ? 'text-green-400' : p.value_change_pct < 0 ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {p.value_change_pct > 0 && <TrendingUp size={12} />}
                  {p.value_change_pct < 0 && <TrendingDown size={12} />}
                  {p.value_change_pct > 0 ? '+' : ''}{p.value_change_pct.toFixed(1)}%
                </span>
              ) : (
                <span className="text-gray-500">-</span>
              )}
            </td>
            <td className="text-right py-3 px-4 tabular-nums">
              {p.num_new_positions > 0 ? (
                <span className="flex items-center justify-end gap-1 text-green-400">
                  <ArrowUpRight size={12} />
                  {p.num_new_positions}
                </span>
              ) : (
                <span className="text-gray-500">{p.num_new_positions || 0}</span>
              )}
            </td>
            <td className="text-right py-3 px-4 tabular-nums">
              {p.num_sold_out > 0 ? (
                <span className="flex items-center justify-end gap-1 text-red-400">
                  <ArrowDownRight size={12} />
                  {p.num_sold_out}
                </span>
              ) : (
                <span className="text-gray-500">{p.num_sold_out || 0}</span>
              )}
            </td>
            <td className="text-right py-3 px-4 tabular-nums">
              {p.num_increased > 0 ? (
                <span className="text-cyan-400 font-medium">{p.num_increased}</span>
              ) : (
                <span className="text-gray-500">{p.num_increased || 0}</span>
              )}
            </td>
            <td className="text-right py-3 px-4 tabular-nums">
              {p.num_decreased > 0 ? (
                <span className="text-yellow-400 font-medium">{p.num_decreased}</span>
              ) : (
                <span className="text-gray-500">{p.num_decreased || 0}</span>
              )}
            </td>
            <td className="text-right py-3 px-4 tabular-nums">
              {p.turnover != null ? (
                <span className="text-white">{p.turnover.toFixed(1)}%</span>
              ) : (
                <span className="text-gray-500">-</span>
              )}
            </td>
          </tr>
        );
      })}
      {portfolios.length === 0 && (
        <tr>
          <td colSpan={8} className="py-12 text-center text-gray-500 text-sm">
            No activity data available
          </td>
        </tr>
      )}
    </tbody>
  </table>
);

export default InstitutionalPortfolios;
