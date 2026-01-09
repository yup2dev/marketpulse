/**
 * 종목 스크리너 위젯
 */
import { useState } from 'react';
import { Search, X, Save, TrendingUp, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { screenerAPI } from '../../lib/api';
import Card from './common/Card';
import WidgetHeader from './common/WidgetHeader';

export default function ScreenerWidget({ symbol, name, onRemove }) {
  const [criteria, setCriteria] = useState({
    min_market_cap: '',
    max_market_cap: '',
    min_pe_ratio: '',
    max_pe_ratio: '',
    min_dividend_yield: '',
    max_dividend_yield: '',
    min_price: '',
    max_price: '',
    sector: '',
  });

  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleInputChange = (field, value) => {
    setCriteria(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleScreen = async () => {
    try {
      setIsLoading(true);
      const response = await screenerAPI.screen(criteria);
      setResults(response.data);
      setShowResults(true);
      toast.success(`Found ${response.data.length} stocks`);
    } catch (error) {
      toast.error('Screening failed');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setCriteria({
      min_market_cap: '',
      max_market_cap: '',
      min_pe_ratio: '',
      max_pe_ratio: '',
      min_dividend_yield: '',
      max_dividend_yield: '',
      min_price: '',
      max_price: '',
      sector: '',
    });
    setResults([]);
    setShowResults(false);
  };

  return (
    <Card className="h-full flex flex-col">
      <WidgetHeader
        title="Stock Screener"
        icon={Search}
        onRemove={onRemove}
      />

      <div className="flex-1 overflow-auto p-4">
        {!showResults ? (
          <div className="space-y-4">
            {/* Market Cap */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Market Cap (M)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={criteria.min_market_cap}
                  onChange={(e) => handleInputChange('min_market_cap', e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={criteria.max_market_cap}
                  onChange={(e) => handleInputChange('max_market_cap', e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* P/E Ratio */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                P/E Ratio
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={criteria.min_pe_ratio}
                  onChange={(e) => handleInputChange('min_pe_ratio', e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={criteria.max_pe_ratio}
                  onChange={(e) => handleInputChange('max_pe_ratio', e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Dividend Yield */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Div Yield (%)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={criteria.min_dividend_yield}
                  onChange={(e) => handleInputChange('min_dividend_yield', e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={criteria.max_dividend_yield}
                  onChange={(e) => handleInputChange('max_dividend_yield', e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Price */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Price ($)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={criteria.min_price}
                  onChange={(e) => handleInputChange('min_price', e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={criteria.max_price}
                  onChange={(e) => handleInputChange('max_price', e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Sector */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Sector
              </label>
              <select
                value={criteria.sector}
                onChange={(e) => handleInputChange('sector', e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Sectors</option>
                <option value="Technology">Technology</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Financial">Financial</option>
                <option value="Consumer">Consumer</option>
                <option value="Industrial">Industrial</option>
                <option value="Energy">Energy</option>
                <option value="Utilities">Utilities</option>
              </select>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleScreen}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-1 bg-blue-600 text-white px-3 py-2 text-sm rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Search size={14} />
                <span>{isLoading ? 'Screening...' : 'Screen'}</span>
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Results ({results.length})
              </h3>
              <button
                onClick={() => setShowResults(false)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Back to Criteria
              </button>
            </div>

            <div className="flex-1 overflow-auto">
              {results.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">No results found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {results.map((stock) => (
                    <div
                      key={stock.symbol}
                      className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <span className="text-sm font-semibold text-gray-900">
                            {stock.symbol}
                          </span>
                          <p className="text-xs text-gray-600">{stock.name}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            ${stock.price?.toFixed(2) || 'N/A'}
                          </div>
                          <div
                            className={`text-xs font-medium ${
                              stock.change >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {stock.change >= 0 ? '+' : ''}
                            {stock.change?.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {stock.market_cap && (
                          <span>MCap: ${(stock.market_cap / 1e9).toFixed(2)}B</span>
                        )}
                        {stock.pe_ratio && <span>P/E: {stock.pe_ratio.toFixed(2)}</span>}
                        {stock.dividend_yield && (
                          <span>Div: {stock.dividend_yield.toFixed(2)}%</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
