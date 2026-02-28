/**
 * WidgetTable - Reusable column-config based table component
 * Provides consistent table rendering across all widgets
 *
 * New in Phase 2:
 *   showFilters  — per-column text filter row below header
 *   pageSize     — client-side pagination (0 = disabled)
 *   Sparkline    — column type:'sparkline' renders a mini SVG trend line
 */
import { useState, useMemo, useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import { FileDown, FileSpreadsheet, ChevronDown, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { downloadCSV, downloadExcel, makeFilename } from '../../../utils/exportUtils';

const SIZE_STYLES = {
  compact: { cell: 'py-1.5 px-2 text-[11px]', header: 'py-1.5 px-2 text-[11px]', filter: 'py-0.5 px-2' },
  default: { cell: 'py-2 px-3 text-xs',       header: 'py-3 px-4 text-sm',        filter: 'py-1 px-3'   },
};

const ALIGN_CLASS = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data, color = '#22c55e', negColor = '#ef4444', width = 56, height = 20 }) {
  if (!Array.isArray(data) || data.length < 2) return <span className="text-gray-600 text-[10px]">—</span>;
  const nums = data.map(Number).filter(isFinite);
  if (nums.length < 2) return <span className="text-gray-600 text-[10px]">—</span>;

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;

  const pts = nums.map((v, i) => {
    const x = (i / (nums.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const last = nums[nums.length - 1];
  const first = nums[0];
  const lineColor = last >= first ? color : negColor;

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={lineColor} strokeWidth={1.5} strokeLinejoin="round" />
      <circle
        cx={parseFloat(pts.split(' ').at(-1).split(',')[0])}
        cy={parseFloat(pts.split(' ').at(-1).split(',')[1])}
        r={2}
        fill={lineColor}
      />
    </svg>
  );
}

// ─── SortArrow ────────────────────────────────────────────────────────────────
function SortArrow({ active, direction }) {
  if (active) {
    return (
      <span className="text-cyan-400 ml-1 text-[10px] leading-none select-none">
        {direction === 'asc' ? '▲' : '▼'}
      </span>
    );
  }
  return (
    <span className="text-gray-600 ml-1 text-[10px] leading-none opacity-0 group-hover/sortable:opacity-100 transition-opacity select-none">
      ▼
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function WidgetTable({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = 'No data available',
  size = 'default',
  showRowNumbers = false,
  rowClassName,
  onRowClick,
  stickyHeader = true,
  defaultSortKey = null,
  defaultSortDirection = null,
  resizable = false,
  // Phase 2 additions
  showFilters = false,   // enable per-column text filter row
  pageSize = 0,          // rows per page; 0 = no pagination
  // Export
  exportFilename,
  showExport = true,
}) {
  const styles = SIZE_STYLES[size] || SIZE_STYLES.default;

  // ── Export ─────────────────────────────────────────────────────────────────
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handler = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) setExportMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exportMenuOpen]);

  // ── Sorting ─────────────────────────────────────────────────────────────────
  const [sortConfig, setSortConfig] = useState({ key: defaultSortKey, direction: defaultSortDirection });

  const handleSort = useCallback((col) => {
    if (!col.sortable) return;
    setSortConfig((prev) => {
      if (prev.key !== col.key) return { key: col.key, direction: 'desc' };
      if (prev.direction === 'desc') return { key: col.key, direction: 'asc' };
      if (prev.direction === 'asc') return { key: null, direction: null };
      return { key: col.key, direction: 'desc' };
    });
  }, []);

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return data;
    const col = columns.find((c) => c.key === sortConfig.key);
    if (!col || !col.sortValue) return data;
    return [...data].sort((a, b) => {
      const aVal = col.sortValue(a);
      const bVal = col.sortValue(b);
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      let cmp = typeof aVal === 'string' && typeof bVal === 'string'
        ? aVal.localeCompare(bVal)
        : aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
  }, [data, columns, sortConfig]);

  // ── Filtering (Phase 2) ─────────────────────────────────────────────────────
  const [filters, setFilters] = useState({});

  const filteredData = useMemo(() => {
    if (!showFilters) return sortedData;
    const activeFilters = Object.entries(filters).filter(([, v]) => v.trim() !== '');
    if (activeFilters.length === 0) return sortedData;
    return sortedData.filter(row =>
      activeFilters.every(([key, query]) => {
        const col = columns.find(c => c.key === key);
        const raw = col?.filterValue
          ? col.filterValue(row)
          : col?.exportValue
            ? String(col.exportValue(row) ?? '')
            : String(row[key] ?? '');
        return raw.toLowerCase().includes(query.toLowerCase());
      })
    );
  }, [sortedData, filters, showFilters, columns]);

  const activeFilterCount = useMemo(() => Object.values(filters).filter(v => v.trim()).length, [filters]);

  const clearFilters = useCallback(() => setFilters({}), []);

  // Reset to page 1 when filters change
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [filters, data]);

  // ── Pagination (Phase 2) ────────────────────────────────────────────────────
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(filteredData.length / pageSize)) : 1;
  const pagedData = useMemo(() => {
    if (pageSize <= 0) return filteredData;
    const start = (page - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, page, pageSize]);

  // ── Export handler ──────────────────────────────────────────────────────────
  const handleExport = useCallback((format) => {
    setExportMenuOpen(false);
    const fname = exportFilename || makeFilename('table-export');
    const exportCols = columns
      .filter(c => c.key && c.header && c.type !== 'sparkline')
      .map(c => ({ key: c.key, header: c.header, exportValue: c.exportValue }));
    if (format === 'csv')   downloadCSV(filteredData,   exportCols, fname);
    if (format === 'excel') downloadExcel(filteredData, exportCols, fname);
  }, [columns, filteredData, exportFilename]);

  // ── Column resize ───────────────────────────────────────────────────────────
  const tableRef = useRef(null);
  const [columnWidths, setColumnWidths] = useState(null);

  useLayoutEffect(() => {
    if (!resizable || !tableRef.current || data.length === 0) return;
    if (columnWidths && columnWidths.length === columns.length + (showRowNumbers ? 1 : 0)) return;
    const ths = tableRef.current.querySelectorAll('thead tr:first-child th');
    if (ths.length === 0) return;
    setColumnWidths(Array.from(ths).map(th => th.getBoundingClientRect().width));
  }, [resizable, data.length, columns.length, showRowNumbers]);

  useEffect(() => { if (resizable) setColumnWidths(null); }, [columns.length, resizable]);

  const handleResizeStart = useCallback((e, colIndex) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidths[colIndex];
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev) => {
      const diff = ev.clientX - startX;
      setColumnWidths(prev => { const n = [...prev]; n[colIndex] = Math.max(50, startWidth + diff); return n; });
    };
    const onUp = () => {
      document.body.style.cursor = ''; document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [columnWidths]);

  // ── Header cell render ──────────────────────────────────────────────────────
  const renderHeaderCell = (col, colIndex) => {
    const isSortable = !!col.sortable;
    const isActiveSort = sortConfig.key === col.key && sortConfig.direction;
    const widthIdx = showRowNumbers ? colIndex + 1 : colIndex;
    const widthStyle = resizable && columnWidths
      ? { width: columnWidths[widthIdx], minWidth: 50 }
      : { width: col.width, minWidth: col.minWidth };

    return (
      <th
        key={col.key}
        className={`${styles.header} ${ALIGN_CLASS[col.align || 'left']} text-gray-400 font-medium ${col.headerClassName || ''} ${isSortable ? 'group/sortable cursor-pointer select-none' : ''} ${resizable && col.resizable !== false ? 'relative' : ''}`}
        style={widthStyle}
        onClick={isSortable ? () => handleSort(col) : undefined}
      >
        <span className="inline-flex items-center">
          {col.header}
          {isSortable && <SortArrow active={isActiveSort} direction={sortConfig.direction} />}
        </span>
        {resizable && col.resizable !== false && columnWidths && (
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-transparent hover:bg-cyan-400/50 opacity-0 hover:opacity-100 transition-opacity z-20"
            onMouseDown={e => handleResizeStart(e, widthIdx)}
          />
        )}
      </th>
    );
  };

  // ── Filter row cell render (Phase 2) ────────────────────────────────────────
  const renderFilterCell = (col, colIndex) => {
    const widthIdx = showRowNumbers ? colIndex + 1 : colIndex;
    const widthStyle = resizable && columnWidths
      ? { width: columnWidths[widthIdx], minWidth: 50 }
      : { width: col.width };
    const isFilterable = col.filterable !== false && col.type !== 'sparkline';

    return (
      <th key={col.key} className={`${styles.filter} ${ALIGN_CLASS[col.align || 'left']} border-b border-gray-800`} style={widthStyle}>
        {isFilterable ? (
          <div className="relative">
            <input
              type="text"
              value={filters[col.key] || ''}
              onChange={e => setFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
              placeholder="Filter…"
              className="w-full bg-gray-800/60 text-[10px] text-gray-300 placeholder-gray-600 rounded px-1.5 py-0.5 border border-transparent focus:border-gray-600 focus:outline-none pr-4"
              onMouseDown={e => e.stopPropagation()}
            />
            {filters[col.key] && (
              <button
                onClick={() => setFilters(prev => { const n = { ...prev }; delete n[col.key]; return n; })}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <X size={9} />
              </button>
            )}
          </div>
        ) : null}
      </th>
    );
  };

  const rowNumWidthStyle = resizable && columnWidths ? { width: columnWidths[0], minWidth: 50 } : {};
  const tableStyle = resizable && columnWidths ? { tableLayout: 'fixed' } : {};

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full">
        <table className="w-full" style={tableStyle}>
          <thead className={stickyHeader ? 'sticky top-0 bg-[#0d0d12] z-10' : ''}>
            <tr className="border-b border-gray-800">
              {showRowNumbers && <th className={`${styles.header} text-left text-gray-400 font-medium w-10`}>#</th>}
              {columns.map((col, i) => renderHeaderCell(col, i))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-800/50">
                {showRowNumbers && <td className={styles.cell}><div className="h-3 w-4 bg-gray-800 rounded animate-pulse" /></td>}
                {columns.map(col => (
                  <td key={col.key} className={`${styles.cell} ${ALIGN_CLASS[col.align || 'left']}`}>
                    <div className={`h-3 bg-gray-800 rounded animate-pulse ${col.align === 'right' ? 'ml-auto w-16' : 'w-24'}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (data.length === 0) {
    return (
      <table className="w-full" style={tableStyle}>
        <thead className={stickyHeader ? 'sticky top-0 bg-[#0d0d12] z-10' : ''}>
          <tr className="border-b border-gray-800">
            {showRowNumbers && <th className={`${styles.header} text-left text-gray-400 font-medium w-10`}>#</th>}
            {columns.map((col, i) => renderHeaderCell(col, i))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={columns.length + (showRowNumbers ? 1 : 0)} className="py-12 text-center text-gray-500 text-sm">
              {emptyMessage}
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  // ── Export toolbar ──────────────────────────────────────────────────────────
  const ExportToolbar = showExport && sortedData.length > 0 ? (
    <div className="flex items-center justify-between px-2 py-1 border-b border-gray-800/40 bg-[#0a0a0f] shrink-0">
      {/* active filter count badge */}
      {showFilters && activeFilterCount > 0 ? (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-amber-400 hover:text-amber-300 rounded hover:bg-gray-800/50 transition-colors"
        >
          <Search size={10} />
          {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
          <X size={9} />
        </button>
      ) : <div />}

      <div ref={exportMenuRef} className="relative">
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={() => setExportMenuOpen(v => !v)}
          className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-gray-500 hover:text-gray-300 hover:bg-gray-800/60 rounded transition-colors"
          title="Download data"
        >
          <FileDown size={11} />
          <span>Export</span>
          <ChevronDown size={9} className={`transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {exportMenuOpen && (
          <div className="absolute right-0 top-full mt-1 bg-[#0d0d12] border border-gray-700 rounded shadow-xl z-50 py-1 min-w-[120px]">
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
          </div>
        )}
      </div>
    </div>
  ) : null;

  // ── Pagination controls (Phase 2) ───────────────────────────────────────────
  const PaginationBar = pageSize > 0 && filteredData.length > pageSize ? (
    <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-800/60 bg-[#0a0a0f] shrink-0 select-none">
      <span className="text-[10px] text-gray-500">
        {filteredData.length} rows · page {page}/{totalPages}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setPage(1)}
          disabled={page === 1}
          className="p-0.5 text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="First page"
        >
          <ChevronLeft size={12} />
        </button>
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-2 py-0.5 text-[10px] text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded hover:bg-gray-800/50"
        >
          Prev
        </button>

        {/* page number pills */}
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let p;
          if (totalPages <= 5) p = i + 1;
          else if (page <= 3) p = i + 1;
          else if (page >= totalPages - 2) p = totalPages - 4 + i;
          else p = page - 2 + i;
          return (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-6 h-5 text-[10px] rounded transition-colors ${
                p === page
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
              }`}
            >
              {p}
            </button>
          );
        })}

        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="px-2 py-0.5 text-[10px] text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded hover:bg-gray-800/50"
        >
          Next
        </button>
        <button
          onClick={() => setPage(totalPages)}
          disabled={page === totalPages}
          className="p-0.5 text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Last page"
        >
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  ) : null;

  // ── Normal render ───────────────────────────────────────────────────────────
  return (
    <>
      {ExportToolbar}
      <table ref={tableRef} className="w-full" style={tableStyle}>
        <thead className={stickyHeader ? 'sticky top-0 bg-[#0d0d12] z-10' : ''}>
          {/* Sort header row */}
          <tr className="border-b border-gray-800">
            {showRowNumbers && (
              <th className={`${styles.header} text-left text-gray-400 font-medium w-10`} style={rowNumWidthStyle}>#</th>
            )}
            {columns.map((col, i) => renderHeaderCell(col, i))}
          </tr>
          {/* Filter row (Phase 2) */}
          {showFilters && (
            <tr className="bg-[#0d0d12]">
              {showRowNumbers && <th className={`${styles.filter} w-10 border-b border-gray-800`} style={rowNumWidthStyle} />}
              {columns.map((col, i) => renderFilterCell(col, i))}
            </tr>
          )}
        </thead>
        <tbody>
          {pagedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (showRowNumbers ? 1 : 0)} className="py-8 text-center text-gray-500 text-xs">
                No rows match the current filters
              </td>
            </tr>
          ) : pagedData.map((row, idx) => {
            const absoluteIdx = pageSize > 0 ? (page - 1) * pageSize + idx : idx;
            const rowCls = typeof rowClassName === 'function' ? rowClassName(row, absoluteIdx) : '';
            return (
              <tr
                key={row._key || absoluteIdx}
                className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${rowCls}`}
                onClick={onRowClick ? () => onRowClick(row, absoluteIdx) : undefined}
              >
                {showRowNumbers && (
                  <td className={`${styles.cell} text-gray-600 tabular-nums`} style={rowNumWidthStyle}>
                    {absoluteIdx + 1}
                  </td>
                )}
                {columns.map((col, colIdx) => {
                  const alignCls = ALIGN_CLASS[col.align || 'left'];
                  const tabNums = col.align === 'right' ? 'tabular-nums' : '';
                  const widthIdx = showRowNumbers ? colIdx + 1 : colIdx;
                  const cellWidthStyle = resizable && columnWidths
                    ? { width: columnWidths[widthIdx], minWidth: 50, overflow: 'hidden' }
                    : {};

                  let content;
                  if (col.type === 'sparkline') {
                    const sparkData = col.sparkKey ? row[col.sparkKey] : row[col.key];
                    content = (
                      <Sparkline
                        data={sparkData}
                        color={col.sparkColor || '#22c55e'}
                        negColor={col.sparkNegColor || '#ef4444'}
                        width={col.sparkWidth || 56}
                        height={col.sparkHeight || 20}
                      />
                    );
                  } else if (col.render) {
                    content = col.render(row, absoluteIdx);
                  } else {
                    content = row[col.key];
                  }

                  return (
                    <td
                      key={col.key}
                      className={`${styles.cell} ${alignCls} ${tabNums} ${col.className || ''}`}
                      style={cellWidthStyle}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {PaginationBar}
    </>
  );
}
