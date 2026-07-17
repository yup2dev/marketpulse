/**
 * SeriesPicker — sidebar to add time-series to the backtest chart.
 *
 * Shows: shared symbol/date-range inputs, grouped catalog dropdown, "Add" button,
 * and a list of currently loaded series with pane toggle + remove.
 */
import { useState, useMemo } from 'react';
import { Plus, X, Eye, EyeOff, Loader2 } from 'lucide-react';
import { SERIES_CATALOG, GROUP_LABELS } from './seriesCatalog';

const RANGE_PRESETS = [
  { label: '1M', months: 1 },
  { label: '6M', months: 6 },
  { label: '1Y', months: 12 },
  { label: '5Y', months: 60 },
];

function presetRange(months) {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  const fmt = d => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

export default function SeriesPicker({
  symbol,
  onSymbolChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  loadedSeries,
  onAddSeries,
  onRemoveSeries,
  onToggleVisible,
  isAdding = false,
}) {
  const [selectedId, setSelectedId] = useState(SERIES_CATALOG[0].id);

  const grouped = useMemo(() => {
    const m = new Map();
    for (const e of SERIES_CATALOG) {
      if (!m.has(e.group)) m.set(e.group, []);
      m.get(e.group).push(e);
    }
    return m;
  }, []);

  const selectedEntry = SERIES_CATALOG.find(e => e.id === selectedId);
  const symbolNeeded  = !!selectedEntry?.needsSymbol;
  const canAdd        = !isAdding && (!symbolNeeded || (symbol && symbol.trim().length > 0));

  return (
    <div className="w-72 bg-[#0d0d12] border border-gray-800 rounded-lg flex flex-col text-xs">
      {/* Shared inputs */}
      <div className="p-3 border-b border-gray-800 space-y-2">
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Symbol</label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => onSymbolChange(e.target.value.toUpperCase())}
            placeholder="AAPL"
            className="w-full bg-[#0a0a0f] border border-gray-800 rounded px-2 py-1.5 text-gray-200 outline-none focus:border-cyan-700 tabular-nums"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Date Range</label>
          <div className="flex items-center gap-1.5 mb-1.5">
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="flex-1 min-w-0 bg-[#0a0a0f] border border-gray-800 rounded px-2 py-1.5 text-gray-200 outline-none focus:border-cyan-700 tabular-nums [color-scheme:dark]"
            />
            <span className="text-gray-600">~</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="flex-1 min-w-0 bg-[#0a0a0f] border border-gray-800 rounded px-2 py-1.5 text-gray-200 outline-none focus:border-cyan-700 tabular-nums [color-scheme:dark]"
            />
          </div>
          <div className="flex items-center gap-1">
            {RANGE_PRESETS.map(opt => {
              const r = presetRange(opt.months);
              const active = startDate === r.start && endDate === r.end;
              return (
                <button
                  key={opt.label}
                  onClick={() => { onStartDateChange(r.start); onEndDateChange(r.end); }}
                  className={`flex-1 px-2 py-1 rounded transition-colors ${
                    active
                      ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-800/50'
                      : 'bg-gray-800/50 text-gray-400 hover:text-gray-200 border border-transparent'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Catalog selector + Add */}
      <div className="p-3 border-b border-gray-800 space-y-2">
        <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Series</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full bg-[#0a0a0f] border border-gray-800 rounded px-2 py-1.5 text-gray-200 outline-none focus:border-cyan-700"
        >
          {[...grouped.entries()].map(([group, entries]) => (
            <optgroup key={group} label={GROUP_LABELS[group] || group}>
              {entries.map(e => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          onClick={() => selectedEntry && onAddSeries(selectedEntry)}
          disabled={!canAdd}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded transition-colors"
        >
          {isAdding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          <span>{isAdding ? 'Adding…' : 'Add to chart'}</span>
        </button>
        {symbolNeeded && !symbol?.trim() && (
          <p className="text-[10px] text-amber-500/80">Symbol required for this series.</p>
        )}
      </div>

      {/* Loaded series list */}
      <div className="flex-1 overflow-auto p-3 space-y-1.5">
        <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">
          Loaded ({loadedSeries.length})
        </div>
        {loadedSeries.length === 0 ? (
          <p className="text-[11px] text-gray-600">Nothing loaded yet.</p>
        ) : (
          loadedSeries.map(s => (
            <div
              key={s.id}
              className="flex items-center gap-1.5 px-2 py-1.5 bg-[#0a0a0f] border border-gray-800 rounded"
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="flex-1 text-gray-300 truncate" title={s.name}>{s.name}</span>
              <button
                onClick={() => onToggleVisible(s.id)}
                className="p-1 text-gray-500 hover:text-cyan-400 transition-colors"
                title={s.visible === false ? 'Show' : 'Hide'}
              >
                {s.visible === false ? <EyeOff size={11} /> : <Eye size={11} />}
              </button>
              <button
                onClick={() => onRemoveSeries(s.id)}
                className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                title="Remove"
              >
                <X size={11} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
