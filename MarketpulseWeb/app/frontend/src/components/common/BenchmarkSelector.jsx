import React, { useState } from 'react';
import { TrendingUp, ChevronDown, Search, X } from 'lucide-react';
import { INPUT_CLASSES, CARD_CLASSES } from '../../styles/designTokens';

/**
 * BenchmarkSelector - Benchmark selection component with search
 */
const BenchmarkSelector = ({
  value,
  onChange,
  benchmarks = [
    { symbol: 'SPY', name: 'S&P 500', description: 'Large-cap US stocks' },
    { symbol: 'QQQ', name: 'Nasdaq 100', description: 'Technology-focused index' },
    { symbol: 'DIA', name: 'Dow Jones', description: '30 blue-chip US stocks' },
    { symbol: 'IWM', name: 'Russell 2000', description: 'Small-cap US stocks' },
    { symbol: 'VTI', name: 'Total Stock Market', description: 'Entire US market' },
    { symbol: 'EFA', name: 'EAFE', description: 'Developed markets ex-US' },
    { symbol: 'AGG', name: 'Aggregate Bond', description: 'US bond market' },
    { symbol: 'GLD', name: 'Gold', description: 'Gold commodity' },
  ],
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedBenchmark = benchmarks.find(b => b.symbol === value) || benchmarks[0];

  const filteredBenchmarks = benchmarks.filter(b =>
    b.symbol.toLowerCase().includes(search.toLowerCase()) ||
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (symbol) => {
    onChange(symbol);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm text-gray-400 mb-1.5">
        <TrendingUp className="inline mr-1" size={14} />
        Benchmark
      </label>

      {/* Selected value display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white hover:border-gray-600 transition-all flex items-center justify-between"
      >
        <div className="text-left">
          <div className="font-semibold">{selectedBenchmark.symbol}</div>
          <div className="text-xs text-gray-400">{selectedBenchmark.name}</div>
        </div>
        <ChevronDown className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} size={16} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown content */}
          <div className={`absolute top-full left-0 right-0 mt-2 ${CARD_CLASSES.default} z-50 max-h-96 overflow-y-auto`}>
            {/* Search */}
            <div className="sticky top-0 bg-[#161b22] pb-3 border-b border-gray-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search benchmarks..."
                  className="w-full pl-10 pr-8 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm"
                  onClick={(e) => e.stopPropagation()}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-1 mt-2">
              {filteredBenchmarks.map((benchmark) => (
                <button
                  key={benchmark.symbol}
                  onClick={() => handleSelect(benchmark.symbol)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
                    value === benchmark.symbol
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-800 text-gray-300'
                  }`}
                >
                  <div className="font-semibold">{benchmark.symbol}</div>
                  <div className="text-xs opacity-75">{benchmark.name}</div>
                  <div className="text-xs opacity-60 mt-0.5">{benchmark.description}</div>
                </button>
              ))}

              {filteredBenchmarks.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No benchmarks found
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BenchmarkSelector;
