/**
 * Professional Dashboard - Full-width trading terminal style layout
 */
import { useState, useEffect, useRef } from 'react';
import GridLayout from 'react-grid-layout';
import ContextMenu from './ContextMenu';
import ResizableStockWidget from './ResizableStockWidget';
import FinancialWidget from './widgets/FinancialWidget';
import ChartWidget from './widgets/ChartWidget';
import TickerInfoWidget from './widgets/TickerInfoWidget';
import KeyMetricsWidget from './widgets/KeyMetricsWidget';
import WatchlistWidget from './widgets/WatchlistWidget';
import MarketOverview from './widgets/MarketOverview';
import LiveWatchlist from './widgets/LiveWatchlist';
import TickerInformation from './widgets/TickerInformation';
import StockSelectorModal from './StockSelectorModal';
import 'react-grid-layout/css/styles.css';

const ProfessionalDashboard = () => {
  const [widgets, setWidgets] = useState([]);
  const [layout, setLayout] = useState([]);
  const [gridWidth, setGridWidth] = useState(1600);
  const [contextMenu, setContextMenu] = useState(null);
  const [showStockSelector, setShowStockSelector] = useState(null);
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const containerRef = useRef(null);

  // Update grid width on resize
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

  // Load widgets from localStorage on mount
  useEffect(() => {
    const savedWidgets = localStorage.getItem('professional-widgets');
    const savedLayout = localStorage.getItem('professional-layout');

    if (savedWidgets) {
      try {
        setWidgets(JSON.parse(savedWidgets));
      } catch (e) {
        console.error('Error loading widgets:', e);
      }
    }

    if (savedLayout) {
      try {
        setLayout(JSON.parse(savedLayout));
      } catch (e) {
        console.error('Error loading layout:', e);
      }
    }
  }, []);

  // Save widgets and layout
  useEffect(() => {
    if (widgets.length > 0) {
      localStorage.setItem('professional-widgets', JSON.stringify(widgets));
    }
  }, [widgets]);

  useEffect(() => {
    if (layout.length > 0) {
      localStorage.setItem('professional-layout', JSON.stringify(layout));
    }
  }, [layout]);

  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleSelectWidgetType = (widgetType) => {
    if (!widgetType.needsStock) {
      const newWidget = {
        id: `widget-${Date.now()}`,
        type: widgetType.id,
        symbol: null,
        name: widgetType.name
      };

      setWidgets([...widgets, newWidget]);

      const getWidgetSize = (type) => {
        if (type === 'watchlist') return { w: 4, h: 6 };
        if (type === 'financials') return { w: 6, h: 6 };
        if (type === 'advanced-chart') return { w: 8, h: 6 };
        if (type === 'ticker-info') return { w: 4, h: 4 };
        if (type === 'key-metrics') return { w: 4, h: 5 };
        return { w: 4, h: 4 };
      };

      const size = getWidgetSize(widgetType.id);
      const newLayout = {
        i: newWidget.id,
        x: (widgets.length * 4) % 12,
        y: Math.floor(widgets.length / 3) * 4,
        w: size.w,
        h: size.h,
        minW: 2,
        minH: 2
      };

      setLayout([...layout, newLayout]);
      setContextMenu(null);
    } else {
      setShowStockSelector(widgetType);
      setContextMenu(null);
    }
  };

  const handleSelectStock = (stock) => {
    const widgetType = showStockSelector;
    const newWidget = {
      id: `widget-${Date.now()}`,
      type: widgetType.id,
      symbol: stock.symbol,
      name: stock.name
    };

    setWidgets([...widgets, newWidget]);

    const getWidgetSize = (type) => {
      if (type === 'financials') return { w: 6, h: 6 };
      if (type === 'advanced-chart') return { w: 8, h: 6 };
      if (type === 'ticker-info') return { w: 4, h: 4 };
      if (type === 'key-metrics') return { w: 4, h: 5 };
      return { w: 4, h: 4 };
    };

    const size = getWidgetSize(widgetType.id);
    const newLayout = {
      i: newWidget.id,
      x: (widgets.length * 4) % 12,
      y: Math.floor(widgets.length / 3) * 4,
      w: size.w,
      h: size.h,
      minW: 2,
      minH: 2
    };

    setLayout([...layout, newLayout]);
    setShowStockSelector(null);
  };

  const handleRemoveWidget = (widgetId) => {
    setWidgets(widgets.filter(w => w.id !== widgetId));
    setLayout(layout.filter(l => l.i !== widgetId));
  };

  const handleLayoutChange = (newLayout) => {
    setLayout(newLayout);
    if (newLayout.length > 0) {
      localStorage.setItem('professional-layout', JSON.stringify(newLayout));
    }
  };

  const renderWidget = (widget) => {
    switch (widget.type) {
      case 'watchlist':
        return (
          <WatchlistWidget
            widgetId={widget.id}
            onRemove={() => handleRemoveWidget(widget.id)}
          />
        );
      case 'financials':
        return (
          <FinancialWidget
            symbol={widget.symbol}
            onRemove={() => handleRemoveWidget(widget.id)}
          />
        );
      case 'advanced-chart':
        return (
          <ChartWidget
            initialSymbols={[widget.symbol]}
            onRemove={() => handleRemoveWidget(widget.id)}
          />
        );
      case 'ticker-info':
        return (
          <TickerInfoWidget
            symbol={widget.symbol}
            onRemove={() => handleRemoveWidget(widget.id)}
          />
        );
      case 'key-metrics':
        return (
          <KeyMetricsWidget
            symbol={widget.symbol}
            onRemove={() => handleRemoveWidget(widget.id)}
          />
        );
      case 'stock-quote':
      case 'stock-chart':
      default:
        return (
          <ResizableStockWidget
            symbol={widget.symbol}
            onRemove={() => handleRemoveWidget(widget.id)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Market Overview - Top Bar */}
      <MarketOverview />

      {/* Main Content */}
      <div className="flex-1 flex flex-col" onContextMenu={handleContextMenu}>
        {/* Default Widgets Grid */}
        <div className="flex-1 grid grid-cols-12 gap-0">
          {/* Left Side - Live Watchlist (spans full height) */}
          <div className="col-span-12 xl:col-span-8 border-r border-gray-800 flex flex-col">
            {/* Live Watchlist */}
            <div className="flex-1 min-h-[300px]">
              <LiveWatchlist />
            </div>

            {/* Custom Widgets Area */}
            {widgets.length > 0 && (
              <div ref={containerRef} className="border-t border-gray-800">
                <GridLayout
                  className="layout"
                  layout={layout}
                  cols={12}
                  rowHeight={60}
                  width={gridWidth}
                  onLayoutChange={handleLayoutChange}
                  draggableHandle=".drag-handle-area"
                  isDraggable={true}
                  isResizable={true}
                  compactType="vertical"
                  preventCollision={false}
                >
                  {widgets.map((widget) => (
                    <div key={widget.id}>
                      {renderWidget(widget)}
                    </div>
                  ))}
                </GridLayout>
              </div>
            )}
          </div>

          {/* Right Side - Ticker Info & Additional Widgets */}
          <div className="col-span-12 xl:col-span-4 flex flex-col">
            {/* Ticker Information */}
            <div className="h-[160px] border-b border-gray-800">
              <TickerInformation
                symbol={selectedTicker}
                onSymbolChange={setSelectedTicker}
              />
            </div>

            {/* Additional content area */}
            <div className="flex-1 p-4 flex flex-col gap-4">
              {widgets.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-800 rounded-lg p-8">
                  <div className="w-16 h-16 mb-4 rounded-full bg-gray-800/50 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">Add Widgets</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Right-click anywhere to add charts, financials, and more
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center text-xs text-gray-600">
                    <span className="px-2 py-1 bg-gray-800/50 rounded">Charts</span>
                    <span className="px-2 py-1 bg-gray-800/50 rounded">Financials</span>
                    <span className="px-2 py-1 bg-gray-800/50 rounded">Watchlists</span>
                    <span className="px-2 py-1 bg-gray-800/50 rounded">Metrics</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onSelectWidget={handleSelectWidgetType}
        />
      )}

      {/* Stock Selector Modal */}
      {showStockSelector && (
        <StockSelectorModal
          onSelect={handleSelectStock}
          onClose={() => setShowStockSelector(null)}
        />
      )}
    </div>
  );
};

export default ProfessionalDashboard;
