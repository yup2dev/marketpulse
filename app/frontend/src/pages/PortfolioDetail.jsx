/**
 * 포트폴리오 상세 페이지
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  Settings,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { portfolioAPI, exportAPI } from '../lib/api';
import AddTransactionModal from '../components/portfolio/AddTransactionModal';
import HoldingsTable from '../components/portfolio/HoldingsTable';
import TransactionsTable from '../components/portfolio/TransactionsTable';
import PortfolioSummaryWidget from '../components/portfolio/PortfolioSummaryWidget';
import AssetAllocationChart from '../components/portfolio/AssetAllocationChart';

export default function PortfolioDetail() {
  const { portfolioId } = useParams();
  const navigate = useNavigate();

  const [portfolio, setPortfolio] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('holdings'); // holdings, transactions
  const [showAddTransaction, setShowAddTransaction] = useState(false);

  useEffect(() => {
    loadPortfolioData();
  }, [portfolioId]);

  const loadPortfolioData = async () => {
    try {
      setIsLoading(true);
      const [portfolioRes, holdingsRes, transactionsRes] = await Promise.all([
        portfolioAPI.getById(portfolioId),
        portfolioAPI.getHoldings(portfolioId),
        portfolioAPI.getTransactions(portfolioId),
      ]);

      setPortfolio(portfolioRes.data);
      setHoldings(holdingsRes.data);
      setTransactions(transactionsRes.data);
    } catch (error) {
      toast.error('데이터 로딩 실패');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTransaction = async (data) => {
    try {
      await portfolioAPI.addTransaction(portfolioId, data);
      toast.success('거래가 추가되었습니다.');
      setShowAddTransaction(false);
      loadPortfolioData();
    } catch (error) {
      toast.error('거래 추가 실패');
      console.error(error);
    }
  };

  const handleExport = async (format) => {
    try {
      let response;
      let filename;

      switch (format) {
        case 'csv':
          response = await exportAPI.portfolioCSV(portfolioId);
          filename = `portfolio_${portfolioId}.csv`;
          break;
        case 'excel':
          response = await exportAPI.portfolioExcel(portfolioId);
          filename = `portfolio_${portfolioId}.xlsx`;
          break;
        case 'pdf':
          response = await exportAPI.portfolioPDF(portfolioId);
          filename = `portfolio_${portfolioId}.pdf`;
          break;
        default:
          return;
      }

      // 파일 다운로드
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('파일이 다운로드되었습니다.');
    } catch (error) {
      toast.error('내보내기 실패');
      console.error(error);
    }
  };

  const handleDeletePortfolio = async () => {
    if (!confirm('정말로 이 포트폴리오를 삭제하시겠습니까?')) {
      return;
    }

    try {
      await portfolioAPI.delete(portfolioId);
      toast.success('포트폴리오가 삭제되었습니다.');
      navigate('/portfolios');
    } catch (error) {
      toast.error('삭제 실패');
      console.error(error);
    }
  };

  // 통계 계산
  const calculateStats = () => {
    if (!holdings || holdings.length === 0) {
      return {
        totalValue: 0,
        totalCost: 0,
        totalPnL: 0,
        totalPnLPct: 0,
      };
    }

    const totalValue = holdings.reduce((sum, h) => sum + (parseFloat(h.market_value) || 0), 0);
    const totalCost = holdings.reduce((sum, h) => sum + (parseFloat(h.total_cost) || 0), 0);
    const totalPnL = totalValue - totalCost;
    const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

    return { totalValue, totalCost, totalPnL, totalPnLPct };
  };

  const stats = calculateStats();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">포트폴리오를 찾을 수 없습니다</h2>
          <button
            onClick={() => navigate('/portfolios')}
            className="text-blue-600 hover:text-blue-700"
          >
            포트폴리오 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/portfolios')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft size={20} />
            <span>포트폴리오 목록</span>
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{portfolio.name}</h1>
              {portfolio.description && (
                <p className="text-gray-600">{portfolio.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Export Menu */}
              <div className="relative group">
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <Download size={18} />
                  <span>내보내기</span>
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <button
                    onClick={() => handleExport('csv')}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-50 first:rounded-t-lg"
                  >
                    CSV로 내보내기
                  </button>
                  <button
                    onClick={() => handleExport('excel')}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-50"
                  >
                    Excel로 내보내기
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-50 last:rounded-b-lg"
                  >
                    PDF로 내보내기
                  </button>
                </div>
              </div>

              <button
                onClick={handleDeletePortfolio}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
              >
                <Trash2 size={18} />
                <span>삭제</span>
              </button>
            </div>
          </div>
        </div>

        {/* Portfolio Summary Widget */}
        <PortfolioSummaryWidget portfolioId={portfolioId} />

        {/* Asset Allocation Chart */}
        <div className="mb-8">
          <AssetAllocationChart portfolioId={portfolioId} />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('holdings')}
                className={`pb-2 border-b-2 transition-colors ${
                  activeTab === 'holdings'
                    ? 'border-blue-600 text-blue-600 font-semibold'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                보유 종목
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`pb-2 border-b-2 transition-colors ${
                  activeTab === 'transactions'
                    ? 'border-blue-600 text-blue-600 font-semibold'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                거래 내역
              </button>
            </div>

            {activeTab === 'holdings' && (
              <button
                onClick={() => setShowAddTransaction(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={18} />
                <span>거래 추가</span>
              </button>
            )}
          </div>

          <div className="p-6">
            {activeTab === 'holdings' ? (
              <HoldingsTable holdings={holdings} />
            ) : (
              <TransactionsTable transactions={transactions} />
            )}
          </div>
        </div>
      </div>

      {/* Add Transaction Modal */}
      {showAddTransaction && (
        <AddTransactionModal
          onClose={() => setShowAddTransaction(false)}
          onAdd={handleAddTransaction}
        />
      )}
    </div>
  );
}
