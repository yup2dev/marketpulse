/**
 * autoRender — OpenBB-style data-driven rendering utilities.
 *
 * Mirrors OpenBB's pattern:
 *   - Chart: response has { data: [{type: 'scatter'|'bar'|...}, ...], layout: {} }
 *   - Table: everything else — auto-generates columns from object keys
 *
 * No explicit column definitions needed. Cell types are inferred at runtime
 * from column names and sample values, exactly like OpenBB's Table component.
 */

// ── Type inference helpers ────────────────────────────────────────────────────

const DATE_KEYS    = ['date', 'time', 'period', 'year', 'month', 'quarter', 'fiscal', 'filed', 'reported'];
const PCT_KEYS     = ['pct', 'percent', 'yield', 'growth', 'return', 'rate', 'ratio', 'margin', 'change'];
const MAG_KEYS     = ['value', 'revenue', 'income', 'assets', 'liabilities', 'debt', 'cash',
                      'market_cap', 'shares', 'volume', 'amount', 'price', 'equity', 'cost'];
const ISO_DATE_RE  = /^\d{4}-\d{2}-\d{2}/;
const MAGNITUDE_RE = /^-?[\d,.]+[KMBT]?$/;

function sampleValues(rows, key, n = 10) {
  return rows.slice(0, n).map(r => r[key]).filter(v => v != null);
}

function inferType(key, samples) {
  const k = key.toLowerCase();

  // Date: column name exact match or suffix (e.g. "report_date"), NOT prefix
  // Prefix matching (e.g. startsWith('period_')) causes false positives like "period_type"
  if (DATE_KEYS.some(d => k === d || k.endsWith('_' + d))) return 'date';
  // Fallback: value looks like ISO date string
  if (samples.some(v => typeof v === 'string' && ISO_DATE_RE.test(v))) return 'date';

  const numSamples = samples.filter(v => typeof v === 'number');
  if (!numSamples.length) return 'text';

  const avgAbs = numSamples.reduce((s, v) => s + Math.abs(v), 0) / numSamples.length;

  // Percent: column name hint + small absolute numbers (< 500)
  if (PCT_KEYS.some(p => k.includes(p)) && avgAbs < 500) return 'percent';

  // Magnitude: large numbers
  if (MAG_KEYS.some(m => k.includes(m)) && avgAbs > 1e5) return 'magnitude';
  if (avgAbs > 1e7) return 'magnitude';

  return 'number';
}

function toTitleCase(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Detect whether the API response should render as a Plotly chart or table.
 *
 * Plotly: response has `data` array whose items have a `type` field
 *   (e.g. 'scatter', 'bar', 'candlestick', 'pie', ...)
 * Everything else → table.
 */
export function detectRenderType(response) {
  if (!response) return 'table';
  const d = response.data;
  if (Array.isArray(d) && d.length > 0 && typeof d[0]?.type === 'string') return 'plotly';
  if (response.layout && Array.isArray(d)) return 'plotly';
  return 'table';
}

/**
 * Extract a clean Plotly figure object from the API response.
 * Strips the title text (rendered by widget header instead).
 */
export function normalizePlotlyJson(response) {
  const layout = {
    ...(response.layout || {}),
    title: undefined,       // widget header renders the title
    width: undefined,
    height: undefined,
  };
  return {
    data:   response.data   || [],
    layout,
    frames: response.frames || [],
  };
}

/**
 * Flatten one level of nested objects into the parent row.
 *
 * { date: '2025-09-30', income_statement: { revenue: 1, net_income: 2 } }
 * → { date: '2025-09-30', revenue: 1, net_income: 2 }
 *
 * Array-valued fields are kept as-is (sparklines etc.).
 * Conflicts: nested key wins only if parent key is the section name itself.
 */
function flattenRow(row) {
  const result = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      // Spread nested object's primitive fields into parent
      for (const [nk, nv] of Object.entries(v)) {
        if (!(nk in result)) result[nk] = nv;
      }
    } else {
      result[k] = v;
    }
  }
  return result;
}

/**
 * Flatten any API response shape into an array of row objects.
 *
 * Handles:
 *   [ {}, {} ]                     → direct array
 *   { data: [ {}, {} ] }           → unwrap .data
 *   { columns: [], data: [[]] }    → OpenBB table format
 *   { items/results/history/... }  → unwrap first array field
 *
 * Each row is also flattened one level deep so nested objects
 * (e.g. income_statement, balance_sheet) become top-level columns.
 */
export function normalizeTableRows(response) {
  if (!response) return [];

  let rows = [];

  // Direct array of objects
  if (Array.isArray(response)) {
    rows = response.filter(r => r && typeof r === 'object');
  }

  // { columns, data } — OpenBB table format (2D array)
  else if (Array.isArray(response.columns) && Array.isArray(response.data)) {
    rows = response.data.map(row => {
      const obj = {};
      row.forEach((v, i) => { obj[response.columns[i]] = v ?? ''; });
      return obj;
    });
  }

  // { data: [ objects ] } — not Plotly (no type field)
  else if (Array.isArray(response.data) && response.data[0] && typeof response.data[0].type !== 'string') {
    rows = response.data.filter(r => r && typeof r === 'object');
  }

  else {
    // Try common wrapping keys in priority order
    for (const path of ['items', 'results', 'history', 'holdings', 'rows', 'records', 'periods']) {
      if (Array.isArray(response[path])) {
        rows = response[path].filter(r => r && typeof r === 'object');
        break;
      }
    }

    // Last resort: pick first array-valued property
    if (!rows.length) {
      for (const val of Object.values(response)) {
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
          rows = val;
          break;
        }
      }
    }
  }

  // Flatten one level of nesting (e.g. income_statement.revenue → revenue)
  return rows.map(flattenRow);
}

/**
 * Auto-generate CommonTable column definitions from row objects.
 * Infers formatter and alignment from column names + sample values.
 *
 * Mirrors OpenBB Table's runtime type detection.
 */
/**
 * Build CommonChart-compatible { xKey, series } spec from row objects.
 * Auto-detects the x-axis (first date or string column) and all numeric y-series.
 */
export function buildChartFromRows(rows) {
  if (!rows?.length) return null;

  const keys = Object.keys(rows[0]);

  // x-axis: first date column, then first string column, else first key
  const xKey =
    keys.find(k => inferType(k, sampleValues(rows, k)) === 'date') ||
    keys.find(k => typeof rows[0][k] === 'string') ||
    keys[0];

  // y-series: all numeric columns except xKey
  const yKeys = keys.filter(k => {
    if (k === xKey) return false;
    return sampleValues(rows, k).some(v => typeof v === 'number');
  });

  if (!yKeys.length) return null;

  const series = yKeys.map(k => ({ key: k, name: toTitleCase(k) }));
  return { xKey, series };
}

function isPrimitive(v) {
  return v === null || v === undefined || typeof v !== 'object';
}

export function autoColumns(rows) {
  if (!rows?.length) return [];

  // Skip columns whose values are objects or arrays (not renderable as-is)
  const renderableKeys = Object.keys(rows[0]).filter(key => {
    const samples = sampleValues(rows, key);
    return samples.length === 0 || samples.some(isPrimitive);
  });

  return renderableKeys.map(key => {
    const samples = sampleValues(rows, key).filter(isPrimitive);
    const type    = inferType(key, samples);

    const col = { key, header: toTitleCase(key), sortable: true };

    switch (type) {
      case 'date':
        col.formatter = 'date';
        break;
      case 'percent':
        col.formatter  = 'percent';
        col.align      = 'right';
        col.renderFn   = 'greenRed';
        break;
      case 'magnitude':
        col.formatter = 'magnitude';
        col.align     = 'right';
        break;
      case 'number':
        col.formatter = 'number';
        col.align     = 'right';
        break;
      default:
        break;
    }

    return col;
  });
}
