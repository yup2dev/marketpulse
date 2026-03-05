/**
 * WidgetHeader — canonical widget header (single source of truth)
 *
 * Props:
 *   icon           Lucide icon component
 *   iconColor      Tailwind color class (default 'text-blue-400')
 *   title          string
 *   subtitle       string (optional)
 *   loading        boolean
 *   onRefresh      fn — shows refresh button
 *   onRemove       fn — shows close/remove button  (alias: onClose)
 *   onClose        fn — alias for onRemove
 *   symbol         string — shows symbol chip
 *   onSymbolChange fn(symbol) — makes symbol chip editable
 *   exportData     fn → { columns, rows } — shows export dropdown (CSV/Excel)
 *   chartRef       ref — enables PNG export in export dropdown
 *   children       ReactNode — extra controls (inserted before standard buttons)
 *   className      string
 */
import { useState, useRef, useEffect } from 'react';
import { RefreshCw, X, ChevronDown, Download, FileDown, FileSpreadsheet, Image } from 'lucide-react';
import { downloadCSV, downloadExcel, downloadChartPNG, makeFilename } from '../../../utils/exportUtils';

export const WidgetHeader = ({
  icon: Icon,
  iconColor = 'text-blue-400',
  title,
  subtitle,
  loading = false,
  onRefresh,
  onRemove,
  onClose,        // alias for onRemove
  symbol,
  onSymbolChange,
  exportData,
  chartRef,
  children,
  className = '',
}) => {
  const handleClose = onRemove || onClose;

  // ── Symbol inline editor ────────────────────────────────────────────────────
  const [showSymbolInput, setShowSymbolInput] = useState(false);
  const [symbolDraft,    setSymbolDraft]    = useState(symbol || '');
  useEffect(() => { setSymbolDraft(symbol || ''); }, [symbol]);

  const submitSymbol = (e) => {
    e.preventDefault();
    if (symbolDraft.trim() && onSymbolChange) onSymbolChange(symbolDraft.trim().toUpperCase());
    setShowSymbolInput(false);
  };

  // ── Export dropdown ─────────────────────────────────────────────────────────
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef(null);
  useEffect(() => {
    if (!showExport) return;
    const handler = (e) => { if (exportRef.current && !exportRef.current.contains(e.target)) setShowExport(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExport]);

  const handleExport = (fmt) => {
    setShowExport(false);
    const fname = makeFilename(title || 'export', symbol);
    if (fmt === 'png') { if (chartRef?.current) downloadChartPNG(chartRef.current, fname); return; }
    if (!exportData) return;
    const { columns, rows } = exportData();
    if (!rows?.length) return;
    if (fmt === 'csv')   downloadCSV(rows, columns, fname);
    if (fmt === 'excel') downloadExcel(rows, columns, fname);
  };

  return (
    <div className={`flex items-center justify-between p-3 border-b border-gray-800 shrink-0 ${className}`}>
      {/* Left — drag handle + icon + title */}
      <div className="flex items-center gap-2 cursor-move drag-handle-area flex-1 min-w-0">
        {Icon && <Icon size={16} className={`${iconColor} flex-shrink-0`} />}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
          {subtitle && <span className="text-xs text-gray-500 truncate block">{subtitle}</span>}
        </div>
      </div>

      {/* Right — controls */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Symbol chip */}
        {symbol != null && (
          showSymbolInput ? (
            <form onSubmit={submitSymbol} className="flex items-center">
              <input
                type="text"
                value={symbolDraft}
                onChange={e => setSymbolDraft(e.target.value.toUpperCase())}
                onBlur={() => setShowSymbolInput(false)}
                className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:outline-none focus:border-cyan-500"
                placeholder="Symbol"
                autoFocus
              />
            </form>
          ) : (
            onSymbolChange ? (
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={() => setShowSymbolInput(true)}
                className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300 transition-colors"
                title="Change symbol"
              >
                {symbol}<ChevronDown size={11} />
              </button>
            ) : (
              <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">{symbol}</span>
            )
          )
        )}

        {/* Custom children */}
        {children}

        {/* Export dropdown */}
        {(exportData || chartRef) && (
          <div ref={exportRef} className="relative">
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={() => setShowExport(v => !v)}
              className="p-1.5 text-gray-400 hover:text-cyan-400 hover:bg-gray-700/50 rounded transition-colors"
              title="Export"
            >
              <Download size={13} />
            </button>
            {showExport && (
              <div className="absolute right-0 top-full mt-1 bg-[#0d0d12] border border-gray-700 rounded shadow-xl z-[60] py-1 min-w-[140px]">
                {exportData && (
                  <>
                    <button onClick={() => handleExport('csv')}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors">
                      <FileDown size={11} className="text-cyan-400" /> CSV
                    </button>
                    <button onClick={() => handleExport('excel')}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors">
                      <FileSpreadsheet size={11} className="text-green-400" /> Excel (.xlsx)
                    </button>
                  </>
                )}
                {chartRef && (
                  <button onClick={() => handleExport('png')}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors">
                    <Image size={11} className="text-purple-400" /> PNG
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Refresh */}
        {onRefresh && (
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onRefresh(); }}
            disabled={loading}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        )}

        {/* Close / Remove */}
        {handleClose && (
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); handleClose(); }}
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700/50 rounded transition-colors"
            title="Remove"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

export default WidgetHeader;
