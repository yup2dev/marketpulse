/**
 * DashboardPage — unified page component for all grid-based routes.
 *
 * Split panes: available on all pages via right-click → "Split Right / Down".
 * Workspaces:  Dashboard (/) only — multiple saved layouts with selector.
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LayoutGrid, RefreshCw, Plus, ChevronDown, X, Copy, Trash2, Save } from 'lucide-react';
import useWorkspace from '../../hooks/useWorkspace';

import { WidgetSyncProvider } from '../../contexts/WidgetSyncContext';
import useAuthStore from '../../store/authStore';
import usePortfolioState from '../../hooks/usePortfolioState';
import useNavigationStore from '../../store/navigationStore';

import { URL_WIDGET_MAP, getGlobalWidgetCategories } from '../../registry/urlWidgetMap';
import SplitPaneLayout, {
  splitPaneNode,
  removePaneNode,
  updatePaneSection,
  countPanes,
  findPane,
} from './SplitPaneLayout';
import DashboardPane from './DashboardPane';
import WidgetMenu from './WidgetMenu';

import StockSelectorModal from '../common/StockSelectorModal';
import CreatePortfolioModal from '../common/CreatePortfolioModal';
import AddTransactionModal from '../common/AddTransactionModal';

// ── Split tree helpers (localStorage — kept as offline fallback) ─────────────

// ── Split tree persistence ──────────────────────────────────────────────────
function splitTreeStorageKey(pathname, wsId) {
  return wsId ? `split-tree:/-${wsId}` : `split-tree:${pathname}`;
}

function loadSplitTree(pathname, defaultSectionId, wsId) {
  const key = splitTreeStorageKey(pathname, wsId);
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
    if (wsId === 'default') {
      const old = localStorage.getItem('split-tree:/');
      if (old) return JSON.parse(old);
    }
  } catch {}
  return { type: 'pane', id: 'root', sectionId: defaultSectionId };
}

function saveSplitTree(pathname, tree, wsId) {
  localStorage.setItem(splitTreeStorageKey(pathname, wsId), JSON.stringify(tree));
}

// ── Component ───────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const { setLastSection, setLastSymbol } = useNavigationStore();

  const pathname = location.pathname;
  const config = URL_WIDGET_MAP[pathname];
  const categories = config?.categories || [];
  const isDashboard = pathname === '/';

  const defaultSection =
    searchParams.get('section') ||
    useNavigationStore.getState().lastSection[pathname] ||
    categories[0]?.id ||
    '';

  // ── Workspace state — backend via useWorkspace hook ─────────────────────
  const {
    workspace: activeWorkspace,
    workspaces,
    isLoading: wsLoading,
    saveLayout: saveWsLayout,
    createWorkspace: createWsInBackend,
    deleteWorkspace: deleteWsFromBackend,
    setActive: setWsActive,
    renameWorkspace: renameWsInBackend,
  } = useWorkspace(isDashboard ? 'dashboard' : null);

  const wsId = isDashboard ? (activeWorkspace?.id || null) : null;
  const activeWsId = wsId;

  // Debounce ref for split tree auto-save
  const saveTreeTimerRef = useRef(null);

  const switchWorkspace = useCallback((id) => {
    setWsActive(id);
  }, [setWsActive]);

  const createWorkspace = useCallback(async () => {
    const nums = workspaces.map((w) => {
      const m = w.name.match(/^Dashboard\s+(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    });
    const next = Math.max(0, ...nums) + 1;
    await createWsInBackend(`Dashboard ${next}`);
  }, [workspaces, createWsInBackend]);

  const deleteWorkspace = useCallback(
    async (id) => {
      if (workspaces.length <= 1) return;
      localStorage.removeItem(`split-tree:/-${id}`);
      await deleteWsFromBackend(id);
    },
    [workspaces, deleteWsFromBackend],
  );

  const renameWorkspace = useCallback(
    async (id, name) => {
      await renameWsInBackend(id, name);
    },
    [renameWsInBackend],
  );

  // ── Split tree state — backend preferred, localStorage fallback ─────────
  const splitTreeFromBackend = useMemo(() => {
    if (!activeWorkspace?.layout?.length) return null;
    return activeWorkspace.layout[0]?.splitTree || null;
  }, [activeWorkspace]);

  const [splitTree, setSplitTree] = useState(() =>
    loadSplitTree(pathname, defaultSection, null),
  );

  // When active workspace changes, reload split tree (backend first, then local)
  useEffect(() => {
    if (splitTreeFromBackend) {
      setSplitTree(splitTreeFromBackend);
    } else {
      setSplitTree(loadSplitTree(pathname, defaultSection, activeWsId));
    }
  }, [activeWorkspace?.id, splitTreeFromBackend]);

  const updateTree = useCallback(
    (newTree) => {
      setSplitTree(newTree);
      saveSplitTree(pathname, newTree, activeWsId); // localStorage fallback
      // Debounced save to backend
      if (isDashboard) {
        clearTimeout(saveTreeTimerRef.current);
        saveTreeTimerRef.current = setTimeout(() => {
          saveWsLayout([{ splitTree: newTree }], []);
        }, 1500);
      }
    },
    [pathname, activeWsId, isDashboard, saveWsLayout],
  );

  // Cleanup debounce on unmount
  useEffect(() => () => clearTimeout(saveTreeTimerRef.current), []);

  // Reload tree when page changes (not workspace — handled by workspace effect above)
  useEffect(() => {
    if (!isDashboard) {
      setSplitTree(loadSplitTree(pathname, defaultSection, null));
    }
  }, [pathname]);

  // ── Symbol state ────────────────────────────────────────────────────────
  const symbolFromUrl = searchParams.get('symbol')?.toUpperCase() || null;

  const [symbol, setSymbol] = useState(
    () => symbolFromUrl || useNavigationStore.getState().lastSymbol || 'AAPL',
  );

  // Sync symbol when URL ?symbol= changes (CommandPalette navigates to /stock?symbol=XXX)
  useEffect(() => {
    if (symbolFromUrl && symbolFromUrl !== symbol) {
      setSymbol(symbolFromUrl);
      setLastSymbol(symbolFromUrl);
    }
  }, [symbolFromUrl]);

  // ── Widget menu (pane-aware) ────────────────────────────────────────────
  const [menuState, setMenuState] = useState({ open: false, paneId: null });
  const addWidgetRefs = useRef({});

  const registerAddWidget = useCallback((paneId, fn) => {
    addWidgetRefs.current[paneId] = fn;
  }, []);

  const handleAddWidget = useCallback(
    (widgetDefs) => {
      const addFn = addWidgetRefs.current[menuState.paneId];
      if (!addFn) return;
      const list = Array.isArray(widgetDefs) ? widgetDefs : [widgetDefs];
      list.forEach((w) => addFn(w));
    },
    [menuState.paneId],
  );

  const openWidgetMenu = useCallback((paneId) => {
    setMenuState({ open: true, paneId });
  }, []);

  // ── Tree operations ─────────────────────────────────────────────────────
  const handleSplit = useCallback(
    (paneId, direction, sectionId) => {
      updateTree(splitPaneNode(splitTree, paneId, direction, sectionId));
    },
    [splitTree, updateTree],
  );

  const handleClosePane = useCallback(
    (paneId) => {
      updateTree(removePaneNode(splitTree, paneId));
    },
    [splitTree, updateTree],
  );

  const handleSectionChange = useCallback(
    (paneId, sectionId) => {
      updateTree(updatePaneSection(splitTree, paneId, sectionId));
      setLastSection(pathname, sectionId);
    },
    [splitTree, updateTree, pathname, setLastSection],
  );

  // ── Portfolio state ─────────────────────────────────────────────────────
  const portfolio = usePortfolioState();

  // ── Derived ─────────────────────────────────────────────────────────────
  const menuPaneCategory = (() => {
    const pane = menuState.paneId
      ? findPane(splitTree, menuState.paneId)
      : null;
    return pane
      ? categories.find((c) => c.id === pane.sectionId) || categories[0]
      : categories[0];
  })();

  // 메뉴 카탈로그 = 현재 pane 카테고리 + 전 페이지의 완성 위젯(중복 제외).
  // WidgetMenu가 여기에 "All Models"(standard_model 단위)를 덧붙인다.
  const menuCategories = (() => {
    const base = menuPaneCategory ? [menuPaneCategory] : categories;
    const baseIds = base.flatMap((c) => c.widgets.map((w) => w.id));
    return [
      ...base,
      ...getGlobalWidgetCategories({
        excludeIds: baseIds,
        includePortfolio: !!config?.needsPortfolio,
      }),
    ];
  })();

  const totalPanes = countPanes(splitTree);
  const firstPaneId =
    splitTree.type === 'pane' ? splitTree.id : findFirstPaneId(splitTree);

  // ── Copilot 위젯 추가 — CopilotPanel이 dispatch하는 CustomEvent 수신 ─────
  useEffect(() => {
    const handler = (e) => {
      const { widget_type: widgetType, w, h } = e.detail || {};
      if (!widgetType) return;
      // copilot/{id} 합성 데이터셋 — rows는 localStorage에 보관, 위젯은 타입으로 참조
      if (widgetType.startsWith('copilot/')) {
        try {
          const { title, rows, chart_hint: chartHint } = e.detail;
          localStorage.setItem(
            `copilot-ds:${widgetType.slice('copilot/'.length)}`,
            JSON.stringify({ title, rows, chart_hint: chartHint, savedAt: Date.now() }),
          );
          gcCopilotDatasets();
        } catch { /* quota 초과 등 — 위젯은 추가하되 빈 데이터로 표시 */ }
      }
      const addFn =
        addWidgetRefs.current[firstPaneId] ||
        Object.values(addWidgetRefs.current)[0];
      addFn?.({ id: widgetType, defaultSize: { w: w || 6, h: h || 5 } });
    };
    window.addEventListener('copilot:add-widget', handler);
    return () => window.removeEventListener('copilot:add-widget', handler);
  }, [firstPaneId]);


  // ── Auth guard ──────────────────────────────────────────────────────────
  if (config?.needsPortfolio && !isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] surface-primary text-gray-400 gap-3">
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

  return (
    <WidgetSyncProvider defaultSymbol={symbol}>
      <div
        className="flex flex-col surface-primary text-themed-primary overflow-hidden"
        style={{ height: 'calc(100vh - 3.5rem)' }}
      >
        {/* ── Sub-header ─────────────────────────────────────────────── */}
        <div className="widget-surface border-b widget-border px-4 flex-shrink-0">
          <div className="flex items-center justify-between py-2 gap-2">
            <div className="flex items-center gap-2">
              <LayoutGrid size={13} className="text-gray-500" />
              <span className="text-sm font-semibold text-gray-200">
                {config.label}
              </span>
              {isDashboard && (
                <WorkspaceSelector
                  workspaces={workspaces}
                  activeId={activeWsId}
                  onSwitch={switchWorkspace}
                  onCreate={createWorkspace}
                  onDelete={deleteWorkspace}
                  onRename={renameWorkspace}
                />
              )}
            </div>

            <div className="flex items-center gap-2">
              {isDashboard && wsLoading && (
                <span className="text-[10px] text-gray-600 animate-pulse">동기화 중...</span>
              )}
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
                      {portfolio.lastRefreshed.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
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
                  {portfolio.displayCurrency === 'KRW' &&
                    portfolio.exchangeRate && (
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
                    <RefreshCw
                      size={12}
                      className={
                        portfolio.isRefreshingPrices ? 'animate-spin' : ''
                      }
                    />
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
                onClick={() => openWidgetMenu(firstPaneId)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded border border-gray-700 transition-colors"
              >
                <Plus size={12} />
                Widget
              </button>
            </div>
          </div>
        </div>

        {/* ── Split pane content ──────────────────────────────────────── */}
        <div className="flex-1 min-h-0">
          {!config.needsPortfolio ||
          portfolio.portfolios.length > 0 ||
          portfolio.selectedPortfolio ? (
            <SplitPaneLayout
              tree={splitTree}
              onTreeChange={updateTree}
              renderPane={(pane) => (
                <DashboardPane
                  paneId={pane.id}
                  sectionId={pane.sectionId}
                  isEmpty={!!pane.empty}
                  workspaceId={wsId}
                  categories={categories}
                  config={config}
                  pathname={pathname}
                  symbol={symbol}
                  portfolioData={config.needsPortfolio ? portfolio : undefined}
                  onSectionChange={handleSectionChange}
                  onSplit={handleSplit}
                  onClosePane={handleClosePane}
                  canClose={totalPanes > 1}
                  onOpenWidgetMenu={openWidgetMenu}
                  registerAddWidget={registerAddWidget}
                />
              )}
            />
          ) : (
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
        </div>

        {/* ── Widget picker modal ─────────────────────────────────────── */}
        <WidgetMenu
          open={menuState.open}
          onClose={() => setMenuState({ open: false, paneId: null })}
          categories={menuCategories}
          activeWidgetIds={[]}
          onAdd={handleAddWidget}
        />

        {/* ── Create-portfolio modal ──────────────────────────────────── */}
        {config.needsPortfolio && (
          <CreatePortfolioModal
            open={portfolio.showCreateModal}
            onClose={() => portfolio.setShowCreateModal(false)}
            onCreate={portfolio.handleCreatePortfolio}
          />
        )}

        {/* ── Add / edit transaction modal ────────────────────────────── */}
        {config.needsPortfolio &&
          (portfolio.showAddTransaction || portfolio.editingTransaction) && (
            <AddTransactionModal
              open
              isEditing={!!portfolio.editingTransaction}
              initialValues={portfolio.editingTransaction || undefined}
              isSubmitting={portfolio.isSubmittingTransaction}
              onClose={() => {
                portfolio.setShowAddTransaction(false);
                portfolio.setEditingTransaction(null);
              }}
              onAdd={portfolio.handleAddTransaction}
              onEdit={portfolio.handleEditTransaction}
            />
          )}
      </div>
    </WidgetSyncProvider>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// 위젯 제거 후 잔존하는 copilot 데이터셋 localStorage 정리 (30일 경과분)
function gcCopilotDatasets() {
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i);
    if (!key?.startsWith('copilot-ds:')) continue;
    try {
      const { savedAt } = JSON.parse(localStorage.getItem(key)) || {};
      if (!savedAt || savedAt < cutoff) localStorage.removeItem(key);
    } catch {
      localStorage.removeItem(key);
    }
  }
}

function findFirstPaneId(tree) {
  if (tree.type === 'pane') return tree.id;
  return findFirstPaneId(tree.children[0]);
}

// ── WorkspaceSelector ────────────────────────────────────────────────────────

function WorkspaceSelector({
  workspaces,
  activeId,
  onSwitch,
  onCreate,
  onDelete,
  onRename,
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const inputRef = useRef(null);

  const active = workspaces.find((w) => w.id === activeId) || workspaces[0];

  useEffect(() => {
    if (editingId && inputRef.current) inputRef.current.focus();
  }, [editingId]);

  const startRename = (ws) => {
    setEditingId(ws.id);
    setEditName(ws.name);
  };

  const commitRename = async () => {
    if (editingId && editName.trim()) {
      await onRename(editingId, editName.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 bg-gray-800/50 hover:bg-gray-700 text-gray-300 text-xs rounded border border-gray-700 transition-colors"
      >
        <span className="truncate max-w-[120px]">{active?.name}</span>
        <ChevronDown size={10} className="flex-shrink-0 text-gray-500" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setEditingId(null); }} />
          <div className="absolute left-0 top-full mt-1 bg-[#1a1a2e] border border-gray-700 rounded-lg shadow-xl z-50 py-1 min-w-[200px]">
            {/* Workspace list */}
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                className={`flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-800/60 transition-colors group ${
                  ws.id === activeId ? 'text-cyan-400' : 'text-gray-300'
                }`}
              >
                {editingId === ws.id ? (
                  <input
                    ref={inputRef}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="flex-1 bg-gray-800 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-white outline-none focus:border-cyan-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <button
                    className="flex-1 text-left truncate"
                    onClick={() => {
                      onSwitch(ws.id);
                      setOpen(false);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startRename(ws);
                    }}
                  >
                    {ws.name}
                  </button>
                )}
                {ws.id === activeId && !editingId && (
                  <span className="text-cyan-500 text-[10px]">●</span>
                )}
                {workspaces.length > 1 && !editingId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(ws.id);
                      if (workspaces.length <= 2) setOpen(false);
                    }}
                    className="p-0.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    title={`Delete "${ws.name}"`}
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}

            {/* Actions */}
            <div className="border-t border-gray-800 mt-1 pt-1">
              <button
                onClick={async () => {
                  await onCreate();
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-cyan-400 hover:bg-gray-800/60 transition-colors"
              >
                <Plus size={12} />
                New Dashboard
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Portfolio dropdown ───────────────────────────────────────────────────────

function PortfolioDropdown({ portfolio }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded transition-colors max-w-[160px]"
      >
        <span className="truncate">
          {portfolio.selectedPortfolio?.name || 'Select Portfolio'}
        </span>
        <ChevronDown size={10} className="flex-shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-[#1a1a2e] border border-gray-700 rounded shadow-xl z-50 py-1 min-w-[180px]">
            {portfolio.portfolios.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-500">
                No portfolios
              </div>
            ) : (
              portfolio.portfolios.map((p) => (
                <button
                  key={p.portfolio_id}
                  onClick={() => {
                    portfolio.setSelectedPortfolio(p);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-800 transition-colors ${
                    portfolio.selectedPortfolio?.portfolio_id === p.portfolio_id
                      ? 'text-cyan-400'
                      : 'text-gray-300'
                  }`}
                >
                  {p.name}
                  {p.description && (
                    <span className="text-gray-600 ml-1">
                      · {p.description.slice(0, 20)}
                    </span>
                  )}
                </button>
              ))
            )}
            <div className="border-t border-gray-800 mt-1 pt-1">
              <button
                onClick={() => {
                  setOpen(false);
                  portfolio.setShowCreateModal(true);
                }}
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