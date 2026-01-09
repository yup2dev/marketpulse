/**
 * 포트폴리오 위젯
 */
import { useState, useEffect } from 'react';
import { Briefcase, Plus, Eye, TrendingUp, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { portfolioAPI } from '../../lib/api';
import Card from './common/Card';
import WidgetHeader from './common/WidgetHeader';
import { useNavigate } from 'react-router-dom';

export default function PortfolioWidget({ onRemove }) {
  const navigate = useNavigate();
  const [portfolios, setPortfolios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPortfolios();
  }, []);

  const loadPortfolios = async () => {
    try {
      setIsLoading(true);
      const response = await portfolioAPI.getAll();
      setPortfolios(response.data);
    } catch (error) {
      console.error('Failed to load portfolios:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewPortfolio = (portfolioId) => {
    navigate(`/portfolio/${portfolioId}`);
  };

  const calculatePortfolioStats = (portfolio) => {
    return {
      totalValue: 0,
      totalPnL: 0,
      totalPnLPct: 0,
    };
  };

  return (
    <Card className="h-full flex flex-col">
      <WidgetHeader
        title="My Portfolios"
        icon={Briefcase}
        onRemove={onRemove}
      >
        <button
          onClick={() => navigate('/portfolios')}
          className="p-1 text-blue-400 hover:text-blue-300 rounded transition-colors"
          title="View all"
        >
          <Plus size={16} />
        </button>
      </WidgetHeader>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : portfolios.length === 0 ? (
          <div className="text-center py-8">
            <Briefcase className="mx-auto text-gray-400 mb-2" size={32} />
            <p className="text-sm text-gray-500 mb-3">No portfolios yet</p>
            <button
              onClick={() => navigate('/portfolios')}
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Create Portfolio
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {portfolios.map((portfolio) => {
              const stats = calculatePortfolioStats(portfolio);
              return (
                <div
                  key={portfolio.portfolio_id}
                  className="p-3 bg-[#1a1a1a] rounded-lg hover:bg-gray-800 transition-colors cursor-pointer group"
                  onClick={() => handleViewPortfolio(portfolio.portfolio_id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-white truncate">
                          {portfolio.name}
                        </span>
                        {portfolio.is_default && (
                          <span className="bg-blue-900/40 text-blue-300 text-xs px-2 py-0.5 rounded border border-blue-700">
                            Default
                          </span>
                        )}
                      </div>
                      {portfolio.description && (
                        <p className="text-xs text-gray-400 truncate">{portfolio.description}</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewPortfolio(portfolio.portfolio_id);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Eye size={14} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="text-gray-400">
                      ${stats.totalValue.toFixed(2)}
                    </div>
                    <div
                      className={`font-semibold ${
                        stats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {stats.totalPnL >= 0 ? '+' : ''}
                      {stats.totalPnLPct.toFixed(2)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
