/**
 * 관심종목 위젯 컴포넌트
 */
import { useState, useEffect } from 'react';
import { Star, TrendingUp, TrendingDown, Plus, Trash2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { dashboardAPI } from '../lib/api';
import Card from './widgets/common/Card';
import WidgetHeader from './widgets/common/WidgetHeader';

export default function WatchlistWidget({ onRemove }) {
  const [watchlist, setWatchlist] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');

  useEffect(() => {
    loadWatchlist();
  }, []);

  const loadWatchlist = async () => {
    try {
      setIsLoading(true);
      const response = await dashboardAPI.getWatchlist();
      setWatchlist(response.data);
    } catch (error) {
      console.error('Failed to load watchlist:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadWatchlist();
    setIsRefreshing(false);
    toast.success('Watchlist updated');
  };

  const handleAddSymbol = async () => {
    if (!newSymbol.trim()) {
      toast.error('Please enter a stock symbol');
      return;
    }

    try {
      await dashboardAPI.addToWatchlist(newSymbol.toUpperCase());
      toast.success(`${newSymbol.toUpperCase()} added to watchlist`);
      setShowAddModal(false);
      setNewSymbol('');
      loadWatchlist();
    } catch (error) {
      toast.error('Failed to add symbol');
      console.error(error);
    }
  };

  const handleRemoveSymbol = async (symbol) => {
    try {
      await dashboardAPI.removeFromWatchlist(symbol);
      toast.success(`${symbol} removed from watchlist`);
      loadWatchlist();
    } catch (error) {
      toast.error('Failed to remove symbol');
      console.error(error);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <WidgetHeader
        title="Watchlist"
        icon={Star}
        iconColor="text-yellow-500"
        onRemove={onRemove}
      >
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-1 text-gray-400 hover:text-white rounded transition-colors disabled:opacity-50"
          title="Refresh watchlist"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={() => setShowAddModal(true)}
          className="p-1 text-blue-400 hover:text-blue-300 rounded transition-colors"
          title="Add stock"
        >
          <Plus size={14} />
        </button>
      </WidgetHeader>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) :
        watchlist.length === 0 ? (
          <div className="text-center py-8">
            <Star className="mx-auto text-gray-400 mb-2" size={32} />
            <p className="text-sm text-gray-500 mb-3">No stocks in watchlist</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Add Stock
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {watchlist.map((item) => (
              <div
                key={item.symbol}
                className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-gray-900">
                        {item.symbol}
                      </span>
                      <span className="text-xs text-gray-600 truncate">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-900">
                        ${item.price?.toFixed(2) || 'N/A'}
                      </span>
                      <div
                        className={`flex items-center gap-1 text-xs font-semibold ${
                          item.change >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {item.change >= 0 ? (
                          <TrendingUp size={12} />
                        ) : (
                          <TrendingDown size={12} />
                        )}
                        <span>
                          {item.change >= 0 ? '+' : ''}
                          {item.change?.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    {item.market_cap && (
                      <div className="text-xs text-gray-500 mt-1">
                        MCap: ${(item.market_cap / 1e9).toFixed(2)}B
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleRemoveSymbol(item.symbol)}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Symbol Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add to Watchlist
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stock Symbol
              </label>
              <input
                type="text"
                placeholder="e.g., AAPL, MSFT, GOOGL"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleAddSymbol()}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAddSymbol}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewSymbol('');
                }}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
