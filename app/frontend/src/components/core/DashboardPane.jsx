import { useState, useCallback, useEffect } from 'react';
import { Plus, X, Columns2, Rows2 } from 'lucide-react';
import DashboardGrid from './DashboardGrid';
import WidgetRenderer from './WidgetRenderer';

export default function DashboardPane({
  paneId,
  sectionId,
  isEmpty,
  workspaceId,
  categories,
  config,
  pathname,
  symbol,
  portfolioData,
  onSectionChange,
  onSplit,
  onClosePane,
  canClose,
  onOpenWidgetMenu,
  registerAddWidget,
}) {
  const activeCategory =
    categories.find((c) => c.id === sectionId) || categories[0];

  // Workspace-aware storage key (backward compat for default/root)
  const screenKey = workspaceId
    ? workspaceId === 'default' && paneId === 'root'
      ? `${pathname}-${sectionId}`
      : `${pathname}-${workspaceId}-${paneId}-${sectionId}`
    : paneId === 'root'
      ? `${pathname}-${sectionId}`
      : `${pathname}-${paneId}-${sectionId}`;

  const [tabMenu, setTabMenu] = useState(null);
  const [bgMenu, setBgMenu] = useState(null);

  // Close menus on outside click / escape
  useEffect(() => {
    const active = tabMenu || bgMenu;
    if (!active) return;
    const close = () => {
      setTabMenu(null);
      setBgMenu(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    const timer = setTimeout(() => document.addEventListener('click', close), 0);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [tabMenu, bgMenu]);

  const handleTabContext = useCallback((e, catId) => {
    e.preventDefault();
    e.stopPropagation();
    setTabMenu({ x: e.clientX, y: e.clientY, sectionId: catId });
  }, []);

  const handleBgContext = useCallback((e) => {
    if (
      e.target.closest(
        'button, a, input, select, textarea, [role="button"], .react-grid-item, .no-context-menu',
      )
    )
      return;
    e.preventDefault();
    setBgMenu({ x: e.clientX, y: e.clientY });
  }, []);

  return (
    <div
      className="flex flex-col h-full w-full bg-[#0a0a0f]"
      onContextMenu={handleBgContext}
    >
      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      {categories.length > 1 && (
        <div className="flex items-center gap-0.5 px-2 pt-1 pb-0 border-b border-gray-800 bg-[#0d0d12] flex-shrink-0">
          <div className="flex gap-0.5 overflow-x-auto flex-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => onSectionChange(paneId, cat.id)}
                onContextMenu={(e) => handleTabContext(e, cat.id)}
                className={`relative px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  sectionId === cat.id
                    ? 'text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {cat.label}
                {sectionId === cat.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500 rounded-t" />
                )}
              </button>
            ))}
          </div>
          {canClose && (
            <button
              onClick={() => onClosePane(paneId)}
              className="p-1 text-gray-600 hover:text-gray-300 hover:bg-gray-800 rounded transition-colors flex-shrink-0"
              title="Close pane"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* ── Grid ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto min-h-0">
        <DashboardGrid
          key={screenKey}
          screen={screenKey}
          defaultWidgets={isEmpty ? [] : activeCategory?.defaultWidgets || []}
          onAddWidgetReady={(fn) => registerAddWidget?.(paneId, fn)}
          renderWidget={(widgetCfg, onRemoveWidget) => (
            <WidgetRenderer
              widget={widgetCfg}
              symbol={symbol}
              portfolioData={config.needsPortfolio ? portfolioData : undefined}
              onRemove={onRemoveWidget}
            />
          )}
        />
      </div>

      {/* ── Tab context menu (right-click on tab) ───────────────────── */}
      {tabMenu && (
        <ContextMenuPortal>
          <div
            className="fixed z-[100] bg-[#0d0d12] border border-gray-700 rounded-lg shadow-2xl py-1 min-w-[180px]"
            style={{
              left: Math.min(tabMenu.x, window.innerWidth - 200),
              top: Math.min(tabMenu.y, window.innerHeight - 120),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setTabMenu(null);
                onSplit(paneId, 'horizontal', tabMenu.sectionId);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <Columns2 size={14} className="text-cyan-400" />
              Open in Split Right
            </button>
            <button
              onClick={() => {
                setTabMenu(null);
                onSplit(paneId, 'vertical', tabMenu.sectionId);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <Rows2 size={14} className="text-cyan-400" />
              Open in Split Down
            </button>
            {canClose && (
              <>
                <div className="border-t border-gray-800 my-1" />
                <button
                  onClick={() => {
                    setTabMenu(null);
                    onClosePane(paneId);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors"
                >
                  <X size={14} />
                  Close Pane
                </button>
              </>
            )}
          </div>
        </ContextMenuPortal>
      )}

      {/* ── Background context menu (right-click on empty space) ─────── */}
      {bgMenu && (
        <ContextMenuPortal>
          <div
            className="fixed z-[100] bg-[#0d0d12] border border-gray-700 rounded-lg shadow-2xl py-1 min-w-[180px]"
            style={{
              left: Math.min(bgMenu.x, window.innerWidth - 200),
              top: Math.min(bgMenu.y, window.innerHeight - 200),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setBgMenu(null);
                onOpenWidgetMenu?.(paneId);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <Plus size={14} className="text-cyan-400" />
              Add Widget
            </button>
            <div className="border-t border-gray-800 my-1" />
            <button
              onClick={() => {
                setBgMenu(null);
                onSplit(paneId, 'horizontal', sectionId);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <Columns2 size={14} className="text-cyan-400" />
              Split Right
            </button>
            <button
              onClick={() => {
                setBgMenu(null);
                onSplit(paneId, 'vertical', sectionId);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <Rows2 size={14} className="text-cyan-400" />
              Split Down
            </button>
            {canClose && (
              <>
                <div className="border-t border-gray-800 my-1" />
                <button
                  onClick={() => {
                    setBgMenu(null);
                    onClosePane(paneId);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors"
                >
                  <X size={14} />
                  Close Pane
                </button>
              </>
            )}
          </div>
        </ContextMenuPortal>
      )}
    </div>
  );
}

function ContextMenuPortal({ children }) {
  return children;
}