import React, { useState } from 'react';
import { X, Plus, DollarSign } from 'lucide-react';
import TickerSearch from '../TickerSearch';
import { INPUT_CLASSES } from '../../styles/designTokens';

/**
 * PortfolioStockSelector - Stock selector with weights management
 * Used in ConfigPanel for backtest configuration
 */
const PortfolioStockSelector = ({
  selectedStocks = [],
  onAdd,
  onRemove,
  showWeights = false,
  onWeightChange,
  maxStocks = 20
}) => {
  const [showSearch, setShowSearch] = useState(false);

  const handleStockSelect = (stock) => {
    if (selectedStocks.length >= maxStocks) {
      alert(`Maximum ${maxStocks} stocks allowed`);
      return;
    }

    // Check if already added
    if (selectedStocks.find(s => s.symbol === stock.symbol)) {
      alert(`${stock.symbol} is already in your portfolio`);
      return;
    }

    onAdd(stock);
    setShowSearch(false);
  };

  const handleWeightChange = (symbol, newWeight) => {
    const weight = parseFloat(newWeight) || 0;
    if (weight < 0 || weight > 100) {
      return;
    }
    onWeightChange(symbol, weight);
  };

  const totalWeight = selectedStocks.reduce((sum, s) => sum + (s.weight || 0), 0);

  return (
    <div className="space-y-3">
      {/* Add Stock Button */}
      {!showSearch && (
        <button
          onClick={() => setShowSearch(true)}
          disabled={selectedStocks.length >= maxStocks}
          className="w-full px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg
                     border border-gray-700 hover:border-gray-600 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          Add Stock ({selectedStocks.length}/{maxStocks})
        </button>
      )}

      {/* Ticker Search */}
      {showSearch && (
        <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Search for a stock</span>
            <button
              onClick={() => setShowSearch(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <TickerSearch
            onSelect={handleStockSelect}
            placeholder="Enter symbol or company name..."
          />
        </div>
      )}

      {/* Selected Stocks List */}
      {selectedStocks.length > 0 && (
        <div className="space-y-2">
          {selectedStocks.map((stock) => (
            <div
              key={stock.symbol}
              className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700"
            >
              {/* Stock Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{stock.symbol}</span>
                  {stock.name && stock.name !== stock.symbol && (
                    <span className="text-xs text-gray-400 truncate">{stock.name}</span>
                  )}
                </div>
              </div>

              {/* Weight Input (if enabled) */}
              {showWeights && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={stock.weight || 0}
                    onChange={(e) => handleWeightChange(stock.symbol, e.target.value)}
                    className={`${INPUT_CLASSES.default} w-20 text-right`}
                  />
                  <span className="text-sm text-gray-400">%</span>
                </div>
              )}

              {/* Remove Button */}
              <button
                onClick={() => onRemove(stock.symbol)}
                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                title="Remove stock"
              >
                <X size={16} />
              </button>
            </div>
          ))}

          {/* Total Weight Display */}
          {showWeights && selectedStocks.length > 0 && (
            <div className={`p-3 rounded-lg border ${
              Math.abs(totalWeight - 100) < 0.1
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-yellow-500/10 border-yellow-500/30'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Total Weight:</span>
                <span className={`text-sm font-semibold ${
                  Math.abs(totalWeight - 100) < 0.1 ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {totalWeight.toFixed(2)}%
                </span>
              </div>
              {Math.abs(totalWeight - 100) >= 0.1 && (
                <p className="text-xs text-yellow-400 mt-1">
                  Weights must sum to 100% to run backtest
                </p>
              )}
            </div>
          )}

          {/* Equal Weight Button */}
          {showWeights && selectedStocks.length > 0 && (
            <button
              onClick={() => {
                const equalWeight = 100 / selectedStocks.length;
                selectedStocks.forEach(stock => {
                  onWeightChange(stock.symbol, equalWeight);
                });
              }}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
            >
              Set Equal Weights ({(100 / selectedStocks.length).toFixed(2)}% each)
            </button>
          )}
        </div>
      )}

      {/* Empty State */}
      {selectedStocks.length === 0 && !showSearch && (
        <div className="p-6 text-center text-gray-500 bg-gray-800/50 rounded-lg border border-gray-700 border-dashed">
          <DollarSign className="mx-auto mb-2 opacity-50" size={32} />
          <p className="text-sm">No stocks added yet</p>
          <p className="text-xs mt-1">Click "Add Stock" to get started</p>
        </div>
      )}
    </div>
  );
};

export default PortfolioStockSelector;
