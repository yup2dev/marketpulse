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

// Alert Widgets
import AlertStatisticsWidget from './alerts/widgets/AlertStatisticsWidget';
import RecentTriggersWidget from './alerts/widgets/RecentTriggersWidget';
import ActiveAlertsWidget from './alerts/widgets/ActiveAlertsWidget';

import 'react-grid-layout/css/styles.css';

// A simple modal for selecting a widget to add from the available list
const AddWidgetModal = ({ isOpen, onClose, availableWidgets, onSelect }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center">
      <div className="bg-[#1a1f2e] rounded-lg shadow-2xl p-6 w-full max-w-md">
        <h3 className="text-xl font-semibold text-white mb-6">Add New Widget</h3>
        <div className="grid grid-cols-2 gap-4">
          {availableWidgets.map((widget) => (
            <button
              key={widget.id}
              onClick={() => onSelect(widget)}
              className="p-4 bg-[#252b3b] hover:bg-blue-600 rounded-lg transition-colors text-left"
            >
              <div className="font-semibold text-white">{widget.name}</div>
              {widget.description && <p className="text-sm text-gray-400 mt-1">{widget.description}</p>}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-8 w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
        >
          Close
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
        key: widget.id,
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
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          {subtitle && <p className="text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-white font-medium"
        >
          <Plus size={20} />
          Add Widget
        </button>
      </div>

      {/* Widget Grid */}
      <div ref={containerRef}>
        {widgets.length > 0 ? (
          <GridLayout
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={50}
            width={gridWidth}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".drag-handle-area"
            isDraggable={true}
            isResizable={true}
            compactType="vertical"
            preventCollision={false}
          >
            {widgets.map((widget) => (
              <div key={widget.id} className="bg-transparent">
                {renderWidget(widget)}
              </div>
            ))}
          </GridLayout>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-[#1a1a1a] rounded-lg border border-gray-800 border-dashed">
            <h3 className="text-xl font-semibold text-white mb-2">Empty Dashboard</h3>
            <p className="text-gray-400 mb-6">Add your first widget to get started.</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium text-white"
            >
              <Plus size={20} />
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
