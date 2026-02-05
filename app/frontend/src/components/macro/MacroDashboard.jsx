/**
 * Macro Dashboard - GridLayout Widget System (same pattern as Analysis tabs)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import GridLayout from 'react-grid-layout';
// Individual macro widgets using BaseWidget
import GDPForecastWidget from '../widgets/macro/GDPForecastWidget';
import InflationMomentumWidget from '../widgets/macro/InflationMomentumWidget';
import InitialClaimsWidget from '../widgets/macro/InitialClaimsWidget';
import JobsBreakdownWidget from '../widgets/macro/JobsBreakdownWidget';
// Tab components
import MacroFedPolicyTab from './MacroFedPolicyTab';
import MacroYieldCurveTab from './MacroYieldCurveTab';
import MacroInflationTab from './MacroInflationTab';
import MacroLaborTab from './MacroLaborTab';
import MacroFinConditionsTab from './MacroFinConditionsTab';
import MacroSentimentTab from './MacroSentimentTab';
import MacroCommoditiesTab from './MacroCommoditiesTab';
import TabWidgetWrapper from '../widgets/TabWidgetWrapper';
import WidgetContextMenu from '../common/WidgetContextMenu';
import { useGlobalWidgetContext } from '../AppLayout';
import 'react-grid-layout/css/styles.css';

// Tab configuration
const MACRO_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'fed-policy', label: 'Fed Policy' },
  { id: 'yield-curve', label: 'Yield Curve' },
  { id: 'inflation', label: 'Inflation' },
  { id: 'labor-market', label: 'Labor Market' },
  { id: 'financial-conditions', label: 'Financial Conditions' },
  { id: 'sentiment', label: 'Sentiment' },
  { id: 'commodities', label: 'Commodities' },
];

// Available widgets per tab
const TAB_WIDGETS = {
  overview: [
    { id: 'gdp-forecast', name: 'GDP Forecast', description: 'Evolution of GDP forecast', defaultSize: { w: 6, h: 6 } },
    { id: 'inflation-momentum', name: 'Inflation Momentum', description: '12M, 6M, 3M momentum', defaultSize: { w: 6, h: 6 } },
    { id: 'initial-claims', name: 'Initial Claims', description: 'Weekly claims with 4-week MA', defaultSize: { w: 6, h: 6 } },
    { id: 'jobs-breakdown', name: 'Jobs Breakdown', description: 'Private vs Government jobs', defaultSize: { w: 6, h: 6 } },
  ],
  'fed-policy': [
    { id: 'fed-policy-tab', name: 'Fed Policy', description: 'Fed policy stance', defaultSize: { w: 12, h: 8 } },
  ],
  'yield-curve': [
    { id: 'yield-curve-tab', name: 'Yield Curve', description: 'Treasury yield curve', defaultSize: { w: 12, h: 8 } },
  ],
  inflation: [
    { id: 'inflation-tab', name: 'Inflation Analysis', description: 'Inflation decomposition', defaultSize: { w: 12, h: 8 } },
  ],
  'labor-market': [
    { id: 'labor-tab', name: 'Labor Market', description: 'Employment metrics', defaultSize: { w: 12, h: 8 } },
  ],
  'financial-conditions': [
    { id: 'fin-conditions-tab', name: 'Financial Conditions', description: 'Credit spreads & liquidity', defaultSize: { w: 12, h: 8 } },
  ],
  sentiment: [
    { id: 'sentiment-tab', name: 'Market Sentiment', description: 'Fear/Greed & VIX', defaultSize: { w: 12, h: 8 } },
  ],
  commodities: [
    { id: 'commodities-tab', name: 'Commodities', description: 'Commodity ratios', defaultSize: { w: 12, h: 8 } },
  ],
};

// Default widgets per tab
const DEFAULT_TAB_WIDGETS = {
  overview: [
    { id: 'gdp-1', type: 'gdp-forecast' },
    { id: 'inflation-1', type: 'inflation-momentum' },
    { id: 'claims-1', type: 'initial-claims' },
    { id: 'jobs-1', type: 'jobs-breakdown' },
  ],
  'fed-policy': [{ id: 'fed-1', type: 'fed-policy-tab' }],
  'yield-curve': [{ id: 'yield-1', type: 'yield-curve-tab' }],
  inflation: [{ id: 'inflation-tab-1', type: 'inflation-tab' }],
  'labor-market': [{ id: 'labor-1', type: 'labor-tab' }],
  'financial-conditions': [{ id: 'fin-1', type: 'fin-conditions-tab' }],
  sentiment: [{ id: 'sentiment-1', type: 'sentiment-tab' }],
  commodities: [{ id: 'commodities-1', type: 'commodities-tab' }],
};

// Default layouts per tab
const DEFAULT_TAB_LAYOUTS = {
  overview: [
    { i: 'gdp-1', x: 0, y: 0, w: 6, h: 6, minW: 4, minH: 4 },
    { i: 'inflation-1', x: 6, y: 0, w: 6, h: 6, minW: 4, minH: 4 },
    { i: 'claims-1', x: 0, y: 6, w: 6, h: 6, minW: 4, minH: 4 },
    { i: 'jobs-1', x: 6, y: 6, w: 6, h: 6, minW: 4, minH: 4 },
  ],
  'fed-policy': [{ i: 'fed-1', x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 5 }],
  'yield-curve': [{ i: 'yield-1', x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 5 }],
  inflation: [{ i: 'inflation-tab-1', x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 5 }],
  'labor-market': [{ i: 'labor-1', x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 5 }],
  'financial-conditions': [{ i: 'fin-1', x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 5 }],
  sentiment: [{ i: 'sentiment-1', x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 5 }],
  commodities: [{ i: 'commodities-1', x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 5 }],
};

export default function MacroDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeTab = searchParams.get('tab') || 'overview';
  const globalContext = useGlobalWidgetContext();

  const [gridWidth, setGridWidth] = useState(1200);
  const [contextMenu, setContextMenu] = useState(null);
  const containerRef = useRef(null);

  // Load widgets and layouts from localStorage
  const [tabWidgets, setTabWidgets] = useState(() => {
    const saved = localStorage.getItem('macro-tab-widgets');
    return saved ? JSON.parse(saved) : DEFAULT_TAB_WIDGETS;
  });

  const [tabLayouts, setTabLayouts] = useState(() => {
    const layouts = {};
    MACRO_TABS.forEach(tab => {
      const saved = localStorage.getItem(`macro-${tab.id}-layout`);
      layouts[tab.id] = saved ? JSON.parse(saved) : DEFAULT_TAB_LAYOUTS[tab.id] || [];
    });
    return layouts;
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('macro-tab-widgets', JSON.stringify(tabWidgets));
  }, [tabWidgets]);

  useEffect(() => {
    Object.entries(tabLayouts).forEach(([tabId, layout]) => {
      if (layout && layout.length > 0) {
        localStorage.setItem(`macro-${tabId}-layout`, JSON.stringify(layout));
      }
    });
  }, [tabLayouts]);

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

  // Current tab's data
  const currentWidgets = tabWidgets[activeTab] || [];
  const currentLayout = tabLayouts[activeTab] || [];
  const availableWidgets = TAB_WIDGETS[activeTab] || [];

  // Handle widget addition
  const handleAddWidget = useCallback((widgetConfig) => {
    const newWidget = {
      id: `widget-${Date.now()}`,
      type: widgetConfig.id,
    };

    setTabWidgets(prev => ({
      ...prev,
      [activeTab]: [...(prev[activeTab] || []), newWidget]
    }));

    const size = widgetConfig.defaultSize || { w: 6, h: 6 };
    const newLayoutItem = {
      i: newWidget.id,
      x: 0,
      y: Infinity,
      w: size.w,
      h: size.h,
      minW: 4,
      minH: 4
    };

    setTabLayouts(prev => ({
      ...prev,
      [activeTab]: [...(prev[activeTab] || []), newLayoutItem]
    }));

    setContextMenu(null);
  }, [activeTab]);

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

  const handleTabChange = useCallback((newTabId) => {
    navigate(`/?view=macro-analysis&tab=${newTabId}`, { replace: true });
  }, [navigate]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  // Render widget based on type
  const renderWidget = useCallback((widget) => {
    const onRemove = () => handleRemoveWidget(widget.id);

    switch (widget.type) {
      case 'gdp-forecast':
        return <GDPForecastWidget onRemove={onRemove} />;
      case 'inflation-momentum':
        return <InflationMomentumWidget onRemove={onRemove} />;
      case 'initial-claims':
        return <InitialClaimsWidget onRemove={onRemove} />;
      case 'jobs-breakdown':
        return <JobsBreakdownWidget onRemove={onRemove} />;
      case 'fed-policy-tab':
        return (
          <TabWidgetWrapper title="Fed Policy" onRemove={onRemove}>
            <MacroFedPolicyTab />
          </TabWidgetWrapper>
        );
      case 'yield-curve-tab':
        return (
          <TabWidgetWrapper title="Yield Curve" onRemove={onRemove}>
            <MacroYieldCurveTab />
          </TabWidgetWrapper>
        );
      case 'inflation-tab':
        return (
          <TabWidgetWrapper title="Inflation Analysis" onRemove={onRemove}>
            <MacroInflationTab />
          </TabWidgetWrapper>
        );
      case 'labor-tab':
        return (
          <TabWidgetWrapper title="Labor Market" onRemove={onRemove}>
            <MacroLaborTab />
          </TabWidgetWrapper>
        );
      case 'fin-conditions-tab':
        return (
          <TabWidgetWrapper title="Financial Conditions" onRemove={onRemove}>
            <MacroFinConditionsTab />
          </TabWidgetWrapper>
        );
      case 'sentiment-tab':
        return (
          <TabWidgetWrapper title="Market Sentiment" onRemove={onRemove}>
            <MacroSentimentTab />
          </TabWidgetWrapper>
        );
      case 'commodities-tab':
        return (
          <TabWidgetWrapper title="Commodities" onRemove={onRemove}>
            <MacroCommoditiesTab />
          </TabWidgetWrapper>
        );
      default:
        return <div className="p-4 text-gray-500">Unknown widget type: {widget.type}</div>;
    }
  }, [handleRemoveWidget]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[calc(100vh-56px)] flex flex-col bg-[#0a0a0f]"
      onContextMenu={handleContextMenu}
    >
      {/* Page Header */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-xl font-bold text-white">Macro Analysis</h2>
        <p className="text-sm text-gray-400">Economic indicators, Fed policy, and market conditions</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800 px-4">
        <div className="flex gap-1 overflow-x-auto">
          {MACRO_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-3 py-2 text-sm font-medium transition-colors relative whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Layout Content */}
      <div className="flex-1 overflow-auto p-4">
        <GridLayout
          className="layout"
          layout={currentLayout}
          cols={12}
          rowHeight={50}
          width={gridWidth - 32}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".drag-handle-area"
          compactType="vertical"
          preventCollision={false}
          isResizable={true}
          isDraggable={true}
          margin={[12, 12]}
        >
          {currentWidgets.map((widget) => (
            <div key={widget.id} className="overflow-hidden">
              {renderWidget(widget)}
            </div>
          ))}
        </GridLayout>

        {currentWidgets.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <p>No widgets</p>
            <p className="text-sm">Right-click to add widgets</p>
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
    </div>
  );
}
