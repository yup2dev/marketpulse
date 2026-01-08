/**
 * 관심종목 페이지
 */
import WatchlistWidget from '../components/watchlist/WatchlistWidget';

export default function WatchlistPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">관심종목</h1>
          <p className="text-gray-600">
            관심 있는 종목을 추적하고 실시간 변화를 확인하세요
          </p>
        </div>

        <WatchlistWidget />
      </div>
    </div>
  );
}
