/**
 * Compact Widget Container - Dense information display
 * Reusable wrapper for all widgets with minimal padding
 */
import { useState, useRef, useEffect } from 'react';
import { RefreshCw, Maximize2, Minimize2, X, MoreVertical, Copy, Search, ChevronDown } from 'lucide-react';
import { API_BASE } from '../../config/api';

// Quick symbol search component
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
      const res = await fetch(`${API_BASE}/stock/search?q=${encodeURIComponent(query)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || data || []);
      }
    } catch (e) {
      // Fallback to common symbols
      const common = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'TSLA', 'AMZN', 'ARM', 'AMD', 'NFLX'];
      setResults(common.filter(s => s.toLowerCase().includes(query.toLowerCase())).map(s => ({ symbol: s, name: s })));
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
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 bg-cyan-900/30 text-[10px] text-cyan-400 border border-cyan-800/50 rounded px-1.5 py-0.5 hover:bg-cyan-900/50 transition-colors"
      >
        <span className="font-medium">{symbol}</span>
        <ChevronDown size={10} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-[#1a1a1f] border border-gray-700 rounded shadow-xl z-50">
          <div className="p-1.5 border-b border-gray-700">
            <div className="flex items-center gap-1.5 bg-gray-800 rounded px-2 py-1">
              <Search size={10} className="text-gray-500" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search symbol..."
                className="flex-1 bg-transparent text-[10px] text-white outline-none placeholder-gray-500"
              />
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {loading ? (
              <div className="p-2 text-center text-[10px] text-gray-500">Searching...</div>
            ) : results.length > 0 ? (
              results.map((item, i) => (
                <button
                  key={i}
                  onClick={() => selectSymbol(item.symbol || item)}
                  className="w-full px-2 py-1.5 text-left hover:bg-gray-800 transition-colors flex items-center justify-between"
                >
                  <span className="text-[10px] text-white font-medium">{item.symbol || item}</span>
                  <span className="text-[9px] text-gray-500 truncate ml-2 max-w-[80px]">{item.name || ''}</span>
                </button>
              ))
            ) : search ? (
              <div className="p-2 text-center text-[10px] text-gray-500">No results</div>
            ) : (
              <div className="p-2 text-center text-[10px] text-gray-500">Type to search</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CompactWidget({
  title,
  symbol,
  onSymbolChange,
  children,
  onRefresh,
  onClose,
  onExpand,
  loading = false,
  className = '',
  headerExtra,
  noPadding = false,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleExpand = () => {
    setIsExpanded(!isExpanded);
    onExpand?.(!isExpanded);
  };

  return (
    <div className={`bg-[#0d0d12] border border-gray-800 rounded flex flex-col h-full ${className}`}>
      {/* Compact Header - drag-handle-area for GridLayout */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-800 bg-[#101016] drag-handle-area cursor-move">
        <div className="flex items-center gap-2">
          <RefreshCw
            size={12}
            className={`text-gray-500 ${loading ? 'animate-spin' : 'cursor-pointer hover:text-white'}`}
            onClick={() => !loading && onRefresh?.()}
          />
          <span className="text-xs font-medium text-white">{title}</span>
          {symbol && onSymbolChange && (
            <SymbolSelector symbol={symbol} onSymbolChange={onSymbolChange} />
          )}
          {headerExtra}
        </div>
        <div className="flex items-center gap-0.5">
          <button className="p-1 text-gray-500 hover:text-white rounded hover:bg-gray-800">
            <Copy size={11} />
          </button>
          <button className="p-1 text-gray-500 hover:text-white rounded hover:bg-gray-800">
            <MoreVertical size={11} />
          </button>
          <button
            className="p-1 text-gray-500 hover:text-white rounded hover:bg-gray-800"
            onClick={handleExpand}
          >
            {isExpanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>
          {onClose && (
            <button
              className="p-1 text-gray-500 hover:text-red-400 rounded hover:bg-gray-800"
              onClick={onClose}
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-auto ${noPadding ? '' : 'p-2'}`}>
        {children}
      </div>
    </div>
  );
}

/**
 * Compact Table Component for dense data display
 */
export function CompactTable({ columns, data, onRowClick, loading = false }) {
  if (loading) {
    return (
      <div className="space-y-1">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-6 bg-gray-800/50 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <span className="text-[10px]">No results found</span>
      </div>
    );
  }

  return (
    <table className="w-full text-[11px]">
      <thead className="sticky top-0 bg-[#0a0a0f]">
        <tr>
          {columns.map((col, i) => (
            <th
              key={i}
              className={`py-1.5 px-2 text-gray-500 font-medium border-b border-gray-800 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
              style={{ width: col.width }}
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, rowIdx) => (
          <tr
            key={rowIdx}
            className={`border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
            onClick={() => onRowClick?.(row)}
          >
            {columns.map((col, colIdx) => (
              <td
                key={colIdx}
                className={`py-1.5 px-2 ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.className || ''}`}
              >
                {col.render ? col.render(row[col.key], row) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Value display with color based on positive/negative
 */
export function ColoredValue({ value, format = 'number', prefix = '', suffix = '', neutral = false }) {
  if (value === null || value === undefined || value === '-') {
    return <span className="text-gray-500">-</span>;
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  const isPositive = numValue >= 0;
  const color = neutral ? 'text-white' : (isPositive ? 'text-green-500' : 'text-red-500');

  let formatted = '';
  switch (format) {
    case 'percent':
      formatted = `${isPositive ? '+' : ''}${numValue.toFixed(2)}%`;
      break;
    case 'currency':
      formatted = `$${Math.abs(numValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      break;
    case 'compact':
      if (Math.abs(numValue) >= 1e12) formatted = `${(numValue / 1e12).toFixed(2)}T`;
      else if (Math.abs(numValue) >= 1e9) formatted = `${(numValue / 1e9).toFixed(2)}B`;
      else if (Math.abs(numValue) >= 1e6) formatted = `${(numValue / 1e6).toFixed(2)}M`;
      else if (Math.abs(numValue) >= 1e3) formatted = `${(numValue / 1e3).toFixed(2)}K`;
      else formatted = numValue.toFixed(2);
      break;
    default:
      formatted = numValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }

  return <span className={color}>{prefix}{formatted}{suffix}</span>;
}
