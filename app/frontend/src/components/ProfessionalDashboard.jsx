/**
 * Professional Dashboard - Full-width trading terminal style layout
 * All widgets are draggable with grid layout
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

// Default widgets configuration
const DEFAULT_WIDGETS = [
  { id: 'market-overview', type: 'market-overview', name: 'Market Overview' },
  { id: 'live-watchlist', type: 'live-watchlist', name: 'Live Watchlist' },
  { id: 'ticker-info-default', type: 'ticker-information', symbol: 'AAPL', name: 'Ticker Information' },
];

// Default layout configuration
const DEFAULT_LAYOUT = [
  { i: 'market-overview', x: 0, y: 0, w: 12, h: 2, minW: 6, minH: 2 },
  { i: 'live-watchlist', x: 0, y: 2, w: 8, h: 5, minW: 4, minH: 3 },
  { i: 'ticker-info-default', x: 8, y: 2, w: 4, h: 5, minW: 3, minH: 3 },
];

const ProfessionalDashboard = () => {
  const [widgets, setWidgets] = useState([]);
  const [layout, setLayout] = useState([]);
  const [gridWidth, setGridWidth] = useState(1600);
  const [contextMenu, setContextMenu] = useState(null);
  const [showStockSelector, setShowStockSelector] = useState(null);
  const [tickerSymbols, setTickerSymbols] = useState({ 'ticker-info-default': 'AAPL' });
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
    const savedWidgets = localStorage.getItem('professional-widgets-v2');
    const savedLayout = localStorage.getItem('professional-layout-v2');
    const savedTickerSymbols = localStorage.getItem('professional-ticker-symbols');

    if (savedWidgets && savedLayout) {
      try {
        setWidgets(JSON.parse(savedWidgets));
        setLayout(JSON.parse(savedLayout));
        if (savedTickerSymbols) {
          setTickerSymbols(JSON.parse(savedTickerSymbols));
        }
      } catch (e) {
        console.error('Error loading widgets:', e);
        // Use defaults on error
        setWidgets(DEFAULT_WIDGETS);
        setLayout(DEFAULT_LAYOUT);
      }
    } else {
      // Initialize with default widgets
      setWidgets(DEFAULT_WIDGETS);
      setLayout(DEFAULT_LAYOUT);
    }
  }, []);

  // Save widgets and layout
  useEffect(() => {
    if (widgets.length > 0) {
      localStorage.setItem('professional-widgets-v2', JSON.stringify(widgets));
    }
  }, [widgets]);

  useEffect(() => {
    if (layout.length > 0) {
      localStorage.setItem('professional-layout-v2', JSON.stringify(layout));
    }
  }, [layout]);

  useEffect(() => {
    localStorage.setItem('professional-ticker-symbols', JSON.stringify(tickerSymbols));
  }, [tickerSymbols]);

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
        if (type === 'watchlist') return { w: 4, h: 5 };
        if (type === 'financials') return { w: 6, h: 5 };
        if (type === 'advanced-chart') return { w: 8, h: 5 };
        if (type === 'ticker-info') return { w: 4, h: 4 };
        if (type === 'key-metrics') return { w: 4, h: 4 };
        if (type === 'market-overview') return { w: 12, h: 2 };
        if (type === 'live-watchlist') return { w: 8, h: 5 };
        if (type === 'ticker-information') return { w: 4, h: 4 };
        return { w: 4, h: 4 };
      };

      const size = getWidgetSize(widgetType.id);
      const newLayout = {
        i: newWidget.id,
        x: 0,
        y: Infinity, // Will be placed at the bottom
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

    // Store ticker symbol for ticker-information widgets
    if (widgetType.id === 'ticker-information') {
      setTickerSymbols(prev => ({ ...prev, [newWidget.id]: stock.symbol }));
    }

    const getWidgetSize = (type) => {
      if (type === 'financials') return { w: 6, h: 5 };
      if (type === 'advanced-chart') return { w: 8, h: 5 };
      if (type === 'ticker-info') return { w: 4, h: 4 };
      if (type === 'key-metrics') return { w: 4, h: 4 };
      if (type === 'ticker-information') return { w: 4, h: 4 };
      return { w: 4, h: 4 };
    };

    const size = getWidgetSize(widgetType.id);
    const newLayout = {
      i: newWidget.id,
      x: 0,
      y: Infinity,
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
    // Clean up ticker symbols
    setTickerSymbols(prev => {
      const next = { ...prev };
      delete next[widgetId];
      return next;
    });
  };

  const handleLayoutChange = (newLayout) => {
    setLayout(newLayout);
  };

  const handleTickerChange = (widgetId, newSymbol) => {
    setTickerSymbols(prev => ({ ...prev, [widgetId]: newSymbol }));
  };

  const renderWidget = (widget) => {
    const commonProps = {
      onRemove: () => handleRemoveWidget(widget.id)
    };

    switch (widget.type) {
      case 'market-overview':
        return <MarketOverview {...commonProps} />;
      case 'live-watchlist':
        return <LiveWatchlist {...commonProps} />;
      case 'ticker-information':
        return (
          <TickerInformation
            {...commonProps}
            symbol={tickerSymbols[widget.id] || widget.symbol || 'AAPL'}
            onSymbolChange={(symbol) => handleTickerChange(widget.id, symbol)}
          />
        );
      case 'watchlist':
        return <WatchlistWidget widgetId={widget.id} {...commonProps} />;
      case 'financials':
        return <FinancialWidget symbol={widget.symbol} {...commonProps} />;
      case 'advanced-chart':
        return <ChartWidget initialSymbols={[widget.symbol]} {...commonProps} />;
      case 'ticker-info':
        return <TickerInfoWidget symbol={widget.symbol} {...commonProps} />;
      case 'key-metrics':
        return <KeyMetricsWidget symbol={widget.symbol} {...commonProps} />;
      case 'stock-quote':
      case 'stock-chart':
      default:
        return <ResizableStockWidget symbol={widget.symbol} {...commonProps} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Main Content */}
      <div
        ref={containerRef}
        className="flex-1 p-3"
        onContextMenu={handleContextMenu}
      >
        {widgets.length > 0 ? (
          <GridLayout
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={80}
            width={gridWidth - 24} // Account for padding
            onLayoutChange={handleLayoutChange}
            draggableHandle=".drag-handle-area"
            isDraggable={true}
            isResizable={true}
            compactType="vertical"
            preventCollision={false}
            margin={[12, 12]} // Gap between widgets
            containerPadding={[0, 0]}
          >
            {widgets.map((widget) => (
              <div key={widget.id} className="widget-container">
                {renderWidget(widget)}
              </div>
            ))}
          </GridLayout>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-800 rounded-lg p-8 min-h-[400px]">
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
          isOpen={true}
          title={`Select Stock for ${showStockSelector.name}`}
          onSelect={handleSelectStock}
          onClose={() => setShowStockSelector(null)}
        />
      )}

      {/* Add custom styles for widget containers */}
      <style>{`
        .widget-container {
          height: 100%;
        }
        .widget-container > div {
          height: 100%;
        }
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
};

export default ProfessionalDashboard;
