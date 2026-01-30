/**
 * Export utilities for data export (CSV/Excel)
 */

/**
 * Export data to CSV/Excel file
 * @param {Array<Object>} data - Array of data objects to export
 * @param {Array<{key: string, header: string, formatter?: Function}>} columns - Column definitions
 * @param {string} filename - Filename for download (without extension)
 */
export const exportToExcel = (data, columns, filename = 'export') => {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Build CSV header
  const headers = columns.map(col => `"${col.header}"`).join(',');

  // Build CSV rows
  const rows = data.map(row => {
    return columns.map(col => {
      let value = row[col.key];

      // Apply formatter if provided
      if (col.formatter && value !== null && value !== undefined) {
        value = col.formatter(value, row);
      }

      // Handle null/undefined
      if (value === null || value === undefined) {
        return '';
      }

      // Escape quotes and wrap in quotes for CSV safety
      const stringValue = String(value).replace(/"/g, '""');
      return `"${stringValue}"`;
    }).join(',');
  }).join('\n');

  // Combine header and rows
  const csv = `${headers}\n${rows}`;

  // Create blob and download
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export presets for common data types
 */
export const EXPORT_PRESETS = {
  // Stock price data
  priceData: [
    { key: 'date', header: 'Date' },
    { key: 'open', header: 'Open', formatter: (v) => v?.toFixed(2) },
    { key: 'high', header: 'High', formatter: (v) => v?.toFixed(2) },
    { key: 'low', header: 'Low', formatter: (v) => v?.toFixed(2) },
    { key: 'close', header: 'Close', formatter: (v) => v?.toFixed(2) },
    { key: 'volume', header: 'Volume', formatter: (v) => v?.toLocaleString() },
  ],

  // Financial metrics
  financialMetrics: [
    { key: 'metric', header: 'Metric' },
    { key: 'value', header: 'Value' },
    { key: 'change', header: 'Change', formatter: (v) => v ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '' },
    { key: 'period', header: 'Period' },
  ],

  // Alert data
  alertData: [
    { key: 'symbol', header: 'Symbol' },
    { key: 'type', header: 'Type' },
    { key: 'condition', header: 'Condition' },
    { key: 'target', header: 'Target' },
    { key: 'current', header: 'Current' },
    { key: 'status', header: 'Status' },
    { key: 'triggeredAt', header: 'Triggered At' },
  ],

  // Earnings data
  earningsData: [
    { key: 'date', header: 'Date' },
    { key: 'symbol', header: 'Symbol' },
    { key: 'epsEstimate', header: 'EPS Estimate', formatter: (v) => v?.toFixed(2) },
    { key: 'epsActual', header: 'EPS Actual', formatter: (v) => v?.toFixed(2) },
    { key: 'surprise', header: 'Surprise %', formatter: (v) => v ? `${v.toFixed(2)}%` : '' },
    { key: 'revenueEstimate', header: 'Revenue Estimate', formatter: (v) => v?.toLocaleString() },
    { key: 'revenueActual', header: 'Revenue Actual', formatter: (v) => v?.toLocaleString() },
  ],

  // Dividend data
  dividendData: [
    { key: 'exDate', header: 'Ex-Date' },
    { key: 'payDate', header: 'Pay Date' },
    { key: 'amount', header: 'Amount', formatter: (v) => v ? `$${v.toFixed(4)}` : '' },
    { key: 'yield', header: 'Yield', formatter: (v) => v ? `${v.toFixed(2)}%` : '' },
    { key: 'frequency', header: 'Frequency' },
  ],

  // Holdings data
  holdingsData: [
    { key: 'symbol', header: 'Symbol' },
    { key: 'name', header: 'Name' },
    { key: 'shares', header: 'Shares', formatter: (v) => v?.toLocaleString() },
    { key: 'value', header: 'Value', formatter: (v) => v ? `$${v.toLocaleString()}` : '' },
    { key: 'weight', header: 'Weight %', formatter: (v) => v ? `${v.toFixed(2)}%` : '' },
    { key: 'change', header: 'Change %', formatter: (v) => v ? `${v.toFixed(2)}%` : '' },
  ],

  // Institutional ownership
  institutionalData: [
    { key: 'holder', header: 'Holder' },
    { key: 'shares', header: 'Shares', formatter: (v) => v?.toLocaleString() },
    { key: 'value', header: 'Value', formatter: (v) => v ? `$${(v / 1e6).toFixed(2)}M` : '' },
    { key: 'pctOut', header: '% Outstanding', formatter: (v) => v ? `${v.toFixed(2)}%` : '' },
    { key: 'change', header: 'Change', formatter: (v) => v?.toLocaleString() },
    { key: 'reportDate', header: 'Report Date' },
  ],

  // Macro economic data
  macroData: [
    { key: 'date', header: 'Date' },
    { key: 'indicator', header: 'Indicator' },
    { key: 'value', header: 'Value' },
    { key: 'previous', header: 'Previous' },
    { key: 'change', header: 'Change', formatter: (v) => v ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}` : '' },
  ],
};

/**
 * Generate filename with date
 * @param {string} prefix - Filename prefix
 * @param {string} symbol - Optional symbol to include
 * @returns {string} Filename with date
 */
export const generateFilename = (prefix, symbol) => {
  const date = new Date().toISOString().split('T')[0];
  if (symbol) {
    return `${prefix}_${symbol}_${date}`;
  }
  return `${prefix}_${date}`;
};
