/**
 * Analysis Financials Tab - Data-Focused Layout
 */
import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useStockContext } from './AnalysisDashboard';
import { API_BASE } from '../../config/api';

const FINANCIAL_TABS = [
  { id: 'income', name: 'Income' },
  { id: 'balance', name: 'Balance' },
  { id: 'cashflow', name: 'Cash Flow' }
];

const METRIC_LABELS = {
  revenue: 'Revenue',
  cost_of_revenue: 'Cost of Revenue',
  gross_profit: 'Gross Profit',
  operating_expenses: 'Operating Expenses',
  operating_income: 'Operating Income',
  net_income: 'Net Income',
  ebitda: 'EBITDA',
  basic_eps: 'Basic EPS',
  diluted_eps: 'Diluted EPS',
  total_assets: 'Total Assets',
  current_assets: 'Current Assets',
  cash: 'Cash',
  total_liabilities: 'Total Liabilities',
  current_liabilities: 'Current Liabilities',
  total_equity: 'Total Equity',
  total_debt: 'Total Debt',
  operating_cash_flow: 'Operating Cash Flow',
  investing_cash_flow: 'Investing Cash Flow',
  financing_cash_flow: 'Financing Cash Flow',
  free_cash_flow: 'Free Cash Flow',
  capital_expenditure: 'CapEx'
};

export default function AnalysisFinancialsTab() {
  const { symbol } = useStockContext();
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('income');
  const [period, setPeriod] = useState('annual');

  useEffect(() => {
    if (symbol) loadFinancials();
  }, [symbol, period]);

  const loadFinancials = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/financials/${symbol}?freq=${period}&limit=8`);
      if (res.ok) setFinancials(await res.json());
    } catch (error) {
      console.error('Error loading financials:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined) return '-';
    if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const getChartData = () => {
    if (!financials?.periods) return [];
    return financials.periods.map(p => {
      const inc = p.income_statement || {};
      const bal = p.balance_sheet || {};
      const cf = p.cash_flow || {};
      const grossMargin = inc.revenue && inc.gross_profit ? (inc.gross_profit / inc.revenue * 100) : 0;
      const operatingMargin = inc.revenue && inc.operating_income ? (inc.operating_income / inc.revenue * 100) : 0;
      const netMargin = inc.revenue && inc.net_income ? (inc.net_income / inc.revenue * 100) : 0;
      return {
        date: p.date?.substring(0, 7) || 'N/A',
        revenue: inc.revenue,
        netIncome: inc.net_income,
        totalAssets: bal.total_assets,
        totalEquity: bal.total_equity,
        operatingCashFlow: cf.operating_cash_flow,
        freeCashFlow: cf.free_cash_flow,
        grossMargin,
        operatingMargin,
        netMargin
      };
    }).reverse();
  };

  const getData = (period, type) => {
    switch (type) {
      case 'income': return period.income_statement || {};
      case 'balance': return period.balance_sheet || {};
      case 'cashflow': return period.cash_flow || {};
      default: return {};
    }
  };

  const chartData = getChartData();

  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid grid-cols-12 gap-4">
        {/* Header Controls */}
        <div className="col-span-12">
          <div className="bg-[#0d0d12] rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex bg-gray-800 rounded p-0.5">
                  {FINANCIAL_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-1.5 text-sm rounded ${
                        activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-gray-400'
                      }`}
                    >
                      {tab.name}
                    </button>
                  ))}
                </div>
                <div className="flex bg-gray-800 rounded p-0.5">
                  <button
                    onClick={() => setPeriod('quarterly')}
                    className={`px-3 py-1.5 text-sm rounded ${period === 'quarterly' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                  >
                    Quarterly
                  </button>
                  <button
                    onClick={() => setPeriod('annual')}
                    className={`px-3 py-1.5 text-sm rounded ${period === 'annual' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                  >
                    Annual
                  </button>
                </div>
              </div>
              <button
                onClick={loadFinancials}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Revenue & Income Chart */}
        <div className="col-span-8">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800 h-[300px]">
            <div className="p-4 border-b border-gray-800">
              <h4 className="text-sm font-semibold text-white">
                {activeTab === 'income' ? 'Revenue & Net Income' : activeTab === 'balance' ? 'Assets & Equity' : 'Cash Flows'}
              </h4>
            </div>
            <div className="p-4 h-[calc(100%-52px)]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" stroke="#666" fontSize={11} />
                  <YAxis stroke="#666" fontSize={11} tickFormatter={(v) => {
                    if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(0)}B`;
                    if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
                    return v;
                  }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                    formatter={(value) => formatNumber(value)}
                    isAnimationActive={false}
                  />
                  {activeTab === 'income' && (
                    <>
                      <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" isAnimationActive={false} />
                      <Bar dataKey="netIncome" name="Net Income" fill="#22c55e" isAnimationActive={false} />
                    </>
                  )}
                  {activeTab === 'balance' && (
                    <>
                      <Bar dataKey="totalAssets" name="Total Assets" fill="#3b82f6" isAnimationActive={false} />
                      <Bar dataKey="totalEquity" name="Total Equity" fill="#22c55e" isAnimationActive={false} />
                    </>
                  )}
                  {activeTab === 'cashflow' && (
                    <>
                      <Bar dataKey="operatingCashFlow" name="Operating CF" fill="#3b82f6" isAnimationActive={false} />
                      <Bar dataKey="freeCashFlow" name="Free CF" fill="#22c55e" isAnimationActive={false} />
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Margin Trends */}
        <div className="col-span-4">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800 h-[300px]">
            <div className="p-4 border-b border-gray-800">
              <h4 className="text-sm font-semibold text-white">Profit Margins</h4>
            </div>
            <div className="p-4 h-[calc(100%-52px)]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" stroke="#666" fontSize={10} />
                  <YAxis stroke="#666" fontSize={10} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                    formatter={(value) => `${value.toFixed(2)}%`}
                  />
                  <Line type="monotone" dataKey="grossMargin" name="Gross" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="operatingMargin" name="Operating" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="netMargin" name="Net" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Financial Data Table */}
        <div className="col-span-12">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800">
            <div className="p-4 border-b border-gray-800">
              <h4 className="text-sm font-semibold text-white">
                {activeTab === 'income' ? 'Income Statement' : activeTab === 'balance' ? 'Balance Sheet' : 'Cash Flow Statement'}
              </h4>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                </div>
              ) : financials?.periods?.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-3 px-4 text-gray-500 text-xs font-medium sticky left-0 bg-[#0d0d12]">Metric</th>
                      {financials.periods.map((period, idx) => (
                        <th key={idx} className="text-right py-3 px-4 text-gray-400 text-xs font-medium min-w-[100px]">
                          {period.date?.substring(0, 7) || 'N/A'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(getData(financials.periods[0], activeTab))
                      .filter(key => getData(financials.periods[0], activeTab)[key] !== null)
                      .map((key) => {
                        const values = financials.periods.map(p => getData(p, activeTab)[key]);
                        const trend = values.length >= 2 && values[0] !== null && values[1] !== null
                          ? values[0] - values[1]
                          : null;

                        return (
                          <tr key={key} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                            <td className="py-3 px-4 text-gray-300 sticky left-0 bg-[#0d0d12]">
                              {METRIC_LABELS[key] || key.replace(/_/g, ' ')}
                            </td>
                            {financials.periods.map((period, idx) => {
                              const data = getData(period, activeTab);
                              const value = data[key];
                              const showTrend = idx === 0 && trend !== null;
                              return (
                                <td key={idx} className="text-right py-3 px-4">
                                  <div className="flex items-center justify-end gap-1">
                                    {showTrend && (
                                      trend > 0
                                        ? <TrendingUp size={12} className="text-green-500" />
                                        : <TrendingDown size={12} className="text-red-500" />
                                    )}
                                    <span className="text-white font-medium">
                                      {typeof value === 'number' ? formatNumber(value) : value || '-'}
                                    </span>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              ) : (
                <div className="text-center text-gray-500 py-12">No data available</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
