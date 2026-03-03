/**
 * TabDashboard — unified screen component used by 4 routes.
 *
 * Routes:
 *   /           → <TabDashboard screen="dashboard" />
 *   /stock      → <TabDashboard screen="stock" />
 *   /macro      → <TabDashboard screen="macro" />
 *   /portfolios → <TabDashboard screen="portfolio" />
 *
 * Each screen has its own tab list from SCREEN_CONFIGS.
 * Active tab is kept in URL ?tab= param.
 * Each tab gets its own backend workspace via screen="{screen}-{tab}".
 */
import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { RefreshCw, ChevronDown, Plus } from 'lucide-react';

import { WidgetSyncProvider } from '../../contexts/WidgetSyncContext';
import useAuthStore from '../../store/authStore';
import usePortfolioState from '../../hooks/usePortfolioState';
import { SCREEN_CONFIGS } from '../../registry/screenConfigs';

import DashboardGrid from './DashboardGrid';
import WidgetRenderer from './WidgetRenderer';

import StockSelectorModal from '../common/StockSelectorModal';
import CreatePortfolioModal from '../portfolio/CreatePortfolioModal';
import AddTransactionModal from '../portfolio/AddTransactionModal';

export default function TabDashboard({ screen }) {
  const config = SCREEN_CONFIGS[screen];
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  // Active tab from URL (defaults to first tab)
  const activeTab = searchParams.get('tab') || config.tabs[0].id;

  // Symbol state (for stock/dashboard screens)
  const [symbol, setSymbol] = useState('AAPL');

  // Portfolio state — always called (hook rules), but only used when screen=portfolio
  const portfolio = usePortfolioState();

  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId });
  };

  // Redirect unauthenticated users for portfolio screen
  if (screen === 'portfolio' && !isAuthenticated) {
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

  // Default widgets for current tab
  const tabDefaultWidgets = (config.defaultWidgets[activeTab] || []);

  return (
    <WidgetSyncProvider defaultSymbol={symbol}>
      <div className="min-h-screen bg-[#0a0a0f] text-white">

        {/* ── Header bar ─────────────────────────────────────────────────── */}
        <div className="bg-[#0d0d12] border-b border-gray-800 px-4">

          {/* Top row: title + selectors */}
          <div className="flex items-center justify-between py-2 gap-2">
            <h1 className="text-sm font-semibold text-gray-200 shrink-0">{config.label}</h1>

            <div className="flex items-center gap-2">
              {/* Stock symbol selector */}
              {config.symbol && (
                <StockSelectorModal
                  symbol={symbol}
                  onSelect={(s) => setSymbol(s.symbol || s)}
                />
              )}

              {/* Portfolio selector + actions */}
              {config.portfolioSelector && (
                <>
                  {portfolio.lastRefreshed && (
                    <span className="text-[10px] text-gray-600 whitespace-nowrap hidden sm:inline">
                      Updated {portfolio.lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}

                  {/* Currency toggle */}
                  <div className="flex items-center rounded border border-gray-700 overflow-hidden">
                    {['USD', 'KRW'].map((cur) => (
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

                  {portfolio.displayCurrency === 'KRW' && (
                    <span className="text-[10px] text-gray-600 whitespace-nowrap hidden sm:inline">
                      {portfolio.loadingRate ? '환율 조회 중...' : portfolio.exchangeRate ? `1$ = ₩${portfolio.exchangeRate.toLocaleString('ko-KR')}` : '환율 없음'}
                    </span>
                  )}

                  {/* Refresh prices */}
                  <button
                    onClick={portfolio.doRefreshPrices}
                    disabled={portfolio.isRefreshingPrices}
                    className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
                    title="Refresh prices"
                  >
                    <RefreshCw size={12} className={portfolio.isRefreshingPrices ? 'animate-spin' : ''} />
                  </button>

                  {/* Add trade */}
                  {portfolio.selectedPortfolio && (
                    <button
                      onClick={() => portfolio.setShowAddTransaction(true)}
                      className="flex items-center gap-1 px-2 py-1 bg-cyan-900/40 hover:bg-cyan-900/60 text-cyan-400 text-xs rounded border border-cyan-800/40 transition-colors"
                    >
                      <Plus size={12} />
                      Trade
                    </button>
                  )}

                  {/* Portfolio dropdown */}
                  <PortfolioDropdown portfolio={portfolio} />
                </>
              )}
            </div>
          </div>

          {/* Tab navigation */}
          <div className="flex gap-0.5 overflow-x-auto pb-0">
            {config.tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`relative px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500 rounded-t" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Portfolio "no portfolios" empty state ───────────────────────── */}
        {screen === 'portfolio' && portfolio.portfolios.length === 0 && !portfolio.loadingPortfolios && (
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

        {/* ── Grid content ────────────────────────────────────────────────── */}
        {(screen !== 'portfolio' || portfolio.portfolios.length > 0 || portfolio.selectedPortfolio) && (
          <DashboardGrid
            key={`${screen}-${activeTab}`}
            screen={`${screen}-${activeTab}`}
            defaultWidgets={tabDefaultWidgets}
            renderWidget={(widgetCfg, onRemoveWidget) => (
              <WidgetRenderer
                widget={widgetCfg}
                symbol={symbol}
                onSymbolChange={setSymbol}
                portfolioData={screen === 'portfolio' ? portfolio : undefined}
                onRemove={onRemoveWidget}
              />
            )}
          />
        )}

        {/* ── Portfolio modals ─────────────────────────────────────────────── */}
        {screen === 'portfolio' && (
          <>
            {portfolio.showCreateModal && (
              <CreatePortfolioModal
                onClose={() => portfolio.setShowCreateModal(false)}
                onCreate={portfolio.handleCreatePortfolio}
              />
            )}
            {portfolio.showAddTransaction && (
              <AddTransactionModal
                onClose={() => portfolio.setShowAddTransaction(false)}
                onAdd={portfolio.handleAddTransaction}
              />
            )}
            {portfolio.editingTransaction && (
              <AddTransactionModal
                isEditing
                initialValues={portfolio.editingTransaction}
                onClose={() => portfolio.setEditingTransaction(null)}
                onEdit={portfolio.handleEditTransaction}
              />
            )}
          </>
        )}
      </div>
    </WidgetSyncProvider>
  );
}

// ── Portfolio dropdown sub-component ─────────────────────────────────────────
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
            ) : (
              portfolio.portfolios.map((p) => (
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
              ))
            )}
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
