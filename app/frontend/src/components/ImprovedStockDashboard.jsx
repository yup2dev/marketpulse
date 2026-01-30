import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import GridLayout from 'react-grid-layout';
import { RefreshCw, Plus } from 'lucide-react';
import StockSelector from './StockSelector';
import StockSelectorModal from './StockSelectorModal';
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
import { useGlobalWidgetContext } from './AppLayout';
import { API_BASE } from '../config/api';
import useRefreshStore from '../store/refreshStore';
import 'react-grid-layout/css/styles.css';

// Available widgets for Stock Dashboard Overview
const OVERVIEW_AVAILABLE_WIDGETS = [
  { id: 'ticker-information', name: 'Ticker Information', description: 'Price with mini chart', defaultSize: { w: 4, h: 4 } },
  { id: 'ticker-info', name: 'Ticker Info', description: 'Company details & price', defaultSize: { w: 4, h: 7 } },
  { id: 'key-metrics', name: 'Key Metrics', description: 'Valuation & profitability', defaultSize: { w: 4, h: 8 } },
  { id: 'advanced-chart', name: 'Advanced Chart', description: 'Price chart with indicators', defaultSize: { w: 8, h: 7 } },
  { id: 'earnings', name: 'Earnings', description: 'EPS history & surprises', defaultSize: { w: 4, h: 6 } },
  { id: 'analyst', name: 'Analyst', description: 'Ratings & price targets', defaultSize: { w: 4, h: 7 } },
  { id: 'insider', name: 'Insider', description: 'Insider trading activity', defaultSize: { w: 4, h: 6 } },
  { id: 'financials', name: 'Financials', description: 'Financial statements', defaultSize: { w: 6, h: 6 } },
];

const STOCK_TABS = ['Overview', 'Financials', 'Institutional Holdings', 'Comparison Analysis', 'Ownership', 'Company Calendar', 'Estimates'];

function ImprovedStockDashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  // Global refresh state
  const { refreshKey, triggerRefresh } = useRefreshStore();

  // Read tab from URL query parameter
  const searchParams = new URLSearchParams(location.search);
  const tabFromUrl = searchParams.get('tab') || 'overview';

  const [symbol, setSymbol] = useState('NVDA');
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [loading, setLoading] = useState(false);
  const [showStockSelector, setShowStockSelector] = useState(false);
  const [overviewWidgets, setOverviewWidgets] = useState([]);
  const [overviewLayout, setOverviewLayout] = useState([]);
  const [gridWidth, setGridWidth] = useState(1200);
  const [contextMenu, setContextMenu] = useState(null);
  const [tickerSymbols, setTickerSymbols] = useState({});
  const containerRef = useRef(null);

  // Global widget context
  const globalContext = useGlobalWidgetContext();

  // Default widgets for Overview tab
  const DEFAULT_OVERVIEW_WIDGETS = [
    { id: 'ticker-information-1', type: 'ticker-information', symbol },
    { id: 'key-metrics-1', type: 'key-metrics', symbol },
    { id: 'analyst-1', type: 'analyst', symbol },
    { id: 'chart-1', type: 'advanced-chart', symbol },
    { id: 'earnings-1', type: 'earnings', symbol },
  ];

  const DEFAULT_OVERVIEW_LAYOUT = [
    { i: 'ticker-information-1', x: 0, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
    { i: 'key-metrics-1', x: 4, y: 0, w: 4, h: 8, minW: 3, minH: 5 },
    { i: 'analyst-1', x: 8, y: 0, w: 4, h: 8, minW: 3, minH: 5 },
    { i: 'chart-1', x: 0, y: 4, w: 4, h: 5, minW: 4, minH: 4 },
    { i: 'earnings-1', x: 0, y: 9, w: 12, h: 5, minW: 6, minH: 4 },
  ];

  // Update tab when URL changes
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  // Load overview widgets from localStorage
  useEffect(() => {
    const savedWidgets = localStorage.getItem('stock-overview-widgets-v2');
    const savedLayout = localStorage.getItem('stock-overview-layout-v2');
    const savedTickerSymbols = localStorage.getItem('stock-overview-symbols');

    if (savedWidgets && savedLayout) {
      try {
        setOverviewWidgets(JSON.parse(savedWidgets));
        setOverviewLayout(JSON.parse(savedLayout));
        if (savedTickerSymbols) {
          setTickerSymbols(JSON.parse(savedTickerSymbols));
        }
      } catch (e) {
        console.error('Error loading overview widgets:', e);
        setOverviewWidgets(DEFAULT_OVERVIEW_WIDGETS);
        setOverviewLayout(DEFAULT_OVERVIEW_LAYOUT);
      }
    } else {
      setOverviewWidgets(DEFAULT_OVERVIEW_WIDGETS);
      setOverviewLayout(DEFAULT_OVERVIEW_LAYOUT);
    }
  }, []);

  // Save overview widgets
  useEffect(() => {
    if (overviewWidgets.length > 0) {
      localStorage.setItem('stock-overview-widgets-v2', JSON.stringify(overviewWidgets));
    }
  }, [overviewWidgets]);

  useEffect(() => {
    if (overviewLayout.length > 0) {
      localStorage.setItem('stock-overview-layout-v2', JSON.stringify(overviewLayout));
    }
  }, [overviewLayout]);

  useEffect(() => {
    localStorage.setItem('stock-overview-symbols', JSON.stringify(tickerSymbols));
  }, [tickerSymbols]);

  // Handle widget addition from context menu
  const handleAddOverviewWidget = useCallback((widgetConfig) => {
    const newWidget = {
      id: `widget-${Date.now()}`,
      type: widgetConfig.id,
      symbol: symbol,
    };

    setOverviewWidgets(prev => [...prev, newWidget]);

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

    setOverviewLayout(prev => [...prev, newLayoutItem]);
    setContextMenu(null);
  }, [symbol]);

  // Register widgets with global context when on overview tab
  useEffect(() => {
    if (activeTab === 'overview' && globalContext?.registerWidgets) {
      globalContext.registerWidgets(OVERVIEW_AVAILABLE_WIDGETS, handleAddOverviewWidget);
    }

    return () => {
      if (globalContext?.unregisterWidgets) {
        globalContext.unregisterWidgets();
      }
    };
  }, [activeTab, handleAddOverviewWidget, globalContext]);

  // Handle context menu
  const handleContextMenu = (e) => {
    if (activeTab !== 'overview') return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleRemoveOverviewWidget = (widgetId) => {
    setOverviewWidgets(prev => prev.filter(w => w.id !== widgetId));
    setOverviewLayout(prev => prev.filter(l => l.i !== widgetId));
  };

  const handleOverviewLayoutChange = (newLayout) => {
    if (newLayout.length === overviewWidgets.length) {
      setOverviewLayout(newLayout);
    }
  };

  const handleTickerChange = (widgetId, newSymbol) => {
    setTickerSymbols(prev => ({ ...prev, [widgetId]: newSymbol }));
  };

  // Update URL when tab changes
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    // Preserve the view parameter when changing tabs
    const params = new URLSearchParams(location.search);
    params.set('tab', newTab);
    navigate(`?${params.toString()}`);
  };

  // Render overview widget
  const renderOverviewWidget = (widget) => {
    const commonProps = {
      onRemove: () => handleRemoveOverviewWidget(widget.id),
    };

    const widgetSymbol = tickerSymbols[widget.id] || widget.symbol || symbol;

    switch (widget.type) {
      case 'ticker-information':
        return (
          <TickerInformation
            symbol={widgetSymbol}
            onSymbolChange={(s) => handleTickerChange(widget.id, s)}
            {...commonProps}
          />
        );
      case 'ticker-info':
        return <TickerInfoWidget symbol={widgetSymbol} {...commonProps} />;
      case 'key-metrics':
        return <KeyMetricsWidget symbol={widgetSymbol} {...commonProps} />;
      case 'advanced-chart':
        return <ChartWidget widgetId={widget.id} initialSymbols={[widgetSymbol]} {...commonProps} />;
      case 'earnings':
        return <EarningsWidget symbol={widgetSymbol} {...commonProps} />;
      case 'analyst':
        return <AnalystWidget symbol={widgetSymbol} {...commonProps} />;
      case 'insider':
        return <InsiderWidget symbol={widgetSymbol} {...commonProps} />;
      case 'financials':
        return <FinancialWidget symbol={widgetSymbol} {...commonProps} />;
      case 'stock-quote':
      default:
        return <ResizableStockWidget symbol={widgetSymbol} {...commonProps} />;
    }
  };

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

  const handleStockSelect = (stock) => {
    setSymbol(stock.symbol);
    setShowStockSelector(false);
    // Update all widget symbols to the new selected stock
    setOverviewWidgets(prev => prev.map(w => ({ ...w, symbol: stock.symbol })));
    setTickerSymbols({});
  };

  return (
    <div className="w-full px-2 py-2 bg-[#0a0a0f] min-h-screen text-[11px]" onContextMenu={handleContextMenu}>
        {/* Compact Header with Tabs */}
        <div className="flex items-center justify-between border-b border-gray-800 mb-2 pb-2">
          {/* Tabs - Left */}
          <div className="flex items-center gap-1">
            {STOCK_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab.toLowerCase().replace(' ', '-'))}
                className={`px-3 py-1.5 text-xs font-medium transition-colors rounded ${
                  activeTab === tab.toLowerCase().replace(' ', '-')
                    ? 'text-white bg-gray-800'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Controls - Right */}
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

        {showStockSelector === true && (
          <div className="mb-2">
            <StockSelector onSelect={handleStockSelect} />
          </div>
        )}

        {/* Content */}
        {activeTab === 'overview' && (
          <div ref={containerRef}>
            {overviewWidgets.length > 0 ? (
              <GridLayout
                className="layout"
                layout={overviewLayout}
                cols={12}
                rowHeight={80}
                width={gridWidth - 16}
                onLayoutChange={handleOverviewLayoutChange}
                draggableHandle=".drag-handle-area"
                isDraggable={true}
                isResizable={true}
                compactType="vertical"
                preventCollision={false}
                margin={[12, 12]}
                containerPadding={[0, 0]}
              >
                {overviewWidgets.map((widget) => (
                  <div key={widget.id} className="widget-container">
                    {renderOverviewWidget(widget)}
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
                  Right-click anywhere to add stock widgets
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
        )}

        {activeTab === 'financials' && (
          <div className="min-h-[500px]">
            <FinancialTableWidget symbol={symbol} />
          </div>
        )}

        {activeTab === 'institutional-holdings' && (
          <InstitutionalPortfolios />
        )}

        {activeTab === 'comparison-analysis' && (
          <ComparisonAnalysisTab symbol={symbol} />
        )}

        {activeTab === 'ownership' && (
          <OwnershipTab symbol={symbol} />
        )}

        {activeTab === 'company-calendar' && (
          <CompanyCalendarTab symbol={symbol} />
        )}

        {activeTab === 'estimates' && (
          <EstimatesTab symbol={symbol} />
        )}

        {/* Context Menu for Widget Addition */}
        {contextMenu && (
          <WidgetContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            availableWidgets={OVERVIEW_AVAILABLE_WIDGETS}
            onSelect={handleAddOverviewWidget}
          />
        )}

        {/* Widget Styles */}
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
