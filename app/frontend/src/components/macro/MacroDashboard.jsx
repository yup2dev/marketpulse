/**
 * Macro 대시보드 - Alerts 스타일 탭+위젯 구조
 */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Globe,
  LayoutDashboard,
  Target,
  TrendingUp,
  Activity,
  Users,
  Building2,
  BarChart3,
  DollarSign,
  CreditCard,
  Home,
  Repeat
} from 'lucide-react';
import MacroOverviewTab from './MacroOverviewTab';
import MacroRegimeTab from './MacroRegimeTab';
import MacroFedPolicyTab from './MacroFedPolicyTab';
import MacroYieldCurveTab from './MacroYieldCurveTab';
import MacroInflationTab from './MacroInflationTab';
import MacroLaborTab from './MacroLaborTab';
import MacroFinConditionsTab from './MacroFinConditionsTab';
import MacroSentimentTab from './MacroSentimentTab';
import MacroCommoditiesTab from './MacroCommoditiesTab';

const TABS = [
  { id: 'overview', name: '개요', icon: LayoutDashboard },
  { id: 'regime', name: '경제 국면', icon: Target },
  { id: 'fed-policy', name: 'Fed 정책', icon: Building2 },
  { id: 'yield-curve', name: '수익률 곡선', icon: TrendingUp },
  { id: 'inflation', name: '인플레이션', icon: DollarSign },
  { id: 'labor', name: '노동 시장', icon: Users },
  { id: 'financial-conditions', name: '금융 환경', icon: Activity },
  { id: 'sentiment', name: '시장 심리', icon: BarChart3 },
  { id: 'commodities', name: '원자재', icon: Globe }
];

export default function MacroDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId });
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <MacroOverviewTab />;
      case 'regime':
        return <MacroRegimeTab />;
      case 'fed-policy':
        return <MacroFedPolicyTab />;
      case 'yield-curve':
        return <MacroYieldCurveTab />;
      case 'inflation':
        return <MacroInflationTab />;
      case 'labor':
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
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="bg-[#12121a] border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-600/20 rounded-xl">
                <Globe className="text-green-500" size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">거시경제 분석</h1>
                <p className="text-gray-400 text-sm mt-1">
                  경제 지표, Fed 정책, 시장 심리를 분석하세요
                </p>
              </div>
            </div>
          </div>

          {/* Tab Navigation - Scrollable */}
          <div className="flex gap-1 mt-6 -mb-px overflow-x-auto pb-1 scrollbar-hide">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative whitespace-nowrap ${
                    isActive
                      ? 'text-green-500'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Icon size={18} />
                  <span>{tab.name}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500 rounded-t" />
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
    </div>
  );
}
