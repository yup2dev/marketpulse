import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import TickerSearch from '../common/TickerSearch';

const PortfolioStockSelector = ({
  selectedStocks = [],
  onAdd,
  onRemove,
  showWeights = false,
  onWeightChange,
  maxStocks = 20
}) => {
  const [showSearch, setShowSearch] = useState(false);

  const handleSelect = (stock) => {
    if (selectedStocks.length >= maxStocks) {
      alert(`최대 ${maxStocks}개 종목까지 추가할 수 있습니다`);
      return;
    }
    if (selectedStocks.find(s => s.symbol === stock.symbol)) {
      alert(`${stock.symbol}은(는) 이미 추가되었습니다`);
      return;
    }
    onAdd(stock);
    setShowSearch(false);
  };

  const handleWeightChange = (symbol, raw) => {
    const w = parseFloat(raw);
    if (!isNaN(w) && w >= 0 && w <= 100) {
      onWeightChange(symbol, w);
    }
  };

  const totalWeight = selectedStocks.reduce((sum, s) => sum + (s.weight || 0), 0);
  const weightOk = Math.abs(totalWeight - 100) < 0.5;

  return (
    <div className="space-y-2">

      {/* Add button / search */}
      {!showSearch ? (
        <button
          onClick={() => setShowSearch(true)}
          disabled={selectedStocks.length >= maxStocks}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-900 border border-gray-700 hover:border-gray-600 hover:bg-gray-800 text-gray-300 text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={14} />
          <span>종목 추가 ({selectedStocks.length}/{maxStocks})</span>
        </button>
      ) : (
        <div className="p-3 bg-gray-900 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">종목 검색</span>
            <button onClick={() => setShowSearch(false)} className="text-gray-500 hover:text-white">
              <X size={14} />
            </button>
          </div>
          <TickerSearch onSelect={handleSelect} placeholder="티커 또는 회사명 검색..." />
        </div>
      )}

      {/* Stock list */}
      {selectedStocks.length > 0 && (
        <div className="space-y-1.5">
          {selectedStocks.map(stock => (
            <div
              key={stock.symbol}
              className="flex items-center gap-2 p-2.5 bg-gray-900 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-white">{stock.symbol}</span>
              </div>

              {showWeights && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={stock.weight?.toFixed(1) ?? 0}
                    onChange={(e) => handleWeightChange(stock.symbol, e.target.value)}
                    className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-right text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-xs text-gray-500">%</span>
                </div>
              )}

              <button
                onClick={() => onRemove(stock.symbol)}
                className="p-1 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          ))}

          {/* Weight summary + equal-weight button */}
          {showWeights && (
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
              weightOk
                ? 'bg-green-500/10 border border-green-800/50 text-green-400'
                : 'bg-yellow-500/10 border border-yellow-800/50 text-yellow-400'
            }`}>
              <span>합계: {totalWeight.toFixed(1)}%</span>
              <button
                onClick={() => {
                  const eq = parseFloat((100 / selectedStocks.length).toFixed(4));
                  selectedStocks.forEach(s => onWeightChange(s.symbol, eq));
                }}
                className="text-[10px] underline underline-offset-2 opacity-80 hover:opacity-100"
              >
                균등 분배
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {selectedStocks.length === 0 && !showSearch && (
        <div className="py-6 text-center text-gray-600 text-xs">
          종목을 추가하거나 포트폴리오를 불러오세요
        </div>
      )}
    </div>
  );
};

export default PortfolioStockSelector;
