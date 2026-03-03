/**
 * 관심종목 위젯
 * 사용자가 등록한 관심종목 목록 표시
 */
import { useEffect, useState } from 'react';
import { Plus, Star, TrendingUp, TrendingDown, X, Eye } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function WatchlistWidget() {
  const [watchlists, setWatchlists] = useState([]);
  const [selectedWatchlist, setSelectedWatchlist] = useState(null);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadWatchlists();
  }, []);

  useEffect(() => {
    if (selectedWatchlist) {
      loadWatchlistItems(selectedWatchlist.watchlist_id);
    }
  }, [selectedWatchlist]);

  const loadWatchlists = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/watchlist`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const watchlistsData = response.data.data || [];
      setWatchlists(watchlistsData);

      // 첫 번째 관심종목 리스트 자동 선택
      if (watchlistsData.length > 0 && !selectedWatchlist) {
        setSelectedWatchlist(watchlistsData[0]);
      }
    } catch (error) {
      toast.error('관심종목 목록을 불러오지 못했습니다');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadWatchlistItems = async (watchlistId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/watchlist/${watchlistId}/items`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setItems(response.data.data || []);
    } catch (error) {
      toast.error('관심종목 항목을 불러오지 못했습니다');
      console.error(error);
    }
  };

  const handleCreateWatchlist = async (name) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${import.meta.env.VITE_API_URL}/watchlist`,
        { name, description: '' },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('관심종목 리스트가 생성되었습니다');
      loadWatchlists();
    } catch (error) {
      toast.error('관심종목 리스트 생성 실패');
      console.error(error);
    }
  };

  const handleRemoveItem = async (watchlistId, tickerCd) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/watchlist/${watchlistId}/items/${tickerCd}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('종목이 제거되었습니다');
      loadWatchlistItems(watchlistId);
    } catch (error) {
      toast.error('종목 제거 실패');
      console.error(error);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Star className="text-yellow-500 fill-yellow-500" size={20} />
            <h3 className="text-lg font-semibold text-gray-900">관심종목</h3>
          </div>
          <button
            onClick={() => {
              const name = prompt('관심종목 리스트 이름을 입력하세요');
              if (name) handleCreateWatchlist(name);
            }}
            className="p-2 hover:bg-white rounded-lg transition-colors"
          >
            <Plus size={18} className="text-gray-600" />
          </button>
        </div>

        {/* Watchlist Tabs */}
        {watchlists.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {watchlists.map((wl) => (
              <button
                key={wl.watchlist_id}
                onClick={() => setSelectedWatchlist(wl)}
                className={`px-3 py-1 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedWatchlist?.watchlist_id === wl.watchlist_id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {wl.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Watchlist Items */}
      <div className="p-4">
        {watchlists.length === 0 ? (
          <div className="text-center py-12">
            <Star className="mx-auto text-gray-400 mb-3" size={48} />
            <p className="text-gray-600 mb-4">관심종목 리스트가 없습니다</p>
            <button
              onClick={() => {
                const name = prompt('관심종목 리스트 이름을 입력하세요');
                if (name) handleCreateWatchlist(name);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              리스트 만들기
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">등록된 종목이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.ticker_cd}
                className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors group"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-900">{item.ticker_cd}</p>
                    {item.ticker_name && (
                      <p className="text-sm text-gray-500">{item.ticker_name}</p>
                    )}
                  </div>
                  {item.sector && (
                    <p className="text-xs text-gray-500">{item.sector}</p>
                  )}
                  {item.notes && (
                    <p className="text-xs text-gray-600 mt-1">{item.notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRemoveItem(selectedWatchlist.watchlist_id, item.ticker_cd)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all"
                  >
                    <X size={16} className="text-red-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
