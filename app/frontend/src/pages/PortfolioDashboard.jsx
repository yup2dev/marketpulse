/**
 * 포트폴리오 대시보드 메인 페이지
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, TrendingUp, TrendingDown, DollarSign, PieChart, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { portfolioAPI } from '../lib/api';
import CreatePortfolioModal from '../components/portfolio/CreatePortfolioModal';

export default function PortfolioDashboard() {
  const navigate = useNavigate();
  const [portfolios, setPortfolios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadPortfolios();
  }, []);

  const loadPortfolios = async () => {
    try {
      setIsLoading(true);
      const response = await portfolioAPI.getAll();
      setPortfolios(response.data);
    } catch (error) {
      toast.error('포트폴리오 로딩 실패');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePortfolio = async (data) => {
    try {
      await portfolioAPI.create(data);
      toast.success('포트폴리오가 생성되었습니다.');
      setShowCreateModal(false);
      loadPortfolios();
    } catch (error) {
      toast.error('포트폴리오 생성 실패');
      console.error(error);
    }
  };

  const calculatePortfolioStats = (portfolio) => {
    // 임시 통계 (실제로는 holdings 데이터로 계산)
    return {
      totalValue: 0,
      totalCost: 0,
      totalPnL: 0,
      totalPnLPct: 0,
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">포트폴리오</h1>
          <p className="text-gray-600">투자 포트폴리오를 관리하고 성과를 추적하세요</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">총 포트폴리오</span>
              <PieChart className="text-blue-600" size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{portfolios.length}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">총 자산</span>
              <DollarSign className="text-green-600" size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-900">$0.00</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">총 수익</span>
              <TrendingUp className="text-green-600" size={20} />
            </div>
            <p className="text-2xl font-bold text-green-600">$0.00</p>
            <p className="text-sm text-green-600">+0.00%</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">총 손실</span>
              <TrendingDown className="text-red-600" size={20} />
            </div>
            <p className="text-2xl font-bold text-red-600">$0.00</p>
            <p className="text-sm text-red-600">-0.00%</p>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">내 포트폴리오</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            <span>새 포트폴리오</span>
          </button>
        </div>

        {/* Portfolio Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : portfolios.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
            <PieChart className="mx-auto text-gray-400 mb-4" size={64} />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              포트폴리오가 없습니다
            </h3>
            <p className="text-gray-600 mb-6">
              첫 번째 포트폴리오를 만들어 투자를 시작하세요
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              포트폴리오 만들기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {portfolios.map((portfolio) => {
              const stats = calculatePortfolioStats(portfolio);
              return (
                <div
                  key={portfolio.portfolio_id}
                  className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/portfolio/${portfolio.portfolio_id}`)}
                >
                  {/* Portfolio Header */}
                  <div className="mb-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {portfolio.name}
                      </h3>
                      {portfolio.is_default && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                          기본
                        </span>
                      )}
                    </div>
                    {portfolio.description && (
                      <p className="text-sm text-gray-600">{portfolio.description}</p>
                    )}
                  </div>

                  {/* Portfolio Stats */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">총 자산</span>
                      <span className="text-sm font-semibold text-gray-900">
                        ${stats.totalValue.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">수익/손실</span>
                      <span
                        className={`text-sm font-semibold ${
                          stats.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        ${stats.totalPnL.toFixed(2)} ({stats.totalPnLPct.toFixed(2)}%)
                      </span>
                    </div>
                  </div>

                  {/* Portfolio Meta */}
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      <span>통화: {portfolio.currency}</span>
                      {portfolio.benchmark && (
                        <span className="ml-3">벤치마크: {portfolio.benchmark}</span>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/portfolio/${portfolio.portfolio_id}`);
                      }}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Eye size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Portfolio Modal */}
      {showCreateModal && (
        <CreatePortfolioModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreatePortfolio}
        />
      )}
    </div>
  );
}
