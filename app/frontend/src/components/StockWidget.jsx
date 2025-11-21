import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { API_ENDPOINTS } from '../config/api';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

const StockWidget = ({ symbol = 'AAPL' }) => {
  const [currentSymbol, setCurrentSymbol] = useState(symbol);
  const [inputSymbol, setInputSymbol] = useState(symbol);

  const { data: quote, loading, error, refetch } = useApi(
    `http://localhost:8000/api/stock/quote/${currentSymbol}`
  );

  const handleSearch = (e) => {
    e.preventDefault();
    if (inputSymbol.trim()) {
      setCurrentSymbol(inputSymbol.toUpperCase());
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const formatPercent = (value) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className="bg-background-secondary rounded-lg p-6 border border-gray-800">
        <div className="flex items-center justify-center h-48">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-background-secondary rounded-lg p-6 border border-gray-800">
        <div className="text-red-400 text-center">
          <p className="font-semibold mb-2">Error loading data</p>
          <p className="text-sm text-text-tertiary">{error}</p>
          <button
            onClick={refetch}
            className="mt-4 px-4 py-2 bg-primary text-background-primary rounded hover:bg-primary-dark"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isPositive = quote?.changePercent >= 0;

  return (
    <div className="bg-background-secondary rounded-lg p-6 border border-gray-800">
      {/* Header with Search */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-text-primary">Stock Quote</h2>
        <button
          onClick={refetch}
          className="p-2 hover:bg-background-tertiary rounded transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-text-secondary" />
        </button>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputSymbol}
            onChange={(e) => setInputSymbol(e.target.value.toUpperCase())}
            placeholder="Enter symbol (e.g., AAPL)"
            className="flex-1 px-3 py-2 bg-background-tertiary border border-gray-700 rounded text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-background-primary rounded hover:bg-primary-dark transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      {/* Quote Data */}
      {quote ? (
        <div>
          <div className="flex items-baseline gap-3 mb-4">
            <h3 className="text-2xl font-bold text-text-primary">
              {quote.symbol}
            </h3>
            <span className="text-sm text-text-tertiary">{quote.name}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-text-tertiary mb-1">Current Price</p>
              <p className="text-3xl font-bold text-text-primary">
                {formatPrice(quote.price)}
              </p>
            </div>

            <div>
              <p className="text-sm text-text-tertiary mb-1">Change</p>
              <div className="flex items-center gap-2">
                {isPositive ? (
                  <TrendingUp className="w-5 h-5 text-positive" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-negative" />
                )}
                <div>
                  <p
                    className={`text-xl font-bold ${
                      isPositive ? 'text-positive' : 'text-negative'
                    }`}
                  >
                    {formatPrice(quote.change)}
                  </p>
                  <p
                    className={`text-sm ${
                      isPositive ? 'text-positive' : 'text-negative'
                    }`}
                  >
                    {formatPercent(quote.changePercent)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
            <div>
              <p className="text-xs text-text-tertiary mb-1">Open</p>
              <p className="text-sm text-text-primary font-medium">
                {formatPrice(quote.open)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-1">Previous Close</p>
              <p className="text-sm text-text-primary font-medium">
                {formatPrice(quote.previousClose)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-1">Day High</p>
              <p className="text-sm text-text-primary font-medium">
                {formatPrice(quote.dayHigh)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-1">Day Low</p>
              <p className="text-sm text-text-primary font-medium">
                {formatPrice(quote.dayLow)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-1">Volume</p>
              <p className="text-sm text-text-primary font-medium">
                {quote.volume?.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-1">Market Cap</p>
              <p className="text-sm text-text-primary font-medium">
                {quote.marketCap
                  ? `$${(quote.marketCap / 1e9).toFixed(2)}B`
                  : 'N/A'}
              </p>
            </div>
          </div>

          {quote.timestamp && (
            <p className="text-xs text-text-tertiary mt-4 text-center">
              Last updated: {new Date(quote.timestamp).toLocaleString()}
            </p>
          )}
        </div>
      ) : (
        <div className="text-center text-text-tertiary py-8">
          No data available
        </div>
      )}
    </div>
  );
};

export default StockWidget;
