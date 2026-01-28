/**
 * Alerts Management Page
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
  { id: 'overview', name: 'Overview', icon: LayoutDashboard },
  { id: 'price', name: 'Price Alerts', icon: DollarSign },
  { id: 'technical', name: 'Technical Alerts', icon: Activity },
  { id: 'news', name: 'News Alerts', icon: Newspaper }
];

export default function AlertsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Get tab from URL
  const searchParams = new URLSearchParams(location.search);
  const tabFromUrl = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  // Sync tab state with URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab') || 'overview';
    setActiveTab(tab);
  }, [location.search]);

  // Tab change handler
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    navigate(`?tab=${tabId}`);
  };

  // Render tab content
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
      <div className="text-white">
        {/* Page Header */}
        <div className="border-b border-gray-800">
          <div className="max-w-[1800px] mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600/20 rounded-lg">
                  <Bell className="text-blue-400" size={20} />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">Alerts</h1>
                  <p className="text-gray-500 text-xs mt-0.5">
                    Manage price, technical, and news alerts
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 border border-gray-700 hover:border-gray-600 rounded-lg transition-colors text-gray-400 hover:text-white text-sm"
              >
                <History size={16} />
                <span>History</span>
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-0.5 mt-4 -mb-px">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-cyan-400 border-b-2 border-cyan-400'
                        : 'text-gray-400 hover:text-white border-b-2 border-transparent'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="py-4">
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
