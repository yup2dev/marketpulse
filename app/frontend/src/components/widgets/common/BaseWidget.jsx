/**
 * BaseWidget - Common widget wrapper with shared functionality
 * Features:
 * - Drag handle for GridLayout
 * - Symbol selector with search
 * - View mode toggle (chart/table)
 * - Period selector
 * - Refresh button
 * - Remove button
 * - Loading state
 * - Source footer
 */
import { useState, useRef, useEffect } from 'react';
import { GripVertical, X, RefreshCw, BarChart2, Table, Calendar, ChevronDown, Search, Download, FileDown, FileSpreadsheet, Image, Link2, Link2Off } from 'lucide-react';
import { API_BASE } from '../../../config/api';
import { downloadCSV, downloadExcel, downloadChartPNG, makeFilename } from '../../../utils/exportUtils';
import { useWidgetSync } from '../../../contexts/WidgetSyncContext';

// Symbol Selector Component
function SymbolSelector({ symbol, onSymbolChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setSearch('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (query) => {
    setSearch(query);
    if (query.length < 1) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/search?query=${encodeURIComponent(query)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || data || []);
      }
    } catch (e) {
      const common = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'TSLA', 'AMZN', 'AMD'];
      setResults(common.filter(s => s.toLowerCase().includes(query.toLowerCase())).map(s => ({ symbol: s })));
    } finally {
      setLoading(false);
    }
  };

  const selectSymbol = (sym) => {
    onSymbolChange?.(sym);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative" onMouseDown={(e) => e.stopPropagation()}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 bg-cyan-900/30 text-[11px] text-cyan-400 border border-cyan-800/50 rounded px-2 py-0.5 hover:bg-cyan-900/50 transition-colors font-medium"
      >
        {symbol}
        <ChevronDown size={10} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-52 bg-[#1a1a1f] border border-gray-700 rounded shadow-xl z-50">
          <div className="p-2 border-b border-gray-700">
            <div className="flex items-center gap-2 bg-gray-800 rounded px-2 py-1.5">
              <Search size={12} className="text-gray-500" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search symbol..."
                className="flex-1 bg-transparent text-xs text-white outline-none placeholder-gray-500"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="p-3 text-center text-xs text-gray-500">Searching...</div>
            ) : results.length > 0 ? (
              results.map((item, i) => (
                <button
                  key={i}
                  onClick={() => selectSymbol(item.symbol || item)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-800 transition-colors flex items-center justify-between"
                >
                  <span className="text-xs text-white font-medium">{item.symbol || item}</span>
                  <span className="text-[10px] text-gray-500 truncate ml-2 max-w-[100px]">{item.name || ''}</span>
                </button>
              ))
            ) : search ? (
              <div className="p-3 text-center text-xs text-gray-500">No results</div>
            ) : (
              <div className="p-3 text-center text-xs text-gray-500">Type to search</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Period options for different data types
export const PERIOD_OPTIONS = {
  short: [
    { id: '1mo', label: '1M' },
    { id: '3mo', label: '3M' },
    { id: '6mo', label: '6M' },
    { id: '1y', label: '1Y' },
  ],
  medium: [
    { id: '6mo', label: '6M' },
    { id: '1y', label: '1Y' },
    { id: '2y', label: '2Y' },
    { id: '3y', label: '3Y' },
  ],
  long: [
    { id: '1y', label: '1Y' },
    { id: '3y', label: '3Y' },
    { id: '5y', label: '5Y' },
    { id: '10y', label: '10Y' },
  ],
  macro: [
    { id: '1y', label: '1Y' },
    { id: '2y', label: '2Y' },
    { id: '3y', label: '3Y' },
    { id: '5y', label: '5Y' },
  ],
};

export default function BaseWidget({
  title,
  subtitle,
  icon: Icon,
  iconColor = 'text-cyan-400',
  children,
  loading = false,
  onRefresh,
  onRemove,
  // Symbol selector
  symbol,
  onSymbolChange,
  // View mode
  viewMode = 'chart',
  onViewModeChange,
  showViewToggle = true,
  // Period selector
  period,
  onPeriodChange,
  periodType = 'macro',
  showPeriodSelector = true,
  // Source
  source,
  // Custom header content
  headerExtra,
  // Export
  exportData,    // () => { columns: [{key,header,exportValue?}], rows: [] }
  chartRef,      // ref to chart container element for PNG export
  // Sync (Phase 3)
  syncable = false,  // opt-in: show sync chain icon
}) {
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [showExportMenu,     setShowExportMenu]     = useState(false);
  const exportMenuRef = useRef(null);
  const periodOptions = PERIOD_OPTIONS[periodType] || PERIOD_OPTIONS.macro;

  // ── Widget Sync (Phase 3) ────────────────────────────────────────────────
  const syncCtx = useWidgetSync();
  const [isSynced, setIsSynced] = useState(false);
  const canSync = syncable && syncCtx && (symbol ? !!onSymbolChange : false || (period ? !!onPeriodChange : false));

  // When global symbol changes and this widget is synced → push to widget
  useEffect(() => {
    if (!isSynced || !syncCtx) return;
    if (syncCtx.globalSymbol && symbol && syncCtx.globalSymbol !== symbol) {
      onSymbolChange?.(syncCtx.globalSymbol);
    }
  }, [syncCtx?.globalSymbol, isSynced]); // eslint-disable-line react-hooks/exhaustive-deps

  // When global period changes and this widget is synced → push to widget
  useEffect(() => {
    if (!isSynced || !syncCtx) return;
    if (syncCtx.globalPeriod && period && syncCtx.globalPeriod !== period) {
      onPeriodChange?.(syncCtx.globalPeriod);
    }
  }, [syncCtx?.globalPeriod, isSynced]); // eslint-disable-line react-hooks/exhaustive-deps

  // Register / unregister with context when sync is toggled
  useEffect(() => {
    if (!syncCtx) return;
    if (isSynced) syncCtx.registerSync?.();
    return () => { if (isSynced) syncCtx.unregisterSync?.(); };
  }, [isSynced]); // eslint-disable-line react-hooks/exhaustive-deps

  // Intercept symbol changes: if synced, also broadcast to context
  const handleSymbolChange = (sym) => {
    onSymbolChange?.(sym);
    if (isSynced && syncCtx) syncCtx.setGlobalSymbol(sym);
  };

  // Intercept period changes: if synced, also broadcast to context
  const handlePeriodChange = (p) => {
    onPeriodChange?.(p);
    if (isSynced && syncCtx) syncCtx.setGlobalPeriod(p);
  };

  const toggleSync = () => {
    const willSync = !isSynced;
    setIsSynced(willSync);
    if (willSync && syncCtx) {
      // When linking, immediately adopt global values
      if (symbol && syncCtx.globalSymbol && syncCtx.globalSymbol !== symbol) {
        onSymbolChange?.(syncCtx.globalSymbol);
      }
      if (period && syncCtx.globalPeriod && syncCtx.globalPeriod !== period) {
        onPeriodChange?.(syncCtx.globalPeriod);
      }
    }
  };

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

  const handleExport = (format) => {
    setShowExportMenu(false);
    const fname = makeFilename(title || 'export', symbol);
    if (format === 'png') {
      const el = chartRef?.current;
      if (el) downloadChartPNG(el, fname);
      return;
    }
    if (!exportData) return;
    const { columns, rows } = exportData();
    if (!rows?.length) return;
    if (format === 'csv')   downloadCSV(rows,   columns, fname);
    if (format === 'excel') downloadExcel(rows, columns, fname);
  };

  return (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-[#0d0d12] gap-2">
        {/* Left: Drag handle + Title + Symbol */}
        <div className="flex items-center gap-2 cursor-move drag-handle-area flex-1 min-w-0">
          <GripVertical size={14} className="text-gray-600 flex-shrink-0" />
          {Icon && <Icon size={14} className={`${iconColor} flex-shrink-0`} />}
          <div className="min-w-0">
            <span className="text-sm font-medium text-white truncate block">{title}</span>
            {subtitle && <span className="text-xs text-gray-500 truncate block">{subtitle}</span>}
          </div>
          {/* Symbol Selector */}
          {symbol && onSymbolChange && (
            <SymbolSelector symbol={symbol} onSymbolChange={handleSymbolChange} />
          )}
        </div>

        {/* Center: Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* View Toggle */}
          {showViewToggle && onViewModeChange && (
            <div className="flex items-center bg-gray-800 rounded p-0.5">
              <button
                onClick={() => onViewModeChange('chart')}
                className={`p-1 rounded transition-colors ${
                  viewMode === 'chart' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
                title="Chart View"
              >
                <BarChart2 size={12} />
              </button>
              <button
                onClick={() => onViewModeChange('table')}
                className={`p-1 rounded transition-colors ${
                  viewMode === 'table' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
                title="Table View"
              >
                <Table size={12} />
              </button>
            </div>
          )}

          {/* Period Selector */}
          {showPeriodSelector && onPeriodChange && (
            <div className="relative">
              <button
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300 transition-colors"
              >
                <Calendar size={10} />
                <span>{periodOptions.find(p => p.id === period)?.label || period}</span>
                <ChevronDown size={10} />
              </button>
              {showPeriodDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowPeriodDropdown(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 bg-[#1a1a1f] border border-gray-700 rounded shadow-lg z-50 py-1 min-w-[60px]">
                    {periodOptions.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          handlePeriodChange(opt.id);
                          setShowPeriodDropdown(false);
                        }}
                        className={`w-full px-3 py-1.5 text-xs text-left hover:bg-gray-800 transition-colors ${
                          period === opt.id ? 'text-cyan-400' : 'text-gray-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Custom header content */}
          {headerExtra}

          {/* Sync toggle (Phase 3) */}
          {canSync && (
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={toggleSync}
              className={`p-1.5 rounded transition-colors ${
                isSynced
                  ? 'text-cyan-400 bg-cyan-500/15 hover:bg-cyan-500/25'
                  : 'text-gray-600 hover:text-gray-300 hover:bg-gray-800'
              }`}
              title={isSynced ? 'Unlink from global sync' : 'Link to global sync'}
            >
              {isSynced ? <Link2 size={12} /> : <Link2Off size={12} />}
            </button>
          )}

          {/* Export dropdown */}
          {(exportData || chartRef) && (
            <div ref={exportMenuRef} className="relative">
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={() => setShowExportMenu(v => !v)}
                className="p-1.5 text-gray-500 hover:text-cyan-400 hover:bg-gray-800 rounded transition-colors"
                title="Export data"
              >
                <Download size={12} />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 bg-[#0d0d12] border border-gray-700 rounded shadow-xl z-[60] py-1 min-w-[140px]">
                  {exportData && (
                    <>
                      <button
                        onClick={() => handleExport('csv')}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors"
                      >
                        <FileDown size={11} className="text-cyan-400" /> CSV
                      </button>
                      <button
                        onClick={() => handleExport('excel')}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors"
                      >
                        <FileSpreadsheet size={11} className="text-green-400" /> Excel (.xlsx)
                      </button>
                    </>
                  )}
                  {chartRef && (
                    <button
                      onClick={() => handleExport('png')}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors border-t border-gray-800 mt-0.5 pt-1.5"
                    >
                      <Image size={11} className="text-purple-400" /> PNG (Chart)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Refresh */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
          )}

          {/* Remove */}
          {onRemove && (
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
              title="Remove"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          children
        )}
      </div>

      {/* Footer with source */}
      {source && (
        <div className="px-3 py-1.5 border-t border-gray-800 flex-shrink-0">
          <p className="text-[10px] text-gray-600">Source: {source}</p>
        </div>
      )}
    </div>
  );
}

