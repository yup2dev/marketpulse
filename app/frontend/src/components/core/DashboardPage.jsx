/**
 * DashboardPage — unified page component for all grid-based routes.
 *
 * Routes:
 *   /           → <DashboardPage />
 *   /stock      → <DashboardPage />
 *   /macro      → <DashboardPage />
 *   /portfolios → <DashboardPage />
 *
 * Tabs are driven by URL_WIDGET_MAP[pathname].categories.
 * Active tab is kept in ?section= URL param.
 * Each tab has its own default widget layout and its own saved workspace
 * (workspace key = "pathname-sectionId", e.g. "/stock-financials").
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LayoutGrid, RefreshCw, Plus, ChevronDown } from 'lucide-react';

import { WidgetSyncProvider } from '../../contexts/WidgetSyncContext';
import useAuthStore from '../../store/authStore';
import usePortfolioState from '../../hooks/usePortfolioState';

import { URL_WIDGET_MAP } from '../../registry/urlWidgetMap';
import DashboardGrid from './DashboardGrid';
import WidgetRenderer from './WidgetRenderer';
import WidgetMenu from './WidgetMenu';

import StockSelectorModal from '../common/StockSelectorModal';
import useNavigationStore from '../../store/navigationStore';

export default function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const { setLastSection, setLastSymbol } = useNavigationStore();

  const config = URL_WIDGET_MAP[location.pathname];
  const categories = config?.categories || [];

  // Active tab: URL param → saved last section (sync read) → first category
  const activeSection =
    searchParams.get('section') ||
    useNavigationStore.getState().lastSection[location.pathname] ||
    categories[0]?.id || '';
  const activeCategory = categories.find(c => c.id === activeSection) || categories[0];

  // Workspace key: pathname + section (e.g. "/stock-financials")
  const screenKey = `${location.pathname}-${activeSection}`;

  const handleTabChange = (sectionId) => {
    setSearchParams({ section: sectionId });
    setLastSection(location.pathname, sectionId);
    addWidgetRef.current = null;
    setActiveWidgetIds([]);
  };

  // Symbol state — read synchronously from store (bypasses hydration timing)
  const [symbol, setSymbol] = useState(
    () => useNavigationStore.getState().lastSymbol
  );

  // Widget menu state
  const [menuOpen, setMenuOpen] = useState(false);

  // addWidget ref — filled by DashboardGrid
  const addWidgetRef = useRef(null);

  // Active widget types on grid (for WidgetMenu "already added" state)
  const [activeWidgetIds, setActiveWidgetIds] = useState([]);

  // Right-click context menu
  const [ctxMenu, setCtxMenu] = useState(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const timer = setTimeout(() => document.addEventListener('click', close), 0);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [ctxMenu]);

  // Portfolio state — always called, only used on /portfolios
  const portfolio = usePortfolioState();

  const handleAddWidget = useCallback((widgetDefs) => {
    const list = Array.isArray(widgetDefs) ? widgetDefs : [widgetDefs];
    list.forEach(w => addWidgetRef.current?.(w));
    setActiveWidgetIds(prev => {
      const next = [...prev];
      list.forEach(w => { if (!next.includes(w.id)) next.push(w.id); });
      return next;
    });
  }, []);

  const handleContextMenu = useCallback((e) => {
    const isInteractive = e.target.closest(
      'button, a, input, select, textarea, [role="button"], .react-grid-item, .no-context-menu'
    );
    if (isInteractive) return;
    e.preventDefault();
    const x = Math.min(e.clientX, window.innerWidth  - 160);
    const y = Math.min(e.clientY, window.innerHeight - 80);
    setCtxMenu({ x, y });
  }, []);

  // Auth guard for portfolio
  if (config?.needsPortfolio && !isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-[#0a0a0f] text-gray-400 gap-3">
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

  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-500 text-sm">
        Page not configured
      </div>
    );
  }

  const defaultWidgets = activeCategory?.defaultWidgets || [];

  return (
    <WidgetSyncProvider defaultSymbol={symbol}>
      <div className="min-h-screen bg-[#0a0a0f] text-white" onContextMenu={handleContextMenu}>

        {/* ── Sub-header ─────────────────────────────────────────────────── */}
        <div className="bg-[#0d0d12] border-b border-gray-800 px-4">

          {/* Top row: label + selectors */}
          <div className="flex items-center justify-between py-2 gap-2">
            <div className="flex items-center gap-2">
              <LayoutGrid size={13} className="text-gray-500" />
              <span className="text-sm font-semibold text-gray-200">{config.label}</span>
            </div>

            <div className="flex items-center gap-2">
              {config.needsSymbol && (
                <StockSelectorModal
                  symbol={symbol}
                  onSelect={(s) => {
                    const sym = s.symbol || s;
                    setSymbol(sym);
                    setLastSymbol(sym);
                  }}
                />
              )}

              {config.needsPortfolio && (
                <>
                  {portfolio.lastRefreshed && (
                    <span className="text-[10px] text-gray-600 whitespace-nowrap hidden sm:inline">
                      {portfolio.lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <div className="flex items-center rounded border border-gray-700 overflow-hidden">
                    {['USD', 'KRW'].map(cur => (
                      <button
                        key={cur}
                        onClick={() => portfolio.handleCurrencyToggle(cur)}
                        className={`px-2 py-1 text-[11px] font-medium transition-colors ${
                          portfolio.displayCurrency === cur
                            ? 'bg-gray-700 text-white'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {cur}
                      </button>
                    ))}
                  </div>
                  {portfolio.displayCurrency === 'KRW' && portfolio.exchangeRate && (
                    <span className="text-[10px] text-gray-600 hidden sm:inline">
                      1$ = ₩{portfolio.exchangeRate.toLocaleString('ko-KR')}
                    </span>
                  )}
                  <button
                    onClick={portfolio.doRefreshPrices}
                    disabled={portfolio.isRefreshingPrices}
                    className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
                    title="Refresh prices"
                  >
                    <RefreshCw size={12} className={portfolio.isRefreshingPrices ? 'animate-spin' : ''} />
                  </button>
                  {portfolio.selectedPortfolio && (
                    <button
                      onClick={() => portfolio.setShowAddTransaction(true)}
                      className="flex items-center gap-1 px-2 py-1 bg-cyan-900/40 hover:bg-cyan-900/60 text-cyan-400 text-xs rounded border border-cyan-800/40 transition-colors"
                    >
                      <Plus size={12} />
                      Trade
                    </button>
                  )}
                  <PortfolioDropdown portfolio={portfolio} />
                </>
              )}

              <button
                onClick={() => setMenuOpen(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded border border-gray-700 transition-colors"
              >
                <Plus size={12} />
                Widget
              </button>
            </div>
          </div>

          {/* Tab row — ?section= URL mapping */}
          {categories.length > 1 && (
            <div className="flex gap-0.5 overflow-x-auto pb-0">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => handleTabChange(cat.id)}
                  className={`relative px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    activeSection === cat.id
                      ? 'text-white'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {cat.label}
                  {activeSection === cat.id && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500 rounded-t" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Portfolio empty state ───────────────────────────────────────── */}
        {config.needsPortfolio && portfolio.portfolios.length === 0 && !portfolio.loadingPortfolios && (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
            <p className="text-gray-500 text-sm">No portfolios yet</p>
            <button
              onClick={() => portfolio.setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs rounded transition-colors"
            >
              <Plus size={14} />
              Create Portfolio
            </button>
          </div>
        )}

        {/* ── Grid — keyed by screenKey so each tab has its own saved layout */}
        {(!config.needsPortfolio || portfolio.portfolios.length > 0 || portfolio.selectedPortfolio) && (
          <DashboardGrid
            key={screenKey}
            screen={screenKey}
            defaultWidgets={defaultWidgets}
            onAddWidgetReady={(fn) => { addWidgetRef.current = fn; }}
            renderWidget={(widgetCfg, onRemoveWidget) => {
              return (
                <WidgetRenderer
                  widget={widgetCfg}
                  symbol={symbol}
                  onSymbolChange={setSymbol}
                  portfolioData={config.needsPortfolio ? portfolio : undefined}
                  onRemove={onRemoveWidget}
                />
              );
            }}
          />
        )}

        {/* ── Right-click context menu ────────────────────────────────────── */}
        {ctxMenu && (
          <div
            className="fixed z-[100] bg-[#0d0d12] border border-gray-700 rounded-lg shadow-2xl py-1 min-w-[140px]"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setCtxMenu(null); setMenuOpen(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <Plus size={14} className="text-cyan-400" />
              Add Widget
            </button>
          </div>
        )}

        {/* ── Widget picker modal ─────────────────────────────────────────── */}
        <WidgetMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          categories={activeCategory ? [activeCategory] : categories}
          activeWidgetIds={activeWidgetIds}
          onAdd={handleAddWidget}
        />

      </div>
    </WidgetSyncProvider>
  );
}

// ── Portfolio dropdown ─────────────────────────────────────────────────────────
function PortfolioDropdown({ portfolio }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded transition-colors max-w-[160px]"
      >
        <span className="truncate">{portfolio.selectedPortfolio?.name || 'Select Portfolio'}</span>
        <ChevronDown size={10} className="flex-shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-[#1a1a2e] border border-gray-700 rounded shadow-xl z-50 py-1 min-w-[180px]">
            {portfolio.portfolios.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-500">No portfolios</div>
            ) : portfolio.portfolios.map((p) => (
              <button
                key={p.portfolio_id}
                onClick={() => { portfolio.setSelectedPortfolio(p); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-800 transition-colors ${
                  portfolio.selectedPortfolio?.portfolio_id === p.portfolio_id ? 'text-cyan-400' : 'text-gray-300'
                }`}
              >
                {p.name}
                {p.description && <span className="text-gray-600 ml-1">· {p.description.slice(0, 20)}</span>}
              </button>
            ))}
            <div className="border-t border-gray-800 mt-1 pt-1">
              <button
                onClick={() => { setOpen(false); portfolio.setShowCreateModal(true); }}
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
  );
}
