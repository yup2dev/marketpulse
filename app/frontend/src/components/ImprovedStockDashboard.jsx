import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import GridLayout from 'react-grid-layout';
import { RefreshCw, Plus } from 'lucide-react';
import StockSelector from './StockSelector';
import ResizableStockWidget from './ResizableStockWidget';
import FinancialWidget from './widgets/FinancialWidget';
import FinancialTableWidget from './widgets/FinancialTableWidget';
import ChartWidget from './widgets/ChartWidget';
import TickerInfoWidget from './widgets/TickerInfoWidget';
import KeyMetricsWidget from './widgets/KeyMetricsWidget';
import TickerInformation from './widgets/TickerInformation';
import EarningsWidget from './widgets/EarningsWidget';
import AnalystWidget from './widgets/AnalystWidget';
import InsiderWidget from './widgets/InsiderWidget';
import InstitutionalPortfolios from './InstitutionalPortfolios';
import ComparisonAnalysisTab from './analysis/ComparisonAnalysisTab';
import OwnershipTab from './analysis/OwnershipTab';
import CompanyCalendarTab from './analysis/CompanyCalendarTab';
import EstimatesTab from './analysis/EstimatesTab';
import WidgetContextMenu from './common/WidgetContextMenu';
import TabWidgetWrapper from './widgets/TabWidgetWrapper';
import { useGlobalWidgetContext } from './AppLayout';
import useRefreshStore from '../store/refreshStore';
import 'react-grid-layout/css/styles.css';

// Tab configuration
const STOCK_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'financials', label: 'Financials' },
  { id: 'institutional-holdings', label: 'Institutional Holdings' },
  { id: 'comparison-analysis', label: 'Comparison Analysis' },
  { id: 'ownership', label: 'Ownership' },
  { id: 'company-calendar', label: 'Company Calendar' },
  { id: 'estimates', label: 'Estimates' },
];

// Available widgets per tab
const TAB_WIDGETS = {
  overview: [
    { id: 'ticker-information', name: 'Ticker Information', description: 'Price with mini chart', defaultSize: { w: 4, h: 4 } },
    { id: 'ticker-info', name: 'Ticker Info', description: 'Company details & price', defaultSize: { w: 4, h: 7 } },
    { id: 'key-metrics', name: 'Key Metrics', description: 'Valuation & profitability', defaultSize: { w: 4, h: 8 } },
    { id: 'advanced-chart', name: 'Advanced Chart', description: 'Price chart with indicators', defaultSize: { w: 8, h: 7 } },
    { id: 'earnings', name: 'Earnings', description: 'EPS history & surprises', defaultSize: { w: 4, h: 6 } },
    { id: 'analyst', name: 'Analyst', description: 'Ratings & price targets', defaultSize: { w: 4, h: 7 } },
    { id: 'insider', name: 'Insider', description: 'Insider trading activity', defaultSize: { w: 4, h: 6 } },
  ],
  financials: [
    { id: 'financial-table', name: 'Financial Statements', description: 'Income, Balance, Cash Flow', defaultSize: { w: 12, h: 8 } },
    { id: 'financials', name: 'Financial Summary', description: 'Key financial metrics', defaultSize: { w: 6, h: 6 } },
    { id: 'advanced-chart', name: 'Price Chart', description: 'Stock price chart', defaultSize: { w: 6, h: 5 } },
    { id: 'key-metrics', name: 'Key Metrics', description: 'Valuation metrics', defaultSize: { w: 4, h: 6 } },
  ],
  'institutional-holdings': [
    { id: 'institutional-portfolios', name: 'Institutional Portfolios', description: 'Top institutional holders', defaultSize: { w: 12, h: 8 } },
    { id: 'advanced-chart', name: 'Price Chart', description: 'Stock price chart', defaultSize: { w: 6, h: 5 } },
  ],
  'comparison-analysis': [
    { id: 'comparison-analysis', name: 'Comparison Analysis', description: 'Compare multiple stocks', defaultSize: { w: 12, h: 10 } },
    { id: 'advanced-chart', name: 'Price Chart', description: 'Stock price chart', defaultSize: { w: 6, h: 5 } },
  ],
  ownership: [
    { id: 'ownership', name: 'Ownership Breakdown', description: 'Insider & institutional ownership', defaultSize: { w: 12, h: 8 } },
    { id: 'insider', name: 'Insider Trading', description: 'Recent insider transactions', defaultSize: { w: 6, h: 6 } },
  ],
  'company-calendar': [
    { id: 'company-calendar', name: 'Company Calendar', description: 'Earnings, dividends, events', defaultSize: { w: 12, h: 8 } },
    { id: 'earnings', name: 'Earnings History', description: 'EPS history & surprises', defaultSize: { w: 6, h: 6 } },
  ],
  estimates: [
    { id: 'estimates', name: 'Analyst Estimates', description: 'Revenue & EPS estimates', defaultSize: { w: 12, h: 8 } },
    { id: 'analyst', name: 'Analyst Ratings', description: 'Price targets & ratings', defaultSize: { w: 6, h: 6 } },
  ],
};

// Default widgets per tab
const DEFAULT_TAB_WIDGETS = {
  overview: [
    { id: 'ticker-information-1', type: 'ticker-information' },
    { id: 'key-metrics-1', type: 'key-metrics' },
    { id: 'analyst-1', type: 'analyst' },
    { id: 'chart-1', type: 'advanced-chart' },
    { id: 'earnings-1', type: 'earnings' },
  ],
  financials: [
    { id: 'financial-table-1', type: 'financial-table' },
  ],
  'institutional-holdings': [
    { id: 'institutional-1', type: 'institutional-portfolios' },
  ],
  'comparison-analysis': [
    { id: 'comparison-1', type: 'comparison-analysis' },
  ],
  ownership: [
    { id: 'ownership-1', type: 'ownership' },
  ],
  'company-calendar': [
    { id: 'calendar-1', type: 'company-calendar' },
  ],
  estimates: [
    { id: 'estimates-1', type: 'estimates' },
  ],
};

// Default layouts per tab
const DEFAULT_TAB_LAYOUTS = {
  overview: [
    { i: 'ticker-information-1', x: 0, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
    { i: 'key-metrics-1', x: 4, y: 0, w: 4, h: 8, minW: 3, minH: 5 },
    { i: 'analyst-1', x: 8, y: 0, w: 4, h: 8, minW: 3, minH: 5 },
    { i: 'chart-1', x: 0, y: 4, w: 4, h: 5, minW: 4, minH: 4 },
    { i: 'earnings-1', x: 0, y: 9, w: 12, h: 5, minW: 6, minH: 4 },
  ],
  financials: [
    { i: 'financial-table-1', x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 5 },
  ],
  'institutional-holdings': [
    { i: 'institutional-1', x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 5 },
  ],
  'comparison-analysis': [
    { i: 'comparison-1', x: 0, y: 0, w: 12, h: 10, minW: 8, minH: 6 },
  ],
  ownership: [
    { i: 'ownership-1', x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 5 },
  ],
  'company-calendar': [
    { i: 'calendar-1', x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 5 },
  ],
  estimates: [
    { i: 'estimates-1', x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 5 },
  ],
};

function ImprovedStockDashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const { triggerRefresh } = useRefreshStore();

  const searchParams = new URLSearchParams(location.search);
  const tabFromUrl = searchParams.get('tab') || 'overview';

  const [symbol, setSymbol] = useState('NVDA');
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [showStockSelector, setShowStockSelector] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [tickerSymbols, setTickerSymbols] = useState({});
  const [gridWidth, setGridWidth] = useState(1200);
  const containerRef = useRef(null);

  // Widgets and layouts state per tab
  const [tabWidgets, setTabWidgets] = useState({});
  const [tabLayouts, setTabLayouts] = useState({});

  const globalContext = useGlobalWidgetContext();

  // Load saved state from localStorage
  useEffect(() => {
    STOCK_TABS.forEach(tab => {
      const savedWidgets = localStorage.getItem(`stock-${tab.id}-widgets`);
      const savedLayout = localStorage.getItem(`stock-${tab.id}-layout`);

      if (savedWidgets && savedLayout) {
        try {
          setTabWidgets(prev => ({ ...prev, [tab.id]: JSON.parse(savedWidgets) }));
          setTabLayouts(prev => ({ ...prev, [tab.id]: JSON.parse(savedLayout) }));
        } catch (e) {
          console.error(`Error loading ${tab.id} widgets:`, e);
          setTabWidgets(prev => ({ ...prev, [tab.id]: DEFAULT_TAB_WIDGETS[tab.id] || [] }));
          setTabLayouts(prev => ({ ...prev, [tab.id]: DEFAULT_TAB_LAYOUTS[tab.id] || [] }));
        }
      } else {
        setTabWidgets(prev => ({ ...prev, [tab.id]: DEFAULT_TAB_WIDGETS[tab.id] || [] }));
        setTabLayouts(prev => ({ ...prev, [tab.id]: DEFAULT_TAB_LAYOUTS[tab.id] || [] }));
      }
    });

    const savedSymbols = localStorage.getItem('stock-ticker-symbols');
    if (savedSymbols) {
      try {
        setTickerSymbols(JSON.parse(savedSymbols));
      } catch (e) {
        console.error('Error loading ticker symbols:', e);
      }
    }
  }, []);

  // Save state to localStorage
  useEffect(() => {
    Object.entries(tabWidgets).forEach(([tabId, widgets]) => {
      if (widgets && widgets.length > 0) {
        localStorage.setItem(`stock-${tabId}-widgets`, JSON.stringify(widgets));
      }
    });
  }, [tabWidgets]);

  useEffect(() => {
    Object.entries(tabLayouts).forEach(([tabId, layout]) => {
      if (layout && layout.length > 0) {
        localStorage.setItem(`stock-${tabId}-layout`, JSON.stringify(layout));
      }
    });
  }, [tabLayouts]);

  useEffect(() => {
    localStorage.setItem('stock-ticker-symbols', JSON.stringify(tickerSymbols));
  }, [tickerSymbols]);

  // Update tab from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  // Update grid width
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

  // Current tab's widgets and layout
  const currentWidgets = tabWidgets[activeTab] || [];
  const currentLayout = tabLayouts[activeTab] || [];
  const availableWidgets = TAB_WIDGETS[activeTab] || [];

  // Handle widget addition
  const handleAddWidget = useCallback((widgetConfig) => {
    const newWidget = {
      id: `widget-${Date.now()}`,
      type: widgetConfig.id,
      symbol: symbol,
    };

    setTabWidgets(prev => ({
      ...prev,
      [activeTab]: [...(prev[activeTab] || []), newWidget]
    }));

    const size = widgetConfig.defaultSize || { w: 4, h: 4 };
    const newLayoutItem = {
      i: newWidget.id,
      x: 0,
      y: Infinity,
      w: size.w,
      h: size.h,
      minW: 3,
      minH: 3
    };

    setTabLayouts(prev => ({
      ...prev,
      [activeTab]: [...(prev[activeTab] || []), newLayoutItem]
    }));

    setContextMenu(null);
  }, [symbol, activeTab]);

  // Register widgets with global context
  useEffect(() => {
    if (globalContext?.registerWidgets && availableWidgets.length > 0) {
      globalContext.registerWidgets(availableWidgets, handleAddWidget);
    }
    return () => {
      if (globalContext?.unregisterWidgets) {
        globalContext.unregisterWidgets();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleRemoveWidget = useCallback((widgetId) => {
    setTabWidgets(prev => ({
      ...prev,
      [activeTab]: (prev[activeTab] || []).filter(w => w.id !== widgetId)
    }));
    setTabLayouts(prev => ({
      ...prev,
      [activeTab]: (prev[activeTab] || []).filter(l => l.i !== widgetId)
    }));
  }, [activeTab]);

  const handleLayoutChange = useCallback((newLayout) => {
    const widgets = tabWidgets[activeTab] || [];
    if (newLayout.length === widgets.length) {
      setTabLayouts(prev => ({ ...prev, [activeTab]: newLayout }));
    }
  }, [activeTab, tabWidgets]);

  const handleTickerChange = useCallback((widgetId, newSymbol) => {
    setTickerSymbols(prev => ({ ...prev, [widgetId]: newSymbol }));
  }, []);

  const handleTabChange = useCallback((newTab) => {
    setActiveTab(newTab);
    const params = new URLSearchParams(location.search);
    params.set('tab', newTab);
    navigate(`?${params.toString()}`);
  }, [location.search, navigate]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleStockSelect = useCallback((stock) => {
    setSymbol(stock.symbol);
    setShowStockSelector(false);
    setTickerSymbols({});
  }, []);

  // Render widget based on type
  const renderWidget = useCallback((widget) => {
    const onRemove = () => handleRemoveWidget(widget.id);
    const widgetSymbol = tickerSymbols[widget.id] || widget.symbol || symbol;

    switch (widget.type) {
      case 'ticker-information':
        return <TickerInformation symbol={widgetSymbol} onSymbolChange={(s) => handleTickerChange(widget.id, s)} onRemove={onRemove} />;
      case 'ticker-info':
        return <TickerInfoWidget symbol={widgetSymbol} onRemove={onRemove} />;
      case 'key-metrics':
        return <KeyMetricsWidget symbol={widgetSymbol} onRemove={onRemove} />;
      case 'advanced-chart':
        return <ChartWidget widgetId={widget.id} initialSymbols={[widgetSymbol]} onRemove={onRemove} />;
      case 'earnings':
        return <EarningsWidget symbol={widgetSymbol} onRemove={onRemove} />;
      case 'analyst':
        return <AnalystWidget symbol={widgetSymbol} onRemove={onRemove} />;
      case 'insider':
        return <InsiderWidget symbol={widgetSymbol} onRemove={onRemove} />;
      case 'financials':
        return <FinancialWidget symbol={widgetSymbol} onRemove={onRemove} />;
      case 'financial-table':
        return <FinancialTableWidget symbol={widgetSymbol} onRemove={onRemove} />;
      case 'institutional-portfolios':
        return (
          <TabWidgetWrapper title="Institutional Portfolios" onRemove={onRemove}>
            <InstitutionalPortfolios />
          </TabWidgetWrapper>
        );
      case 'comparison-analysis':
        return (
          <TabWidgetWrapper title="Comparison Analysis" onRemove={onRemove}>
            <ComparisonAnalysisTab symbol={widgetSymbol} />
          </TabWidgetWrapper>
        );
      case 'ownership':
        return (
          <TabWidgetWrapper title="Ownership" onRemove={onRemove}>
            <OwnershipTab symbol={widgetSymbol} />
          </TabWidgetWrapper>
        );
      case 'company-calendar':
        return (
          <TabWidgetWrapper title="Company Calendar" onRemove={onRemove}>
            <CompanyCalendarTab symbol={widgetSymbol} />
          </TabWidgetWrapper>
        );
      case 'estimates':
        return (
          <TabWidgetWrapper title="Estimates" onRemove={onRemove}>
            <EstimatesTab symbol={widgetSymbol} />
          </TabWidgetWrapper>
        );
      default:
        return <ResizableStockWidget symbol={widgetSymbol} onRemove={onRemove} />;
    }
  }, [symbol, tickerSymbols, handleRemoveWidget, handleTickerChange]);

  return (
    <div className="w-full px-2 py-2 bg-[#0a0a0f] min-h-screen text-[11px]" onContextMenu={handleContextMenu}>
      {/* Header with Tabs */}
      <div className="flex items-center justify-between border-b border-gray-800 mb-2 pb-2">
        <div className="flex items-center gap-1">
          {STOCK_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors rounded ${
                activeTab === tab.id
                  ? 'text-white bg-gray-800'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={triggerRefresh}
            className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white text-xs"
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
          <button
            onClick={() => setShowStockSelector(!showStockSelector)}
            className="px-2 py-1 bg-cyan-900/50 hover:bg-cyan-900/70 rounded text-cyan-400 text-xs font-medium"
          >
            {symbol}
          </button>
        </div>
      </div>

      {showStockSelector && (
        <div className="mb-2">
          <StockSelector onSelect={handleStockSelect} />
        </div>
      )}

      {/* Grid Content */}
      <div ref={containerRef}>
        {currentWidgets.length > 0 ? (
          <GridLayout
            className="layout"
            layout={currentLayout}
            cols={12}
            rowHeight={80}
            width={gridWidth - 16}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".drag-handle-area"
            isDraggable={true}
            isResizable={true}
            compactType="vertical"
            preventCollision={false}
            margin={[12, 12]}
            containerPadding={[0, 0]}
          >
            {currentWidgets.map((widget) => (
              <div key={widget.id} className="widget-container">
                {renderWidget(widget)}
              </div>
            ))}
          </GridLayout>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-[#0d0d12] rounded-lg border border-gray-800 border-dashed min-h-[400px]">
            <div className="w-16 h-16 mb-4 rounded-full bg-gray-800/50 flex items-center justify-center">
              <Plus size={24} className="text-gray-600" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Add Widgets</h3>
            <p className="text-sm text-gray-500 mb-4">
              Right-click anywhere to add widgets
            </p>
            <button
              onClick={() => setContextMenu({ x: window.innerWidth / 2, y: window.innerHeight / 2 })}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors"
            >
              <Plus size={16} />
              Add Widget
            </button>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && availableWidgets.length > 0 && (
        <WidgetContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          availableWidgets={availableWidgets}
          onSelect={handleAddWidget}
        />
      )}

      {/* Grid Styles */}
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
}

export default ImprovedStockDashboard;
