/**
 * usePortfolioState — all portfolio API state extracted from PortfolioDashboard.
 * TabDashboard calls this for the portfolio screen only.
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import toast from 'react-hot-toast';
import { portfolioAPI } from '../config/api';
import useAuthStore from '../store/authStore';

// ── Formatters ──────────────────────────────────────────────────────────────
export const formatCurrency = (v, dec = 2) => {
  if (v == null) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
};
export const formatKRW = (v) => {
  if (v == null) return '₩0';
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(Math.round(v));
};
export const formatPercent = (v) => v == null ? '0.00%' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

// ── Map raw DB holding → widget row ─────────────────────────────────────────
const mapHolding = (h) => {
  const hasMkt   = h.market_value != null && h.market_value > 0;
  const value    = hasMkt ? h.market_value : (h.total_cost ?? (h.quantity ?? 0) * (h.avg_cost ?? 0));
  const curPrice = (h.current_price && h.current_price > 0) ? h.current_price : (h.avg_cost ?? 0);
  return {
    symbol:         h.ticker_cd,
    name:           h.ticker_cd,
    quantity:       h.quantity ?? 0,
    avgCost:        h.avg_cost ?? 0,
    currentPrice:   curPrice,
    value,
    pnl:            hasMkt ? (h.unrealized_pnl ?? 0) : 0,
    pnlPct:         hasMkt ? (h.unrealized_pnl_pct ?? 0) : 0,
    openPrice:      null,
    dailyChange:    null,
    dailyChangePct: null,
    todayPnl:       null,
    _noPrices:      !hasMkt,
    _raw:           h,
  };
};

export default function usePortfolioState() {
  const { isAuthenticated } = useAuthStore();

  // ── Portfolio list ────────────────────────────────────────────────────────
  const [portfolios, setPortfolios] = useState([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState(null);
  const [loadingPortfolios, setLoadingPortfolios] = useState(false);

  // ── Holdings / transactions / summary ────────────────────────────────────
  const [holdings, setHoldings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loadingHoldings, setLoadingHoldings] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // ── Live prices ───────────────────────────────────────────────────────────
  const [priceQuotes, setPriceQuotes] = useState({});
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);

  // ── Currency ──────────────────────────────────────────────────────────────
  const [displayCurrency, setDisplayCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(null);
  const [loadingRate, setLoadingRate] = useState(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedPeriod, setSelectedPeriod] = useState('30D');
  const [selectedAccountType, setSelectedAccountType] = useState('all');
  const [hideSmallBalances, setHideSmallBalances] = useState(false);
  const [chartTab, setChartTab] = useState('value');
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // ── Load portfolios ───────────────────────────────────────────────────────
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

  // ── Load holdings + summary ───────────────────────────────────────────────
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

  // ── Load transactions ─────────────────────────────────────────────────────
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

  // ── Refresh prices ────────────────────────────────────────────────────────
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

  // ── Exchange rate ─────────────────────────────────────────────────────────
  const fetchExchangeRate = useCallback(async () => {
    setLoadingRate(true);
    try {
      const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=KRW');
      const data = await res.json();
      setExchangeRate(data?.rates?.KRW ?? null);
    } catch {
      setExchangeRate(null);
    } finally {
      setLoadingRate(false);
    }
  }, []);

  const handleCurrencyToggle = useCallback((currency) => {
    setDisplayCurrency(currency);
    if (currency === 'KRW' && !exchangeRate) fetchExchangeRate();
  }, [exchangeRate, fetchExchangeRate]);

  // ── Portfolio actions ─────────────────────────────────────────────────────
  const handleCreatePortfolio = useCallback(async (data) => {
    try {
      const created = await portfolioAPI.create(data);
      toast.success('Portfolio created');
      setShowCreateModal(false);
      await loadPortfolios();
      setSelectedPortfolio(created);
    } catch {
      toast.error('Failed to create portfolio');
    }
  }, [loadPortfolios]);

  const handleAddTransaction = useCallback(async (txnData) => {
    if (!selectedPortfolio?.portfolio_id) {
      toast.error('No portfolio selected');
      return;
    }
    setIsSubmittingTransaction(true);
    try {
      await portfolioAPI.addTransaction(selectedPortfolio.portfolio_id, txnData);
      toast.success(`${txnData.transaction_type.toUpperCase()} ${txnData.ticker_cd} added`);
      setShowAddTransaction(false);
      const pid = selectedPortfolio.portfolio_id;
      await Promise.all([loadHoldings(pid), loadTransactions(pid)]);
      doRefreshPrices(pid, true);
    } catch (err) {
      toast.error(err.detail || 'Failed to add transaction');
    } finally {
      setIsSubmittingTransaction(false);
    }
  }, [selectedPortfolio, loadHoldings, loadTransactions, doRefreshPrices]);

  const handleEditTransaction = useCallback(async (transactionId, txnData) => {
    if (!selectedPortfolio?.portfolio_id) return;
    setIsSubmittingTransaction(true);
    try {
      await portfolioAPI.updateTransaction(selectedPortfolio.portfolio_id, transactionId, txnData);
      toast.success('Transaction updated');
      setEditingTransaction(null);
      const pid = selectedPortfolio.portfolio_id;
      await Promise.all([loadHoldings(pid), loadTransactions(pid)]);
      doRefreshPrices(pid, true);
    } catch (err) {
      toast.error(err.detail || 'Failed to update transaction');
    } finally {
      setIsSubmittingTransaction(false);
    }
  }, [selectedPortfolio, loadHoldings, loadTransactions, doRefreshPrices]);

  const handleDeleteTransaction = useCallback(async (transaction) => {
    if (!selectedPortfolio?.portfolio_id) return;
    try {
      await portfolioAPI.deleteTransaction(selectedPortfolio.portfolio_id, transaction.transaction_id);
      toast.success(`${transaction.ticker_cd} transaction deleted`);
      const pid = selectedPortfolio.portfolio_id;
      await Promise.all([loadHoldings(pid), loadTransactions(pid)]);
      doRefreshPrices(pid, true);
    } catch (err) {
      toast.error(err.detail || 'Failed to delete transaction');
    }
  }, [selectedPortfolio, loadHoldings, loadTransactions, doRefreshPrices]);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => { loadPortfolios(); }, [isAuthenticated]); // eslint-disable-line

  useEffect(() => {
    if (!selectedPortfolio?.portfolio_id) return;
    const pid = selectedPortfolio.portfolio_id;
    Promise.all([loadHoldings(pid), loadTransactions(pid)]).then(() => {
      doRefreshPrices(pid, true);
    });
  }, [selectedPortfolio?.portfolio_id]); // eslint-disable-line

  // ── Enrich holdings with live prices ─────────────────────────────────────
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
        currentPrice:    curPrice,
        value:           hasLive ? mktValue : h.value,
        pnl:             unrealPnl,
        pnlPct:          unrealPnlPct,
        openPrice:       q.open ?? null,
        dailyChange:     q.change ?? null,
        dailyChangePct:  q.change_percent ?? null,
        todayPnl:        q.open != null ? (curPrice - q.open) * h.quantity : null,
        _noPrices:       !hasLive && h._noPrices,
      };
    });
  }, [holdings, priceQuotes]);

  const filteredHoldings = useMemo(
    () => hideSmallBalances ? enrichedHoldings.filter((h) => h.value >= 10) : enrichedHoldings,
    [enrichedHoldings, hideSmallBalances]
  );

  const stats = useMemo(() => {
    const totalMktValue = enrichedHoldings.reduce((s, h) => s + (h.value || 0), 0);
    const totalCost     = enrichedHoldings.reduce((s, h) => s + h.quantity * h.avgCost, 0);
    const unrealPnl     = totalMktValue - totalCost;
    const returnPct     = totalCost > 0 ? (unrealPnl / totalCost) * 100 : 0;
    const todayPnl      = enrichedHoldings.reduce((s, h) => s + (h.todayPnl || 0), 0);
    return { pnl: unrealPnl, volume: totalMktValue, maxDrawdown: 0, totalEquity: totalMktValue, totalCost, returnPct, todayPnl, holdingsCount: enrichedHoldings.length, stockEquity: totalMktValue, futuresEquity: 0, earnBalance: 0 };
  }, [enrichedHoldings]);

  const pnlHistory = useMemo(() => {
    if (!summary) return [];
    const base = summary.total_cost || 10000;
    return Array.from({ length: 30 }, (_, i) => ({
      date:  new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
      value: base + (stats.pnl || 0) * (i / 29),
      pnl:   (stats.pnl || 0) * (i / 29),
    }));
  }, [summary, stats.pnl]);

  return {
    // Portfolio list
    portfolios, selectedPortfolio, setSelectedPortfolio, loadingPortfolios,
    showCreateModal, setShowCreateModal, handleCreatePortfolio,
    // Holdings / stats
    filteredHoldings, stats, pnlHistory, summary,
    loadingHoldings, loadingTransactions,
    // Transactions
    transactions, priceQuotes,
    showAddTransaction, setShowAddTransaction,
    editingTransaction, setEditingTransaction,
    isSubmittingTransaction,
    handleAddTransaction, handleEditTransaction, handleDeleteTransaction,
    // Prices
    lastRefreshed, isRefreshingPrices,
    doRefreshPrices: () => selectedPortfolio && doRefreshPrices(selectedPortfolio.portfolio_id, false),
    // Currency
    displayCurrency, exchangeRate, loadingRate, formatKRW,
    handleCurrencyToggle,
    // Period / filters
    selectedPeriod, setSelectedPeriod,
    selectedAccountType, setSelectedAccountType,
    hideSmallBalances, setHideSmallBalances,
    chartTab, setChartTab,
  };
}
