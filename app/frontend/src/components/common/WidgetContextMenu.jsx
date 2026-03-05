/**
 * Widget Context Menu - Right-click menu for adding widgets
 * Can be used on any page for widget management
 */
import { useEffect } from 'react';
import { Plus, BarChart3, LineChart, TrendingUp, DollarSign, Building2, BarChart2, Star, Globe, List, Info, Activity, Bell, PieChart, Table2 } from 'lucide-react';

// Icon mapping for widget types
const ICON_MAP = {
  // Global/Dashboard Widgets
  'market-overview': Globe,
  'live-watchlist': List,
  'ticker-information': Info,
  'watchlist': Star,
  // Stock Analysis Widgets
  'stock-quote': TrendingUp,
  'advanced-chart': LineChart,
  'ticker-info': Building2,
  'key-metrics': BarChart2,
  'financials': DollarSign,
  'earnings': BarChart3,
  'analyst': TrendingUp,
  'insider': Building2,
  // Macro Widgets
  'yield-curve': Activity,
  'regime': Activity,
  // Alert Widgets
  'alert-statistics': Bell,
  'recent-triggers': Activity,
  'active-alerts': Bell,
  // Other
  'portfolio': PieChart,
  'screener': Table2,
  default: BarChart3,
};

const WidgetContextMenu = ({
  x,
  y,
  onClose,
  availableWidgets = [],
  onSelect,
  showIcons = true
}) => {
  useEffect(() => {
    const handleClickOutside = () => onClose();
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    // Use setTimeout to prevent immediate close from the same click
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);
    document.addEventListener('keydown', handleEscape);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to prevent overflow
  const menuWidth = 300;
  const menuHeight = Math.min(450, availableWidgets.length * 56 + 60);
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 20);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 20);

  const getIcon = (widgetId) => {
    return ICON_MAP[widgetId] || ICON_MAP.default;
  };

  return (
    <div
      className="fixed z-[100] bg-[#0d0d12] border border-gray-700 rounded-lg shadow-2xl py-2 min-w-[280px] max-w-[320px] overflow-hidden"
      style={{
        left: `${adjustedX}px`,
        top: `${adjustedY}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Plus size={16} className="text-cyan-400" />
          Add Widget
        </div>
        <p className="text-xs text-gray-500 mt-1">Select a widget to add to your dashboard</p>
      </div>

      {/* Widget List */}
      <div className="py-1 overflow-y-auto max-h-[360px]">
        {availableWidgets.length === 0 ? (
          <div className="px-3 py-4 text-center text-gray-500 text-sm">
            No widgets available
          </div>
        ) : (
          availableWidgets.map((widget) => {
            const Icon = showIcons ? getIcon(widget.id) : null;
            return (
              <button
                key={widget.id}
                onClick={() => {
                  onSelect(widget);
                  onClose();
                }}
                className="w-full px-3 py-2.5 hover:bg-gray-800/80 transition-colors text-left flex items-start gap-3 group"
              >
                {showIcons && Icon && (
                  <div className="mt-0.5 text-gray-400 group-hover:text-cyan-400 transition-colors">
                    <Icon size={18} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white group-hover:text-cyan-400 transition-colors">
                    {widget.name}
                  </div>
                  {widget.description && (
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {widget.description}
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-gray-800">
        <p className="text-[10px] text-gray-600">
          Tip: Drag widgets to rearrange, resize from corners
        </p>
      </div>
    </div>
  );
};

export default WidgetContextMenu;
