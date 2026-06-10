/**
 * Institutional Portfolios - 13F Institutional Holdings
 * Design based on ComparisonAnalysisTab terminal style
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Plus,
  X,
  RefreshCw,
  Building2,
  TrendingUp,
  TrendingDown,
  Search,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { apiClient, API_BASE } from '../../config/api';
import CommonTable from '../common/CommonTable';
import BaseWidget from './common/BaseWidget';

// ── Overview 컬럼 (CommonTable 포맷) ─────────────────────────────────────────
const OVERVIEW_COLUMNS = [
  {
    key: 'manager',
    header: 'Institution',
    minWidth: 240,
    sortable: true,
    renderFn: (_, row) => (
      <div className="flex items-center gap-3">
        {/* 선택 표시 바 */}
        <div className="w-1 h-10 rounded transition-colors"
          style={{ backgroundColor: row._isSelected ? INST_COLORS[row._idx % INST_COLORS.length] : 'transparent',
                   border: row._isSelected ? 'none' : '1px solid #374151' }} />
        <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
          <Building2 size={14} className="text-gray-400" />
        </div>
        <div className="min-w-0">
          <div className={`font-semibold truncate ${row._isSelected ? 'text-white' : 'text-gray-300'}`}>{row.manager}</div>
          <div className="text-xs text-gray-500 truncate max-w-[160px]">{row.name}</div>
        </div>
        {row._isLoading && <RefreshCw size={11} className="animate-spin text-cyan-400 flex-shrink-0" />}
      </div>
    ),
  },
  {
    key: 'total_value',
    header: 'Total Value',
    align: 'right',
    minWidth: 120,
    sortable: true,
    renderFn: (value, row) => {
      if (!row._hasData) return <span className="text-gray-600 text-xs">{row._isLoading ? '…' : '-'}</span>;
      const fmt = value >= 1e12 ? `${(value/1e12).toFixed(2)}T`
                : value >= 1e9  ? `${(value/1e9).toFixed(2)}B`
                : value >= 1e6  ? `${(value/1e6).toFixed(2)}M`
                : `$${value?.toLocaleString() ?? '-'}`;
      return <span className="text-white font-medium tabular-nums">{fmt}</span>;
    },
  },
  {
    key: 'num_holdings',
    header: 'Holdings',
    align: 'right',
    minWidth: 90,
    sortable: true,
    renderFn: (value, row) =>
      !row._hasData ? <span className="text-gray-600 text-xs">{row._isLoading ? '…' : '-'}</span>
                    : <span className="text-white tabular-nums">{value ?? '-'}</span>,
  },
  {
    key: 'value_change_pct',
    header: 'Change QoQ',
    align: 'right',
    minWidth: 110,
    sortable: true,
    renderFn: (value, row) => {
      if (!row._hasData) return <span className="text-gray-600 text-xs">{row._isLoading ? '…' : '-'}</span>;
      if (value == null) return <span className="text-gray-500">-</span>;
      const color = value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-400';
      return (
        <span className={`flex items-center justify-end gap-1 ${color} tabular-nums`}>
          {value > 0 ? <TrendingUp size={12} /> : value < 0 ? <TrendingDown size={12} /> : null}
          {value > 0 ? '+' : ''}{value.toFixed(1)}%
        </span>
      );
    },
  },
  {
    key: 'turnover',
    header: 'Turnover',
    align: 'right',
    minWidth: 90,
    sortable: true,
    renderFn: (value, row) =>
      !row._hasData ? <span className="text-gray-600 text-xs">-</span>
                    : <span className="text-gray-300 text-xs tabular-nums">{value != null ? `${value.toFixed(1)}%` : '-'}</span>,
  },
  {
    key: 'filing_date',
    header: 'Filing Date',
    align: 'right',
    minWidth: 110,
    sortable: true,
    renderFn: (value, row) =>
      !row._hasData ? <span className="text-gray-600 text-xs">-</span>
                    : <span className="text-gray-400 text-xs">{value || '-'}</span>,
  },
];

const STATUS_BADGE = {
  new:       { label: 'NEW',  cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  increased: { label: 'ADD',  cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  decreased: { label: 'TRIM', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  unchanged: { label: 'UNCH', cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  sold:      { label: 'SOLD', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

const STATUS_FILTERS = [
  { id: 'all',       label: 'All' },
  { id: 'new',       label: 'New' },
  { id: 'increased', label: 'Increased' },
  { id: 'decreased', label: 'Decreased' },
  { id: 'sold',      label: 'Sold' },
];

const OverviewExpandedPanel = ({ portfolio, formatNumber, formatShares, onFetch }) => {
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!portfolio._hasFull && !portfolio._isLoading) onFetch?.();
  }, []);

  // 모든 훅은 early return 전에 선언해야 함 (Rules of Hooks)
  const hasPrevious = portfolio.previous_filing_date != null;

  const allPositions = useMemo(() => {
    const stocks = portfolio.stocks || [];
    const soldPositions = (portfolio.sold_positions || []).map(sp => ({
      symbol:       sp.symbol,
      cusip:        sp.cusip,
      name:         sp.name,
      value:        sp.prev_value || 0,
      shares:       sp.prev_shares || 0,
      weight:       0,
      share_change: -(sp.prev_shares || 0),
      value_change: -(sp.prev_value || 0),
      status:       'sold',
      _isSold:      true,
    }));
    return [...stocks, ...soldPositions];
  }, [portfolio.stocks, portfolio.sold_positions]);

  const filteredPositions = useMemo(() => {
    const filtered = statusFilter === 'all'
      ? allPositions
      : allPositions.filter(s => s.status === statusFilter);
    return [...filtered].sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [allPositions, statusFilter]);

  const subColumns = useMemo(() => {
    const cols = [
      {
        key: 'symbol',
        header: '#',
        minWidth: 50,
        sortable: false,
        renderFn: (_, row, idx) => (
          <span className="text-gray-500 tabular-nums">{(idx ?? 0) + 1}</span>
        ),
      },
      {
        key: 'symbol',
        header: 'Symbol',
        minWidth: 80,
        sortable: true,
        renderFn: (value, row) => (
          <span className={`font-medium ${row._isSold ? 'text-gray-400' : 'text-white'}`}>
            {row.symbol || row.cusip}
          </span>
        ),
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
          <span className={`tabular-nums ${row._isSold ? 'text-gray-500' : 'text-white'}`}>
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
          <span className={`tabular-nums ${row._isSold ? 'text-gray-500' : 'text-gray-300'}`}>
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
          <span className={`tabular-nums ${row._isSold ? 'text-gray-600' : 'text-cyan-400 font-medium'}`}>
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
          minWidth: 100,
          sortable: true,
          renderFn: (value, row) => {
            if (value == null) return <span className="text-gray-600">-</span>;
            const color = value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-500';
            return (
              <span className={`tabular-nums ${color}`}>
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
            return <span className={`tabular-nums ${color}`}>{value > 0 ? '+' : ''}{formatNumber(value)}</span>;
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
  }, [hasPrevious, formatNumber, formatShares]);

  // 훅 선언 완료 후 early return
  if (!portfolio._hasFull) {
    return (
      <div className="px-6 py-4 text-xs text-gray-500 flex items-center gap-2">
        <RefreshCw size={12} className="animate-spin text-cyan-400" />
        <span>Loading holdings…</span>
      </div>
    );
  }

  return (
    <div className="bg-[#08080d]">
      {/* 포지션 요약 바 */}
      <div className="flex items-center gap-4 px-4 py-2 bg-gray-800/20 text-xs border-b border-gray-800/50">
        <span className="text-gray-400">
          Period: <span className="text-white">{portfolio.period_end || '-'}</span>
        </span>
        {hasPrevious && (
          <span className="text-gray-400">
            vs <span className="text-gray-300">{portfolio.previous_filing_date}</span>
          </span>
        )}
        {portfolio.num_new_positions > 0 && <span className="text-green-400">+{portfolio.num_new_positions} new</span>}
        {portfolio.num_sold_out > 0 && <span className="text-red-400">-{portfolio.num_sold_out} sold</span>}
        {portfolio.num_increased > 0 && <span className="text-cyan-400">{portfolio.num_increased} increased</span>}
        {portfolio.num_decreased > 0 && <span className="text-yellow-400">{portfolio.num_decreased} decreased</span>}
      </div>

      <CommonTable
        key={statusFilter}
        columns={subColumns}
        data={filteredPositions.slice(0, 30).map((s, i) => ({ ...s, _key: `${s.symbol}-${i}` }))}
        compact
        searchable={false}
        exportable={false}
        pageSize={30}
        toolbarLeft={hasPrevious && STATUS_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={(e) => { e.stopPropagation(); setStatusFilter(f.id); }}
            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
              statusFilter === f.id
                ? 'bg-gray-700 text-white'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
            }`}
          >
            {f.label}
          </button>
        ))}
        rowClassName={(row) => row._isSold ? 'opacity-70' : ''}
      />
      {filteredPositions.length > 30 && (
        <div className="px-4 py-2 text-center text-xs text-gray-600">
          Showing top 30 of {filteredPositions.length} positions
        </div>
      )}
    </div>
  );
};

// Category tabs for different data views
const CATEGORIES = [
  { id: 'overview', name: 'Overview' },
  { id: 'holdings', name: 'Top Holdings' },
  { id: 'activity', name: 'Portfolio Activity' },
];

const CategoryTabs = ({ active, onChange, loading }) => (
  <div className="flex items-center gap-0.5">
    {CATEGORIES.map(cat => (
      <button
        key={cat.id}
        onClick={() => onChange(cat.id)}
        className={`px-2.5 py-1 text-xs font-medium whitespace-nowrap rounded transition-colors ${
          active === cat.id
            ? 'text-cyan-400 bg-cyan-400/10'
            : 'text-gray-400 hover:text-white hover:bg-gray-800'
        }`}
      >
        {cat.name}
      </button>
    ))}
    {loading && (
      <div className="flex items-center gap-1 ml-1 text-xs text-cyan-400">
        <RefreshCw size={11} className="animate-spin" />
      </div>
    )}
  </div>
);

// Sort options
const SORT_OPTIONS = [
  { id: 'total_value', label: 'AUM' },
  { id: 'num_holdings', label: 'Holdings' },
  { id: 'value_change_pct', label: 'Change %' },
];

// Colors for institution indicators
const INST_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

const InstitutionalPortfolios = ({ onRemove }) => {
  const [institutions, setInstitutions] = useState([]);
  const [selectedInstitutions, setSelectedInstitutions] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingKeys, setLoadingKeys] = useState(new Set());   // summary fetch (행 스피너용)
  const [expandLoadingKeys, setExpandLoadingKeys] = useState(new Set()); // expand full fetch
  const [activeCategory, setActiveCategory] = useState('overview');
  const [sortBy, setSortBy] = useState('total_value');
  const [showAddInst, setShowAddInst] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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

  const fetchInstitutions = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get(`${API_BASE}/portfolio/13f/institutions?use_dynamic=true`);
      const list = data.results || [];
      setInstitutions(list);
      // 목록 로드 후 전체 기관 summary 병렬 조회
      list.forEach(inst => fetchPortfolioSummary(inst.key));
    } catch (error) {
      console.error('Error fetching institutions:', error);
    } finally {
      setLoading(false);
    }
  };

  // 요약 데이터만 조회 (total_value, holdings, QoQ — 종목 목록 없음)
  const fetchPortfolioSummary = useCallback(async (instKey) => {
    setLoadingKeys(prev => new Set([...prev, instKey]));
    try {
      const data = await apiClient.get(`${API_BASE}/portfolio/13f/${instKey}?summary_only=true`);
      const portfolio = data.results?.[0];
      if (portfolio) {
        setPortfolios(prev => {
          const existing = prev.find(p => p.institution_key === portfolio.institution_key);
          if (existing?._full) return prev;
          const filtered = prev.filter(p => p.institution_key !== portfolio.institution_key);
          // _summarySnapshot: 정렬 기준값 고정용 (full 로드 후에도 sort 불변)
          return [...filtered, { ...portfolio, _full: false, _summarySnapshot: portfolio }];
        });
      }
    } catch (error) {
      console.error('Error fetching portfolio summary:', error);
    } finally {
      setLoadingKeys(prev => { const n = new Set(prev); n.delete(instKey); return n; });
    }
  }, []);

  // 전체 데이터 조회 (expand 시 호출) — expandLoadingKeys 사용으로 위젯 전체 로딩 표시 안 함
  const fetchPortfolio = useCallback(async (instKey) => {
    setExpandLoadingKeys(prev => new Set([...prev, instKey]));
    try {
      const data = await apiClient.get(`${API_BASE}/portfolio/13f/${instKey}`);
      const portfolio = data.results?.[0];
      if (portfolio) {
        setPortfolios(prev => {
          const existing = prev.find(p => p.institution_key === portfolio.institution_key);
          const filtered = prev.filter(p => p.institution_key !== portfolio.institution_key);
          // _summarySnapshot 유지 → 정렬 순서 변경 없음
          return [...filtered, { ...portfolio, _full: true, _summarySnapshot: existing?._summarySnapshot ?? portfolio }];
        });
      }
    } catch (error) {
      console.error('Error fetching portfolio:', error);
    } finally {
      setExpandLoadingKeys(prev => { const n = new Set(prev); n.delete(instKey); return n; });
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

  // Overview: 전체 기관 목록 + 로드된 portfolio 데이터 병합
  const overviewData = useMemo(() =>
    institutions.map((inst, idx) => {
      const portfolio = portfolios.find(p => p.institution_key === inst.key);
      return {
        ...inst,
        ...(portfolio || {}),
        _idx: idx,
        _key: inst.key,
        _isSelected: !!selectedInstitutions.find(s => s.key === inst.key),
        _isLoading: loadingKeys.has(inst.key) || expandLoadingKeys.has(inst.key),
        _hasData: !!portfolio,
        _hasFull: !!portfolio?._full,
      };
    }).sort((a, b) => {
      if (a._isSelected !== b._isSelected) return a._isSelected ? -1 : 1;
      // _summarySnapshot 기준으로 정렬 → full 로드 후에도 순서 불변
      const aSnap = a._summarySnapshot || a;
      const bSnap = b._summarySnapshot || b;
      return (bSnap[sortBy] || 0) - (aSnap[sortBy] || 0);
    }),
  [institutions, portfolios, selectedInstitutions, loadingKeys, expandLoadingKeys, sortBy]);

  // Holdings / Activity: 선택된 기관의 portfolio만
  const selectedPortfolios = useMemo(() => {
    const base = portfolios.filter(p =>
      selectedInstitutions.find(s => s.key === p.institution_key)
    );
    return [...base].sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));
  }, [portfolios, selectedInstitutions, sortBy]);

  // Get all unique holdings across selected portfolios for the "holdings" view
  const getAllHoldings = () => {
    const holdingsMap = {};
    selectedPortfolios.forEach((portfolio) => {
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

  // 위젯 헤더 로딩: 초기 목록/summary fetch만 포함, expand fetch 제외
  const isAnyLoading = loading || loadingKeys.size > 0;
  // tabs 옆 스피너: summary 또는 expand 중 하나라도 진행 중
  const isTabLoading = loadingKeys.size > 0 || expandLoadingKeys.size > 0;

  return (
    <BaseWidget
      title="Institutional Portfolios"
      loading={isAnyLoading}
      onRefresh={fetchInstitutions}
      onRemove={onRemove}
    >
    <div className="flex flex-col h-full min-h-0">
      {/* Sub-header: institution chips + controls */}
      <div className="flex items-center flex-wrap gap-2 px-3 py-2 border-b border-gray-800">
        {/* Institution chips */}
        {selectedInstitutions.length === 0 ? (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Building2 size={13} /><span>No institution selected</span>
          </div>
        ) : selectedInstitutions.map((inst, idx) => (
          <div key={inst.key} className="flex items-center gap-1 px-2 py-1 bg-gray-800 rounded text-xs">
            <span className="text-cyan-400 font-medium">{idx + 1}</span>
            <span className="text-white truncate max-w-[100px]" title={inst.manager}>{inst.manager}</span>
            {loadingKeys.has(inst.key) && <RefreshCw size={10} className="animate-spin text-cyan-400" />}
            <button onClick={(e) => { e.stopPropagation(); removeInstitution(inst.key); }} className="text-gray-500 hover:text-red-400">
              <X size={11} />
            </button>
          </div>
        ))}

        {/* Add institution */}
        <div className="relative" ref={addInstRef}>
          <button onClick={() => setShowAddInst(!showAddInst)} className="flex items-center gap-1 px-2 py-1 text-xs text-cyan-400 hover:bg-gray-800 rounded">
            <Plus size={13} />Add
          </button>
          {showAddInst && (
            <div className="absolute top-full left-0 mt-1 w-72 bg-[#1a1a1f] border border-gray-700 rounded-lg shadow-xl z-50">
              <div className="p-2 border-b border-gray-700 relative">
                <Search className="absolute left-4 top-3.5 text-gray-500" size={13} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search institutions..."
                  className="w-full pl-7 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
                  autoFocus
                />
              </div>
              <div className="max-h-56 overflow-y-auto">
                {filteredInstitutions.map(inst => {
                  const isSel = !!selectedInstitutions.find(s => s.key === inst.key);
                  return (
                    <button key={inst.key} onClick={() => !isSel && addInstitution(inst)} disabled={isSel}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-800 ${isSel ? 'opacity-40 cursor-not-allowed' : ''}`}>
                      <div className="text-white font-medium truncate">{inst.manager}</div>
                      <div className="text-gray-500 text-[11px] truncate">{inst.name}</div>
                    </button>
                  );
                })}
                {!filteredInstitutions.length && <div className="px-3 py-4 text-xs text-gray-500 text-center">No institutions found</div>}
              </div>
              {selectedInstitutions.length >= 10 && (
                <div className="p-2 border-t border-gray-700 text-xs text-yellow-500 text-center">Maximum 10 institutions</div>
              )}
            </div>
          )}
        </div>


        {/* Sort selector */}
        <div className="flex items-center gap-0.5 bg-gray-800 rounded p-0.5 ml-auto">
          {SORT_OPTIONS.map(opt => (
            <button key={opt.id} onClick={() => setSortBy(opt.id)}
              className={`px-2 py-1 text-xs rounded transition-colors ${sortBy === opt.id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeCategory !== 'overview' && selectedPortfolios.length === 0 ? (
          <>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800">
              <CategoryTabs active={activeCategory} onChange={setActiveCategory} loading={isTabLoading} />
            </div>
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <Building2 size={32} className="mb-3 opacity-50" />
              <p className="text-sm">No institutions selected</p>
              <p className="text-xs mt-1 text-gray-600">Select institutions from the Overview tab</p>
            </div>
          </>
        ) : activeCategory === 'overview' ? (
          <CommonTable
            columns={OVERVIEW_COLUMNS}
            data={overviewData}
            renderExpanded={(row) => (
              <OverviewExpandedPanel
                portfolio={row}
                formatNumber={formatNumber}
                formatShares={formatShares}
                onFetch={() => fetchPortfolio(row.key)}
              />
            )}
            rowClassName={(row) => row._isSelected ? 'bg-cyan-950/20' : ''}
            searchable={false}
            exportable={false}
            pageSize={20}
            toolbarLeft={<CategoryTabs active={activeCategory} onChange={setActiveCategory} loading={isTabLoading} />}
          />
        ) : activeCategory === 'holdings' ? (
          <HoldingsTable
            holdings={getAllHoldings()}
            formatNumber={formatNumber}
            formatShares={formatShares}
            portfolios={selectedPortfolios}
            toolbarLeft={<CategoryTabs active={activeCategory} onChange={setActiveCategory} loading={isTabLoading} />}
          />
        ) : activeCategory === 'activity' ? (
          <ActivityTable
            portfolios={selectedPortfolios}
            formatNumber={formatNumber}
            toolbarLeft={<CategoryTabs active={activeCategory} onChange={setActiveCategory} loading={isTabLoading} />}
          />
        ) : null}
      </div>
    </div>
    </BaseWidget>
  );
};
/**
 * Holdings Table - Aggregated holdings across all loaded institutions
 */
const HoldingsTable = ({ holdings, formatNumber, formatShares, portfolios, toolbarLeft }) => {
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
      toolbarLeft={toolbarLeft}
    />
  );
};

/**
 * Activity Table - Portfolio-level position changes and activity metrics
 */
const ActivityTable = ({ portfolios, formatNumber, toolbarLeft }) => {
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
      toolbarLeft={toolbarLeft}
    />
  );
};

export default InstitutionalPortfolios;
