import { useState, useEffect, useRef, useCallback } from 'react';
import GridLayout from 'react-grid-layout';
import { Plus } from 'lucide-react';
import { useWidgetGrid } from '../hooks/useWidgetGrid';
import { useGlobalWidgetContext } from './AppLayout';

// Import all possible widget components
import FinancialWidget from './widgets/FinancialWidget';
import FinancialTableWidget from './widgets/FinancialTableWidget';
import ChartWidget from './widgets/ChartWidget';
import TickerInfoWidget from './widgets/TickerInfoWidget';
import KeyMetricsWidget from './widgets/KeyMetricsWidget';
import ResizableStockWidget from './ResizableStockWidget';
import YieldCurveWidget from './widgets/macro/YieldCurveWidget';
import RegimeWidget from './widgets/macro/RegimeWidget';
import EarningsWidget from './widgets/EarningsWidget';
import AnalystWidget from './widgets/AnalystWidget';
import InsiderWidget from './widgets/InsiderWidget';
import MarketOverview from './widgets/MarketOverview';
import LiveWatchlist from './widgets/LiveWatchlist';
import TickerInformation from './widgets/TickerInformation';
import WatchlistWidget from './widgets/WatchlistWidget';

// Alert Widgets
import AlertStatisticsWidget from './alerts/widgets/AlertStatisticsWidget';
import RecentTriggersWidget from './alerts/widgets/RecentTriggersWidget';
import ActiveAlertsWidget from './alerts/widgets/ActiveAlertsWidget';
import AlertsListView from './alerts/AlertsListView';

// Macro Widgets
import FedPolicyGauge from './macro/FedPolicyGauge';
import InflationDecomposition from './macro/InflationDecomposition';
import LaborMarketHeatmap from './macro/LaborMarketHeatmap';
import RegimeDashboard from './macro/RegimeDashboard';
import SentimentComposite from './macro/SentimentComposite';
import FinancialConditionsWidget from './macro/FinancialConditionsWidget';
import YieldCurveChart from './macro/YieldCurveChart';
import { CommoditiesWidget } from './macro/MacroCommoditiesTab';

// Analysis Widgets
import InstitutionalPortfolios from './InstitutionalPortfolios';
import { EstimatesContentWidget } from './analysis/AnalysisEstimateTab';
import { ComparisonContentWidget } from './analysis/AnalysisComparisonTab';
import { FinancialsContentWidget } from './analysis/AnalysisFinancialsTab';
import { CalendarContentWidget } from './analysis/AnalysisCalendarTab';
import { EstimatesTabWidget } from './analysis/EstimatesTab';
import { OwnershipTabWidget } from './analysis/OwnershipTab';

import 'react-grid-layout/css/styles.css';

// Import reusable context menu
import WidgetContextMenu from './common/WidgetContextMenu';

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
  const [contextMenu, setContextMenu] = useState(null);
  const containerRef = useRef(null);

  // Global widget context for registering widgets
  const globalContext = useGlobalWidgetContext();

  // Handle right-click context menu
  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent global context menu
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // Handle adding widget (used by both local context menu and global)
  const handleAddWidget = useCallback((widgetConfig) => {
    addWidgetToGrid({
      type: widgetConfig.id,
      defaultSize: widgetConfig.defaultSize,
      ...widgetConfig.initialProps,
    });
    setIsModalOpen(false);
    setContextMenu(null);
  }, [addWidgetToGrid]);

  // Register widgets with global context when mounted
  useEffect(() => {
    if (globalContext?.registerWidgets) {
      globalContext.registerWidgets(availableWidgets, handleAddWidget);
    }

    return () => {
      if (globalContext?.unregisterWidgets) {
        globalContext.unregisterWidgets();
      }
    };
  }, [availableWidgets, handleAddWidget, globalContext]);

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

  // This master function knows how to render every widget type in the application.
  const renderWidget = (widget) => {
    const props = {
        ...widget,
        onRemove: () => handleRemoveWidget(widget.id),
    };

    switch (widget.type) {
        // Global/Dashboard Widgets
        case 'market-overview':
            return <MarketOverview {...props} />;
        case 'live-watchlist':
            return <LiveWatchlist {...props} />;
        case 'ticker-information':
            return <TickerInformation symbol={widget.symbol || 'AAPL'} {...props} />;
        case 'watchlist':
            return <WatchlistWidget widgetId={widget.id} {...props} />;

        // Stock Widgets
        case 'financials':
            return <FinancialWidget {...props} />;
        case 'financial-table':
            return <FinancialTableWidget symbol={widget.symbol} {...props} />;
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
        case 'regime':
            return <RegimeWidget {...props} />;

        // Alert Widgets
        case 'alert-statistics':
            return <AlertStatisticsWidget {...props} />;
        case 'recent-triggers':
            return <RecentTriggersWidget {...props} />;
        case 'active-alerts':
            return <ActiveAlertsWidget {...props} />;
        case 'alerts-list':
            return <AlertsListView {...props} />;

        // Macro Widgets
        case 'fed-policy':
            return <FedPolicyGauge {...props} />;
        case 'inflation':
            return <InflationDecomposition {...props} />;
        case 'labor-market':
            return <LaborMarketHeatmap {...props} />;
        case 'regime-dashboard':
            return <RegimeDashboard {...props} />;
        case 'sentiment':
            return <SentimentComposite {...props} />;
        case 'fin-conditions':
            return <FinancialConditionsWidget {...props} />;
        case 'yield-curve-chart':
            return <YieldCurveChart {...props} />;
        case 'commodities':
            return <CommoditiesWidget {...props} />;

        // Analysis Widgets
        case 'institutional-portfolios':
            return <InstitutionalPortfolios symbol={widget.symbol} {...props} />;
        case 'estimates-content':
            return <EstimatesContentWidget symbol={widget.symbol} {...props} />;
        case 'comparison-content':
            return <ComparisonContentWidget symbol={widget.symbol} {...props} />;
        case 'financials-content':
            return <FinancialsContentWidget symbol={widget.symbol} {...props} />;
        case 'calendar-content':
            return <CalendarContentWidget symbol={widget.symbol} {...props} />;
        case 'estimates-tab':
            return <EstimatesTabWidget symbol={widget.symbol} {...props} />;
        case 'ownership-tab':
            return <OwnershipTabWidget symbol={widget.symbol} {...props} />;

        default:
            return (
              <div className="bg-red-900 text-white p-4 rounded-lg h-full">
                Unknown widget type: {widget.type}
              </div>
            );
    }
  }

  return (
    <div className="w-full px-2 py-2" onContextMenu={handleContextMenu}>
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
          <div className="flex flex-col items-center justify-center py-12 bg-[#0d0d12] rounded border border-gray-800 border-dashed min-h-[300px]">
            <div className="w-12 h-12 mb-3 rounded-full bg-gray-800/50 flex items-center justify-center">
              <Plus size={20} className="text-gray-600" />
            </div>
            <p className="text-gray-400 text-sm mb-1">No widgets added yet</p>
            <p className="text-gray-500 text-xs mb-4">Right-click anywhere to add widgets</p>
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

      {/* Context Menu for right-click */}
      {contextMenu && (
        <WidgetContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          availableWidgets={availableWidgets}
          onSelect={handleAddWidget}
        />
      )}

      {/* Add Widget Modal */}
      <AddWidgetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        availableWidgets={availableWidgets}
        onSelect={handleAddWidget}
      />

      {/* Grid Layout Styles */}
      <style>{`
        .react-grid-item {
          transition: all 200ms ease;
          transition-property: left, top;
        }
        .react-grid-item.cssTransforms {
          transition-property: transform;
        }
        .react-grid-item.resizing {
          z-index: 1;
          will-change: width, height;
        }
        .react-grid-item.react-draggable-dragging {
          transition: none;
          z-index: 3;
          will-change: transform;
          opacity: 0.9;
        }
        .react-grid-item > .react-resizable-handle {
          position: absolute;
          width: 20px;
          height: 20px;
        }
        .react-grid-item > .react-resizable-handle::after {
          content: "";
          position: absolute;
          right: 3px;
          bottom: 3px;
          width: 5px;
          height: 5px;
          border-right: 2px solid rgba(255, 255, 255, 0.3);
          border-bottom: 2px solid rgba(255, 255, 255, 0.3);
        }
        .react-grid-item:hover > .react-resizable-handle::after {
          border-color: rgba(255, 255, 255, 0.5);
        }
        .react-grid-placeholder {
          background: #3b82f6;
          opacity: 0.2;
          border-radius: 8px;
          transition-duration: 100ms;
          z-index: 2;
        }
      `}</style>
    </div>
  );
}

export default WidgetDashboard;
