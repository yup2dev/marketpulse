/**
 * Analysis 비교 분석 탭
 */
import { useState } from 'react';
import { GitCompare, Plus, X } from 'lucide-react';
import { useStockContext } from './AnalysisDashboard';
import ChartWidget from '../widgets/ChartWidget';
import StockSelectorModal from '../StockSelectorModal';

export default function AnalysisComparisonTab() {
  const { symbol } = useStockContext();
  const [compareSymbols, setCompareSymbols] = useState([symbol]);
  const [showAddStock, setShowAddStock] = useState(false);

  const handleAddStock = (stock) => {
    if (!compareSymbols.includes(stock.symbol)) {
      setCompareSymbols([...compareSymbols, stock.symbol]);
    }
    setShowAddStock(false);
  };

  const handleRemoveStock = (sym) => {
    if (compareSymbols.length > 1) {
      setCompareSymbols(compareSymbols.filter(s => s !== sym));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitCompare className="text-purple-500" size={28} />
            <div>
              <h2 className="text-xl font-bold text-white">비교 분석</h2>
              <p className="text-gray-400 text-sm mt-0.5">여러 종목을 비교 분석하세요</p>
            </div>
          </div>

          <button
            onClick={() => setShowAddStock(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors text-white"
          >
            <Plus size={18} />
            <span>종목 추가</span>
          </button>
        </div>

        {/* Selected Stocks */}
        <div className="flex flex-wrap gap-2">
          {compareSymbols.map((sym) => (
            <div
              key={sym}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                sym === symbol ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300'
              }`}
            >
              <span className="font-medium">{sym}</span>
              {compareSymbols.length > 1 && (
                <button
                  onClick={() => handleRemoveStock(sym)}
                  className="hover:text-red-400 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Chart Comparison */}
        <div className="bg-[#1a1f2e] rounded-xl border border-gray-700 p-4" style={{ height: '500px' }}>
          <ChartWidget
            widgetId="comparison-chart"
            initialSymbols={compareSymbols}
            onRemove={() => {}}
          />
        </div>
      </div>

      {/* Add Stock Modal */}
      {showAddStock && (
        <StockSelectorModal
          onSelect={handleAddStock}
          onClose={() => setShowAddStock(false)}
        />
      )}
    </div>
  );
}
