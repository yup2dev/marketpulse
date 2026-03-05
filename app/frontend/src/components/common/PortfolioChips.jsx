import React from 'react';
import { X, Eye, EyeOff } from 'lucide-react';

/**
 * PortfolioChips - Display selected stocks as colored chips
 */
const PortfolioChips = ({
  stocks = [],
  onRemove,
  onToggleVisibility,
  showStats = false,
  colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'],
  className = ''
}) => {
  if (stocks.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        No stocks selected
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {stocks.map((stock, index) => {
        const color = stock.color || colors[index % colors.length];
        const isVisible = stock.visible !== false;

        return (
          <div
            key={stock.symbol}
            className={`group flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
              isVisible
                ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                : 'bg-gray-900/30 border-gray-800 opacity-50'
            }`}
            style={{
              borderLeftWidth: '3px',
              borderLeftColor: color,
            }}
          >
            {/* Symbol and name */}
            <div className="flex-1">
              <div className="font-semibold text-white text-sm">{stock.symbol}</div>
              {stock.name && (
                <div className="text-xs text-gray-400 truncate max-w-[150px]">
                  {stock.name}
                </div>
              )}
              {showStats && stock.change !== undefined && (
                <div
                  className={`text-xs font-medium ${
                    stock.change >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {stock.change >= 0 ? '+' : ''}
                  {stock.change.toFixed(2)}%
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {onToggleVisibility && (
                <button
                  onClick={() => onToggleVisibility(stock.symbol)}
                  className="p-1 rounded hover:bg-gray-700 transition-colors opacity-70 hover:opacity-100"
                  title={isVisible ? 'Hide from chart' : 'Show in chart'}
                >
                  {isVisible ? (
                    <Eye size={14} className="text-gray-400" />
                  ) : (
                    <EyeOff size={14} className="text-gray-500" />
                  )}
                </button>
              )}

              {onRemove && (
                <button
                  onClick={() => onRemove(stock.symbol)}
                  className="p-1 rounded hover:bg-red-600/20 transition-colors opacity-70 hover:opacity-100"
                  title="Remove stock"
                >
                  <X size={14} className="text-red-400" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PortfolioChips;
