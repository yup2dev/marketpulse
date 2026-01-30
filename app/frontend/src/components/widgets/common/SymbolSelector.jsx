/**
 * SymbolSelector - Reusable stock symbol search dropdown
 * Provides auto-complete search with API integration
 */
import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { API_BASE } from '../../../config/api';

/**
 * @param {Object} props
 * @param {string} props.symbol - Current selected symbol
 * @param {Function} props.onSymbolChange - Callback when symbol changes
 * @param {string} props.size - Size variant: 'sm' | 'md' (default: 'sm')
 * @param {string} props.className - Additional CSS classes
 */
const SymbolSelector = ({
  symbol,
  onSymbolChange,
  size = 'sm',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Click outside handler
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
      setResults(
        common
          .filter(s => s.toLowerCase().includes(query.toLowerCase()))
          .map(s => ({ symbol: s, name: s }))
      );
    } finally {
      setLoading(false);
    }
  };

  const selectSymbol = (sym) => {
    onSymbolChange?.(sym);
    setIsOpen(false);
    setSearch('');
    setResults([]);
  };

  // Size variants
  const sizeClasses = {
    sm: {
      button: 'text-[10px] px-1.5 py-0.5',
      icon: 10,
      dropdown: 'w-48',
      input: 'text-[10px]',
      item: 'text-[10px]',
      itemName: 'text-[9px]',
    },
    md: {
      button: 'text-xs px-2 py-1',
      icon: 12,
      dropdown: 'w-56',
      input: 'text-xs',
      item: 'text-xs',
      itemName: 'text-[10px]',
    },
  };

  const s = sizeClasses[size] || sizeClasses.sm;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 bg-cyan-900/30 text-cyan-400 border border-cyan-800/50 rounded hover:bg-cyan-900/50 transition-colors ${s.button}`}
      >
        <span className="font-medium">{symbol}</span>
        <ChevronDown size={s.icon} />
      </button>

      {isOpen && (
        <div className={`absolute top-full left-0 mt-1 ${s.dropdown} bg-[#1a1a1f] border border-gray-700 rounded shadow-xl z-50`}>
          <div className="p-1.5 border-b border-gray-700">
            <div className="flex items-center gap-1.5 bg-gray-800 rounded px-2 py-1">
              <Search size={s.icon} className="text-gray-500" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search symbol..."
                className={`flex-1 bg-transparent text-white outline-none placeholder-gray-500 ${s.input}`}
              />
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {loading ? (
              <div className={`p-2 text-center text-gray-500 ${s.item}`}>Searching...</div>
            ) : results.length > 0 ? (
              results.map((item, i) => (
                <button
                  key={i}
                  onClick={() => selectSymbol(item.symbol || item)}
                  className="w-full px-2 py-1.5 text-left hover:bg-gray-800 transition-colors flex items-center justify-between"
                >
                  <span className={`text-white font-medium ${s.item}`}>{item.symbol || item}</span>
                  <span className={`text-gray-500 truncate ml-2 max-w-[80px] ${s.itemName}`}>
                    {item.name || ''}
                  </span>
                </button>
              ))
            ) : search ? (
              <div className={`p-2 text-center text-gray-500 ${s.item}`}>No results</div>
            ) : (
              <div className={`p-2 text-center text-gray-500 ${s.item}`}>Type to search</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SymbolSelector;
