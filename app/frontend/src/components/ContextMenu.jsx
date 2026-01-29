import { useEffect } from 'react';
import { Plus, BarChart3, Table2, TrendingUp, DollarSign, PieChart, Activity, LineChart, Building2, BarChart2, Star, Globe, List, Info, Bell, GitMerge, Users } from 'lucide-react';

const WIDGET_TYPES = [
  // Global/Dashboard Widgets
  { id: 'market-overview', name: 'Market Overview', icon: Globe, description: 'Global market indices', needsStock: false },
  { id: 'live-watchlist', name: 'Live Watchlist', icon: List, description: 'Real-time watchlist with sparklines', needsStock: false },
  { id: 'ticker-information', name: 'Ticker Information', icon: Info, description: 'Detailed ticker info with chart', needsStock: true },
  { id: 'watchlist', name: 'Watchlist', icon: Star, description: 'Manage favorite stocks', needsStock: false },
  // Stock Analysis Widgets
  { id: 'stock-quote', name: 'Stock Quote', icon: TrendingUp, description: 'Real-time price and changes', needsStock: true },
  { id: 'advanced-chart', name: 'Advanced Chart', icon: LineChart, description: 'Multi-ticker comparison & analysis', needsStock: true },
  { id: 'ticker-info', name: 'Ticker Info', icon: Building2, description: 'Company information & price details', needsStock: true },
  { id: 'key-metrics', name: 'Key Metrics', icon: BarChart2, description: 'Valuation & trading metrics', needsStock: true },
  { id: 'financials', name: 'Financial Data', icon: DollarSign, description: 'Income, balance sheet, cash flow', needsStock: true },
  { id: 'earnings', name: 'Earnings', icon: BarChart3, description: 'EPS actual vs expected', needsStock: true },
  { id: 'analyst', name: 'Analyst Ratings', icon: Users, description: 'Investment opinions & targets', needsStock: true },
  { id: 'insider', name: 'Insider Trading', icon: Building2, description: 'Executive buy/sell activity', needsStock: true },
  // Macro Widgets
  { id: 'yield-curve', name: 'Yield Curve', icon: GitMerge, description: 'US Treasury yield curve', needsStock: false },
  { id: 'regime', name: 'Economic Regime', icon: Activity, description: 'Current economic cycle', needsStock: false },
  // Alert Widgets
  { id: 'alert-statistics', name: 'Alert Statistics', icon: Bell, description: 'Alert counts & distribution', needsStock: false },
  { id: 'recent-triggers', name: 'Recent Triggers', icon: Activity, description: 'Recently triggered alerts', needsStock: false },
  { id: 'active-alerts', name: 'Active Alerts', icon: Bell, description: 'Currently active alerts', needsStock: false },
];

const ContextMenu = ({ x, y, onClose, onSelectWidget }) => {
  useEffect(() => {
    const handleClickOutside = () => onClose();
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleSelect = (widgetType) => {
    onSelectWidget(widgetType);
    onClose();
  };

  return (
    <div
      className="fixed z-[100] bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-2xl py-2 min-w-[280px]"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Plus size={16} />
          Add Widget
        </div>
      </div>
      <div className="py-1">
        {WIDGET_TYPES.map((widget) => {
          const Icon = widget.icon;
          return (
            <button
              key={widget.id}
              onClick={() => handleSelect(widget)}
              className="w-full px-3 py-2 hover:bg-gray-800 transition-colors text-left flex items-start gap-3"
            >
              <div className="mt-0.5 text-blue-400">
                <Icon size={18} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-white">{widget.name}</div>
                <div className="text-xs text-gray-400">{widget.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ContextMenu;
