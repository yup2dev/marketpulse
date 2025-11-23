import { useEffect } from 'react';
import { Plus, BarChart3, Table2, TrendingUp, DollarSign, PieChart, Activity, LineChart, Building2, BarChart2 } from 'lucide-react';

const WIDGET_TYPES = [
  { id: 'stock-quote', name: 'Stock Quote', icon: TrendingUp, description: 'Real-time price and changes' },
  { id: 'advanced-chart', name: 'Advanced Chart', icon: LineChart, description: 'Multi-ticker comparison & analysis' },
  { id: 'ticker-info', name: 'Ticker Info', icon: Building2, description: 'Company information & price details' },
  { id: 'key-metrics', name: 'Key Metrics', icon: BarChart2, description: 'Valuation & trading metrics' },
  { id: 'financials', name: 'Financial Data', icon: DollarSign, description: 'Income, balance sheet, cash flow' },
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
