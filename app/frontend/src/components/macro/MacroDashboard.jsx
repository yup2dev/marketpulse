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
import FedPolicyStanceWidget from '../widgets/macro/FedPolicyStanceWidget';
import YieldCurveSnapshotWidget from '../widgets/macro/YieldCurveSnapshotWidget';
import YieldTrendsWidget from '../widgets/macro/YieldTrendsWidget';
import InflationDecompWidget from '../widgets/macro/InflationDecompWidget';
import InflationTrendsWidget from '../widgets/macro/InflationTrendsWidget';
import LaborMarketWidget from '../widgets/macro/LaborMarketWidget';
import PMIWidget from '../widgets/macro/PMIWidget';
import FedBalanceSheetWidget from '../widgets/macro/FedBalanceSheetWidget';
import RealRatesWidget from '../widgets/macro/RealRatesWidget';
// Tab components (remaining tabs still use TabWidgetWrapper)
import MacroFinConditionsTab from './MacroFinConditionsTab';
import MacroSentimentTab from './MacroSentimentTab';
import MacroCommoditiesTab from './MacroCommoditiesTab';
import TabWidgetWrapper from '../widgets/TabWidgetWrapper';
import WidgetContextMenu from '../common/WidgetContextMenu';
import { useGlobalWidgetContext } from '../../contexts/GlobalWidgetContext';
import 'react-grid-layout/css/styles.css';

// Tab configuration
const MACRO_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'business-cycle', label: 'Business Cycle' },
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
  'business-cycle': [
    { id: 'pmi', name: 'ISM PMI / LEI', description: 'Manufacturing PMI & Leading Economic Index', defaultSize: { w: 8, h: 6 } },
  ],
  'fed-policy': [
    { id: 'fed-policy-stance', name: 'Fed Policy Stance', description: 'Fed stance, probabilities & signals', defaultSize: { w: 6, h: 6 } },
    { id: 'fed-balance-sheet', name: 'Fed Balance Sheet', description: 'QE/QT monitor — total assets', defaultSize: { w: 6, h: 6 } },
  ],
  'yield-curve': [
    { id: 'yield-curve-snapshot', name: 'Yield Curve', description: 'Current yield curve shape', defaultSize: { w: 6, h: 6 } },
    { id: 'yield-trends', name: 'Yield Trends', description: 'Historical yield trends & spreads', defaultSize: { w: 6, h: 6 } },
    { id: 'real-rates', name: 'Real Rates (TIPS)', description: 'Nominal vs real yields vs breakeven inflation', defaultSize: { w: 6, h: 6 } },
  ],
  inflation: [
    { id: 'inflation-decomp', name: 'Inflation Decomposition', description: 'CPI components breakdown', defaultSize: { w: 6, h: 6 } },
    { id: 'inflation-trends', name: 'Inflation Trends', description: 'Historical CPI sector trends', defaultSize: { w: 6, h: 6 } },
  ],
  'labor-market': [
    { id: 'labor-market-dashboard', name: 'Labor Market', description: 'Employment metrics dashboard', defaultSize: { w: 6, h: 6 } },
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
  'business-cycle': [
    { id: 'pmi-1', type: 'pmi' },
  ],
  'fed-policy': [
    { id: 'fed-1', type: 'fed-policy-stance' },
    { id: 'fed-bs-1', type: 'fed-balance-sheet' },
  ],
  'yield-curve': [
    { id: 'yield-snap-1', type: 'yield-curve-snapshot' },
    { id: 'yield-trends-1', type: 'yield-trends' },
    { id: 'real-rates-1', type: 'real-rates' },
  ],
  inflation: [
    { id: 'inflation-decomp-1', type: 'inflation-decomp' },
    { id: 'inflation-trends-1', type: 'inflation-trends' },
  ],
  'labor-market': [{ id: 'labor-dash-1', type: 'labor-market-dashboard' }],
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
  'business-cycle': [
    { i: 'pmi-1', x: 0, y: 0, w: 8, h: 7, minW: 5, minH: 5 },
  ],
  'fed-policy': [
    { i: 'fed-1', x: 0, y: 0, w: 6, h: 6, minW: 4, minH: 4 },
    { i: 'fed-bs-1', x: 6, y: 0, w: 6, h: 6, minW: 4, minH: 4 },
  ],
  'yield-curve': [
    { i: 'yield-snap-1', x: 0, y: 0, w: 6, h: 6, minW: 4, minH: 4 },
    { i: 'yield-trends-1', x: 6, y: 0, w: 6, h: 6, minW: 4, minH: 4 },
    { i: 'real-rates-1', x: 0, y: 6, w: 8, h: 7, minW: 5, minH: 5 },
  ],
  inflation: [
    { i: 'inflation-decomp-1', x: 0, y: 0, w: 6, h: 6, minW: 4, minH: 4 },
    { i: 'inflation-trends-1', x: 6, y: 0, w: 6, h: 6, minW: 4, minH: 4 },
  ],
  'labor-market': [{ i: 'labor-dash-1', x: 0, y: 0, w: 6, h: 6, minW: 4, minH: 4 }],
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

  // Load widgets and layouts from localStorage, merging defaults for any new tabs
  const [tabWidgets, setTabWidgets] = useState(() => {
    const saved = localStorage.getItem('macro-tab-widgets');
    if (!saved) return DEFAULT_TAB_WIDGETS;
    const parsed = JSON.parse(saved);
    // Merge: for any tab defined in defaults but missing from saved, add it
    const merged = { ...parsed };
    Object.entries(DEFAULT_TAB_WIDGETS).forEach(([tabId, widgets]) => {
      if (!merged[tabId]) merged[tabId] = widgets;
    });
    return merged;
  });

  const [tabLayouts, setTabLayouts] = useState(() => {
    const layouts = {};
    MACRO_TABS.forEach(tab => {
      const saved = localStorage.getItem(`macro-${tab.id}-layout`);
      layouts[tab.id] = saved ? JSON.parse(saved) : DEFAULT_TAB_LAYOUTS[tab.id] || [];
      // If saved layout is missing entries for new default widgets, reset to default
      if (saved && DEFAULT_TAB_LAYOUTS[tab.id]) {
        const savedIds = new Set(JSON.parse(saved).map(l => l.i));
        const defaultIds = DEFAULT_TAB_LAYOUTS[tab.id].map(l => l.i);
        if (defaultIds.some(id => !savedIds.has(id))) {
          layouts[tab.id] = DEFAULT_TAB_LAYOUTS[tab.id];
        }
      }
    });
    return layouts;
  });

  // Migrate old widget types to new ones
  useEffect(() => {
    const OLD_TYPES = ['fed-policy-tab', 'yield-curve-tab', 'inflation-tab', 'labor-tab'];
    const saved = localStorage.getItem('macro-tab-widgets');
    if (!saved) return;
    const parsed = JSON.parse(saved);
    let needsMigration = false;
    for (const tabId of Object.keys(parsed)) {
      const widgets = parsed[tabId] || [];
      if (widgets.some(w => OLD_TYPES.includes(w.type))) {
        needsMigration = true;
        break;
      }
    }
    if (needsMigration) {
      // Reset affected tabs to defaults
      const migrated = { ...parsed };
      if (migrated['fed-policy']?.some(w => w.type === 'fed-policy-tab')) {
        migrated['fed-policy'] = DEFAULT_TAB_WIDGETS['fed-policy'];
        localStorage.setItem('macro-fed-policy-layout', JSON.stringify(DEFAULT_TAB_LAYOUTS['fed-policy']));
      }
      if (migrated['yield-curve']?.some(w => w.type === 'yield-curve-tab')) {
        migrated['yield-curve'] = DEFAULT_TAB_WIDGETS['yield-curve'];
        localStorage.setItem('macro-yield-curve-layout', JSON.stringify(DEFAULT_TAB_LAYOUTS['yield-curve']));
      }
      if (migrated['inflation']?.some(w => w.type === 'inflation-tab')) {
        migrated['inflation'] = DEFAULT_TAB_WIDGETS['inflation'];
        localStorage.setItem('macro-inflation-layout', JSON.stringify(DEFAULT_TAB_LAYOUTS['inflation']));
      }
      if (migrated['labor-market']?.some(w => w.type === 'labor-tab')) {
        migrated['labor-market'] = DEFAULT_TAB_WIDGETS['labor-market'];
        localStorage.setItem('macro-labor-market-layout', JSON.stringify(DEFAULT_TAB_LAYOUTS['labor-market']));
      }
      localStorage.setItem('macro-tab-widgets', JSON.stringify(migrated));
      setTabWidgets(migrated);
      // Reload layouts for migrated tabs
      const newLayouts = {};
      MACRO_TABS.forEach(tab => {
        const savedLayout = localStorage.getItem(`macro-${tab.id}-layout`);
        newLayouts[tab.id] = savedLayout ? JSON.parse(savedLayout) : DEFAULT_TAB_LAYOUTS[tab.id] || [];
      });
      setTabLayouts(newLayouts);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    navigate(`/macro?tab=${newTabId}`, { replace: true });
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
      case 'fed-policy-stance':
        return <FedPolicyStanceWidget onRemove={onRemove} />;
      case 'yield-curve-snapshot':
        return <YieldCurveSnapshotWidget onRemove={onRemove} />;
      case 'yield-trends':
        return <YieldTrendsWidget onRemove={onRemove} />;
      case 'inflation-decomp':
        return <InflationDecompWidget onRemove={onRemove} />;
      case 'inflation-trends':
        return <InflationTrendsWidget onRemove={onRemove} />;
      case 'labor-market-dashboard':
        return <LaborMarketWidget onRemove={onRemove} />;
      case 'pmi':
        return <PMIWidget onRemove={onRemove} />;
      case 'fed-balance-sheet':
        return <FedBalanceSheetWidget onRemove={onRemove} />;
      case 'real-rates':
        return <RealRatesWidget onRemove={onRemove} />;
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
