/**
 * Institutional Portfolios - 13F Institutional Holdings
 * Design based on ComparisonAnalysisTab terminal style
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { API_BASE } from '../../config/api';
import CommonTable from '../common/CommonTable';

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
    if (val === null || val === undefined) return '-';
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 1e6) return sign + (abs / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return sign + (abs / 1e3).toFixed(1) + 'K';
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
      // Aggregate per-symbol within this portfolio first to avoid duplicates
      const perSymbol = {};
      (portfolio.stocks || []).forEach(stock => {
        const sym = stock.symbol?.toUpperCase();
        if (!sym) return;
        if (!perSymbol[sym]) {
          perSymbol[sym] = { value: 0, shares: 0, weight: 0, name: stock.name };
        }
        perSymbol[sym].value += stock.value || 0;
        perSymbol[sym].shares += stock.shares || 0;
        perSymbol[sym].weight += stock.weight || 0;
      });

      Object.entries(perSymbol).forEach(([sym, agg]) => {
        if (!holdingsMap[sym]) {
          holdingsMap[sym] = {
            symbol: sym,
            name: agg.name,
            totalValue: 0,
            totalShares: 0,
            holders: 0,
            weights: [],
            institutions: [],
          };
        }
        holdingsMap[sym].totalValue += agg.value;
        holdingsMap[sym].totalShares += agg.shares;
        holdingsMap[sym].holders += 1;
        holdingsMap[sym].weights.push(agg.weight);
        holdingsMap[sym].institutions.push(portfolio.manager);
      });
    });

    return Object.values(holdingsMap)
      .map(h => ({
        ...h,
        _key: h.symbol,
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
const OVERVIEW_COLUMNS = [
  {
    key: 'institution',
    header: 'Institution',
    minWidth: '250px',
    sortable: true,
    sortValue: (row) => row.manager?.toLowerCase(),
    render: (row) => (
      <div className="flex items-center gap-3">
        <div
          className="w-1 h-10 rounded"
          style={{ backgroundColor: INST_COLORS[row._idx % INST_COLORS.length] }}
        />
        <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center">
          <Building2 size={14} className="text-gray-400" />
        </div>
        <div>
          <div className="font-semibold text-white">{row.manager}</div>
          <div className="text-xs text-gray-400 truncate max-w-[180px]">{row.name}</div>
        </div>
      </div>
    ),
  },
  {
    key: 'total_value',
    header: 'Total Value',
    align: 'right',
    minWidth: '120px',
    sortable: true,
    sortValue: (row) => row.total_value,
    render: (row) => <span className="text-white font-medium">{row._fmt.totalValue}</span>,
  },
  {
    key: 'num_holdings',
    header: 'Holdings',
    align: 'right',
    minWidth: '100px',
    sortable: true,
    sortValue: (row) => row.num_holdings,
    render: (row) => <span className="text-white">{row.num_holdings || '-'}</span>,
  },
  {
    key: 'change_qoq',
    header: 'Change QoQ',
    align: 'right',
    minWidth: '100px',
    sortable: true,
    sortValue: (row) => row.value_change_pct,
    render: (row) => {
      const pct = row.value_change_pct;
      if (pct == null) return <span className="text-gray-500">-</span>;
      const color = pct > 0 ? 'text-green-400' : pct < 0 ? 'text-red-400' : 'text-gray-400';
      return (
        <span className={`flex items-center justify-end gap-1 ${color}`}>
          {pct > 0 && <TrendingUp size={12} />}
          {pct < 0 && <TrendingDown size={12} />}
          {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
        </span>
      );
    },
  },
  {
    key: 'turnover',
    header: 'Turnover',
    align: 'right',
    minWidth: '100px',
    sortable: true,
    sortValue: (row) => row.turnover,
    className: 'text-gray-300 text-xs',
    render: (row) => row.turnover != null ? `${row.turnover.toFixed(1)}%` : '-',
  },
  {
    key: 'filing_date',
    header: 'Filing Date',
    align: 'right',
    minWidth: '120px',
    sortable: true,
    sortValue: (row) => row.filing_date,
    className: 'text-gray-400 text-xs',
    render: (row) => row.filing_date || '-',
  },
  {
    key: 'expand',
    header: '',
    align: 'center',
    width: '60px',
    render: (row) => row._isExpanded
      ? <ChevronUp size={14} className="text-gray-400 mx-auto" />
      : <ChevronDown size={14} className="text-gray-400 mx-auto" />,
  },
];

const OverviewTable = ({ portfolios, expandedId, setExpandedId, formatNumber, formatShares, symbolFilter }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'total_value', direction: 'desc' });

  const handleSort = useCallback((col) => {
    if (!col.sortable) return;
    setSortConfig((prev) => {
      if (prev.key !== col.key) return { key: col.key, direction: 'desc' };
      if (prev.direction === 'desc') return { key: col.key, direction: 'asc' };
      return { key: null, direction: null };
    });
  }, []);

  const data = portfolios.map((p, idx) => ({
    ...p,
    _key: p.id,
    _idx: idx,
    _isExpanded: expandedId === p.id,
    _fmt: { totalValue: formatNumber(p.total_value) },
  }));

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return data;
    const col = OVERVIEW_COLUMNS.find((c) => c.key === sortConfig.key);
    if (!col || !col.sortValue) return data;

    return [...data].sort((a, b) => {
      const aVal = col.sortValue(a);
      const bVal = col.sortValue(b);
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let cmp;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal);
      } else {
        cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
  }, [data, sortConfig]);

  return (
    <div>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-[#0d0d12] z-20">
          <tr className="border-b border-gray-800">
            {OVERVIEW_COLUMNS.map((col) => {
              const isSortable = !!col.sortable;
              const isActive = sortConfig.key === col.key && sortConfig.direction;
              return (
                <th
                  key={col.key}
                  className={`${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} py-3 px-4 text-gray-400 font-medium ${col.headerClassName || ''} ${isSortable ? 'group/sortable cursor-pointer select-none hover:text-gray-200 transition-colors' : ''}`}
                  style={{ width: col.width, minWidth: col.minWidth }}
                  onClick={isSortable ? () => handleSort(col) : undefined}
                >
                  <span className="inline-flex items-center">
                    {col.header}
                    {isSortable && (
                      isActive
                        ? <span className="text-cyan-400 ml-1 text-[10px] leading-none select-none">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                        : <span className="text-gray-600 ml-1 text-[10px] leading-none opacity-0 group-hover/sortable:opacity-100 transition-opacity select-none">▼</span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row) => (
            <OverviewRow
              key={row._key}
              portfolio={row}
              idx={row._idx}
              isExpanded={row._isExpanded}
              onToggle={() => setExpandedId(expandedId === row.id ? null : row.id)}
              formatNumber={formatNumber}
              formatShares={formatShares}
              symbolFilter={symbolFilter}
              columns={OVERVIEW_COLUMNS}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

const STATUS_BADGE = {
  new: { label: 'NEW', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  increased: { label: 'ADD', cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  decreased: { label: 'TRIM', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  unchanged: { label: 'UNCH', cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  sold: { label: 'SOLD', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'increased', label: 'Increased' },
  { id: 'decreased', label: 'Decreased' },
  { id: 'sold', label: 'Sold' },
];

const OverviewRow = ({ portfolio, idx, isExpanded, onToggle, formatNumber, formatShares, symbolFilter, columns }) => {
  const [statusFilter, setStatusFilter] = useState('all');
  const hasPrevious = portfolio.previous_filing_date != null;

  // Merge stocks + normalized sold positions into a unified list
  const allPositions = useMemo(() => {
    const stocks = portfolio.stocks || [];
    const soldPositions = (portfolio.sold_positions || []).map(sp => ({
      symbol: sp.symbol,
      cusip: sp.cusip,
      name: sp.name,
      value: sp.prev_value || 0,
      shares: sp.prev_shares || 0,
      weight: 0,
      share_change: -(sp.prev_shares || 0),
      value_change: -(sp.prev_value || 0),
      status: 'sold',
      _isSold: true,
    }));
    return [...stocks, ...soldPositions];
  }, [portfolio.stocks, portfolio.sold_positions]);

  const filteredPositions = useMemo(() => {
    const filtered = statusFilter === 'all'
      ? allPositions
      : allPositions.filter(s => s.status === statusFilter);
    return [...filtered].sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [allPositions, statusFilter]);

  // Status sort priority: new > increased > decreased > unchanged > sold
  const STATUS_ORDER = { new: 0, increased: 1, decreased: 2, unchanged: 3, sold: 4 };

  // Build expanded sub-table columns
  const subColumns = useMemo(() => {
    const cols = [
      {
        key: 'symbol',
        header: 'Symbol',
        minWidth: 80,
        sortable: true,
        renderFn: (value, row) => {
          const isCurrentSymbol = symbolFilter && row.symbol?.toUpperCase() === symbolFilter.toUpperCase();
          return (
            <span className={`font-medium ${row._isSold ? 'text-gray-400' : isCurrentSymbol ? 'text-cyan-400' : 'text-white'}`}>
              {row.symbol || row.cusip}
            </span>
          );
        },
      },
      {
        key: 'name',
        header: 'Name',
        minWidth: 120,
        sortable: true,
        renderFn: (value, row) => (
          <span className={`truncate max-w-[200px] inline-block ${row._isSold ? 'text-gray-500' : 'text-gray-400'}`}>
            {value}
          </span>
        ),
      },
      {
        key: 'value',
        header: 'Value',
        align: 'right',
        minWidth: 90,
        sortable: true,
        renderFn: (value, row) => (
          <span className={row._isSold ? 'text-gray-500' : 'text-white'}>
            {formatNumber(value)}
          </span>
        ),
      },
      {
        key: 'shares',
        header: 'Shares',
        align: 'right',
        minWidth: 80,
        sortable: true,
        renderFn: (value, row) => (
          <span className={row._isSold ? 'text-gray-500' : 'text-gray-300'}>
            {formatShares(value)}
          </span>
        ),
      },
      {
        key: 'weight',
        header: 'Weight',
        align: 'right',
        minWidth: 70,
        sortable: true,
        renderFn: (value, row) => (
          <span className={row._isSold ? 'text-gray-600' : 'text-cyan-400 font-medium'}>
            {row._isSold ? '-' : `${value || 0}%`}
          </span>
        ),
      },
    ];

    if (hasPrevious) {
      cols.push(
        {
          key: 'share_change',
          header: 'Share Chg',
          align: 'right',
          minWidth: 90,
          sortable: true,
          renderFn: (value, row) => {
            if (value == null) return <span className="text-gray-600">-</span>;
            const color = value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-500';
            return (
              <span className={color}>
                {value > 0 ? '+' : ''}{formatShares(value)}
                {row.share_change_pct != null && (
                  <span className="text-gray-500 ml-1">({row.share_change_pct > 0 ? '+' : ''}{row.share_change_pct.toFixed(1)}%)</span>
                )}
              </span>
            );
          },
        },
        {
          key: 'value_change',
          header: 'Value Chg',
          align: 'right',
          minWidth: 90,
          sortable: true,
          renderFn: (value) => {
            if (value == null) return <span className="text-gray-600">-</span>;
            const color = value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-500';
            return (
              <span className={color}>
                {value > 0 ? '+' : ''}{formatNumber(value)}
              </span>
            );
          },
        },
        {
          key: 'status',
          header: 'Status',
          align: 'center',
          minWidth: 70,
          sortable: true,
          renderFn: (value) => {
            const badge = value ? STATUS_BADGE[value] : null;
            if (!badge) return <span className="text-gray-600">-</span>;
            return (
              <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${badge.cls}`}>
                {badge.label}
              </span>
            );
          },
        },
      );
    }

    return cols;
  }, [hasPrevious, symbolFilter, formatNumber, formatShares]);

  return (
    <>
      <tr
        className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        {columns.map((col) => {
          const alignCls = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
          const tabNums = col.align === 'right' ? 'tabular-nums' : '';
          return (
            <td key={col.key} className={`py-3 px-4 ${alignCls} ${tabNums} ${col.className || ''}`}>
              {col.render(portfolio)}
            </td>
          );
        })}
      </tr>

      {/* Expanded holdings sub-table */}
      {isExpanded && portfolio.stocks && (
        <tr className="relative z-0">
          <td colSpan={columns.length} className="p-0">
            <div className="bg-[#08080d] border-b border-gray-800">
              {/* Position summary bar */}
              <div className="flex items-center gap-4 px-4 py-2 bg-gray-800/20 text-xs border-b border-gray-800/50">
                <span className="text-gray-400">
                  Period: <span className="text-white">{portfolio.period_end || '-'}</span>
                </span>
                {hasPrevious && (
                  <span className="text-gray-400">
                    vs <span className="text-gray-300">{portfolio.previous_filing_date}</span>
                  </span>
                )}
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

              {/* Status filter bar */}
              {hasPrevious && (
                <div className="flex items-center gap-1 px-4 py-1.5 border-b border-gray-800/50">
                  {STATUS_FILTERS.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setStatusFilter(f.id)}
                      className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                        statusFilter === f.id
                          ? 'bg-gray-700 text-white'
                          : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}

              <CommonTable
                key={statusFilter}
                columns={subColumns}
                data={filteredPositions.slice(0, 30)}
                compact
                searchable={false}
                exportable={false}
                pageSize={30}
                rowClassName={(row) => {
                  const isCurrentSymbol = symbolFilter && row.symbol?.toUpperCase() === symbolFilter.toUpperCase();
                  return `${row._isSold ? 'opacity-70' : ''} ${isCurrentSymbol ? 'bg-cyan-900/10' : ''}`.trim();
                }}
              />
              {filteredPositions.length > 30 && (
                <div className="px-4 py-2 text-center text-xs text-gray-600">
                  Showing top 30 of {filteredPositions.length} positions
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

/**
 * Holdings Table - Aggregated holdings across all loaded institutions
 */
const HoldingsTable = ({ holdings, formatNumber, formatShares, portfolios }) => {
  const columns = useMemo(() => [
    {
      key: 'symbol',
      header: 'Stock',
      minWidth: 200,
      sortable: true,
      renderFn: (value, row) => (
        <div className="flex items-center gap-3">
          <div
            className="w-1 h-10 rounded"
            style={{ backgroundColor: INST_COLORS[row._idx % INST_COLORS.length] }}
          />
          <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center text-xs font-bold text-white">
            {value?.slice(0, 2)}
          </div>
          <div>
            <div className="font-semibold text-white">{value}</div>
            <div className="text-xs text-gray-400 truncate max-w-[150px]">{row.name}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'totalValue',
      header: 'Total Value',
      align: 'right',
      minWidth: 130,
      sortable: true,
      renderFn: (value) => <span className="text-white font-medium">{formatNumber(value)}</span>,
    },
    {
      key: 'totalShares',
      header: 'Total Shares',
      align: 'right',
      minWidth: 120,
      sortable: true,
      renderFn: (value) => <span className="text-white">{formatShares(value)}</span>,
    },
    {
      key: 'holders',
      header: 'Holders',
      align: 'right',
      minWidth: 90,
      sortable: true,
      renderFn: (value) => (
        <span className="text-cyan-400 font-medium">{value}/{portfolios.length}</span>
      ),
    },
    {
      key: 'avgWeight',
      header: 'Avg Weight',
      align: 'right',
      minWidth: 100,
      sortable: true,
      renderFn: (value) => <span className="text-white">{value?.toFixed(1)}%</span>,
    },
    {
      key: 'institutions',
      header: 'Held By',
      minWidth: 150,
      sortable: false,
      renderFn: (value) => (
        <div className="flex items-center gap-1 flex-wrap">
          {(value || []).slice(0, 3).map((inst, i) => (
            <span key={i} className="px-1.5 py-0.5 bg-gray-800 rounded text-[10px] text-gray-400 truncate max-w-[80px]">
              {inst}
            </span>
          ))}
          {(value || []).length > 3 && (
            <span className="text-[10px] text-gray-500">+{value.length - 3}</span>
          )}
        </div>
      ),
    },
  ], [formatNumber, formatShares, portfolios.length]);

  const data = useMemo(() => holdings.map((h, i) => ({ ...h, _idx: i })), [holdings]);

  return (
    <CommonTable
      columns={columns}
      data={data}
      searchable
      exportable={false}
      pageSize={50}
    />
  );
};

/**
 * Activity Table - Portfolio-level position changes and activity metrics
 */
const ActivityTable = ({ portfolios, formatNumber }) => {
  const columns = useMemo(() => [
    {
      key: 'manager',
      header: 'Institution',
      minWidth: 250,
      sortable: true,
      renderFn: (value, row) => (
        <div className="flex items-center gap-3">
          <div
            className="w-1 h-10 rounded"
            style={{ backgroundColor: INST_COLORS[row._idx % INST_COLORS.length] }}
          />
          <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center">
            <Building2 size={14} className="text-gray-400" />
          </div>
          <div>
            <div className="font-semibold text-white">{value}</div>
            <div className="text-xs text-gray-400">{row.filing_date || ''}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'value_change',
      header: 'Value Change',
      align: 'right',
      minWidth: 110,
      sortable: true,
      renderFn: (value, row) => {
        const valueChange = value || (row.previous_value ? row.total_value - row.previous_value : null);
        if (valueChange == null) return <span className="text-gray-500">-</span>;
        const color = valueChange > 0 ? 'text-green-400' : valueChange < 0 ? 'text-red-400' : 'text-gray-400';
        return <span className={color}>{valueChange > 0 ? '+' : ''}{formatNumber(valueChange)}</span>;
      },
    },
    {
      key: 'value_change_pct',
      header: 'Change %',
      align: 'right',
      minWidth: 90,
      sortable: true,
      renderFn: (value) => {
        if (value == null) return <span className="text-gray-500">-</span>;
        const color = value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-400';
        return (
          <span className={`flex items-center justify-end gap-1 font-medium ${color}`}>
            {value > 0 && <TrendingUp size={12} />}
            {value < 0 && <TrendingDown size={12} />}
            {value > 0 ? '+' : ''}{value.toFixed(1)}%
          </span>
        );
      },
    },
    {
      key: 'num_new_positions',
      header: 'New',
      align: 'right',
      minWidth: 80,
      sortable: true,
      renderFn: (value) => value > 0
        ? <span className="flex items-center justify-end gap-1 text-green-400"><ArrowUpRight size={12} />{value}</span>
        : <span className="text-gray-500">{value || 0}</span>,
    },
    {
      key: 'num_sold_out',
      header: 'Sold',
      align: 'right',
      minWidth: 80,
      sortable: true,
      renderFn: (value) => value > 0
        ? <span className="flex items-center justify-end gap-1 text-red-400"><ArrowDownRight size={12} />{value}</span>
        : <span className="text-gray-500">{value || 0}</span>,
    },
    {
      key: 'num_increased',
      header: 'Increased',
      align: 'right',
      minWidth: 90,
      sortable: true,
      renderFn: (value) => value > 0
        ? <span className="text-cyan-400 font-medium">{value}</span>
        : <span className="text-gray-500">{value || 0}</span>,
    },
    {
      key: 'num_decreased',
      header: 'Decreased',
      align: 'right',
      minWidth: 90,
      sortable: true,
      renderFn: (value) => value > 0
        ? <span className="text-yellow-400 font-medium">{value}</span>
        : <span className="text-gray-500">{value || 0}</span>,
    },
    {
      key: 'turnover',
      header: 'Turnover',
      align: 'right',
      minWidth: 90,
      sortable: true,
      renderFn: (value) => value != null
        ? <span className="text-white">{value.toFixed(1)}%</span>
        : <span className="text-gray-500">-</span>,
    },
  ], [formatNumber]);

  const data = useMemo(() => portfolios.map((p, i) => ({ ...p, _idx: i })), [portfolios]);

  return (
    <CommonTable
      columns={columns}
      data={data}
      searchable
      exportable={false}
      pageSize={20}
    />
  );
};

export default InstitutionalPortfolios;
