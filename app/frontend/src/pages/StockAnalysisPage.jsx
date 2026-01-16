import { useState, createContext, useContext } from 'react';
import WidgetDashboard from '../components/WidgetDashboard';
import StockSelector from '../components/StockSelector';

// 1. Create the context for stock-related data
export const StockContext = createContext(null);

// Custom hook for easy access to the context
export const useStock = () => {
  const context = useContext(StockContext);
  if (!context) {
    throw new Error('useStock must be used within a StockProvider');
  }
  return context;
};

// 2. Define the widgets available for THIS dashboard
const availableStockWidgets = [
  { id: 'ticker-info', name: 'Ticker Info', description: 'Price, change, and volume.', defaultSize: { w: 4, h: 6 } },
  { id: 'key-metrics', name: 'Key Metrics', description: 'P/E, EPS, market cap, etc.', defaultSize: { w: 4, h: 7 } },
  { id: 'advanced-chart', name: 'Advanced Chart', description: 'Multi-ticker comparison & analysis.', defaultSize: { w: 12, h: 8 } },
  { id: 'financials', name: 'Financials', description: 'Income, balance sheet, cash flow.', defaultSize: { w: 6, h: 9 } },
  { id: 'stock-quote', name: 'Simple Quote', description: 'A simple stock quote with a chart.', defaultSize: { w: 5, h: 7 } },
];


export default function StockAnalysisPage() {
  const [symbol, setSymbol] = useState('NVDA');

  // The context value that will be passed down
  const contextValue = {
    symbol,
    setSymbol,
  };

  // When adding a widget that needs a symbol, we add it to the widget's props
  const handleAddWidget = (widgetConfig) => {
    return {
      ...widgetConfig,
      initialProps: {
        symbol: symbol
      }
    };
  }

  return (
    <StockContext.Provider value={contextValue}>
        {/* This is the context-specific UI, like the stock selector */}
        <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                <h2 className="text-2xl font-bold text-white">Stock Analysis</h2>
                <p className="text-gray-400">Select a stock to begin deep dive analysis.</p>
                </div>
            </div>
            <StockSelector onSelect={(stock) => setSymbol(stock.symbol)} />
        </div>

        {/* Render the generic dashboard, passing it the config it needs */}
        <WidgetDashboard
            dashboardId="stock-analysis-dashboard"
            title="My Stock Dashboard"
            subtitle="Your personal space for stock widgets."
            availableWidgets={availableStockWidgets.map(handleAddWidget)}
        />
    </StockContext.Provider>
  );
}
