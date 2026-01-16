/**
 * 알림 관리 페이지 - 4탭 구조
 */
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, LayoutDashboard, DollarSign, Activity, Newspaper, History } from 'lucide-react';
import { AlertsProvider } from '../contexts/AlertsContext';
import AlertsOverviewTab from '../components/alerts/AlertsOverviewTab';
import PriceAlertsTab from '../components/alerts/PriceAlertsTab';
import TechnicalAlertsTab from '../components/alerts/TechnicalAlertsTab';
import NewsAlertsTab from '../components/alerts/NewsAlertsTab';
import AlertHistoryModal from '../components/alerts/AlertHistoryModal';

const TABS = [
  { id: 'overview', name: '개요', icon: LayoutDashboard },
  { id: 'price', name: '가격 알림', icon: DollarSign },
  { id: 'technical', name: '기술적 알림', icon: Activity },
  { id: 'news', name: '뉴스 알림', icon: Newspaper }
];

export default function AlertsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // URL에서 탭 파라미터 읽기
  const searchParams = new URLSearchParams(location.search);
  const tabFromUrl = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  // URL 변경 시 탭 상태 동기화
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab') || 'overview';
    setActiveTab(tab);
  }, [location.search]);

  // 탭 변경 핸들러
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    navigate(`?tab=${tabId}`);
  };

  // 탭 컨텐츠 렌더링
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <AlertsOverviewTab />;
      case 'price':
        return <PriceAlertsTab />;
      case 'technical':
        return <TechnicalAlertsTab />;
      case 'news':
        return <NewsAlertsTab />;
      default:
        return <AlertsOverviewTab />;
    }
  };

  return (
    <AlertsProvider>
      <div className="min-h-screen bg-[#0a0a0f]">
        {/* Header */}
        <div className="bg-[#12121a] border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600/20 rounded-xl">
                  <Bell className="text-blue-500" size={28} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">알림 관리</h1>
                  <p className="text-gray-400 text-sm mt-1">
                    가격, 기술적 지표, 뉴스 알림을 설정하고 관리하세요
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-300"
              >
                <History size={18} />
                <span>히스토리</span>
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
                        ? 'text-blue-500'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{tab.name}</span>
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t" />
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

        {/* History Modal */}
        {showHistoryModal && (
          <AlertHistoryModal onClose={() => setShowHistoryModal(false)} />
        )}
      </div>
    </AlertsProvider>
  );
}
