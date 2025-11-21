import { useState, useEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import DataWidget from './DataWidget';
import { useApi } from '../hooks/useApi';
import { API_ENDPOINTS } from '../config/api';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

const Dashboard = () => {
  // Fetch health check to verify API connection
  const { data: healthData, error: healthError } = useApi(API_ENDPOINTS.health);

  const [layouts, setLayouts] = useState({
    lg: [
      { i: 'price-chart', x: 0, y: 0, w: 8, h: 4, minW: 4, minH: 3 },
      { i: 'volume-chart', x: 8, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
      { i: 'market-data', x: 0, y: 4, w: 6, h: 4, minW: 4, minH: 3 },
      { i: 'economic-indicators', x: 6, y: 4, w: 6, h: 4, minW: 4, minH: 3 },
    ],
  });

  const [widgets, setWidgets] = useState({
    'price-chart': {
      title: 'Price Performance',
      data: generateMockData(30, 'price'),
      columns: [
        { key: 'date', label: 'Date', format: 'date' },
        { key: 'open', label: 'Open', format: 'currency' },
        { key: 'high', label: 'High', format: 'currency' },
        { key: 'low', label: 'Low', format: 'currency' },
        { key: 'close', label: 'Close', format: 'currency' },
      ],
      chartConfig: {
        type: 'line',
        xKey: 'date',
        yKeys: ['close', 'open'],
        colors: ['#00d9ff', '#3fb950'],
      },
      defaultView: 'chart',
    },
    'volume-chart': {
      title: 'Trading Volume',
      data: generateMockData(30, 'volume'),
      columns: [
        { key: 'date', label: 'Date', format: 'date' },
        { key: 'volume', label: 'Volume', format: 'number' },
      ],
      chartConfig: {
        type: 'bar',
        xKey: 'date',
        yKeys: ['volume'],
        colors: ['#7c3aed'],
      },
      defaultView: 'chart',
    },
    'market-data': {
      title: 'Market Statistics',
      data: generateMarketData(),
      columns: [
        { key: 'metric', label: 'Metric' },
        { key: 'value', label: 'Value', format: 'currency' },
        { key: 'change', label: 'Change', format: 'percent' },
      ],
      chartConfig: {
        type: 'bar',
        xKey: 'metric',
        yKeys: ['value'],
        colors: ['#00d9ff'],
      },
      defaultView: 'table',
      enableDatePicker: false,
    },
    'economic-indicators': {
      title: 'Economic Indicators',
      data: generateEconomicData(),
      columns: [
        { key: 'indicator', label: 'Indicator' },
        { key: 'value', label: 'Value', format: 'number' },
        { key: 'trend', label: 'Trend', format: 'percent' },
      ],
      chartConfig: {
        type: 'line',
        xKey: 'indicator',
        yKeys: ['value'],
        colors: ['#3fb950'],
      },
      defaultView: 'table',
      enableDatePicker: false,
    },
  });

  const handleLayoutChange = (layout, layouts) => {
    setLayouts(layouts);
    // Save to localStorage or backend
    localStorage.setItem('dashboard-layouts', JSON.stringify(layouts));
  };

  const handleDateChange = (widgetId, dateRange) => {
    console.log(`Date changed for ${widgetId}:`, dateRange);
    // Fetch new data based on date range
    // This would typically call your API
  };

  const handleRefresh = async (widgetId) => {
    console.log(`Refreshing ${widgetId}`);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Update widget data
  };

  const handleClose = (widgetId) => {
    const newLayouts = { ...layouts };
    Object.keys(newLayouts).forEach(breakpoint => {
      newLayouts[breakpoint] = newLayouts[breakpoint].filter(item => item.i !== widgetId);
    });
    setLayouts(newLayouts);

    const newWidgets = { ...widgets };
    delete newWidgets[widgetId];
    setWidgets(newWidgets);
  };

  // Load layouts from localStorage on mount
  useEffect(() => {
    const savedLayouts = localStorage.getItem('dashboard-layouts');
    if (savedLayouts) {
      try {
        setLayouts(JSON.parse(savedLayouts));
      } catch (e) {
        console.error('Failed to parse saved layouts');
      }
    }
  }, []);

  return (
    <div className="h-screen w-full overflow-hidden bg-background-primary">
      {/* Header */}
      <div className="h-16 bg-background-secondary border-b border-gray-800 px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M6 18L12 12L16 16L20 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-text-primary">MarketPulse</h1>
            {/* API Status Indicator */}
            {healthError ? (
              <span className="ml-2 px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">API Offline</span>
            ) : healthData ? (
              <span className="ml-2 px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">API Connected</span>
            ) : null}
          </div>
          <div className="h-6 w-px bg-gray-700"></div>
          <input
            type="text"
            placeholder="Search ticker (Ctrl+K)"
            className="w-64 px-3 py-1.5 bg-background-tertiary border border-gray-700 rounded text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 bg-primary text-background-primary rounded text-sm font-medium hover:bg-primary-dark transition-colors">
            Add Widget
          </button>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="h-[calc(100vh-4rem)] overflow-auto p-4">
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={60}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".draggable-handle"
          isDraggable={true}
          isResizable={true}
          compactType="vertical"
          preventCollision={false}
        >
          {Object.entries(widgets).map(([id, config]) => (
            <div key={id}>
              <DataWidget
                id={id}
                title={config.title}
                data={config.data}
                columns={config.columns}
                chartConfig={config.chartConfig}
                defaultView={config.defaultView}
                enableDatePicker={config.enableDatePicker}
                onDateChange={(dateRange) => handleDateChange(id, dateRange)}
                onRefresh={() => handleRefresh(id)}
                onClose={() => handleClose(id)}
              />
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>
    </div>
  );
};

// Mock data generators
function generateMockData(days, type) {
  const data = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    if (type === 'price') {
      const basePrice = 150 + Math.random() * 50;
      data.push({
        date: date.toLocaleDateString(),
        open: basePrice + Math.random() * 5,
        high: basePrice + Math.random() * 10,
        low: basePrice - Math.random() * 5,
        close: basePrice + Math.random() * 5,
      });
    } else if (type === 'volume') {
      data.push({
        date: date.toLocaleDateString(),
        volume: Math.floor(1000000 + Math.random() * 5000000),
      });
    }
  }

  return data;
}

function generateMarketData() {
  return [
    { metric: 'Market Cap', value: 2500000000, change: 2.5 },
    { metric: 'P/E Ratio', value: 25.3, change: -0.8 },
    { metric: 'EPS', value: 5.67, change: 3.2 },
    { metric: 'Dividend Yield', value: 1.8, change: 0.1 },
    { metric: 'Beta', value: 1.15, change: -0.05 },
  ];
}

function generateEconomicData() {
  return [
    { indicator: 'GDP Growth', value: 2.8, trend: 0.3 },
    { indicator: 'Unemployment', value: 3.7, trend: -0.2 },
    { indicator: 'Inflation', value: 3.2, trend: 0.1 },
    { indicator: 'Interest Rate', value: 5.25, trend: 0 },
    { indicator: 'Consumer Confidence', value: 102.5, trend: 1.2 },
  ];
}

export default Dashboard;
