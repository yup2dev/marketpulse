 import { useState, useEffect, useRef } from 'react';
import GridLayout from 'react-grid-layout';
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Calendar, RefreshCw, Maximize2, Plus, BarChart3, Table2 } from 'lucide-react';
import StockSelector from './StockSelector';
import StockSelectorModal from './StockSelectorModal';
import ResizableStockWidget from './ResizableStockWidget';
import FinancialWidget from './widgets/FinancialWidget';
import ChartWidget from './widgets/ChartWidget';
import TickerInfoWidget from './widgets/TickerInfoWidget';
import KeyMetricsWidget from './widgets/KeyMetricsWidget';
import InstitutionalPortfolios from './InstitutionalPortfolios';
import { formatNumber, formatCurrency, formatPercent } from '../utils/widgetUtils';
import { API_BASE } from '../config/api';
import 'react-grid-layout/css/styles.css';

const STOCK_TABS = ['Overview', 'Financials', 'Institutional Holdings', 'Comparison Analysis', 'Ownership', 'Company Calendar', 'Estimates'];

function ImprovedStockDashboard() {
  const [symbol, setSymbol] = useState('NVDA');
  const [activeTab, setActiveTab] = useState('overview');
  const [quote, setQuote] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [history, setHistory] = useState([]);
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showStockSelector, setShowStockSelector] = useState(false);
  const [selectedWidgetType, setSelectedWidgetType] = useState('advanced-chart');
  const [widgets, setWidgets] = useState([]);
  const [layout, setLayout] = useState([]);
  const [gridWidth, setGridWidth] = useState(1200);
  const [financialsViewMode, setFinancialsViewMode] = useState('table');
  const [financialsPeriod, setFinancialsPeriod] = useState('quarterly'); // 'quarterly' or 'annual'
  const containerRef = useRef(null);

  useEffect(() => {
    loadStockData();
  }, [symbol]);

  const loadStockData = async () => {
    setLoading(true);
    try {
      const [quoteRes, infoRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/stock/quote/${symbol}`),
        fetch(`${API_BASE}/stock/info/${symbol}`),
        fetch(`${API_BASE}/stock/history/${symbol}?period=6mo`)
      ]);

      if (quoteRes.ok) setQuote(await quoteRes.json());
      if (infoRes.ok) setCompanyInfo(await infoRes.json());
      if (historyRes.ok) {
        const histData = await historyRes.json();
        setHistory(histData.data || []);
      }

      if (activeTab === 'financials') {
        const finRes = await fetch(`${API_BASE}/stock/financials/${symbol}`);
        if (finRes.ok) setFinancials(await finRes.json());
      }
    } catch (error) {
      console.error('Error loading stock data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFinancials = async () => {
    try {
      const res = await fetch(`${API_BASE}/stock/financials/${symbol}?freq=${financialsPeriod}&limit=4`);
      if (res.ok) {
        setFinancials(await res.json());
      }
    } catch (error) {
      console.error('Error loading financials:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'financials') {
      loadFinancials();
    }
  }, [activeTab, symbol, financialsPeriod]);

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

  // Load widgets from localStorage
  useEffect(() => {
    const savedWidgets = localStorage.getItem('analysis-widgets');
    const savedLayout = localStorage.getItem('analysis-layout');

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
      localStorage.setItem('analysis-widgets', JSON.stringify(widgets));
    }
  }, [widgets]);

  useEffect(() => {
    if (layout.length > 0) {
      localStorage.setItem('analysis-layout', JSON.stringify(layout));
    }
  }, [layout]);

  const handleStockSelect = (stock) => {
    setSymbol(stock.symbol);
    setShowStockSelector(false);
  };

  const handleAddWidget = (stock) => {
    const newWidget = {
      id: `widget-${Date.now()}`,
      type: selectedWidgetType,
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

    const size = getWidgetSize(selectedWidgetType);
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
    setShowStockSelector(false);
  };

  const handleRemoveWidget = (widgetId) => {
    setWidgets(widgets.filter(w => w.id !== widgetId));
    setLayout(layout.filter(l => l.i !== widgetId));
  };

  const handleLayoutChange = (newLayout) => {
    setLayout(newLayout);
    // Save immediately to localStorage
    if (newLayout.length > 0) {
      localStorage.setItem('analysis-layout', JSON.stringify(newLayout));
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
            widgetId={widget.id}
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
    <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stock Selector Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white">Stock Analysis</h2>
              <p className="text-gray-400">Deep dive into company fundamentals and performance</p>
            </div>
            <button
              onClick={() => setShowStockSelector(!showStockSelector)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-white text-sm font-medium"
            >
              {showStockSelector ? 'Hide Selector' : 'Change Stock'}
            </button>
          </div>

          {showStockSelector === true && (
            <div className="mb-6">
              <StockSelector onSelect={handleStockSelect} />
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-800 mb-6">
          <div className="flex gap-6">
            {STOCK_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab.toLowerCase().replace(' ', '-'))}
                className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                  activeTab === tab.toLowerCase().replace(' ', '-')
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab}
                {activeTab === tab.toLowerCase().replace(' ', '-') && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 gap-6">
            {/* Ticker Information */}
            <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Ticker Information</h3>
                <div className="flex gap-2 text-gray-400">
                  <button onClick={loadStockData} className="hover:text-white p-1" title="Refresh">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* Mini Chart */}
              <div className="mb-4 h-32 bg-gradient-to-br from-green-900/20 to-transparent rounded">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history.slice(-30)}>
                    <Line type="monotone" dataKey="close" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Price Info */}
              {quote && (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Price</span>
                    <span className="font-semibold text-white">${quote.price?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Day's Change</span>
                    <span className={quote.change >= 0 ? 'text-green-500' : 'text-red-500'}>
                      {quote.change >= 0 ? <TrendingUp className="inline" size={14} /> : <TrendingDown className="inline" size={14} />}
                      {quote.change?.toFixed(2)} ({formatPercent(quote.change_percent)})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Volume</span>
                    <span className="text-white">{formatNumber(quote.volume)}</span>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <span className="px-3 py-1 bg-gray-800 rounded text-xs text-gray-300">
                      {companyInfo?.sector || 'Technology'}
                    </span>
                    <span className="px-3 py-1 bg-gray-800 rounded text-xs text-gray-300">US</span>
                    <span className="px-3 py-1 bg-gray-800 rounded text-xs text-gray-300">NASDAQ</span>
                  </div>
                </div>
              )}
            </div>

            {/* Price Performance Chart */}
            <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Price Performance</h3>
              </div>

              {quote && (
                <div className="mb-4">
                  <div className="text-2xl font-bold text-white mb-2">{companyInfo?.name || symbol}</div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-gray-400">O <span className="text-white">{quote.open?.toFixed(2)}</span></span>
                    <span className="text-gray-400">H <span className="text-white">{quote.high?.toFixed(2)}</span></span>
                    <span className="text-gray-400">L <span className="text-white">{quote.low?.toFixed(2)}</span></span>
                    <span className="text-gray-400">C <span className={quote.change >= 0 ? 'text-green-500' : 'text-red-500'}>
                      {quote.price?.toFixed(2)} {formatPercent(quote.change_percent)}
                    </span></span>
                  </div>
                </div>
              )}

              {/* Main Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={history.slice(-60)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" tick={{ fill: '#666' }} tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short' })} />
                    <YAxis yAxisId="price" orientation="right" tick={{ fill: '#666' }} domain={['dataMin - 50', 'dataMax + 50']} />
                    <YAxis yAxisId="volume" orientation="left" tick={{ fill: '#666' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Bar yAxisId="volume" dataKey="volume" fill="#4ade80" opacity={0.3} />
                    <Line yAxisId="price" type="monotone" dataKey="close" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ticker Profile */}
            <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800 col-span-2">
              <h3 className="text-lg font-semibold text-white mb-4">Ticker Profile</h3>
              {companyInfo && (
                <div>
                  <h4 className="text-xl font-bold mb-2 text-white">{companyInfo.name}</h4>
                  <div className="text-sm text-gray-400 mb-2">{companyInfo.address}</div>
                  <a href={companyInfo.website} className="text-blue-400 hover:underline text-sm">
                    {companyInfo.website}
                  </a>
                  <div className="mt-3 text-sm space-y-1">
                    <div>
                      <span className="text-gray-400">Sector:</span> <span className="text-white">{companyInfo.sector}</span>
                      {', '}
                      <span className="text-gray-400">Industry:</span> <span className="text-white">{companyInfo.industry}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Full time employees:</span> <span className="text-white">{companyInfo.employees?.toLocaleString()}</span>
                    </div>
                  </div>
                  <h5 className="text-base font-semibold mt-4 mb-2 text-white">Description</h5>
                  <p className="text-sm text-gray-300 leading-relaxed">{companyInfo.description}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'financials' && (
          <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
            {/* Header with Controls */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-white">Financial Statements</h3>
                <p className="text-gray-400 text-sm mt-1">Compare {financialsPeriod === 'quarterly' ? 'quarterly' : 'annual'} performance</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Period Selector */}
                <div className="flex bg-gray-800/50 rounded p-1 border border-gray-700">
                  <button
                    onClick={() => setFinancialsPeriod('quarterly')}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      financialsPeriod === 'quarterly' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Quarterly
                  </button>
                  <button
                    onClick={() => setFinancialsPeriod('annual')}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      financialsPeriod === 'annual' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Annual
                  </button>
                </div>
                {/* View Mode Selector */}
                <div className="flex bg-gray-800/50 rounded p-1 border border-gray-700">
                  <button
                    onClick={() => setFinancialsViewMode('table')}
                    className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                      financialsViewMode === 'table' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Table2 size={16} />
                    <span className="text-sm font-medium">Table</span>
                  </button>
                  <button
                    onClick={() => setFinancialsViewMode('chart')}
                    className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                      financialsViewMode === 'chart' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <BarChart3 size={16} />
                    <span className="text-sm font-medium">Chart</span>
                  </button>
                </div>
              </div>
            </div>

            {financials?.periods && financials.periods.length > 0 ? (
              financialsViewMode === 'table' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-[#1a1a1a]">
                      <tr className="border-b border-gray-800">
                        <th className="text-left py-3 px-4 text-gray-400 font-medium sticky left-0 bg-[#1a1a1a] z-10">Metric</th>
                        {financials.periods.map((period, idx) => (
                          <th key={idx} className="text-right py-3 px-4 text-gray-400 font-medium whitespace-nowrap">
                            {new Date(period.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Income Statement */}
                      <tr className="border-b border-gray-700 bg-gray-800/20">
                        <td colSpan={financials.periods.length + 1} className="py-3 px-4 text-blue-400 font-semibold text-sm uppercase">
                          Income Statement
                        </td>
                      </tr>
                      <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="py-2.5 px-4 text-white sticky left-0 bg-[#1a1a1a]">Revenue</td>
                        {financials.periods.map((period, idx) => (
                          <td key={idx} className="text-right py-2.5 px-4 text-white font-medium">
                            {formatCurrency(period.income_statement?.revenue)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="py-2.5 px-4 text-white sticky left-0 bg-[#1a1a1a]">Cost of Revenue</td>
                        {financials.periods.map((period, idx) => (
                          <td key={idx} className="text-right py-2.5 px-4 text-white">
                            {formatCurrency(period.income_statement?.cost_of_revenue)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="py-2.5 px-4 text-white sticky left-0 bg-[#1a1a1a]">Gross Profit</td>
                        {financials.periods.map((period, idx) => (
                          <td key={idx} className="text-right py-2.5 px-4 text-white font-medium">
                            {formatCurrency(period.income_statement?.gross_profit)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="py-2.5 px-4 text-white sticky left-0 bg-[#1a1a1a]">Operating Income</td>
                        {financials.periods.map((period, idx) => (
                          <td key={idx} className="text-right py-2.5 px-4 text-white font-medium">
                            {formatCurrency(period.income_statement?.operating_income)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="py-2.5 px-4 text-white sticky left-0 bg-[#1a1a1a]">Net Income</td>
                        {financials.periods.map((period, idx) => (
                          <td key={idx} className="text-right py-2.5 px-4 text-green-500 font-semibold">
                            {formatCurrency(period.income_statement?.net_income)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="py-2.5 px-4 text-white sticky left-0 bg-[#1a1a1a]">EPS (Diluted)</td>
                        {financials.periods.map((period, idx) => (
                          <td key={idx} className="text-right py-2.5 px-4 text-white">
                            {formatCurrency(period.income_statement?.diluted_eps)}
                          </td>
                        ))}
                      </tr>

                      {/* Balance Sheet */}
                      <tr className="border-b border-gray-700 bg-gray-800/20">
                        <td colSpan={financials.periods.length + 1} className="py-3 px-4 text-blue-400 font-semibold text-sm uppercase pt-6">
                          Balance Sheet
                        </td>
                      </tr>
                      <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="py-2.5 px-4 text-white sticky left-0 bg-[#1a1a1a]">Total Assets</td>
                        {financials.periods.map((period, idx) => (
                          <td key={idx} className="text-right py-2.5 px-4 text-white font-medium">
                            {formatCurrency(period.balance_sheet?.total_assets)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="py-2.5 px-4 text-white sticky left-0 bg-[#1a1a1a]">Cash</td>
                        {financials.periods.map((period, idx) => (
                          <td key={idx} className="text-right py-2.5 px-4 text-white">
                            {formatCurrency(period.balance_sheet?.cash)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="py-2.5 px-4 text-white sticky left-0 bg-[#1a1a1a]">Total Liabilities</td>
                        {financials.periods.map((period, idx) => (
                          <td key={idx} className="text-right py-2.5 px-4 text-white font-medium">
                            {formatCurrency(period.balance_sheet?.total_liabilities)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="py-2.5 px-4 text-white sticky left-0 bg-[#1a1a1a]">Total Equity</td>
                        {financials.periods.map((period, idx) => (
                          <td key={idx} className="text-right py-2.5 px-4 text-white font-medium">
                            {formatCurrency(period.balance_sheet?.total_equity)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="py-2.5 px-4 text-white sticky left-0 bg-[#1a1a1a]">Total Debt</td>
                        {financials.periods.map((period, idx) => (
                          <td key={idx} className="text-right py-2.5 px-4 text-white">
                            {formatCurrency(period.balance_sheet?.total_debt)}
                          </td>
                        ))}
                      </tr>

                      {/* Cash Flow */}
                      <tr className="border-b border-gray-700 bg-gray-800/20">
                        <td colSpan={financials.periods.length + 1} className="py-3 px-4 text-blue-400 font-semibold text-sm uppercase pt-6">
                          Cash Flow
                        </td>
                      </tr>
                      <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="py-2.5 px-4 text-white sticky left-0 bg-[#1a1a1a]">Operating Cash Flow</td>
                        {financials.periods.map((period, idx) => (
                          <td key={idx} className="text-right py-2.5 px-4 text-white font-medium">
                            {formatCurrency(period.cash_flow?.operating_cash_flow)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="py-2.5 px-4 text-white sticky left-0 bg-[#1a1a1a]">Free Cash Flow</td>
                        {financials.periods.map((period, idx) => (
                          <td key={idx} className="text-right py-2.5 px-4 text-green-500 font-semibold">
                            {formatCurrency(period.cash_flow?.free_cash_flow)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="py-2.5 px-4 text-white sticky left-0 bg-[#1a1a1a]">Capital Expenditure</td>
                        {financials.periods.map((period, idx) => (
                          <td key={idx} className="text-right py-2.5 px-4 text-red-400">
                            {formatCurrency(Math.abs(period.cash_flow?.capital_expenditure || 0))}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {/* Revenue & Net Income Trend */}
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-4">Revenue & Net Income Trend</h4>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={financials.periods.map(p => ({
                          date: new Date(p.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
                          revenue: p.income_statement?.revenue || 0,
                          netIncome: p.income_statement?.net_income || 0,
                          grossProfit: p.income_statement?.gross_profit || 0,
                        })).reverse()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 11 }} />
                          <YAxis tick={{ fill: '#666', fontSize: 11 }} tickFormatter={(value) => formatNumber(value)} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                            labelStyle={{ color: '#fff' }}
                            formatter={(value) => formatCurrency(value)}
                          />
                          <Legend />
                          <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
                          <Bar dataKey="grossProfit" fill="#06b6d4" name="Gross Profit" />
                          <Line type="monotone" dataKey="netIncome" stroke="#22c55e" strokeWidth={3} name="Net Income" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Balance Sheet Trend */}
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-4">Balance Sheet Trend</h4>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={financials.periods.map(p => ({
                          date: new Date(p.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
                          assets: p.balance_sheet?.total_assets || 0,
                          liabilities: p.balance_sheet?.total_liabilities || 0,
                          equity: p.balance_sheet?.total_equity || 0,
                          cash: p.balance_sheet?.cash || 0,
                        })).reverse()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 11 }} />
                          <YAxis tick={{ fill: '#666', fontSize: 11 }} tickFormatter={(value) => formatNumber(value)} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                            labelStyle={{ color: '#fff' }}
                            formatter={(value) => formatCurrency(value)}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="assets" stroke="#3b82f6" strokeWidth={2} name="Total Assets" />
                          <Line type="monotone" dataKey="liabilities" stroke="#ef4444" strokeWidth={2} name="Total Liabilities" />
                          <Line type="monotone" dataKey="equity" stroke="#22c55e" strokeWidth={2} name="Total Equity" />
                          <Line type="monotone" dataKey="cash" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" name="Cash" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Cash Flow Trend */}
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-4">Cash Flow Trend</h4>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={financials.periods.map(p => ({
                          date: new Date(p.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
                          operating: p.cash_flow?.operating_cash_flow || 0,
                          free: p.cash_flow?.free_cash_flow || 0,
                          capex: Math.abs(p.cash_flow?.capital_expenditure || 0),
                        })).reverse()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 11 }} />
                          <YAxis tick={{ fill: '#666', fontSize: 11 }} tickFormatter={(value) => formatNumber(value)} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                            labelStyle={{ color: '#fff' }}
                            formatter={(value) => formatCurrency(value)}
                          />
                          <Legend />
                          <Bar dataKey="operating" fill="#3b82f6" name="Operating CF" />
                          <Bar dataKey="capex" fill="#ef4444" name="CapEx" />
                          <Line type="monotone" dataKey="free" stroke="#22c55e" strokeWidth={3} name="Free CF" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center py-20 text-gray-400">
                <div className="text-center">
                  <RefreshCw className="mx-auto mb-4 text-gray-600" size={40} />
                  <p>No financial data available</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'institutional-holdings' && (
          <InstitutionalPortfolios />
        )}

        {!['overview', 'financials', 'institutional-holdings'].includes(activeTab) && (
          <div className="bg-[#1a1a1a] rounded-lg p-12 text-center border border-gray-800">
            <div className="text-gray-400 text-lg">
              {activeTab.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} - Coming Soon
            </div>
          </div>
        )}

        {/* Widget Area - Only show in Overview tab */}
        {activeTab === 'overview' && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white">Quick Access Widgets</h3>
                <p className="text-gray-400 mt-1">Add widgets for quick access to stock data</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex bg-gray-800/50 rounded-lg p-1 border border-gray-700">
                  <button
                    onClick={() => setSelectedWidgetType('advanced-chart')}
                    className={`px-3 py-2 rounded text-xs font-medium transition-colors ${
                      selectedWidgetType === 'advanced-chart' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Chart
                  </button>
                  <button
                    onClick={() => setSelectedWidgetType('stock-quote')}
                    className={`px-3 py-2 rounded text-xs font-medium transition-colors ${
                      selectedWidgetType === 'stock-quote' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Stock
                  </button>
                  <button
                    onClick={() => setSelectedWidgetType('ticker-info')}
                    className={`px-3 py-2 rounded text-xs font-medium transition-colors ${
                      selectedWidgetType === 'ticker-info' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Info
                  </button>
                  <button
                    onClick={() => setSelectedWidgetType('key-metrics')}
                    className={`px-3 py-2 rounded text-xs font-medium transition-colors ${
                      selectedWidgetType === 'key-metrics' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Metrics
                  </button>
                  <button
                    onClick={() => setSelectedWidgetType('financials')}
                    className={`px-3 py-2 rounded text-xs font-medium transition-colors ${
                      selectedWidgetType === 'financials' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Financials
                  </button>
                </div>
                <button
                  onClick={() => setShowStockSelector('add-widget')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-white font-medium"
                >
                  <Plus size={20} />
                  Add Widget
                </button>
              </div>
            </div>

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
              <div className="flex flex-col items-center justify-center py-20 bg-[#1a1a1a] rounded-lg border border-gray-800 border-dashed">
                <div className="text-gray-500 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No widgets yet</h3>
                <p className="text-gray-400 mb-6 text-center max-w-md">
                  Add widgets to quickly access stock data while analyzing
                </p>
                <div className="flex flex-col gap-3 items-center">
                  <div className="flex bg-gray-800/50 rounded-lg p-1 border border-gray-700">
                    <button
                      onClick={() => setSelectedWidgetType('advanced-chart')}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                        selectedWidgetType === 'advanced-chart' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Chart
                    </button>
                    <button
                      onClick={() => setSelectedWidgetType('stock-quote')}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                        selectedWidgetType === 'stock-quote' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Stock
                    </button>
                    <button
                      onClick={() => setSelectedWidgetType('ticker-info')}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                        selectedWidgetType === 'ticker-info' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Info
                    </button>
                    <button
                      onClick={() => setSelectedWidgetType('key-metrics')}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                        selectedWidgetType === 'key-metrics' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Metrics
                    </button>
                    <button
                      onClick={() => setSelectedWidgetType('financials')}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                        selectedWidgetType === 'financials' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Financials
                    </button>
                  </div>
                  <button
                    onClick={() => setShowStockSelector('add-widget')}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium text-white"
                  >
                    <Plus size={20} />
                    Add Your First Widget
                  </button>
                </div>
              </div>
            )}
          </div>
          </div>
        )}

        {/* Stock Selector Modal */}
        <StockSelectorModal
          isOpen={showStockSelector === 'add-widget'}
          title="Add Widget"
          onSelect={handleAddWidget}
          onClose={() => setShowStockSelector(false)}
        />
    </div>
  );
}

export default ImprovedStockDashboard;
