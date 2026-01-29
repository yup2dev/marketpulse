/**
 * Widget Context - Global widget management for all pages
 * Provides right-click context menu functionality across the application
 */
import { createContext, useContext, useState, useCallback } from 'react';
import WidgetContextMenu from '../components/common/WidgetContextMenu';

// Default widgets available across all dashboards
const DEFAULT_WIDGETS = [
  { id: 'market-overview', name: 'Market Overview', description: 'Global market indices overview', defaultSize: { w: 12, h: 3 } },
  { id: 'live-watchlist', name: 'Live Watchlist', description: 'Real-time watchlist with sparklines', defaultSize: { w: 8, h: 5 } },
  { id: 'ticker-information', name: 'Ticker Information', description: 'Detailed ticker info with chart', needsStock: true, defaultSize: { w: 4, h: 5 } },
  { id: 'ticker-info', name: 'Ticker Info', description: 'Price, change, and volume', needsStock: true, defaultSize: { w: 4, h: 6 } },
  { id: 'key-metrics', name: 'Key Metrics', description: 'P/E, EPS, market cap, etc.', needsStock: true, defaultSize: { w: 4, h: 7 } },
  { id: 'advanced-chart', name: 'Advanced Chart', description: 'Multi-ticker comparison & analysis', needsStock: true, defaultSize: { w: 12, h: 8 } },
  { id: 'financials', name: 'Financials', description: 'Income, balance sheet, cash flow', needsStock: true, defaultSize: { w: 6, h: 9 } },
  { id: 'stock-quote', name: 'Stock Quote', description: 'A simple stock quote with a chart', needsStock: true, defaultSize: { w: 5, h: 7 } },
  { id: 'watchlist', name: 'Watchlist', description: 'Manage favorite stocks', defaultSize: { w: 4, h: 5 } },
  { id: 'earnings', name: 'Earnings', description: 'Upcoming and past earnings', needsStock: true, defaultSize: { w: 4, h: 5 } },
  { id: 'analyst', name: 'Analyst Ratings', description: 'Analyst recommendations', needsStock: true, defaultSize: { w: 4, h: 5 } },
  { id: 'insider', name: 'Insider Trading', description: 'Insider trading activity', needsStock: true, defaultSize: { w: 4, h: 5 } },
];

// Page-specific widget configurations
const PAGE_WIDGETS = {
  'professional': DEFAULT_WIDGETS,
  'stock': DEFAULT_WIDGETS.filter(w => w.needsStock || ['market-overview', 'live-watchlist', 'watchlist'].includes(w.id)),
  'macro-analysis': [
    { id: 'yield-curve', name: 'Yield Curve', description: 'US Treasury yield curve and spreads', defaultSize: { w: 8, h: 8 } },
    { id: 'market-overview', name: 'Market Overview', description: 'Global market indices overview', defaultSize: { w: 12, h: 3 } },
  ],
  'alerts': [
    { id: 'alert-statistics', name: 'Alert Statistics', description: 'Overall alert statistics', defaultSize: { w: 4, h: 6 } },
    { id: 'recent-triggers', name: 'Recent Triggers', description: 'Recent alert triggers', defaultSize: { w: 8, h: 7 } },
    { id: 'active-alerts', name: 'Active Alerts', description: 'Currently active alerts', defaultSize: { w: 6, h: 8 } },
  ],
  'portfolio': [
    { id: 'portfolio-overview', name: 'Portfolio Overview', description: 'Portfolio summary and performance', defaultSize: { w: 6, h: 6 } },
    { id: 'holdings', name: 'Holdings', description: 'Current holdings list', defaultSize: { w: 6, h: 8 } },
    { id: 'performance-chart', name: 'Performance Chart', description: 'Portfolio performance over time', defaultSize: { w: 8, h: 5 } },
  ],
  'screener': [
    { id: 'screener-results', name: 'Screener Results', description: 'Stock screening results', defaultSize: { w: 12, h: 8 } },
    { id: 'screener-presets', name: 'Screener Presets', description: 'Saved screener presets', defaultSize: { w: 4, h: 6 } },
  ],
  default: DEFAULT_WIDGETS,
};

const WidgetContext = createContext(null);

export const useWidgetContext = () => {
  const context = useContext(WidgetContext);
  if (!context) {
    throw new Error('useWidgetContext must be used within a WidgetProvider');
  }
  return context;
};

export const WidgetProvider = ({ children, pageId = 'default', onAddWidget }) => {
  const [contextMenu, setContextMenu] = useState(null);
  const [customWidgets, setCustomWidgets] = useState([]);

  // Get available widgets for current page
  const availableWidgets = PAGE_WIDGETS[pageId] || PAGE_WIDGETS.default;
  const allWidgets = [...availableWidgets, ...customWidgets];

  // Handle right-click to show context menu
  const handleContextMenu = useCallback((e) => {
    // Don't show menu if clicking on interactive elements
    const target = e.target;
    const isInteractive = target.closest('button, a, input, select, textarea, [role="button"], .no-context-menu');

    if (!isInteractive) {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  }, []);

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Handle widget selection
  const handleSelectWidget = useCallback((widget) => {
    if (onAddWidget) {
      onAddWidget(widget);
    }
    setContextMenu(null);
  }, [onAddWidget]);

  // Register additional widgets
  const registerWidgets = useCallback((widgets) => {
    setCustomWidgets(prev => {
      const newWidgets = widgets.filter(w => !prev.some(p => p.id === w.id));
      return [...prev, ...newWidgets];
    });
  }, []);

  // Unregister widgets
  const unregisterWidgets = useCallback((widgetIds) => {
    setCustomWidgets(prev => prev.filter(w => !widgetIds.includes(w.id)));
  }, []);

  const value = {
    contextMenu,
    availableWidgets: allWidgets,
    handleContextMenu,
    closeContextMenu,
    handleSelectWidget,
    registerWidgets,
    unregisterWidgets,
  };

  return (
    <WidgetContext.Provider value={value}>
      <div onContextMenu={handleContextMenu} className="min-h-full">
        {children}
      </div>

      {/* Global Context Menu */}
      {contextMenu && (
        <WidgetContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          availableWidgets={allWidgets}
          onSelect={handleSelectWidget}
        />
      )}
    </WidgetContext.Provider>
  );
};

export default WidgetContext;
