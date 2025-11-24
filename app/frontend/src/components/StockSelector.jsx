import { useState } from 'react';
import { Search, TrendingUp } from 'lucide-react';

const POPULAR_STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Cyclical' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology' },
  { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Automotive' },
  { symbol: 'META', name: 'Meta Platforms Inc.', sector: 'Technology' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financial' },
  { symbol: 'V', name: 'Visa Inc.', sector: 'Financial' },
  { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Defensive' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare' },
  { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumer Defensive' },
  { symbol: 'BAC', name: 'Bank of America', sector: 'Financial' },
  { symbol: 'MA', name: 'Mastercard Inc.', sector: 'Financial' },
  { symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Entertainment' },
  { symbol: 'DIS', name: 'Walt Disney Co.', sector: 'Entertainment' },
  { symbol: 'INTC', name: 'Intel Corporation', sector: 'Technology' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology' },
  { symbol: 'PYPL', name: 'PayPal Holdings', sector: 'Financial' },
  { symbol: 'ADBE', name: 'Adobe Inc.', sector: 'Technology' },
];

const StockSelector = ({ onSelect }) => {
  const [activeTab, setActiveTab] = useState('popular');
  const [customSymbol, setCustomSymbol] = useState('');
  const [filter, setFilter] = useState('');

  const handleSelectStock = (stock) => {
    onSelect(stock);
  };

  const handleAddCustom = (e) => {
    e.preventDefault();
    if (customSymbol.trim()) {
      onSelect({
        symbol: customSymbol.toUpperCase(),
        name: customSymbol.toUpperCase(),
        sector: 'Custom'
      });
      setCustomSymbol('');
    }
  };

  const filteredStocks = filter
    ? POPULAR_STOCKS.filter(stock =>
        stock.symbol.toLowerCase().includes(filter.toLowerCase()) ||
        stock.name.toLowerCase().includes(filter.toLowerCase())
      )
    : POPULAR_STOCKS;

  return (
    <div className="space-y-4">

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-800">
        <button
          onClick={() => setActiveTab('popular')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'popular'
              ? 'text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Popular Stocks
          {activeTab === 'popular' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'custom'
              ? 'text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Custom Symbol
          {activeTab === 'custom' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
          )}
        </button>
      </div>

      {activeTab === 'popular' ? (
        <div>
          {/* Filter */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter stocks..."
                className="w-full pl-10 pr-4 py-2 bg-[#0d0d0d] border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Stock Grid */}
          <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
            {filteredStocks.map((stock) => (
              <button
                key={stock.symbol}
                onClick={() => handleSelectStock(stock)}
                className="p-4 bg-[#0d0d0d] border border-gray-700 rounded-lg hover:border-blue-500 hover:bg-gray-800/50 transition-all text-left group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="font-bold text-white text-lg">{stock.symbol}</div>
                  <div className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                    {stock.sector}
                  </div>
                </div>
                <div className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                  {stock.name}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <form onSubmit={handleAddCustom} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Enter Stock Symbol
            </label>
            <input
              type="text"
              value={customSymbol}
              onChange={(e) => setCustomSymbol(e.target.value.toUpperCase())}
              placeholder="e.g., AAPL, TSLA, MSFT"
              className="w-full px-4 py-3 bg-[#0d0d0d] border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <p className="mt-2 text-xs text-gray-400">
              Enter any valid stock ticker symbol to add it to your dashboard
            </p>
          </div>
          <button
            type="submit"
            disabled={!customSymbol.trim()}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded font-medium transition-colors"
          >
            Add Widget
          </button>
        </form>
      )}
    </div>
  );
};

export default StockSelector;
