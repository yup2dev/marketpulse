/**
 * Portfolio Dashboard
 * Grid-based layout — real API data + Add Transaction
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import GridLayout from 'react-grid-layout';
import { ChevronDown, Plus, RefreshCw } from 'lucide-react';
import { portfolioAPI } from '../config/api';
import useAuthStore from '../store/authStore';
import CreatePortfolioModal from '../components/portfolio/CreatePortfolioModal';
import AddTransactionModal from '../components/portfolio/AddTransactionModal';
import PortfolioStatsWidget from '../components/widgets/portfolio/PortfolioStatsWidget';
import PortfolioPnLChartWidget from '../components/widgets/portfolio/PortfolioPnLChartWidget';
import PortfolioHoldingsWidget from '../components/widgets/portfolio/PortfolioHoldingsWidget';
import PortfolioBalancesWidget from '../components/widgets/portfolio/PortfolioBalancesWidget';
import PortfolioPositionsWidget from '../components/widgets/portfolio/PortfolioPositionsWidget';
import PortfolioTradeHistoryWidget from '../components/widgets/portfolio/PortfolioTradeHistoryWidget';
import PortfolioEmptyWidget from '../components/widgets/portfolio/PortfolioEmptyWidget';
import 'react-grid-layout/css/styles.css';

// ─── Tab config ────────────────────────────────────────────────────────────────
const PORTFOLIO_TABS = [
  { id: 'overview',              label: 'Overview' },
  { id: 'balances',              label: 'Balances' },
  { id: 'positions',             label: 'Positions' },
  { id: 'trade-history',         label: 'Trade History' },
  { id: 'open-orders',           label: 'Open Orders' },
  { id: 'dividends',             label: 'Dividends' },
  { id: 'deposits-withdrawals',  label: 'Deposits & Withdrawals' },
];

// ─── Widget definitions per tab ────────────────────────────────────────────────
const TAB_WIDGET_DEFS = {
  overview:              [{ id: 'stats-1', type: 'stats' }, { id: 'chart-1', type: 'chart' }, { id: 'holdings-1', type: 'holdings' }],
  balances:              [{ id: 'balances-1', type: 'balances' }],
  positions:             [{ id: 'positions-1', type: 'positions' }],
  'trade-history':       [{ id: 'trade-history-1', type: 'trade-history' }],
  'open-orders':         [{ id: 'open-orders-1',   type: 'empty', title: 'Open Orders',             message: 'No open orders' }],
  dividends:             [{ id: 'dividends-1',      type: 'empty', title: 'Dividends',               message: 'No dividend records' }],
  'deposits-withdrawals':[{ id: 'deposits-1',       type: 'empty', title: 'Deposits & Withdrawals',  message: 'No records' }],
};

// ─── Default grid layouts per tab ─────────────────────────────────────────────
const DEFAULT_LAYOUTS = {
  overview:             [{ i: 'stats-1', x: 0, y: 0, w: 5, h: 6, minW: 3, minH: 4 }, { i: 'chart-1', x: 5, y: 0, w: 7, h: 6, minW: 4, minH: 4 }, { i: 'holdings-1', x: 0, y: 6, w: 12, h: 6, minW: 6, minH: 4 }],
  balances:             [{ i: 'balances-1',  x: 0, y: 0, w: 12, h: 10, minW: 6, minH: 5 }],
  positions:            [{ i: 'positions-1', x: 0, y: 0, w: 12, h: 10, minW: 6, minH: 5 }],
  'trade-history':      [{ i: 'trade-history-1', x: 0, y: 0, w: 12, h: 10, minW: 6, minH: 5 }],
  'open-orders':        [{ i: 'open-orders-1',   x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 4 }],
  dividends:            [{ i: 'dividends-1',      x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 4 }],
  'deposits-withdrawals':[{ i: 'deposits-1',      x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 4 }],
};

// ─── Formatters ────────────────────────────────────────────────────────────────
const formatCurrency = (v, dec = 2) => {
  if (v == null) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
};
const formatPercent = (v) => v == null ? '0.00%' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

// ─── Map raw DB holding → widget row ──────────────────────────────────────────
const mapHolding = (h) => {
  const hasMkt   = h.market_value != null && h.market_value > 0;
  const value    = hasMkt ? h.market_value : (h.total_cost ?? (h.quantity ?? 0) * (h.avg_cost ?? 0));
  const curPrice = (h.current_price && h.current_price > 0) ? h.current_price : (h.avg_cost ?? 0);
  return {
    symbol:       h.ticker_cd,
    name:         h.ticker_cd,
    quantity:     h.quantity ?? 0,
    avgCost:      h.avg_cost ?? 0,
    currentPrice: curPrice,
    value,
    pnl:          hasMkt ? (h.unrealized_pnl ?? 0) : 0,
    pnlPct:       hasMkt ? (h.unrealized_pnl_pct ?? 0) : 0,
    openPrice:    null,
    dailyChange:  null,
    dailyChangePct: null,
    todayPnl:     null,
    _noPrices:    !hasMkt,
    _raw:         h,
  };
};

// ─── Component ─────────────────────────────────────────────────────────────────
export default function PortfolioDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuthStore();

  // ── Portfolio state ──────────────────────────────────────────────────────────
  const [portfolios, setPortfolios] = useState([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState(null);
  const [loadingPortfolios, setLoadingPortfolios] = useState(false);
  const [showPortfolioMenu, setShowPortfolioMenu] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // ── Holdings / transactions / stats ─────────────────────────────────────────
  const [holdings, setHoldings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loadingHoldings, setLoadingHoldings] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // ── Live price data (from refresh-prices API) ────────────────────────────────
  // { AAPL: { price, open, change, change_percent, high, low }, ... }
  const [priceQuotes, setPriceQuotes] = useState({});
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // ── UI ───────────────────────────────────────────────────────────────────────
  const [selectedPeriod, setSelectedPeriod] = useState('30D');
  const [selectedAccountType, setSelectedAccountType] = useState('all');
  const [hideSmallBalances, setHideSmallBalances] = useState(false);
  const [chartTab, setChartTab] = useState('value');
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);  // transaction object being edited
  const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false);
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);

  // ── Grid ─────────────────────────────────────────────────────────────────────
  const [tabLayouts, setTabLayouts] = useState(() => {
    try { return { ...DEFAULT_LAYOUTS, ...JSON.parse(localStorage.getItem('portfolio-tab-layouts') || '{}') }; }
    catch { return DEFAULT_LAYOUTS; }
  });
  const [gridWidth, setGridWidth] = useState(1200);
  const containerRef = useRef(null);

  const activeTab = searchParams.get('tab') || 'overview';
  const handleTabChange = (id) => navigate(`/portfolios?tab=${id}`, { replace: true });

  // ── Load portfolios ──────────────────────────────────────────────────────────
  const loadPortfolios = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingPortfolios(true);
    try {
      const data = await portfolioAPI.getAll();
      const list = Array.isArray(data) ? data : (data.data || []);
      setPortfolios(list);
      if (list.length > 0 && !selectedPortfolio) {
        setSelectedPortfolio(list[0]);
      }
    } catch (err) {
      console.error('Portfolio load error:', err);
    } finally {
      setLoadingPortfolios(false);
    }
  }, [isAuthenticated, selectedPortfolio]);

  // ── Load holdings + summary ──────────────────────────────────────────────────
  const loadHoldings = useCallback(async (portfolioId) => {
    if (!portfolioId) return;
    setLoadingHoldings(true);
    try {
      const [holdingsData, summaryData] = await Promise.allSettled([
        portfolioAPI.getHoldings(portfolioId),
        portfolioAPI.getSummary(portfolioId),
      ]);
      if (holdingsData.status === 'fulfilled') {
        const raw = Array.isArray(holdingsData.value) ? holdingsData.value : (holdingsData.value?.data || []);
        setHoldings(raw.map(mapHolding));
      }
      if (summaryData.status === 'fulfilled') {
        setSummary(summaryData.value);
      }
    } catch (err) {
      console.error('Holdings load error:', err);
    } finally {
      setLoadingHoldings(false);
    }
  }, []);

  // ── Load transactions ────────────────────────────────────────────────────────
  const loadTransactions = useCallback(async (portfolioId) => {
    if (!portfolioId) return;
    setLoadingTransactions(true);
    try {
      const data = await portfolioAPI.getTransactions(portfolioId);
      const list = Array.isArray(data) ? data : (data.data || []);
      setTransactions(list);
    } catch (err) {
      console.error('Transactions load error:', err);
    } finally {
      setLoadingTransactions(false);
    }
  }, []);

  // ── Refresh prices (silent or explicit) ─────────────────────────────────────
  const doRefreshPrices = useCallback(async (portfolioId, silent = false) => {
    if (!portfolioId) return;
    setIsRefreshingPrices(true);
    try {
      const result = await portfolioAPI.refreshPrices(portfolioId);
      if (result?.quotes) {
        setPriceQuotes(result.quotes);
        setLastRefreshed(new Date());
      }
      if (!silent) {
        if (result?.updated > 0) {
          toast.success(`Updated ${result.updated} price${result.updated > 1 ? 's' : ''}`);
        } else {
          toast('No prices updated', { icon: '⚠️' });
        }
      }
      return result;
    } catch (err) {
      if (!silent) toast.error('Price refresh failed');
      console.error('Price refresh error:', err);
    } finally {
      setIsRefreshingPrices(false);
    }
  }, []);

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => { loadPortfolios(); }, [isAuthenticated]);

  useEffect(() => {
    if (!selectedPortfolio?.portfolio_id) return;
    const pid = selectedPortfolio.portfolio_id;

    // Load data first, then auto-refresh prices in background
    Promise.all([
      loadHoldings(pid),
      loadTransactions(pid),
    ]).then(() => {
      doRefreshPrices(pid, true); // silent auto-refresh
    });
  }, [selectedPortfolio?.portfolio_id]);

  useEffect(() => {
    const updateWidth = () => { if (containerRef.current) setGridWidth(containerRef.current.offsetWidth); };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // ── Portfolio actions ────────────────────────────────────────────────────────
  const handleCreatePortfolio = async (data) => {
    try {
      const created = await portfolioAPI.create(data);
      toast.success('Portfolio created');
      setShowCreateModal(false);
      await loadPortfolios();
      setSelectedPortfolio(created);
    } catch {
      toast.error('Failed to create portfolio');
    }
  };

  const handleAddTransaction = async (txnData) => {
    if (!selectedPortfolio?.portfolio_id) {
      toast.error('No portfolio selected');
      return;
    }
    setIsSubmittingTransaction(true);
    try {
      await portfolioAPI.addTransaction(selectedPortfolio.portfolio_id, txnData);
      toast.success(`${txnData.transaction_type.toUpperCase()} ${txnData.ticker_cd} added`);
      setShowAddTransaction(false);
      await Promise.all([
        loadHoldings(selectedPortfolio.portfolio_id),
        loadTransactions(selectedPortfolio.portfolio_id),
      ]);
      // Refresh prices after new transaction
      doRefreshPrices(selectedPortfolio.portfolio_id, true);
    } catch (err) {
      toast.error(err.detail || 'Failed to add transaction');
    } finally {
      setIsSubmittingTransaction(false);
    }
  };

  // ── Edit transaction ─────────────────────────────────────────────────────────
  const handleEditTransaction = async (transactionId, txnData) => {
    if (!selectedPortfolio?.portfolio_id) return;
    setIsSubmittingTransaction(true);
    try {
      await portfolioAPI.updateTransaction(selectedPortfolio.portfolio_id, transactionId, txnData);
      toast.success('Transaction updated');
      setEditingTransaction(null);
      await Promise.all([
        loadHoldings(selectedPortfolio.portfolio_id),
        loadTransactions(selectedPortfolio.portfolio_id),
      ]);
      doRefreshPrices(selectedPortfolio.portfolio_id, true);
    } catch (err) {
      toast.error(err.detail || 'Failed to update transaction');
    } finally {
      setIsSubmittingTransaction(false);
    }
  };

  // ── Delete transaction ────────────────────────────────────────────────────────
  const handleDeleteTransaction = async (transaction) => {
    if (!selectedPortfolio?.portfolio_id) return;
    try {
      await portfolioAPI.deleteTransaction(selectedPortfolio.portfolio_id, transaction.transaction_id);
      toast.success(`${transaction.ticker_cd} transaction deleted`);
      await Promise.all([
        loadHoldings(selectedPortfolio.portfolio_id),
        loadTransactions(selectedPortfolio.portfolio_id),
      ]);
      doRefreshPrices(selectedPortfolio.portfolio_id, true);
    } catch (err) {
      toast.error(err.detail || 'Failed to delete transaction');
    }
  };

  // ── Grid layout persist ──────────────────────────────────────────────────────
  const handleLayoutChange = useCallback((newLayout) => {
    setTabLayouts((prev) => {
      const updated = { ...prev, [activeTab]: newLayout };
      try { localStorage.setItem('portfolio-tab-layouts', JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, [activeTab]);

  // ── Enrich holdings with live price data ─────────────────────────────────────
  // Merges DB holdings with live quotes (open, change, etc.) from refresh API
  const enrichedHoldings = useMemo(() => {
    return holdings.map((h) => {
      const q = priceQuotes[h.symbol] || {};
      const hasLive = q.price != null;
      const curPrice = hasLive ? q.price : h.currentPrice;
      const totalCostBasis = h.quantity * h.avgCost;
      const mktValue = curPrice * h.quantity;
      const unrealPnl = hasLive ? mktValue - totalCostBasis : h.pnl;
      const unrealPnlPct = hasLive && totalCostBasis > 0
        ? ((mktValue - totalCostBasis) / totalCostBasis) * 100
        : h.pnlPct;

      return {
        ...h,
        currentPrice: curPrice,
        value: hasLive ? mktValue : h.value,
        pnl: unrealPnl,
        pnlPct: unrealPnlPct,
        openPrice: q.open ?? null,
        dailyChange: q.change ?? null,
        dailyChangePct: q.change_percent ?? null,
        todayPnl: q.open != null ? (curPrice - q.open) * h.quantity : null,
        _noPrices: !hasLive && h._noPrices,
      };
    });
  }, [holdings, priceQuotes]);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const filteredHoldings = useMemo(
    () => hideSmallBalances ? enrichedHoldings.filter((h) => h.value >= 10) : enrichedHoldings,
    [enrichedHoldings, hideSmallBalances]
  );

  const dividendTransactions = useMemo(
    () => transactions.filter((t) => t.transaction_type === 'dividend'),
    [transactions]
  );

  // ── Stats derived from enriched holdings ─────────────────────────────────────
  const stats = useMemo(() => {
    const totalMktValue = enrichedHoldings.reduce((s, h) => s + (h.value || 0), 0);
    const totalCost = enrichedHoldings.reduce((s, h) => s + h.quantity * h.avgCost, 0);
    const unrealPnl = totalMktValue - totalCost;
    const returnPct = totalCost > 0 ? (unrealPnl / totalCost) * 100 : 0;
    const todayPnl = enrichedHoldings.reduce((s, h) => s + (h.todayPnl || 0), 0);

    return {
      pnl: unrealPnl,
      volume: totalMktValue,
      maxDrawdown: 0,
      totalEquity: totalMktValue,
      totalCost,
      returnPct,
      todayPnl,
      holdingsCount: enrichedHoldings.length,
      stockEquity: totalMktValue,
      futuresEquity: 0,
      earnBalance: 0,
    };
  }, [enrichedHoldings]);

  // ── Mock PnL chart (until performance API returns time-series) ───────────────
  const pnlHistory = useMemo(() => {
    if (!summary) return [];
    const base = summary.total_cost || 10000;
    return Array.from({ length: 30 }, (_, i) => ({
      date:  new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
      value: base + (stats.pnl || 0) * (i / 29),
      pnl:   (stats.pnl || 0) * (i / 29),
    }));
  }, [summary, stats.pnl]);

  // ── Widget renderer ──────────────────────────────────────────────────────────
  const renderWidget = useCallback((widget) => {
    switch (widget.type) {
      case 'stats':
        return (
          <PortfolioStatsWidget
            stats={stats}
            selectedAccountType={selectedAccountType}
            setSelectedAccountType={setSelectedAccountType}
            selectedPeriod={selectedPeriod}
            setSelectedPeriod={setSelectedPeriod}
            formatCurrency={formatCurrency}
            formatPercent={formatPercent}
            lastRefreshed={lastRefreshed}
          />
        );
      case 'chart':
        return (
          <PortfolioPnLChartWidget
            pnlHistory={pnlHistory}
            chartTab={chartTab}
            setChartTab={setChartTab}
          />
        );
      case 'holdings':
        return (
          <PortfolioHoldingsWidget
            holdings={filteredHoldings}
            onViewAll={() => handleTabChange('balances')}
          />
        );
      case 'balances':
        return (
          <PortfolioBalancesWidget
            holdings={filteredHoldings}
            hideSmallBalances={hideSmallBalances}
            setHideSmallBalances={setHideSmallBalances}
          />
        );
      case 'positions':
        return <PortfolioPositionsWidget holdings={filteredHoldings} />;
      case 'trade-history':
        return (
          <PortfolioTradeHistoryWidget
            transactions={transactions}
            loading={loadingTransactions}
            onAddTransaction={() => setShowAddTransaction(true)}
            onEditTransaction={(txn) => setEditingTransaction(txn)}
            onDeleteTransaction={handleDeleteTransaction}
            priceQuotes={priceQuotes}
          />
        );
      case 'empty':
        return <PortfolioEmptyWidget title={widget.title} message={widget.message} />;
      default:
        return null;
    }
  }, [stats, pnlHistory, filteredHoldings, chartTab, selectedAccountType, selectedPeriod, hideSmallBalances, transactions, loadingTransactions, lastRefreshed]);

  const currentWidgets = TAB_WIDGET_DEFS[activeTab] || [];
  const currentLayout  = tabLayouts[activeTab] || DEFAULT_LAYOUTS[activeTab] || [];

  // ── Not logged in ────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0f] text-gray-400 gap-3">
        <p className="text-sm">Sign in to view your portfolio</p>
        <button
          onClick={() => navigate('/login')}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded transition-colors"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="text-white bg-[#0a0a0f] h-[calc(100vh-56px)] flex flex-col">

      {/* ── Header bar ──────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-2 flex-shrink-0">

        {/* Tabs */}
        <div className="flex items-center gap-0.5 flex-wrap flex-1 min-w-0">
          {PORTFOLIO_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors rounded whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-white bg-gray-800'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: last updated + portfolio selector + actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Last updated timestamp */}
          {lastRefreshed && (
            <span className="text-[10px] text-gray-600 whitespace-nowrap">
              Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          {/* Refresh */}
          <button
            onClick={() => selectedPortfolio && doRefreshPrices(selectedPortfolio.portfolio_id, false)}
            disabled={isRefreshingPrices}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
            title="Refresh prices"
          >
            <RefreshCw size={12} className={isRefreshingPrices ? 'animate-spin' : ''} />
          </button>

          {/* Add Transaction shortcut */}
          {selectedPortfolio && (
            <button
              onClick={() => setShowAddTransaction(true)}
              className="flex items-center gap-1 px-2 py-1 bg-cyan-900/40 hover:bg-cyan-900/60 text-cyan-400 text-xs rounded border border-cyan-800/40 transition-colors"
            >
              <Plus size={12} />
              Trade
            </button>
          )}

          {/* Portfolio selector */}
          <div className="relative">
            <button
              onClick={() => setShowPortfolioMenu(!showPortfolioMenu)}
              className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded transition-colors max-w-[160px]"
            >
              <span className="truncate">{selectedPortfolio?.name || 'Select Portfolio'}</span>
              <ChevronDown size={10} className="flex-shrink-0" />
            </button>

            {showPortfolioMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowPortfolioMenu(false)} />
                <div className="absolute right-0 top-full mt-1 bg-[#1a1a2e] border border-gray-700 rounded shadow-xl z-50 py-1 min-w-[180px]">
                  {portfolios.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-500">No portfolios</div>
                  ) : (
                    portfolios.map((p) => (
                      <button
                        key={p.portfolio_id}
                        onClick={() => { setSelectedPortfolio(p); setShowPortfolioMenu(false); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-800 transition-colors ${
                          selectedPortfolio?.portfolio_id === p.portfolio_id ? 'text-cyan-400' : 'text-gray-300'
                        }`}
                      >
                        {p.name}
                        {p.description && <span className="text-gray-600 ml-1">· {p.description.slice(0, 20)}</span>}
                      </button>
                    ))
                  )}
                  <div className="border-t border-gray-800 mt-1 pt-1">
                    <button
                      onClick={() => { setShowPortfolioMenu(false); setShowCreateModal(true); }}
                      className="w-full text-left px-3 py-2 text-xs text-cyan-400 hover:bg-gray-800 flex items-center gap-1 transition-colors"
                    >
                      <Plus size={11} />
                      New Portfolio
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── No portfolio state ───────────────────────────────────────────────── */}
      {portfolios.length === 0 && !loadingPortfolios && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3">
          <p className="text-gray-500 text-sm">No portfolios yet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs rounded transition-colors"
          >
            <Plus size={14} />
            Create Portfolio
          </button>
        </div>
      )}

      {/* ── Grid content ─────────────────────────────────────────────────────── */}
      {(portfolios.length > 0 || selectedPortfolio) && (
        <div className="flex-1 overflow-auto p-4">
          <GridLayout
            className="layout"
            layout={currentLayout}
            cols={12}
            rowHeight={80}
            width={Math.max(gridWidth - 32, 600)}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".drag-handle-area"
            isDraggable
            isResizable
            compactType="vertical"
            preventCollision={false}
            margin={[12, 12]}
            containerPadding={[0, 0]}
          >
            {currentWidgets.map((widget) => (
              <div key={widget.id} className="widget-container">
                {renderWidget(widget)}
              </div>
            ))}
          </GridLayout>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <CreatePortfolioModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreatePortfolio}
        />
      )}

      {showAddTransaction && (
        <AddTransactionModal
          onClose={() => setShowAddTransaction(false)}
          onAdd={handleAddTransaction}
        />
      )}

      {editingTransaction && (
        <AddTransactionModal
          isEditing
          initialValues={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onEdit={handleEditTransaction}
        />
      )}

      {/* ── Grid styles ─────────────────────────────────────────────────────────── */}
      <style>{`
        .widget-container { height: 100%; }
        .widget-container > div { height: 100%; }
        .react-grid-item { transition: all 200ms ease; transition-property: left, top; }
        .react-grid-item.cssTransforms { transition-property: transform; }
        .react-grid-item.resizing { z-index: 1; will-change: width, height; }
        .react-grid-item.react-draggable-dragging { transition: none; z-index: 3; will-change: transform; opacity: 0.9; }
        .react-grid-item > .react-resizable-handle { position: absolute; width: 20px; height: 20px; }
        .react-grid-item > .react-resizable-handle::after {
          content: ""; position: absolute; right: 3px; bottom: 3px; width: 5px; height: 5px;
          border-right: 2px solid rgba(255,255,255,0.2); border-bottom: 2px solid rgba(255,255,255,0.2);
        }
        .react-grid-item:hover > .react-resizable-handle::after { border-color: rgba(255,255,255,0.4); }
        .react-grid-placeholder { background: #06b6d4; opacity: 0.15; border-radius: 8px; transition-duration: 100ms; z-index: 2; }
      `}</style>
    </div>
  );
}
