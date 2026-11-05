/**
 * BaseWidget — 모든 위젯의 껍데기 (헤더 + 필터 줄 + 본문 + 출처).
 *
 * 헤더 순서는 고정이다. 위젯이 순서를 바꾸지 않는다.
 *
 *   [⠿][아이콘] 제목 · titleSuffix  [심볼]  ……  [기간][headerExtra][보기][provider][Run] ⟳ ⋯ ✕
 *
 * - 보기(view): 표/선/막대… 를 하나의 드롭다운으로 고른다 (viewOptions). 예전의
 *   차트/표 토글 + 차트형 아이콘 6개를 대신한다.
 * - ⋯ 메뉴: 내보내기·위젯 연동처럼 자주 안 쓰는 동작.
 * - filters: 위젯 필터는 본문에 그리지 말고 여기로 넘긴다 → 헤더 아래 FilterBar.
 * - state: 데이터를 못 보여 줄 때 { kind, … } 를 넘기면 본문 대신 WidgetState 를 그린다.
 * - 위젯 폭이 좁으면(COMPACT_WIDTH) 보기·provider 선택을 ⋯ 메뉴 안으로 접는다.
 */
import { useState, useRef, useEffect } from 'react';
import { GripVertical, X, RefreshCw, ChevronDown, Search, Database, FileDown, FileSpreadsheet, Image, Link2, Link2Off, Play, Check } from 'lucide-react';
import { apiClient, API_BASE } from '../../../config/api';
import { downloadCSV, downloadExcel, downloadChartPNG, makeFilename } from '../../../utils/exportUtils';
import { useWidgetSync } from '../../../contexts/WidgetSyncContext';
import { Select, PeriodSelect, OverflowMenu, FilterBar, WidgetState } from '../ui';

// 이 폭보다 좁으면 보기·provider 선택을 ⋯ 메뉴로 접는다 (헤더가 제목을 밀어내지 않게)
const COMPACT_WIDTH = 460;

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
      // apiClient는 Bearer 토큰을 붙이고 401 시 refresh를 처리한다. raw fetch를 쓰면
      // 인증 게이트(AuthGateMiddleware)에서 401이 나 결과가 조용히 비어버린다.
      const data = await apiClient.get(`${API_BASE}/stock/search?query=${encodeURIComponent(query)}&limit=8`);
      setResults(data.results || data || []);
    } catch {
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

  // 자유 입력 통과: DB 유니버스에 없는 심볼(OTC ADR, 'KRX:005930' 같은
  // TradingView 표기 등)도 Enter로 그대로 사용할 수 있게 한다.
  const freeText = search.trim().toUpperCase();
  const hasExactMatch = results.some(r => (r.symbol || r) === freeText);
  const submitFreeText = () => {
    if (freeText) selectSymbol(freeText);
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
                onKeyDown={(e) => { if (e.key === 'Enter') submitFreeText(); }}
                placeholder="Search or type symbol..."
                className="flex-1 bg-transparent text-xs text-white outline-none placeholder-gray-500"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="p-3 text-center text-xs text-gray-500">Searching...</div>
            ) : (
              <>
                {results.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => selectSymbol(item.symbol || item)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-800 transition-colors flex items-center justify-between"
                  >
                    <span className="text-xs text-white font-medium">{item.symbol || item}</span>
                    <span className="text-[10px] text-gray-500 truncate ml-2 max-w-[100px]">{item.name || ''}</span>
                  </button>
                ))}
                {freeText && !hasExactMatch && (
                  <button
                    onClick={submitFreeText}
                    className="w-full px-3 py-2 text-left hover:bg-gray-800 transition-colors flex items-center justify-between border-t border-gray-800"
                  >
                    <span className="text-xs text-cyan-400 font-medium">Use “{freeText}”</span>
                    <span className="text-[10px] text-gray-500 ml-2">직접 입력</span>
                  </button>
                )}
                {!search && results.length === 0 && (
                  <div className="p-3 text-center text-xs text-gray-500">Type to search</div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// provider 옵션 → Select 옵션. 키가 없으면 'Key needed' 를 붙인다 (선택은 허용 — 서버가 안내를 돌려준다).
function providerSelectOptions(options) {
  return (options || []).map((o) => ({
    value: o.id,
    label: o.name || o.id,
    note: o.configured === false ? 'Key needed' : undefined,
  }));
}

function useElementWidth(ref) {
  const [width, setWidth] = useState(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

export default function BaseWidget({
  title,
  subtitle,
  titleSuffix,                // 제목 뒤에 붙는 맥락 (예: 'United States', 펀드 이름)
  icon: Icon,
  iconColor = 'text-cyan-400',
  children,
  loading = false,
  onRefresh,
  onRun,
  runLabel = 'Run',
  onRemove,
  // Symbol selector
  symbol,
  onSymbolChange,
  // View (표/선/막대 …) — [{ value, label, icon }]
  view,
  viewOptions,
  onViewChange,
  // Period selector
  period,
  onPeriodChange,
  periodPreset,               // periods.js 프리셋 이름 또는 id 배열
  periodType = 'macro',       // 예전 이름 — periodPreset 이 없을 때 쓴다
  showPeriodSelector = true,
  // Provider selector (data source)
  provider,
  onProviderChange,
  providerOptions,            // [{ id, name, configured }]
  // Source
  source,
  // Custom header content (파라미터 버튼 등)
  headerExtra,
  // 헤더 아래 필터 줄 — node 또는 { left, right }
  filters,
  // 본문 대신 그릴 상태 화면 — { kind, message, provider, onRetry, action }
  state,
  // Export
  exportData,    // () => { columns: [{key,header,exportValue?}], rows: [] }
  chartRef,      // ref to chart container element for PNG export
  // Sync
  syncable = false,  // opt-in: show sync chain icon
}) {
  const rootRef = useRef(null);
  const width = useElementWidth(rootRef);
  const compact = width != null && width < COMPACT_WIDTH;

  // ── Widget Sync ──────────────────────────────────────────────────────────
  const syncCtx = useWidgetSync();
  const [isSynced, setIsSynced] = useState(false);
  // 괄호 주의: `?:` 가 `||` 보다 결합력이 낮아, 괄호가 없으면
  // `symbol ? !!onSymbolChange : (false || …)` 로 묶여 symbol 이 있을 때 period 분기를
  // 아예 보지 않았다. 심볼 핸들러 '또는' 기간 핸들러가 있으면 동기화 가능이 맞다.
  const canSync = syncable && syncCtx && (
    (symbol ? !!onSymbolChange : false) || (period ? !!onPeriodChange : false)
  );

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

  const handleExport = (format) => {
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

  const hasView     = !!(onViewChange && viewOptions?.length > 1);
  const hasProvider = !!(onProviderChange && providerOptions?.length > 1);
  const hasPeriod   = !!(showPeriodSelector && onPeriodChange);
  const provOpts    = hasProvider ? providerSelectOptions(providerOptions) : [];

  // ⋯ 메뉴 — 좁으면 보기·provider 선택도 여기로 접는다
  const menuItems = [];
  if (compact && hasView) {
    menuItems.push({ section: 'View' });
    viewOptions.forEach((o) => menuItems.push({
      label: o.label,
      icon: o.value === view ? Check : o.icon,
      active: o.value === view,
      onClick: () => onViewChange(o.value),
    }));
  }
  if (compact && hasProvider) {
    menuItems.push({ section: 'Data source' });
    provOpts.forEach((o) => menuItems.push({
      label: o.note ? `${o.label} · ${o.note}` : o.label,
      icon: o.value === provider ? Check : undefined,
      active: o.value === provider,
      onClick: () => onProviderChange(o.value),
    }));
  }
  if (exportData || chartRef) {
    if (menuItems.length) menuItems.push({ section: 'Export' });
    if (exportData) {
      menuItems.push({ label: 'Export CSV', icon: FileDown, onClick: () => handleExport('csv') });
      menuItems.push({ label: 'Export Excel (.xlsx)', icon: FileSpreadsheet, onClick: () => handleExport('excel') });
    }
    if (chartRef) menuItems.push({ label: 'Export chart (PNG)', icon: Image, onClick: () => handleExport('png') });
  }
  if (canSync) {
    menuItems.push({
      label: isSynced ? 'Unlink from global sync' : 'Link to global sync',
      icon: isSynced ? Link2 : Link2Off,
      active: isSynced,
      divider: menuItems.length > 0,
      onClick: toggleSync,
    });
  }

  let body;
  if (loading) body = <WidgetState kind="loading" />;
  else if (state) body = <WidgetState {...state} onRetry={state.onRetry ?? onRefresh} />;
  else body = children;

  return (
    <div ref={rootRef} className="widget-surface rounded-lg border widget-border h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b widget-border widget-surface gap-2">
        {/* Left: Drag handle + Title + Symbol */}
        <div className="flex items-center gap-2 cursor-move drag-handle-area flex-1 min-w-0">
          <GripVertical size={14} className="text-gray-600 flex-shrink-0" />
          {Icon && <Icon size={14} className={`${iconColor} flex-shrink-0`} />}
          <div className="min-w-0">
            <span className="text-sm font-medium text-white truncate block">
              {title}
              {titleSuffix && <span className="font-normal text-gray-400"> · {titleSuffix}</span>}
            </span>
            {subtitle && <span className="text-xs text-gray-500 truncate block">{subtitle}</span>}
          </div>
          {symbol && onSymbolChange && (
            <SymbolSelector symbol={symbol} onSymbolChange={handleSymbolChange} />
          )}
        </div>

        {/* Right: Controls (순서 고정) */}
        <div className="flex items-center gap-1 flex-shrink-0" onMouseDown={(e) => e.stopPropagation()}>
          {hasPeriod && (
            <PeriodSelect value={period} onChange={handlePeriodChange} preset={periodPreset || periodType} />
          )}

          {headerExtra}

          {hasView && !compact && (
            <Select value={view} options={viewOptions} onChange={onViewChange} title="View" menuWidth="min-w-[120px]" />
          )}

          {hasProvider && !compact && (
            <Select value={provider} options={provOpts} onChange={onProviderChange} icon={Database} title="Data source" />
          )}

          {onRun && (
            <button
              onClick={onRun}
              disabled={loading}
              className="flex items-center gap-1 h-6 px-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-[11px] font-semibold rounded transition-colors"
              title={runLabel}
            >
              <Play size={11} />
              <span>{loading ? 'Running…' : runLabel}</span>
            </button>
          )}

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

          <OverflowMenu items={menuItems} />

          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
              title="Remove"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <FilterBar filters={filters} />

      {/* Content */}
      <div className="flex-1 overflow-hidden min-h-0 relative widget-content">
        {body}
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
