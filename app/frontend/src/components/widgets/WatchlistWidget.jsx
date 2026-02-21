import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Star, TrendingUp, TrendingDown, X, Trash2, Search } from 'lucide-react';
import useTheme from '../../hooks/useTheme';
import {
  WidgetHeader,
  LoadingSpinner,
  formatPrice,
  formatNumber,
  API_BASE,
} from './constants';
import { useApi } from '../../hooks/useApi';

/**
 * Watchlist Widget
 * 관심종목 관리 및 실시간 가격 표시
 */
const WatchlistWidget = ({ widgetId, onRemove }) => {
  const { classes, isDark, tokens } = useTheme();
  const { fetchData } = useApi();

  // State
  const [watchlists, setWatchlists] = useState([]);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState(null);
  const [watchlistItems, setWatchlistItems] = useState([]);
  const [priceData, setPriceData] = useState({});
  const [loading, setLoading] = useState(false);
  const [showAddTicker, setShowAddTicker] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Load watchlists on mount
  useEffect(() => {
    loadWatchlists();
  }, []);

  // Load items when watchlist is selected
  useEffect(() => {
    if (selectedWatchlistId) {
      loadWatchlistItems(selectedWatchlistId);
    }
  }, [selectedWatchlistId]);

  // Refresh prices periodically
  useEffect(() => {
    if (watchlistItems.length > 0) {
      const interval = setInterval(() => {
        loadPrices();
      }, 30000); // 30초마다 갱신

      return () => clearInterval(interval);
    }
  }, [watchlistItems]);

  /**
   * Load user's watchlists
   */
  const loadWatchlists = async () => {
    try {
      setLoading(true);
      const response = await fetchData(`${API_BASE}/watchlist`);

      if (response.success && response.data) {
        setWatchlists(response.data);

        // 첫 번째 관심종목 리스트 자동 선택
        if (response.data.length > 0 && !selectedWatchlistId) {
          setSelectedWatchlistId(response.data[0].watchlist_id);
        }
      }
    } catch (error) {
      console.error('Failed to load watchlists:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load watchlist items
   */
  const loadWatchlistItems = async (watchlistId) => {
    try {
      setLoading(true);
      const response = await fetchData(`${API_BASE}/watchlist/${watchlistId}/items`);

      if (response.success && response.data) {
        setWatchlistItems(response.data);

        // Load prices for these tickers
        loadPrices(response.data);
      }
    } catch (error) {
      console.error('Failed to load watchlist items:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load real-time prices for watchlist items
   */
  const loadPrices = async (items = watchlistItems) => {
    if (items.length === 0) return;

    try {
      const tickers = items.map(item => item.ticker_cd).join(',');
      const response = await fetchData(`${API_BASE}/stock/quote?symbols=${tickers}`);

      if (response && response.data) {
        const pricesMap = {};
        response.data.forEach(quote => {
          pricesMap[quote.symbol] = quote;
        });
        setPriceData(pricesMap);
      }
    } catch (error) {
      console.error('Failed to load prices:', error);
    }
  };

  /**
   * Add ticker to watchlist
   */
  const handleAddTicker = async () => {
    if (!newTicker.trim() || !selectedWatchlistId) return;

    try {
      const response = await fetchData(`${API_BASE}/watchlist/${selectedWatchlistId}/items`, {
        method: 'POST',
        body: JSON.stringify({ ticker_cd: newTicker.toUpperCase() })
      });

      if (response.success) {
        setNewTicker('');
        setShowAddTicker(false);
        loadWatchlistItems(selectedWatchlistId);
      }
    } catch (error) {
      console.error('Failed to add ticker:', error);
      alert('Failed to add ticker. Make sure the ticker exists and is not already in the watchlist.');
    }
  };

  /**
   * Remove ticker from watchlist
   */
  const handleRemoveTicker = async (tickerCd) => {
    if (!selectedWatchlistId) return;

    if (!confirm(`Remove ${tickerCd} from watchlist?`)) return;

    try {
      const response = await fetchData(
        `${API_BASE}/watchlist/${selectedWatchlistId}/items/${tickerCd}`,
        { method: 'DELETE' }
      );

      if (response.success) {
        loadWatchlistItems(selectedWatchlistId);
      }
    } catch (error) {
      console.error('Failed to remove ticker:', error);
    }
  };

  /**
   * Create new watchlist
   */
  const handleCreateWatchlist = async () => {
    const name = prompt('Enter watchlist name:');
    if (!name) return;

    try {
      const response = await fetchData(`${API_BASE}/watchlist`, {
        method: 'POST',
        body: JSON.stringify({ name, description: '' })
      });

      if (response.success) {
        loadWatchlists();
        setSelectedWatchlistId(response.data.watchlist_id);
      }
    } catch (error) {
      console.error('Failed to create watchlist:', error);
    }
  };

  /**
   * Get selected watchlist
   */
  const selectedWatchlist = watchlists.find(wl => wl.watchlist_id === selectedWatchlistId);

  /**
   * Calculate change percentage
   */
  const getChangePercent = (ticker) => {
    const price = priceData[ticker];
    if (!price || !price.previousClose || !price.price) return 0;
    return ((price.price - price.previousClose) / price.previousClose) * 100;
  };

  return (
    <div className={`${classes.widget.container} rounded-lg h-full flex flex-col`}>
      <WidgetHeader
        icon={Star}
        iconColor="text-yellow-500"
        title="Watchlist"
        subtitle={selectedWatchlist?.name}
        loading={loading}
        onRefresh={() => loadWatchlistItems(selectedWatchlistId)}
        onRemove={onRemove}
      >
        <button
          onClick={handleCreateWatchlist}
          className={`${classes.button.ghost} p-1.5`}
          title="Create New Watchlist"
        >
          <Plus size={16} />
        </button>
      </WidgetHeader>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Watchlist Selector */}
        {watchlists.length > 1 && (
          <div className={`px-3 py-2 border-b ${classes.widget.header}`}>
            <select
              value={selectedWatchlistId || ''}
              onChange={(e) => setSelectedWatchlistId(e.target.value)}
              className={`w-full ${classes.input.base} text-sm`}
            >
              {watchlists.map(wl => (
                <option key={wl.watchlist_id} value={wl.watchlist_id}>
                  {wl.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Add Ticker Section */}
        {showAddTicker && (
          <div className={`px-3 py-2 border-b ${classes.widget.header}`}>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTicker()}
                placeholder="Enter ticker (e.g., AAPL)"
                className={`flex-1 ${classes.input.base} text-sm`}
                autoFocus
              />
              <button
                onClick={handleAddTicker}
                className={`${classes.button.primary} px-3 py-1 text-sm`}
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddTicker(false);
                  setNewTicker('');
                }}
                className={`${classes.button.ghost} px-2 py-1`}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Watchlist Items */}
        <div className="flex-1 overflow-y-auto">
          {loading && watchlistItems.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <LoadingSpinner size={24} />
            </div>
          ) : watchlistItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <Star size={32} className="mb-2 opacity-50" />
              <p className="text-sm">No stocks in this watchlist</p>
              <button
                onClick={() => setShowAddTicker(true)}
                className={`${classes.button.primary} mt-3 px-4 py-1 text-sm`}
              >
                Add Stock
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {watchlistItems.map((item) => {
                const price = priceData[item.ticker_cd];
                const changePercent = getChangePercent(item.ticker_cd);
                const isPositive = changePercent >= 0;

                return (
                  <div
                    key={item.item_id}
                    className={`px-3 py-2 hover:bg-gray-800/50 transition-colors group`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">
                            {item.ticker_cd}
                          </span>
                          <span className="text-xs text-gray-500 truncate">
                            {item.ticker_name || ''}
                          </span>
                        </div>
                        {item.sector && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {item.sector}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {price ? (
                          <>
                            <div className="text-right">
                              <div className="font-semibold text-white">
                                ${formatPrice(price.price)}
                              </div>
                              <div className={`text-xs flex items-center gap-1 ${
                                isPositive ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {isPositive ? (
                                  <TrendingUp size={12} />
                                ) : (
                                  <TrendingDown size={12} />
                                )}
                                {formatNumber(Math.abs(changePercent), 2)}%
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveTicker(item.ticker_cd)}
                              className={`${classes.button.ghost} p-1 opacity-0 group-hover:opacity-100 transition-opacity`}
                              title="Remove"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : (
                          <div className="text-sm text-gray-500">Loading...</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add Button (Bottom) */}
        {!showAddTicker && watchlistItems.length > 0 && (
          <div className={`px-3 py-2 border-t ${classes.widget.header}`}>
            <button
              onClick={() => setShowAddTicker(true)}
              className={`w-full ${classes.button.ghost} py-2 text-sm flex items-center justify-center gap-2`}
            >
              <Plus size={16} />
              Add Stock
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WatchlistWidget;
