/**
 * Macro Dashboard - Analysis style with data-driven content
 */
import { useSearchParams, useNavigate } from 'react-router-dom';
import MacroOverviewTab from './MacroOverviewTab';
import MacroRegimeTab from './MacroRegimeTab';
import MacroFedPolicyTab from './MacroFedPolicyTab';
import MacroYieldCurveTab from './MacroYieldCurveTab';
import MacroInflationTab from './MacroInflationTab';
import MacroLaborTab from './MacroLaborTab';
import MacroFinConditionsTab from './MacroFinConditionsTab';
import MacroSentimentTab from './MacroSentimentTab';
import MacroCommoditiesTab from './MacroCommoditiesTab';

const MACRO_TABS = [
  'Overview',
  'Economic Regime',
  'Fed Policy',
  'Yield Curve',
  'Inflation',
  'Labor Market',
  'Financial Conditions',
  'Sentiment',
  'Commodities'
];

export default function MacroDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeTab = searchParams.get('tab') || 'overview';

  const handleTabChange = (tabName) => {
    const tabId = tabName.toLowerCase().replace(/ /g, '-');
    navigate(`/?view=macro-analysis&tab=${tabId}`, { replace: true });
  };

  const isTabActive = (tabName) => {
    const tabId = tabName.toLowerCase().replace(/ /g, '-');
    return activeTab === tabId;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <MacroOverviewTab />;
      case 'economic-regime':
        return <MacroRegimeTab />;
      case 'fed-policy':
        return <MacroFedPolicyTab />;
      case 'yield-curve':
        return <MacroYieldCurveTab />;
      case 'inflation':
        return <MacroInflationTab />;
      case 'labor-market':
        return <MacroLaborTab />;
      case 'financial-conditions':
        return <MacroFinConditionsTab />;
      case 'sentiment':
        return <MacroSentimentTab />;
      case 'commodities':
        return <MacroCommoditiesTab />;
      default:
        return <MacroOverviewTab />;
    }
  };

  return (
    <div className="w-full px-4 py-4 bg-[#0a0a0f] min-h-screen">
      {/* Page Header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white">Macro Analysis</h2>
        <p className="text-sm text-gray-400">Economic indicators, Fed policy, and market conditions</p>
      </div>

      {/* Tabs - Analysis Style */}
      <div className="border-b border-gray-800 mb-6">
        <div className="flex gap-6 overflow-x-auto">
          {MACRO_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative whitespace-nowrap ${
                isTabActive(tab)
                  ? 'text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab}
              {isTabActive(tab) && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {renderTabContent()}
    </div>
  );
}
