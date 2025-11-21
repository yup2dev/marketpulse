import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Calendar, RefreshCw, Maximize2, X } from 'lucide-react';

const API_BASE = 'http://localhost:8000/api';

function StockDashboard() {
  const [symbol, setSymbol] = useState('NVDA');
  const [activeTab, setActiveTab] = useState('overview');
  const [quote, setQuote] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [history, setHistory] = useState([]);
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(false);

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
      const res = await fetch(`${API_BASE}/stock/financials/${symbol}`);
      if (res.ok) {
        setFinancials(await res.json());
      }
    } catch (error) {
      console.error('Error loading financials:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'financials' && !financials) {
      loadFinancials();
    }
  }, [activeTab]);

  const formatNumber = (num) => {
    if (!num) return 'N/A';
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  const formatCurrency = (num) => {
    if (!num) return 'N/A';
    return '$' + formatNumber(num);
  };

  const formatPercent = (num) => {
    if (!num && num !== 0) return 'N/A';
    return num.toFixed(2) + '%';
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      {/* Top Navigation */}
      <div className="border-b border-gray-800">
        <div className="flex gap-6 px-6 pt-4">
          {['Overview', 'Financials', 'Technical Analysis', 'Comparison Analysis', 'Ownership', 'Company Calendar', 'Estimates'].map((tab) => (
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
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 gap-4">
            {/* Ticker Information */}
            <div className="bg-[#1a1a1a] rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">Ticker Information</h2>
                  <div className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">
                    <span className="text-[10px]">ℹ️</span>
                    <select
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                      className="bg-transparent border-none outline-none text-xs font-medium"
                    >
                      <option value="NVDA">NVDA</option>
                      <option value="AAPL">AAPL</option>
                      <option value="MSFT">MSFT</option>
                      <option value="GOOGL">GOOGL</option>
                      <option value="TSLA">TSLA</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 text-gray-400">
                  <button className="hover:text-white"><RefreshCw size={16} /></button>
                  <button className="hover:text-white"><Calendar size={16} /></button>
                  <button className="hover:text-white">•••</button>
                  <button className="hover:text-white"><Maximize2 size={16} /></button>
                  <button className="hover:text-white"><X size={16} /></button>
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
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Price</span>
                    <span className="font-semibold">${quote.price?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Day's Change</span>
                    <span className={quote.change >= 0 ? 'text-green-500' : 'text-red-500'}>
                      {quote.change >= 0 ? <TrendingUp className="inline" size={14} /> : <TrendingDown className="inline" size={14} />}
                      {quote.change?.toFixed(2)} ({formatPercent(quote.change_percent)})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Volume: {formatNumber(quote.volume)}</span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <span className="px-2 py-1 bg-gray-800 rounded text-xs">
                      {companyInfo?.sector || 'Semiconductors'}
                    </span>
                    <span className="px-2 py-1 bg-gray-800 rounded text-xs">US</span>
                    <span className="px-2 py-1 bg-gray-800 rounded text-xs">NASDAQ</span>
                  </div>
                </div>
              )}
            </div>

            {/* Price Performance Chart */}
            <div className="bg-[#1a1a1a] rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">Price Performance</h2>
                  <div className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                    ℹ️ {symbol}
                  </div>
                </div>
                <div className="flex gap-2 text-gray-400">
                  <button className="hover:text-white"><RefreshCw size={16} /></button>
                  <button className="hover:text-white"><Calendar size={16} /></button>
                  <button className="hover:text-white">•••</button>
                  <button className="hover:text-white"><Maximize2 size={16} /></button>
                  <button className="hover:text-white"><X size={16} /></button>
                </div>
              </div>

              {quote && (
                <div className="mb-4">
                  <div className="text-2xl font-bold">{companyInfo?.name || symbol} - 1D - NASDAQ</div>
                  <div className="flex gap-4 text-sm mt-2">
                    <span className="text-gray-400">O <span className="text-white">{quote.open?.toFixed(2)}</span></span>
                    <span className="text-gray-400">H <span className="text-white">{quote.high?.toFixed(2)}</span></span>
                    <span className="text-gray-400">L <span className="text-white">{quote.low?.toFixed(2)}</span></span>
                    <span className="text-gray-400">C <span className={quote.change >= 0 ? 'text-green-500' : 'text-red-500'}>
                      {quote.close?.toFixed(2)} {formatPercent(quote.change_percent)}
                    </span></span>
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    Volume <span className="text-blue-400">SMA 9</span> {formatNumber(quote.volume)}
                  </div>
                  <div className="text-sm text-gray-400">
                    Outstanding Shares: {companyInfo?.market_cap ? formatNumber(companyInfo.market_cap / quote.price) : '24.347 B'}
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
                    <Line yAxisId="price" type="monotone" dataKey="close" stroke="#ef4444" strokeWidth={2} dot={false} />
                    <Line yAxisId="price" type="monotone" dataKey="close" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ticker Profile */}
            <div className="bg-[#1a1a1a] rounded-lg p-4 col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">Ticker Profile</h2>
                  <div className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                    ℹ️ {symbol}
                  </div>
                </div>
                <div className="flex gap-2 text-gray-400">
                  <button className="hover:text-white"><RefreshCw size={16} /></button>
                  <button className="hover:text-white"><Calendar size={16} /></button>
                  <button className="hover:text-white">•••</button>
                  <button className="hover:text-white"><Maximize2 size={16} /></button>
                  <button className="hover:text-white"><X size={16} /></button>
                </div>
              </div>

              {companyInfo && (
                <div>
                  <h3 className="text-xl font-bold mb-2">{companyInfo.name}</h3>
                  <div className="text-sm text-gray-400 mb-2">
                    {companyInfo.address}
                  </div>
                  <a href={companyInfo.website} className="text-blue-400 hover:underline text-sm">
                    {companyInfo.website}
                  </a>
                  <div className="mt-2 text-sm">
                    <span className="text-gray-400">Sector:</span> <span className="text-white">{companyInfo.sector}</span>
                    {', '}
                    <span className="text-gray-400">Industry:</span> <span className="text-white">{companyInfo.industry}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-400">Full time employees:</span> <span className="text-white">{companyInfo.employees?.toLocaleString()}</span>
                  </div>

                  <h4 className="text-lg font-semibold mt-4 mb-2">Description</h4>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {companyInfo.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'financials' && (
          <div className="bg-[#1a1a1a] rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold">Financial Statements</h2>
                <div className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                  ℹ️ {symbol}
                </div>
                <div className="flex gap-2 text-sm">
                  <button className="px-3 py-1 bg-blue-600 rounded text-white">FY</button>
                  <button className="px-3 py-1 bg-gray-700 rounded text-gray-300 hover:bg-gray-600">QTR</button>
                </div>
                <div className="flex gap-2 border-l border-gray-700 pl-4">
                  <button className="text-blue-400 hover:underline text-sm">Income Statement</button>
                  <span className="text-gray-600">|</span>
                  <button className="text-gray-400 hover:text-white text-sm">Balance Sheet</button>
                  <span className="text-gray-600">|</span>
                  <button className="text-gray-400 hover:text-white text-sm">Cash Flow Statement</button>
                </div>
              </div>
              <div className="flex gap-2 text-gray-400">
                <button className="hover:text-white"><RefreshCw size={16} /></button>
                <button className="hover:text-white"><Calendar size={16} /></button>
                <button className="hover:text-white">•••</button>
                <button className="hover:text-white"><Maximize2 size={16} /></button>
                <button className="hover:text-white"><X size={16} /></button>
              </div>
            </div>

            {/* Financial Table */}
            {financials ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-3 text-gray-400 font-medium">Index</th>
                      <th className="text-right py-3 text-gray-400 font-medium">2025</th>
                      <th className="text-right py-3 text-gray-400 font-medium">2024</th>
                      <th className="text-right py-3 text-gray-400 font-medium">2023</th>
                      <th className="text-right py-3 text-gray-400 font-medium">2022</th>
                      <th className="text-right py-3 text-gray-400 font-medium">2021</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-800">
                      <td className="py-3 text-white">Revenue</td>
                      <td className="text-right">{formatNumber(financials.income_statement?.revenue)}</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-3 text-white">Cost Of Revenue</td>
                      <td className="text-right">{formatNumber(financials.income_statement?.cost_of_revenue)}</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-3 text-white">Gross Profit</td>
                      <td className="text-right">{formatNumber(financials.income_statement?.gross_profit)}</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-3 text-white">Gross Profit Margin</td>
                      <td className="text-right">
                        {formatPercent((financials.income_statement?.gross_profit / financials.income_statement?.revenue) * 100)}
                      </td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-3 text-white">Operating Expenses</td>
                      <td className="text-right">{formatNumber(financials.income_statement?.operating_expenses)}</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-3 text-white">Operating Income</td>
                      <td className="text-right">{formatNumber(financials.income_statement?.operating_income)}</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-3 text-white">Net Income</td>
                      <td className="text-right">{formatNumber(financials.income_statement?.net_income)}</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-3 text-white">EBITDA</td>
                      <td className="text-right">{formatNumber(financials.income_statement?.ebitda)}</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-3 text-white">EBITDA Ratio</td>
                      <td className="text-right">
                        {formatPercent((financials.income_statement?.ebitda / financials.income_statement?.revenue) * 100)}
                      </td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-3 text-white">Basic EPS</td>
                      <td className="text-right">{formatCurrency(financials.income_statement?.basic_eps)}</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-3 text-white">Diluted EPS</td>
                      <td className="text-right">{formatCurrency(financials.income_statement?.diluted_eps)}</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                      <td className="text-right text-gray-400">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="text-gray-400">Loading financial data...</div>
              </div>
            )}
          </div>
        )}

        {!['overview', 'financials'].includes(activeTab) && (
          <div className="bg-[#1a1a1a] rounded-lg p-12 text-center">
            <div className="text-gray-400 text-lg">
              {activeTab.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} - Coming Soon
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StockDashboard;
