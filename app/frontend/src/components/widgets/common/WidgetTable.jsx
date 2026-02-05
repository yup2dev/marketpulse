/**
 * WidgetTable - Reusable column-config based table component
 * Provides consistent table rendering across all widgets
 * Supports column sorting and column resizing
 */
import { useState, useMemo, useRef, useLayoutEffect, useCallback, useEffect } from 'react';

const SIZE_STYLES = {
  compact: { cell: 'py-1.5 px-2 text-[11px]', header: 'py-1.5 px-2 text-[11px]' },
  default: { cell: 'py-2 px-3 text-xs', header: 'py-3 px-4 text-sm' },
};

const ALIGN_CLASS = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

/**
 * Sort indicator arrow for sortable column headers
 */
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
}) {
  const styles = SIZE_STYLES[size] || SIZE_STYLES.default;

  // --- Sorting state ---
  const [sortConfig, setSortConfig] = useState({
    key: defaultSortKey,
    direction: defaultSortDirection,
  });

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
      // null/undefined go last
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let cmp;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal);
      } else {
        cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
  }, [data, columns, sortConfig]);

  // --- Resize state ---
  const tableRef = useRef(null);
  const headerRefs = useRef([]);
  const [columnWidths, setColumnWidths] = useState(null);
  const [resizing, setResizing] = useState(null); // { colIndex, startX, startWidth }

  // Measure initial column widths once data is available
  useLayoutEffect(() => {
    if (!resizable || !tableRef.current || data.length === 0) return;
    // Only measure once (when columnWidths is null) or when columns change
    if (columnWidths && columnWidths.length === columns.length + (showRowNumbers ? 1 : 0)) return;

    const ths = tableRef.current.querySelectorAll('thead th');
    if (ths.length === 0) return;
    const widths = Array.from(ths).map((th) => th.getBoundingClientRect().width);
    setColumnWidths(widths);
  }, [resizable, data.length, columns.length, showRowNumbers]);

  // Reset column widths when columns change structurally
  useEffect(() => {
    if (resizable) setColumnWidths(null);
  }, [columns.length, resizable]);

  const handleResizeStart = useCallback((e, colIndex) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidths[colIndex];

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent) => {
      const diff = moveEvent.clientX - startX;
      const newWidth = Math.max(50, startWidth + diff);
      setColumnWidths((prev) => {
        const next = [...prev];
        next[colIndex] = newWidth;
        return next;
      });
    };

    const onMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      setResizing(null);
    };

    setResizing({ colIndex, startX, startWidth });
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [columnWidths]);

  // --- Helpers for rendering header cells ---
  const renderHeaderCell = (col, colIndex) => {
    const isSortable = !!col.sortable;
    const isActiveSort = sortConfig.key === col.key && sortConfig.direction;
    const widthIdx = showRowNumbers ? colIndex + 1 : colIndex;

    const widthStyle = resizable && columnWidths
      ? { width: columnWidths[widthIdx], minWidth: 50 }
      : { width: col.width, minWidth: col.minWidth };

    const canResize = resizable && col.resizable !== false;

    return (
      <th
        key={col.key}
        className={`${styles.header} ${ALIGN_CLASS[col.align || 'left']} text-gray-400 font-medium ${col.headerClassName || ''} ${isSortable ? 'group/sortable cursor-pointer select-none' : ''} ${canResize ? 'relative' : ''}`}
        style={widthStyle}
        onClick={isSortable ? () => handleSort(col) : undefined}
      >
        <span className="inline-flex items-center">
          {col.header}
          {isSortable && <SortArrow active={isActiveSort} direction={sortConfig.direction} />}
        </span>
        {canResize && columnWidths && (
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-transparent hover:bg-cyan-400/50 opacity-0 hover:opacity-100 transition-opacity z-20"
            onMouseDown={(e) => handleResizeStart(e, widthIdx)}
          />
        )}
      </th>
    );
  };

  const rowNumWidthStyle = resizable && columnWidths ? { width: columnWidths[0], minWidth: 50 } : {};

  const tableStyle = resizable && columnWidths ? { tableLayout: 'fixed' } : {};

  // --- Loading skeleton ---
  if (loading) {
    return (
      <div className="w-full">
        <table className="w-full" style={tableStyle}>
          <thead className={stickyHeader ? 'sticky top-0 bg-[#0d0d12] z-10' : ''}>
            <tr className="border-b border-gray-800">
              {showRowNumbers && (
                <th className={`${styles.header} text-left text-gray-400 font-medium w-10`}>#</th>
              )}
              {columns.map((col, i) => renderHeaderCell(col, i))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-800/50">
                {showRowNumbers && (
                  <td className={styles.cell}>
                    <div className="h-3 w-4 bg-gray-800 rounded animate-pulse" />
                  </td>
                )}
                {columns.map((col) => (
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

  // --- Empty state ---
  if (data.length === 0) {
    return (
      <table className="w-full" style={tableStyle}>
        <thead className={stickyHeader ? 'sticky top-0 bg-[#0d0d12] z-10' : ''}>
          <tr className="border-b border-gray-800">
            {showRowNumbers && (
              <th className={`${styles.header} text-left text-gray-400 font-medium w-10`}>#</th>
            )}
            {columns.map((col, i) => renderHeaderCell(col, i))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td
              colSpan={columns.length + (showRowNumbers ? 1 : 0)}
              className="py-12 text-center text-gray-500 text-sm"
            >
              {emptyMessage}
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  // --- Normal render ---
  return (
    <table ref={tableRef} className="w-full" style={tableStyle}>
      <thead className={stickyHeader ? 'sticky top-0 bg-[#0d0d12] z-10' : ''}>
        <tr className="border-b border-gray-800">
          {showRowNumbers && (
            <th
              className={`${styles.header} text-left text-gray-400 font-medium w-10`}
              style={rowNumWidthStyle}
            >
              #
            </th>
          )}
          {columns.map((col, i) => renderHeaderCell(col, i))}
        </tr>
      </thead>
      <tbody>
        {sortedData.map((row, idx) => {
          const rowCls = typeof rowClassName === 'function' ? rowClassName(row, idx) : '';
          return (
            <tr
              key={row._key || idx}
              className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${
                onRowClick ? 'cursor-pointer' : ''
              } ${rowCls}`}
              onClick={onRowClick ? () => onRowClick(row, idx) : undefined}
            >
              {showRowNumbers && (
                <td
                  className={`${styles.cell} text-gray-600 tabular-nums`}
                  style={rowNumWidthStyle}
                >
                  {idx + 1}
                </td>
              )}
              {columns.map((col, colIdx) => {
                const alignCls = ALIGN_CLASS[col.align || 'left'];
                const tabNums = col.align === 'right' ? 'tabular-nums' : '';
                const widthIdx = showRowNumbers ? colIdx + 1 : colIdx;
                const cellWidthStyle = resizable && columnWidths
                  ? { width: columnWidths[widthIdx], minWidth: 50, overflow: 'hidden' }
                  : {};
                return (
                  <td
                    key={col.key}
                    className={`${styles.cell} ${alignCls} ${tabNums} ${col.className || ''}`}
                    style={cellWidthStyle}
                  >
                    {col.render ? col.render(row, idx) : row[col.key]}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
