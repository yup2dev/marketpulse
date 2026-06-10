/**
 * WidgetMenu — modal popup for adding widgets.
 *
 * Props:
 *   open            boolean
 *   onClose         () => void
 *   categories      [{ id, label, widgets: [{ id, name, description, defaultSize }] }]
 *   activeWidgetIds string[]   — widget types already on the grid
 *   onAdd           (widgetDef[]) => void  — called with array of selected widgets
 *
 * Tabs:
 *   Widgets Library — static catalog from urlWidgetMap
 *   Data            — dynamic list from /api/data/ (all registered fetchers)
 *                     Widget type: "data/{provider}/{model}" → auto-routed by WidgetRenderer
 */
import { useState, useMemo, useEffect } from 'react';
import { X, Search, ChevronRight, ChevronDown, Plus } from 'lucide-react';
import { apiClient, API_BASE } from '../../config/api';

const _titleCase = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export default function WidgetMenu({ open, onClose, categories = [], activeWidgetIds = [], onAdd }) {
  // ── Library tab state ───────────────────────────────────────────────────────
  const [activeCat, setActiveCat]   = useState('all');
  const [collapsed, setCollapsed]   = useState({});

  // ── Data tab state ──────────────────────────────────────────────────────────
  const [activeTab,     setActiveTab]     = useState('library');
  const [providers,     setProviders]     = useState([]);
  const [provLoading,   setProvLoading]   = useState(false);
  const [activeProvider, setActiveProvider] = useState('all');

  // ── Shared state ────────────────────────────────────────────────────────────
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState({});  // { widgetId: widgetDef }

  // Fetch provider list when "Data" tab first activates
  useEffect(() => {
    if (activeTab !== 'data' || providers.length > 0) return;
    setProvLoading(true);
    apiClient.get(`${API_BASE}/data/`)
      .then(r => setProviders(r.results || []))
      .catch(() => {})
      .finally(() => setProvLoading(false));
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Library tab: filtered categories ────────────────────────────────────────
  const allWidgets = categories.flatMap(c => c.widgets);
  const visibleCategories = useMemo(() => {
    const q = search.toLowerCase();
    return categories
      .filter(c => activeCat === 'all' || c.id === activeCat)
      .map(c => ({
        ...c,
        widgets: c.widgets.filter(w =>
          !q || w.name.toLowerCase().includes(q) || w.description?.toLowerCase().includes(q)
        ),
      }))
      .filter(c => c.widgets.length > 0);
  }, [categories, activeCat, search]);

  // ── Data tab: flat list of {provider}/{model} pairs ─────────────────────────
  // providers[].models は [{ model, required_params }] の配列
  const dataWidgets = useMemo(() => {
    const q = search.toLowerCase();
    return providers.flatMap(p =>
      (activeProvider === 'all' || p.provider === activeProvider)
        ? (p.models || [])
            .filter(m => {
              const key = m.model ?? m;
              return !q || key.includes(q) || p.provider.includes(q);
            })
            .map(m => {
              const modelKey      = m.model ?? m;
              const requiredParams = m.required_params ?? [];
              return {
                id:             `data/${p.provider}/${modelKey}`,
                name:           _titleCase(modelKey),
                description:    p.provider.toUpperCase(),
                provider:       p.provider,
                model:          modelKey,
                requiredParams,
                defaultSize:    { w: 6, h: 6 },
              };
            })
        : []
    );
  }, [providers, activeProvider, search]);

  const totalCount    = allWidgets.length;
  const selectedCount = Object.keys(selected).length;

  if (!open) return null;

  // ── Handlers ────────────────────────────────────────────────────────────────
  const toggleCollapse  = (catId) => setCollapsed(p => ({ ...p, [catId]: !p[catId] }));
  const toggleWidget    = (widget) => setSelected(p => {
    const next = { ...p };
    if (next[widget.id]) delete next[widget.id];
    else next[widget.id] = widget;
    return next;
  });
  const handleAdd = () => {
    const widgets = Object.values(selected);
    if (widgets.length) onAdd(widgets);
    setSelected({});
    onClose();
  };
  const handleClose = () => { setSelected({}); onClose(); };

  // ── Widget row ──────────────────────────────────────────────────────────────
  const WidgetRow = ({ widget, disableIfAdded = true }) => {
    const isAdded   = disableIfAdded && activeWidgetIds.includes(widget.id);
    const isChecked = !!selected[widget.id];
    return (
      <label
        className={`flex items-center gap-3 px-6 py-2.5 cursor-pointer transition-colors ${
          isAdded ? 'opacity-40 cursor-default' : 'hover:bg-gray-800/40'
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-200 truncate">{widget.name}</div>
          {widget.description && (
            <div className="text-[11px] text-gray-500 truncate mt-0.5">{widget.description}</div>
          )}
        </div>
        <input
          type="checkbox"
          disabled={isAdded}
          checked={isChecked}
          onChange={() => !isAdded && toggleWidget(widget)}
          className="w-3.5 h-3.5 rounded border-gray-600 accent-cyan-500 cursor-pointer flex-shrink-0"
          onClick={e => e.stopPropagation()}
        />
      </label>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-[860px] max-w-[95vw] h-[600px] max-h-[90vh] bg-[#1a1a1f] border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <span className="text-sm font-semibold text-white">Widget Menu</span>
          <button onClick={handleClose} className="p-1 text-gray-500 hover:text-white transition-colors rounded">
            <X size={14} />
          </button>
        </div>

        {/* ── Search ──────────────────────────────────────────────────────── */}
        <div className="px-5 py-2 border-b border-gray-800">
          <div className="flex items-center gap-2 bg-[#0d0d12] border border-gray-700 rounded-lg px-3 py-1.5">
            <Search size={13} className="text-gray-500 flex-shrink-0" />
            <input
              type="text"
              placeholder={activeTab === 'data' ? 'Search providers or models…' : 'Search for widgets'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
            />
          </div>
        </div>

        {/* ── Tab bar ─────────────────────────────────────────────────────── */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setActiveTab('library')}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === 'library'
                ? 'text-white bg-cyan-600/20 border-b-2 border-cyan-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Widgets Library
            <span className="ml-1.5 px-1.5 py-0.5 bg-cyan-600 text-white text-[10px] rounded-full">{totalCount}</span>
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === 'data'
                ? 'text-white bg-cyan-600/20 border-b-2 border-cyan-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Data
            {providers.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-gray-700 text-gray-300 text-[10px] rounded-full">
                {providers.reduce((s, p) => s + p.models.length, 0)}
              </span>
            )}
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left sidebar */}
          <div className="w-44 flex-shrink-0 border-r border-gray-800 flex flex-col overflow-y-auto">
            <div className="px-3 pt-3 pb-1">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {activeTab === 'data' ? 'Provider' : 'Category'}
              </span>
            </div>

            {activeTab === 'library' ? (
              <nav className="flex-1 py-1">
                <button
                  onClick={() => setActiveCat('all')}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    activeCat === 'all' ? 'text-white bg-gray-800' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  All
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCat(cat.id)}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                      activeCat === cat.id ? 'text-white bg-gray-800' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </nav>
            ) : (
              <nav className="flex-1 py-1">
                <button
                  onClick={() => setActiveProvider('all')}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    activeProvider === 'all' ? 'text-white bg-gray-800' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  All
                </button>
                {providers.map(p => (
                  <button
                    key={p.provider}
                    onClick={() => setActiveProvider(p.provider)}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between ${
                      activeProvider === p.provider ? 'text-white bg-gray-800' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    }`}
                  >
                    <span className="uppercase">{p.provider}</span>
                    <span className="text-gray-600 text-[10px]">{p.models.length}</span>
                  </button>
                ))}
              </nav>
            )}
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'library' ? (
              /* Library tab content */
              visibleCategories.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  No widgets found
                </div>
              ) : (
                visibleCategories.map(cat => (
                  <div key={cat.id}>
                    <button
                      onClick={() => toggleCollapse(cat.id)}
                      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-800/30 transition-colors"
                    >
                      {collapsed[cat.id]
                        ? <ChevronRight size={13} className="text-gray-500" />
                        : <ChevronDown  size={13} className="text-gray-500" />
                      }
                      <span className="text-xs font-semibold text-gray-300">{cat.label}</span>
                      <span className="text-[11px] text-gray-600">({cat.widgets.length})</span>
                    </button>
                    {!collapsed[cat.id] && cat.widgets.map(widget => (
                      <WidgetRow key={widget.id} widget={widget} disableIfAdded />
                    ))}
                  </div>
                ))
              )
            ) : (
              /* Data tab content */
              provLoading ? (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  Loading providers…
                </div>
              ) : dataWidgets.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  No data sources found
                </div>
              ) : (
                <div>
                  <div className="px-4 py-2 text-[10px] text-gray-600 border-b border-gray-800/50">
                    {dataWidgets.length} model{dataWidgets.length !== 1 ? 's' : ''} available via Universal Data Gateway
                  </div>
                  {dataWidgets.map(widget => (
                    <label
                      key={widget.id}
                      className="flex items-center gap-3 px-6 py-2.5 cursor-pointer hover:bg-gray-800/40 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-200 truncate">{widget.name}</span>
                          {widget.requiredParams?.length > 0 && (
                            <span
                              className="text-[9px] px-1 py-0.5 bg-gray-700 text-gray-400 rounded flex-shrink-0"
                              title={`Required: ${widget.requiredParams.join(', ')}`}
                            >
                              {widget.requiredParams.join(', ')}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate mt-0.5">{widget.description}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={!!selected[widget.id]}
                        onChange={() => toggleWidget(widget)}
                        className="w-3.5 h-3.5 rounded border-gray-600 accent-cyan-500 cursor-pointer flex-shrink-0"
                        onClick={e => e.stopPropagation()}
                      />
                    </label>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-800 bg-[#0d0d12]">
          <button
            onClick={handleClose}
            className="px-4 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={selectedCount === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-default text-white rounded transition-colors"
          >
            <Plus size={12} />
            Add widget{selectedCount > 1 ? `s (${selectedCount})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}