/**
 * exportUtils.js
 * Universal export utilities — CSV, Excel (.xlsx), PNG chart capture.
 *
 * Column definition for export:
 *   { key, header, exportValue?: (row) => any }
 *
 * If `exportValue` is omitted, raw row[key] is used.
 * Widgets may add `exportValue` alongside their `render` function
 * so JSX rendering and raw data export stay independent.
 */
import * as XLSX from 'xlsx';

// ─── Internal helpers ─────────────────────────────────────────────────────────

function triggerDownload(blob, filename) {
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function csvCell(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function getExportValue(row, col) {
  if (typeof col.exportValue === 'function') return col.exportValue(row);
  if (typeof col.formatter   === 'function') return col.formatter(row[col.key], row);
  const v = row[col.key];
  return v !== null && v !== undefined ? v : '';
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

/**
 * Download rows as UTF-8 CSV (with BOM so Excel opens it correctly).
 * @param {object[]}  rows
 * @param {object[]}  columns  [{key, header, exportValue?}]
 * @param {string}    filename
 */
export function downloadCSV(rows, columns, filename = 'export') {
  if (!rows?.length || !columns?.length) return;
  const header = columns.map(c => csvCell(c.header)).join(',');
  const lines  = rows.map(row =>
    columns.map(col => csvCell(getExportValue(row, col))).join(','),
  );
  const blob = new Blob(['\uFEFF' + [header, ...lines].join('\r\n')],
    { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

// ─── Excel ───────────────────────────────────────────────────────────────────

/**
 * Download rows as Excel (.xlsx) with auto column widths.
 * @param {object[]}  rows
 * @param {object[]}  columns   [{key, header, exportValue?}]
 * @param {string}    filename
 * @param {string}    sheetName  Worksheet tab name (≤31 chars)
 */
export function downloadExcel(rows, columns, filename = 'export', sheetName = 'Data') {
  if (!rows?.length || !columns?.length) return;

  const headers  = columns.map(c => c.header);
  const dataRows = rows.map(row => columns.map(col => getExportValue(row, col)));

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

  // Auto column widths
  ws['!cols'] = columns.map((col, i) => {
    const maxLen = Math.max(
      col.header.length,
      ...dataRows.map(r => String(r[i] ?? '').length),
    );
    return { wch: Math.min(Math.max(maxLen + 2, 8), 42) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, String(sheetName).slice(0, 31));
  const fname = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, fname);
}

/**
 * Download multiple sheets in one Excel workbook.
 * @param {{ name, rows, columns }[]} sheets
 * @param {string} filename
 */
export function downloadMultiSheetExcel(sheets, filename = 'export') {
  if (!sheets?.length) return;
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, rows, columns }) => {
    if (!rows?.length || !columns?.length) return;
    const headers  = columns.map(c => c.header);
    const dataRows = rows.map(row => columns.map(col => getExportValue(row, col)));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    ws['!cols'] = columns.map((col, i) => {
      const ml = Math.max(col.header.length, ...dataRows.map(r => String(r[i] ?? '').length));
      return { wch: Math.min(Math.max(ml + 2, 8), 42) };
    });
    XLSX.utils.book_append_sheet(wb, ws, String(name || 'Sheet').slice(0, 31));
  });
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

// ─── PNG ─────────────────────────────────────────────────────────────────────

/**
 * Capture a chart container (finds first <svg>) and download as PNG.
 * @param {HTMLElement} containerEl
 * @param {string}      filename
 * @param {string}      bgColor   Background fill colour (dark default)
 */
export async function downloadChartPNG(containerEl, filename = 'chart', bgColor = '#0d0d12') {
  if (!containerEl) return;
  const svg = containerEl.querySelector('svg');
  if (!svg) return;

  const svgStr = new XMLSerializer().serializeToString(svg);
  const blob   = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url    = URL.createObjectURL(blob);

  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });

  const dpr = window.devicePixelRatio || 1;
  const w   = svg.clientWidth  || 600;
  const h   = svg.clientHeight || 300;

  const canvas = document.createElement('canvas');
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(url);

  canvas.toBlob(pngBlob => {
    triggerDownload(pngBlob, filename.endsWith('.png') ? filename : `${filename}.png`);
  }, 'image/png');
}

// ─── Filename helper ─────────────────────────────────────────────────────────

/**
 * Build a safe filename: 'key-metrics_AAPL_2025-02-28'
 */
export function makeFilename(title = 'export', symbol = '') {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
  const sym  = symbol ? `_${symbol.toUpperCase()}` : '';
  const date = new Date().toISOString().slice(0, 10);
  return `${slug}${sym}_${date}`;
}

// ─── Legacy compat aliases (used by PortfolioDetail etc.) ────────────────────

export const exportToExcel   = downloadCSV;   // was CSV-only; keep name to avoid breaking imports
export const generateFilename = makeFilename;

export const EXPORT_PRESETS = {
  priceData: [
    { key: 'date',   header: 'Date'   },
    { key: 'open',   header: 'Open',   exportValue: r => r.open?.toFixed(2)   },
    { key: 'high',   header: 'High',   exportValue: r => r.high?.toFixed(2)   },
    { key: 'low',    header: 'Low',    exportValue: r => r.low?.toFixed(2)    },
    { key: 'close',  header: 'Close',  exportValue: r => r.close?.toFixed(2)  },
    { key: 'volume', header: 'Volume', exportValue: r => r.volume?.toLocaleString() },
  ],
  financialMetrics: [
    { key: 'metric', header: 'Metric' },
    { key: 'value',  header: 'Value'  },
    { key: 'period', header: 'Period' },
  ],
  macroData: [
    { key: 'date',      header: 'Date'      },
    { key: 'indicator', header: 'Indicator' },
    { key: 'value',     header: 'Value'     },
    { key: 'previous',  header: 'Previous'  },
  ],
  holdingsData: [
    { key: 'symbol', header: 'Symbol' },
    { key: 'name',   header: 'Name'   },
    { key: 'shares', header: 'Shares', exportValue: r => r.shares?.toLocaleString()         },
    { key: 'value',  header: 'Value',  exportValue: r => r.value  ? `$${r.value.toLocaleString()}` : '' },
    { key: 'weight', header: 'Weight %', exportValue: r => r.weight?.toFixed(2) },
  ],
};
