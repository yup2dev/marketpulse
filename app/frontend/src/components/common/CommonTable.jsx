/**
 * CommonTable — OpenBB-style data table using TanStack React Table v8.
 *
 * Usage:
 *   <CommonTable
 *     data={[{ symbol:'AAPL', price:189.3, change_pct:1.2 }, ...]}
 *     columns={[
 *       { key: 'symbol',     header: 'Symbol',   sortable: true },
 *       { key: 'price',      header: 'Price',    formatter: 'number', align: 'right' },
 *       { key: 'change_pct', header: 'Chg %',    formatter: 'percent', renderFn: 'greenRed', align: 'right' },
 *       { key: 'sparkline',  header: 'Trend',    renderFn: 'sparkline', sparklineField: 'history' },
 *     ]}
 *   />
 *
 * Column config:
 *   key          string   — data field name
 *   header       string   — column label
 *   sortable     boolean  — enable sort (default true)
 *   filterable   boolean  — enable column filter
 *   align        'left'|'right'|'center'
 *   width        number   — fixed width (px)
 *   minWidth     number
 *   pinned       'left'|'right'
 *   formatter    'number'|'percent'|'currency'|'date'|'magnitude'|'none'
 *   renderFn     'greenRed'|'badge'|'sparkline'
 *   sparklineField string — data field containing array for sparkline
 *   hide         boolean  — hidden by default
 *
 * Props:
 *   data         array    — rows (objects)
 *   columns      array    — column definitions
 *   title        string   — optional header title
 *   pageSize     number   — rows per page (default 20)
 *   searchable   boolean  — show global search (default true)
 *   exportable   boolean  — show CSV export button (default true)
 *   compact      boolean  — smaller row height
 *   className    string
 *   onRowClick   fn(row)
 */
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import { rankItem } from '@tanstack/match-sorter-utils';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  Search, Download, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, SlidersHorizontal,
} from 'lucide-react';

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = {
  number:    v => v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }),
  percent:   v => v == null ? '—' : `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`,
  currency:  v => v == null ? '—' : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  date:      v => v == null ? '—' : new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }),
  magnitude: v => {
    if (v == null) return '—';
    const n = Number(v);
    if (Math.abs(n) >= 1e12) return `${(n/1e12).toFixed(2)}T`;
    if (Math.abs(n) >= 1e9)  return `${(n/1e9).toFixed(2)}B`;
    if (Math.abs(n) >= 1e6)  return `${(n/1e6).toFixed(2)}M`;
    if (Math.abs(n) >= 1e3)  return `${(n/1e3).toFixed(2)}K`;
    return Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
  },
  none: v => v ?? '—',
};

function formatCell(value, formatter) {
  const fn = fmt[formatter] || fmt.none;
  return fn(value);
}

// ── Cell Renderers ────────────────────────────────────────────────────────────
function GreenRedCell({ value, formatted }) {
  const n = Number(value);
  const color = n > 0 ? 'text-green-400' : n < 0 ? 'text-red-400' : 'text-gray-400';
  return <span className={`font-medium ${color}`}>{formatted}</span>;
}

function BadgeCell({ value }) {
  const upper = String(value).toUpperCase();
  const color =
    upper === 'BUY'    || upper === 'STRONG_BUY' ? 'bg-green-900/50 text-green-400 border-green-800' :
    upper === 'SELL'   || upper === 'STRONG_SELL'? 'bg-red-900/50 text-red-400 border-red-800' :
    upper === 'HOLD'   || upper === 'NEUTRAL'    ? 'bg-yellow-900/50 text-yellow-400 border-yellow-800' :
    'bg-gray-800 text-gray-400 border-gray-700';
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${color}`}>
      {String(value)}
    </span>
  );
}

function SparklineCell({ sparkData, isPositive }) {
  const divRef = useRef(null);
  useEffect(() => {
    if (!divRef.current || !sparkData?.length) return;
    let ro;
    const draw = async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      const color = isPositive ? '#22c55e' : '#ef4444';
      await Plotly.react(
        divRef.current,
        [{ type: 'scatter', mode: 'lines', y: sparkData.map(d => (typeof d === 'object' ? d.close ?? d.value ?? d : d)), line: { color, width: 1 } }],
        {
          paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
          margin: { t: 0, r: 0, b: 0, l: 0 }, showlegend: false,
          xaxis: { visible: false }, yaxis: { visible: false },
        },
        { displayModeBar: false, responsive: true },
      );
      ro = new ResizeObserver(() => Plotly.Plots.resize(divRef.current));
      ro.observe(divRef.current);
    };
    draw();
    return () => { if (ro) ro.disconnect(); };
  }, [sparkData, isPositive]);

  if (!sparkData?.length) return null;
  return <div ref={divRef} style={{ width: 80, height: 28 }} />;
}

function renderCellContent(value, colDef, row) {
  // Guard: object values are not renderable — show placeholder
  if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
    return <span className="text-gray-600 text-[10px]">—</span>;
  }

  const formatted = formatCell(value, colDef.formatter);

  if (typeof colDef.renderFn === 'function') return colDef.renderFn(value, row);
  if (colDef.renderFn === 'greenRed') return <GreenRedCell value={value} formatted={formatted} />;
  if (colDef.renderFn === 'badge')    return <BadgeCell value={value} />;
  if (colDef.renderFn === 'sparkline') {
    const sparkData = colDef.sparklineField ? row[colDef.sparklineField] : value;
    const arr = Array.isArray(sparkData) ? sparkData : [];
    const isPos = arr.length >= 2 && (arr[arr.length - 1]?.close ?? arr[arr.length-1]) >= (arr[0]?.close ?? arr[0]);
    return <SparklineCell sparkData={arr} isPositive={isPos} />;
  }

  return <span>{formatted}</span>;
}

// ── Fuzzy filter ──────────────────────────────────────────────────────────────
function fuzzyFilter(row, columnId, value, addMeta) {
  const itemRank = rankItem(row.getValue(columnId), value);
  addMeta({ itemRank });
  return itemRank.passed;
}

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportCSV(data, columns) {
  const headers = columns.map(c => c.header || c.key);
  const keys    = columns.map(c => c.key);
  const rows    = data.map(row => keys.map(k => JSON.stringify(row[k] ?? '')).join(','));
  const csv     = [headers.join(','), ...rows].join('\n');
  const blob    = new Blob([csv], { type: 'text/csv' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href = url; a.download = 'export.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CommonTable({
  data = [],
  columns: colDefs = [],
  title,
  pageSize: initialPageSize = 20,
  searchable = true,
  exportable = true,
  compact = false,
  className = '',
  onRowClick,
  rowClassName,   // (row) => string — extra CSS classes per row
}) {
  const [sorting,       setSorting]       = useState([]);
  const [globalFilter,  setGlobalFilter]  = useState('');
  const [columnVisibility, setColumnVisibility] = useState(
    () => Object.fromEntries(colDefs.filter(c => c.hide).map(c => [c.key, false])),
  );
  const [showColPicker, setShowColPicker] = useState(false);

  // Build TanStack column defs
  const tanColumns = useMemo(() =>
    colDefs.map(col => {
      const base = {
        id:            col.key,
        header:        col.header ?? col.key,
        enableSorting: col.sortable !== false,
        enableColumnFilter: col.filterable ?? false,
        size:          col.width,
        minSize:       col.minWidth ?? 60,
        cell: ({ getValue, row }) =>
          renderCellContent(getValue(), col, row.original),
        meta: { align: col.align ?? 'left', col },
      };
      if (col.accessorFn) {
        base.accessorFn = col.accessorFn;
      } else {
        base.accessorKey = col.key;
      }
      return base;
    }),
  [colDefs]);

  const table = useReactTable({
    data,
    columns: tanColumns,
    state:   { sorting, globalFilter, columnVisibility },
    onSortingChange:          setSorting,
    onGlobalFilterChange:     setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    globalFilterFn:           fuzzyFilter,
    getCoreRowModel:          getCoreRowModel(),
    getSortedRowModel:        getSortedRowModel(),
    getFilteredRowModel:      getFilteredRowModel(),
    getPaginationRowModel:    getPaginationRowModel(),
    initialState: { pagination: { pageSize: initialPageSize } },
  });

  const rowH = compact ? 'py-1' : 'py-2';

  return (
    <div className={`flex flex-col h-full bg-[#0d0d12] text-gray-200 ${className}`}>
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 flex-shrink-0">
        {title && <span className="text-xs font-semibold text-gray-300 mr-2">{title}</span>}

        {searchable && (
          <div className="relative flex-1 max-w-[220px]">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              value={globalFilter}
              onChange={e => setGlobalFilter(e.target.value)}
              placeholder="Search…"
              className="w-full pl-6 pr-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded outline-none focus:border-cyan-600 text-gray-200 placeholder-gray-600"
            />
          </div>
        )}

        <div className="flex items-center gap-1 ml-auto">
          {/* Column picker */}
          <div className="relative">
            <button
              onClick={() => setShowColPicker(v => !v)}
              className="p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              title="Show/hide columns"
            >
              <SlidersHorizontal size={13} />
            </button>
            {showColPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowColPicker(false)} />
                <div className="absolute right-0 top-full mt-1 bg-[#111827] border border-gray-700 rounded-lg shadow-xl z-50 py-1 min-w-[160px]">
                  {table.getAllLeafColumns().map(col => (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={col.getIsVisible()}
                        onChange={col.getToggleVisibilityHandler()}
                        className="accent-cyan-500"
                      />
                      {col.columnDef.header}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {exportable && (
            <button
              onClick={() => exportCSV(data, colDefs)}
              className="p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              title="Export CSV"
            >
              <Download size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-[#111827]">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => {
                  const align = header.column.columnDef.meta?.align ?? 'left';
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() || undefined, textAlign: align }}
                      className={`px-3 ${rowH} font-medium text-gray-400 border-b border-gray-800 whitespace-nowrap select-none ${canSort ? 'cursor-pointer hover:text-gray-200' : ''}`}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <span className="flex items-center gap-1 justify-inherit">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          header.column.getIsSorted() === 'asc'  ? <ChevronUp size={10} className="text-cyan-400" /> :
                          header.column.getIsSorted() === 'desc' ? <ChevronDown size={10} className="text-cyan-400" /> :
                          <ChevronsUpDown size={10} className="text-gray-600" />
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={colDefs.length} className="text-center py-10 text-gray-500">
                  No data
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={`border-b border-gray-800/50 transition-colors ${onRowClick ? 'cursor-pointer hover:bg-gray-800/40' : 'hover:bg-gray-800/20'} ${rowClassName ? rowClassName(row.original) : ''}`}
                >
                  {row.getVisibleCells().map(cell => {
                    const align = cell.column.columnDef.meta?.align ?? 'left';
                    return (
                      <td
                        key={cell.id}
                        style={{ textAlign: align }}
                        className={`px-3 ${rowH} text-gray-200 whitespace-nowrap`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {data.length > initialPageSize && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-800 flex-shrink-0">
          <span className="text-xs text-gray-500">
            {table.getFilteredRowModel().rows.length} rows
            {globalFilter ? ` (filtered from ${data.length})` : ''}
          </span>
          <div className="flex items-center gap-1">
            <select
              value={table.getState().pagination.pageSize}
              onChange={e => table.setPageSize(Number(e.target.value))}
              className="text-xs bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-gray-300 outline-none"
            >
              {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}/page</option>)}
            </select>
            <button onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} className="p-0.5 text-gray-500 disabled:opacity-30 hover:text-gray-200">
              <ChevronsLeft size={13} />
            </button>
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="p-0.5 text-gray-500 disabled:opacity-30 hover:text-gray-200">
              <ChevronLeft size={13} />
            </button>
            <span className="text-xs text-gray-400 px-1">
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="p-0.5 text-gray-500 disabled:opacity-30 hover:text-gray-200">
              <ChevronRight size={13} />
            </button>
            <button onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} className="p-0.5 text-gray-500 disabled:opacity-30 hover:text-gray-200">
              <ChevronsRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
