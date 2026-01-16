/**
 * Analysis 대시보드 - Alerts 스타일 탭+위젯 구조
 */
import { useState, useEffect, createContext, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, LayoutDashboard, FileText, Building2, GitCompare, Calendar } from 'lucide-react';
import AnalysisOverviewTab from './AnalysisOverviewTab';
import AnalysisFinancialsTab from './AnalysisFinancialsTab';
import AnalysisInstitutionalTab from './AnalysisInstitutionalTab';
import AnalysisComparisonTab from './AnalysisComparisonTab';
import StockSelectorModal from '../StockSelectorModal';

// Stock Context for sharing selected stock across tabs
const StockContext = createContext(null);
export const useStockContext = () => useContext(StockContext);

const TABS = [
  { id: 'overview', name: '개요', icon: LayoutDashboard },
  { id: 'financials', name: '재무제표', icon: FileText },
  { id: 'institutional', name: '기관 보유', icon: Building2 },
  { id: 'comparison', name: '비교 분석', icon: GitCompare }
];

function AnalysisDashboardContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [symbol, setSymbol] = useState('NVDA');
  const [showStockSelector, setShowStockSelector] = useState(false);

  const activeTab = searchParams.get('tab') || 'overview';

  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId });
  };

  const handleStockSelect = (stock) => {
    setSymbol(stock.symbol);
    setShowStockSelector(false);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <AnalysisOverviewTab />;
      case 'financials':
        return <AnalysisFinancialsTab />;
      case 'institutional':
        return <AnalysisInstitutionalTab />;
      case 'comparison':
        return <AnalysisComparisonTab />;
      default:
        return <AnalysisOverviewTab />;
    }
  };

  return (
    <StockContext.Provider value={{ symbol, setSymbol, setShowStockSelector }}>
      <div className="min-h-screen bg-[#0a0a0f]">
        {/* Header */}
        <div className="bg-[#12121a] border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-600/20 rounded-xl">
                  <BarChart3 className="text-purple-500" size={28} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">종목 분석</h1>
                  <p className="text-gray-400 text-sm mt-1">
                    재무제표, 기관 보유, 비교 분석을 확인하세요
                  </p>
                </div>
              </div>

              {/* Stock Selector Button */}
              <button
                onClick={() => setShowStockSelector(true)}
                className="flex items-center gap-3 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <span className="text-2xl font-bold text-white">{symbol}</span>
                <span className="text-gray-400 text-sm">종목 변경</span>
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 mt-6 -mb-px">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative ${
                      isActive
                        ? 'text-purple-500'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{tab.name}</span>
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-t" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="py-6">
          {renderTabContent()}
        </div>

        {/* Stock Selector Modal */}
        {showStockSelector && (
          <StockSelectorModal
            onSelect={handleStockSelect}
            onClose={() => setShowStockSelector(false)}
          />
        )}
      </div>
    </StockContext.Provider>
  );
}

export default function AnalysisDashboard() {
  return <AnalysisDashboardContent />;
}
/**
 * Analysis 대시보드 - Alerts 스타일 탭+위젯 구조
 */
import { useState, useEffect, createContext, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, LayoutDashboard, FileText, Building2, GitCompare, Calendar } from 'lucide-react';
import AnalysisOverviewTab from './AnalysisOverviewTab';
import AnalysisFinancialsTab from './AnalysisFinancialsTab';
import AnalysisInstitutionalTab from './AnalysisInstitutionalTab';
import AnalysisComparisonTab from './AnalysisComparisonTab';
import StockSelectorModal from '../StockSelectorModal';

// Stock Context for sharing selected stock across tabs
const StockContext = createContext(null);
export const useStockContext = () => useContext(StockContext);

const TABS = [
  { id: 'overview', name: '개요', icon: LayoutDashboard },
  { id: 'financials', name: '재무제표', icon: FileText },
  { id: 'institutional', name: '기관 보유', icon: Building2 },
  { id: 'comparison', name: '비교 분석', icon: GitCompare }
];

function AnalysisDashboardContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [symbol, setSymbol] = useState('NVDA');
  const [showStockSelector, setShowStockSelector] = useState(false);

  const activeTab = searchParams.get('tab') || 'overview';

  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId });
  };

  const handleStockSelect = (stock) => {
    setSymbol(stock.symbol);
    setShowStockSelector(false);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <AnalysisOverviewTab />;
      case 'financials':
        return <AnalysisFinancialsTab />;
      case 'institutional':
        return <AnalysisInstitutionalTab />;
      case 'comparison':
        return <AnalysisComparisonTab />;
      default:
        return <AnalysisOverviewTab />;
    }
  };

  return (
    <StockContext.Provider value={{ symbol, setSymbol, setShowStockSelector }}>
      <div className="min-h-screen bg-[#0a0a0f]">
        {/* Header */}
        <div className="bg-[#12121a] border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-600/20 rounded-xl">
                  <BarChart3 className="text-purple-500" size={28} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">종목 분석</h1>
                  <p className="text-gray-400 text-sm mt-1">
                    재무제표, 기관 보유, 비교 분석을 확인하세요
                  </p>
                </div>
              </div>

              {/* Stock Selector Button */}
              <button
                onClick={() => setShowStockSelector(true)}
                className="flex items-center gap-3 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <span className="text-2xl font-bold text-white">{symbol}</span>
                <span className="text-gray-400 text-sm">종목 변경</span>
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 mt-6 -mb-px">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative ${
                      isActive
                        ? 'text-purple-500'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{tab.name}</span>
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-t" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="py-6">
          {renderTabContent()}
        </div>

        {/* Stock Selector Modal */}
        {showStockSelector && (
          <StockSelectorModal
            onSelect={handleStockSelect}
            onClose={() => setShowStockSelector(false)}
          />
        )}
      </div>
    </StockContext.Provider>
  );
}

export default function AnalysisDashboard() {
  return <AnalysisDashboardContent />;
}
