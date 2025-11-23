import { useState, useEffect, useRef } from 'react';
import GridLayout from 'react-grid-layout';
import { TrendingUp } from 'lucide-react';
import Layout from './Layout';
import ContextMenu from './ContextMenu';
import ResizableStockWidget from './ResizableStockWidget';
import FinancialWidget from './widgets/FinancialWidget';
import ChartWidget from './widgets/ChartWidget';
import TickerInfoWidget from './widgets/TickerInfoWidget';
import KeyMetricsWidget from './widgets/KeyMetricsWidget';
import StockSelectorModal from './StockSelectorModal';
import 'react-grid-layout/css/styles.css';

const ProfessionalDashboard = () => {
  const [widgets, setWidgets] = useState([]);
  const [layout, setLayout] = useState([]);
  const [gridWidth, setGridWidth] = useState(1200);
  const [contextMenu, setContextMenu] = useState(null);
  const [showStockSelector, setShowStockSelector] = useState(null);
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
    setShowStockSelector(widgetType);
    setContextMenu(null);
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
      if (type === 'advanced-chart') return { w: 12, h: 8 };
      if (type === 'ticker-info') return { w: 4, h: 5 };
      if (type === 'key-metrics') return { w: 4, h: 6 };
      return { w: 4, h: 4 };
    };

    const size = getWidgetSize(widgetType.id);
    const newLayout = {
      i: newWidget.id,
      x: (widgets.length * 4) % 12,
      y: Math.floor(widgets.length / 3) * 4,
      w: size.w,
      h: size.h,
      minW: 3,
      minH: 3
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
    // Save immediately to localStorage
    if (newLayout.length > 0) {
      localStorage.setItem('professional-layout', JSON.stringify(newLayout));
    }
  };

  const renderWidget = (widget) => {
    switch (widget.type) {
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
    <Layout>
      <div
        className="max-w-7xl mx-auto px-6 py-8 min-h-[calc(100vh-400px)]"
        onContextMenu={handleContextMenu}
      >
        {/* Hero Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <TrendingUp className="text-blue-500" size={32} />
            Professional Dashboard
          </h2>
          <p className="text-gray-400">Right-click anywhere to add widgets • Drag to rearrange • Resize from corners</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-900/40 to-blue-900/10 border border-blue-800/50 rounded-lg p-4">
            <div className="text-blue-300 text-sm mb-1">Active Widgets</div>
            <div className="text-3xl font-bold text-white">{widgets.length}</div>
            <div className="text-xs text-blue-400 mt-1">
              {widgets.filter(w => w.type === 'financials').length} financials, {widgets.filter(w => w.type !== 'financials').length} stocks
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-900/40 to-purple-900/10 border border-purple-800/50 rounded-lg p-4">
            <div className="text-purple-300 text-sm mb-1">Tracking</div>
            <div className="text-3xl font-bold text-white">{new Set(widgets.map(w => w.symbol)).size}</div>
            <div className="text-xs text-purple-400 mt-1">unique stocks</div>
          </div>
          <div className="bg-gradient-to-br from-green-900/40 to-green-900/10 border border-green-800/50 rounded-lg p-4">
            <div className="text-green-300 text-sm mb-1">Layout</div>
            <div className="text-3xl font-bold text-green-400">Auto-save</div>
            <div className="text-xs text-green-400 mt-1">Changes saved automatically</div>
          </div>
        </div>

        {/* Widgets Grid */}
        <div ref={containerRef}>
          {widgets.length > 0 ? (
            <GridLayout
              className="layout"
              layout={layout}
              cols={12}
              rowHeight={80}
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
          ) : (
            <div className="flex flex-col items-center justify-center py-32 bg-gradient-to-br from-gray-900/50 to-gray-900/20 rounded-lg border-2 border-gray-800 border-dashed">
              <div className="text-gray-500 mb-6">
                <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Your Canvas Awaits</h3>
              <p className="text-gray-400 mb-2 text-center max-w-md text-lg">
                Right-click anywhere on this area to add your first widget
              </p>
              <p className="text-gray-500 text-sm">
                Choose from stock quotes, charts, financials, and more
              </p>
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
        <StockSelectorModal
          isOpen={!!showStockSelector}
          title={showStockSelector ? `Select Stock for ${showStockSelector.name}` : ''}
          onSelect={handleSelectStock}
          onClose={() => setShowStockSelector(null)}
        />

        {/* Help Section */}
        <div className="mt-12 grid grid-cols-3 gap-4">
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-5">
            <div className="text-blue-400 font-semibold mb-2">Getting Started</div>
            <ul className="text-sm text-gray-400 space-y-2">
              <li>• Right-click to add widgets</li>
              <li>• Drag widgets to move them</li>
              <li>• Resize from bottom-right corner</li>
            </ul>
          </div>
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-5">
            <div className="text-green-400 font-semibold mb-2">Widget Features</div>
            <ul className="text-sm text-gray-400 space-y-2">
              <li>• Toggle chart/table views</li>
              <li>• Real-time data updates</li>
              <li>• Customizable layouts</li>
            </ul>
          </div>
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-5">
            <div className="text-purple-400 font-semibold mb-2">Pro Tips</div>
            <ul className="text-sm text-gray-400 space-y-2">
              <li>• Layouts auto-save</li>
              <li>• Add multiple stock widgets</li>
              <li>• Mix different widget types</li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProfessionalDashboard;
