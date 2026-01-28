import { useState, useEffect, useRef } from 'react';
import GridLayout from 'react-grid-layout';
import { Plus } from 'lucide-react';
import { useWidgetGrid } from '../hooks/useWidgetGrid';

// Import all possible widget components
import FinancialWidget from './widgets/FinancialWidget';
import ChartWidget from './widgets/ChartWidget';
import TickerInfoWidget from './widgets/TickerInfoWidget';
import KeyMetricsWidget from './widgets/KeyMetricsWidget';
import ResizableStockWidget from './ResizableStockWidget';
import YieldCurveWidget from './widgets/macro/YieldCurveWidget';
import EarningsWidget from './widgets/EarningsWidget';
import AnalystWidget from './widgets/AnalystWidget';
import InsiderWidget from './widgets/InsiderWidget';

// Alert Widgets
import AlertStatisticsWidget from './alerts/widgets/AlertStatisticsWidget';
import RecentTriggersWidget from './alerts/widgets/RecentTriggersWidget';
import ActiveAlertsWidget from './alerts/widgets/ActiveAlertsWidget';

import 'react-grid-layout/css/styles.css';

// Compact modal for selecting a widget to add
const AddWidgetModal = ({ isOpen, onClose, availableWidgets, onSelect }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
      <div className="bg-[#12121a] border border-gray-800 rounded shadow-2xl p-4 w-full max-w-sm">
        <h3 className="text-sm font-medium text-white mb-3">Add Widget</h3>
        <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
          {availableWidgets.map((widget) => (
            <button
              key={widget.id}
              onClick={() => onSelect(widget)}
              className="p-2 bg-gray-800/50 hover:bg-cyan-900/50 border border-gray-700 hover:border-cyan-700 rounded transition-colors text-left"
            >
              <div className="text-xs font-medium text-white">{widget.name}</div>
              {widget.description && <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{widget.description}</p>}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-3 w-full py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

/**
 * A generic, reusable dashboard component for displaying a customizable grid of widgets.
 */
function WidgetDashboard({
  dashboardId,
  title,
  subtitle,
  availableWidgets = [],
  defaultLayout = [],
  defaultWidgets = [],
}) {
  const {
    widgets,
    layout,
    handleAddWidget: addWidgetToGrid,
    handleRemoveWidget,
    handleLayoutChange,
  } = useWidgetGrid(dashboardId, defaultWidgets, defaultLayout);

  const [gridWidth, setGridWidth] = useState(1200);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const containerRef = useRef(null);

  // Update grid width on resize for the grid layout component
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setGridWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const handleAddWidget = (widgetConfig) => {
    addWidgetToGrid({
      type: widgetConfig.id,
      defaultSize: widgetConfig.defaultSize,
      ...widgetConfig.initialProps,
    });
    setIsModalOpen(false);
  };
  
  // This master function knows how to render every widget type in the application.
  const renderWidget = (widget) => {
    const props = {
        onRemove: () => handleRemoveWidget(widget.id),
        ...widget,
    };

    switch (widget.type) {
        // Stock Widgets
        case 'financials':
            return <FinancialWidget {...props} />;
        case 'advanced-chart':
            return <ChartWidget widgetId={widget.id} initialSymbols={[widget.symbol || 'NVDA']} onRemove={props.onRemove} />;
        case 'ticker-info':
            return <TickerInfoWidget {...props} />;
        case 'key-metrics':
            return <KeyMetricsWidget {...props} />;
        case 'stock-quote':
            return <ResizableStockWidget {...props} />;
        case 'earnings':
            return <EarningsWidget {...props} />;
        case 'analyst':
            return <AnalystWidget {...props} />;
        case 'insider':
            return <InsiderWidget {...props} />;

        // Macro Widgets
        case 'yield-curve':
            return <YieldCurveWidget {...props} />;

        // Alert Widgets
        case 'alert-statistics':
            return <AlertStatisticsWidget {...props} />;
        case 'recent-triggers':
            return <RecentTriggersWidget {...props} />;
        case 'active-alerts':
            return <ActiveAlertsWidget {...props} />;

        default:
            return (
              <div className="bg-red-900 text-white p-4 rounded-lg h-full">
                Unknown widget type: {widget.type}
              </div>
            );
    }
  }

  return (
    <div className="w-full px-2 py-2">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-white">{title}</h2>
          {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-400 hover:text-white transition-colors"
        >
          <Plus size={12} />
          Add
        </button>
      </div>

      {/* Widget Grid */}
      <div ref={containerRef}>
        {widgets.length > 0 ? (
          <GridLayout
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={40}
            width={gridWidth}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".drag-handle-area"
            isDraggable={true}
            isResizable={true}
            compactType="vertical"
            preventCollision={false}
            margin={[4, 4]}
          >
            {widgets.map((widget) => (
              <div key={widget.id} className="bg-transparent">
                {renderWidget(widget)}
              </div>
            ))}
          </GridLayout>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 bg-[#0d0d12] rounded border border-gray-800 border-dashed">
            <p className="text-gray-500 text-xs mb-3">No widgets. Click to add.</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-white transition-colors"
            >
              <Plus size={12} />
              Add Widget
            </button>
          </div>
        )}
      </div>

      {/* Add Widget Modal */}
      <AddWidgetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        availableWidgets={availableWidgets}
        onSelect={handleAddWidget}
      />
    </div>
  );
}

export default WidgetDashboard;
