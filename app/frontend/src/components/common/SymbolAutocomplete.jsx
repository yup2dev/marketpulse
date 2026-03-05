/**
 * SymbolAutocomplete - Inline ticker search input for forms
 * Behaves like a text field but shows a live-search dropdown.
 */
import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { API_BASE } from '../../config/api';

const EXCHANGE_STYLES = {
  NASDAQ:  'bg-purple-900/40 text-purple-300 border-purple-700',
  NYSE:    'bg-cyan-900/40 text-cyan-300 border-cyan-700',
  KOSPI:   'bg-blue-900/40 text-blue-300 border-blue-700',
  KOSDAQ:  'bg-orange-900/40 text-orange-300 border-orange-700',
};

function exchangeLabel(symbol, exchange) {
  if (symbol?.endsWith('.KS')) return 'KOSPI';
  if (symbol?.endsWith('.KQ')) return 'KOSDAQ';
  return exchange;
}

export default function SymbolAutocomplete({ value, onChange, placeholder = 'AAPL', required }) {
  const [query, setQuery]       = useState(value || '');
  const [results, setResults]   = useState([]);
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [selectedName, setSelectedName] = useState('');
  const containerRef = useRef(null);
  const inputRef     = useRef(null);
  const pendingRef   = useRef(null);

  // Sync external value resets (e.g. form reset)
  useEffect(() => {
    if (!value) { setQuery(''); setSelectedName(''); }
  }, [value]);

  // Click-outside closes dropdown
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced search
  useEffect(() => {
    clearTimeout(pendingRef.current);
    if (query.length < 1) { setResults([]); setOpen(false); return; }
    pendingRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/stock/search?query=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setOpen(true);
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    }, 280);
  }, [query]);

  const handleInput = (e) => {
    const v = e.target.value.toUpperCase();
    setQuery(v);
    setSelectedName('');
    onChange(v);
  };

  const handleSelect = (stock) => {
    const sym = stock.symbol.toUpperCase();
    setQuery(sym);
    setSelectedName(stock.name || '');
    setResults([]);
    setOpen(false);
    onChange(sym);
  };

  const handleClear = () => {
    setQuery('');
    setSelectedName('');
    setResults([]);
    setOpen(false);
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={13} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          required={required}
          className="w-full pl-7 pr-7 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors font-mono uppercase"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {selectedName && (
        <div className="text-[10px] text-gray-500 mt-0.5 pl-1 truncate">{selectedName}</div>
      )}

      {open && (
        <div className="absolute z-[200] left-0 right-0 mt-1 bg-[#0d0d12] border border-gray-700 rounded shadow-2xl max-h-52 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-3 text-xs text-gray-500">Searching…</div>
          ) : results.length > 0 ? (
            results.map((s) => {
              const exLabel = exchangeLabel(s.symbol, s.exchange);
              const exStyle = EXCHANGE_STYLES[exLabel] || 'bg-gray-800 text-gray-400 border-gray-700';
              return (
                <button
                  key={s.symbol}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-800 transition-colors border-b border-gray-800/60 last:border-b-0 gap-2"
                >
                  <div className="text-left min-w-0">
                    <div className="text-[12px] font-semibold text-white font-mono">{s.symbol}</div>
                    <div className="text-[10px] text-gray-400 truncate max-w-[200px]">{s.name}</div>
                  </div>
                  {exLabel && (
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap flex-shrink-0 ${exStyle}`}>
                      {exLabel}
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-3 text-xs text-gray-500">No results</div>
          )}
        </div>
      )}
    </div>
  );
}
