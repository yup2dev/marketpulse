/**
 * WidgetMenu — modal popup for adding widgets (widgetMenu.png style).
 *
 * Props:
 *   open            boolean
 *   onClose         () => void
 *   categories      [{ id, label, widgets: [{ id, name, description, defaultSize }] }]
 *   activeWidgetIds string[]   — widget types already on the grid
 *   onAdd           (widgetDef[]) => void  — called with array of selected widgets
 */
import { useState, useMemo } from 'react';
import { X, Search, ChevronRight, ChevronDown, Plus } from 'lucide-react';

export default function WidgetMenu({ open, onClose, categories = [], activeWidgetIds = [], onAdd }) {
  const [activeCat, setActiveCat]     = useState('all');
  const [search, setSearch]           = useState('');
  const [collapsed, setCollapsed]     = useState({});
  const [selected, setSelected]       = useState({});   // { widgetId: widgetDef }

  // Flat list of all widgets
  const allWidgets = categories.flatMap(c => c.widgets);

  // Widgets shown in main panel based on active category + search
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

  const totalCount = allWidgets.length;
  const selectedCount = Object.keys(selected).length;

  if (!open) return null;

  const toggleCollapse = (catId) =>
    setCollapsed(p => ({ ...p, [catId]: !p[catId] }));

  const toggleWidget = (widget) => {
    setSelected(p => {
      const next = { ...p };
      if (next[widget.id]) delete next[widget.id];
      else next[widget.id] = widget;
      return next;
    });
  };

  const handleAdd = () => {
    const widgets = Object.values(selected);
    if (widgets.length) onAdd(widgets);
    setSelected({});
    onClose();
  };

  const handleClose = () => {
    setSelected({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-[860px] max-w-[95vw] h-[600px] max-h-[90vh] bg-[#1a1a1f] border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <span className="text-sm font-semibold text-white">Widget Menu</span>
          <button onClick={handleClose} className="p-1 text-gray-500 hover:text-white transition-colors rounded">
            <X size={14} />
          </button>
        </div>

        {/* ── Search ────────────────────────────────────────────────────── */}
        <div className="px-5 py-2 border-b border-gray-800">
          <div className="flex items-center gap-2 bg-[#0d0d12] border border-gray-700 rounded-lg px-3 py-1.5">
            <Search size={13} className="text-gray-500 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search for widgets"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
            />
          </div>
        </div>

        {/* ── Tab bar ───────────────────────────────────────────────────── */}
        <div className="flex border-b border-gray-800">
          <button className="flex-1 py-2 text-xs font-medium text-white bg-cyan-600/20 border-b-2 border-cyan-500">
            Widgets Library
            <span className="ml-1.5 px-1.5 py-0.5 bg-cyan-600 text-white text-[10px] rounded-full">{totalCount}</span>
          </button>
          <button className="flex-1 py-2 text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors">
            Data
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left sidebar — categories */}
          <div className="w-44 flex-shrink-0 border-r border-gray-800 flex flex-col overflow-y-auto">
            <div className="px-3 pt-3 pb-1">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Category</span>
            </div>
            <nav className="flex-1 py-1">
              {/* All */}
              <button
                onClick={() => setActiveCat('all')}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                  activeCat === 'all'
                    ? 'text-white bg-gray-800'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCat(cat.id)}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    activeCat === cat.id
                      ? 'text-white bg-gray-800'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Main content — widget list */}
          <div className="flex-1 overflow-y-auto">
            {visibleCategories.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                No widgets found
              </div>
            ) : (
              visibleCategories.map(cat => (
                <div key={cat.id}>
                  {/* Category header */}
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

                  {/* Widget rows */}
                  {!collapsed[cat.id] && cat.widgets.map(widget => {
                    const isAdded   = activeWidgetIds.includes(widget.id);
                    const isChecked = !!selected[widget.id];

                    return (
                      <label
                        key={widget.id}
                        className={`flex items-center gap-3 px-6 py-2.5 cursor-pointer transition-colors ${
                          isAdded
                            ? 'opacity-40 cursor-default'
                            : 'hover:bg-gray-800/40'
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
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
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
