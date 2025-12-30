import React, { useState } from 'react';
import { Plus, Search, X, DollarSign } from 'lucide-react';
import TickerSearch from '../TickerSearch';
import { INPUT_CLASSES, BUTTON_CLASSES, CARD_CLASSES } from '../../styles/designTokens';

/**
 * StockSelector - Unified stock selection component with search and weight management
 */
const StockSelector = ({
  selectedStocks = [],
  onAdd,
  onRemove,
  maxStocks = 20,
  showWeights = false,
  onWeightChange,
  className = ''
}) => {
  const [showSearch, setShowSearch] = useState(false);

  const handleStockSelect = (stock) => {
    if (selectedStocks.length >= maxStocks) {
      alert(`Maximum ${maxStocks} stocks allowed`);
      return;
    }

    if (selectedStocks.find(s => s.symbol === stock.symbol)) {
      alert('Stock already added');
      return;
    }

    const newStock = {
      symbol: stock.symbol,
      name: stock.name,
      weight: showWeights ? 0 : undefined,
    };

    onAdd(newStock);
    setShowSearch(false);
  };

  const handleWeightChange = (symbol, newWeight) => {
    const weight = parseFloat(newWeight);
    if (isNaN(weight) || weight < 0 || weight > 100) {
      return;
    }
    onWeightChange && onWeightChange(symbol, weight);
  };

  const handleEqualWeights = () => {
    if (!onWeightChange || selectedStocks.length === 0) return;

    const equalWeight = 100 / selectedStocks.length;
    selectedStocks.forEach(stock => {
      onWeightChange(stock.symbol, equalWeight);
    });
  };

  const totalWeight = showWeights
    ? selectedStocks.reduce((sum, stock) => sum + (parseFloat(stock.weight) || 0), 0)
    : 0;

  const isWeightValid = !showWeights || Math.abs(totalWeight - 100) < 0.01;

  return (
    <div className={className}>
      {/* Add stock button */}
      <div className="mb-3">
        <button
          onClick={() => setShowSearch(true)}
          className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          <span>Add Stock ({selectedStocks.length}/{maxStocks})</span>
        </button>
      </div>

      {/* Selected stocks list */}
      {selectedStocks.length > 0 && (
        <div className="space-y-2 mb-3">
          {selectedStocks.map(stock => (
            <div
              key={stock.symbol}
              className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg"
            >
              <div className="flex-1">
                <div className="font-semibold text-white text-sm">{stock.symbol}</div>
                {stock.name && (
                  <div className="text-xs text-gray-400 truncate">{stock.name}</div>
                )}
              </div>

              {showWeights && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={stock.weight || 0}
                    onChange={(e) => handleWeightChange(stock.symbol, e.target.value)}
                    className="w-20 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-gray-400 text-sm">%</span>
                </div>
              )}

              <button
                onClick={() => onRemove(stock.symbol)}
                className="p-1 rounded hover:bg-red-600/20 transition-colors"
              >
                <X size={16} className="text-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Weight summary and equal weight button */}
      {showWeights && selectedStocks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg">
            <span className="text-sm text-gray-400">Total Weight:</span>
            <span className={`text-sm font-semibold ${isWeightValid ? 'text-green-400' : 'text-red-400'}`}>
              {totalWeight.toFixed(2)}% {isWeightValid && '✓'}
            </span>
          </div>

          <button
            onClick={handleEqualWeights}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg hover:bg-gray-700 transition-all text-sm"
          >
            Equal Weight All
          </button>
        </div>
      )}

      {/* Search modal */}
      {showSearch && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
            onClick={() => setShowSearch(false)}
          >
            {/* Modal */}
            <div
              className={`${CARD_CLASSES.default} max-w-2xl w-full max-h-[80vh] overflow-y-auto m-4`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <Search className="text-blue-400" size={20} />
                  <h3 className="text-lg font-semibold text-white">Search Stocks</h3>
                </div>
                <button
                  onClick={() => setShowSearch(false)}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <X className="text-gray-400" size={20} />
                </button>
              </div>

              {/* TickerSearch component */}
              <TickerSearch onStockSelect={handleStockSelect} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StockSelector;
