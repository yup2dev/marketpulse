/**
 * Financial Table Widget - Clean table design like img.png
 * Displays financial statements in a compact, professional format
 */
import { useState, useEffect } from 'react';
import { FileText, Table2, BarChart3 } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { WidgetHeader, WIDGET_STYLES, LoadingSpinner, formatNumber, API_BASE } from './common';

const STATEMENT_TABS = [
  { id: 'income', label: 'Income Statement' },
  { id: 'balance', label: 'Balance Sheet' },
  { id: 'cashflow', label: 'Cash Flow Statement' },
];

const INCOME_METRICS = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'cost_of_revenue', label: 'Cost Of Revenue' },
  { key: 'gross_profit', label: 'Gross Profit' },
  { key: 'research_and_development', label: 'Research And Development Expenses' },
  { key: 'selling_general_administrative', label: 'Selling General And Administrative Expenses' },
  { key: 'operating_expenses', label: 'Operating Expenses' },
  { key: 'operating_income', label: 'Operating Income' },
  { key: 'interest_expense', label: 'Interest Expense' },
  { key: 'ebitda', label: 'EBITDA' },
  { key: 'net_income', label: 'Net Income' },
  { key: 'basic_eps', label: 'EPS(Basic)' },
  { key: 'diluted_eps', label: 'EPS(Diluted)' },
];

const BALANCE_METRICS = [
  { key: 'cash', label: 'Cash' },
  { key: 'short_term_investments', label: 'Short Term Investments' },
  { key: 'total_current_assets', label: 'Total Current Assets' },
  { key: 'property_plant_equipment', label: 'Property Plant & Equipment' },
  { key: 'goodwill', label: 'Goodwill' },
  { key: 'intangible_assets', label: 'Intangible Assets' },
  { key: 'total_assets', label: 'Total Assets' },
  { key: 'accounts_payable', label: 'Accounts Payable' },
  { key: 'short_term_debt', label: 'Short Term Debt' },
  { key: 'total_current_liabilities', label: 'Total Current Liabilities' },
  { key: 'long_term_debt', label: 'Long Term Debt' },
  { key: 'total_liabilities', label: 'Total Liabilities' },
  { key: 'total_equity', label: 'Total Equity' },
];

const CASHFLOW_METRICS = [
  { key: 'operating_cash_flow', label: 'Operating Cash Flow' },
  { key: 'capital_expenditure', label: 'Capital Expenditure' },
  { key: 'free_cash_flow', label: 'Free Cash Flow' },
  { key: 'investing_cash_flow', label: 'Investing Cash Flow' },
  { key: 'financing_cash_flow', label: 'Financing Cash Flow' },
  { key: 'dividends_paid', label: 'Dividends Paid' },
  { key: 'net_change_in_cash', label: 'Net Change In Cash' },
];

const CHART_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];

export default function FinancialTableWidget({ symbol = 'AAPL', onRemove }) {
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('income');
  const [period, setPeriod] = useState('quarterly');
  const [viewMode, setViewMode] = useState('table');

  useEffect(() => {
    if (symbol) loadFinancials();
  }, [symbol, period]);

  const loadFinancials = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/financials/${symbol}?freq=${period}&limit=6`);
      if (res.ok) setFinancials(await res.json());
    } catch (error) {
      console.error('Error loading financials:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMetrics = () => {
    switch (activeTab) {
      case 'income': return INCOME_METRICS;
      case 'balance': return BALANCE_METRICS;
      case 'cashflow': return CASHFLOW_METRICS;
      default: return [];
    }
  };

  const getData = (periodData) => {
    switch (activeTab) {
      case 'income': return periodData.income_statement || {};
      case 'balance': return periodData.balance_sheet || {};
      case 'cashflow': return periodData.cash_flow || {};
      default: return {};
    }
  };

  const formatPeriodLabel = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth();
    const quarter = Math.floor(month / 3) + 1;
    return period === 'quarterly' ? `Q${quarter} ${year}` : `${year}`;
  };

  const getChartData = () => {
    if (!financials?.periods) return [];
    return financials.periods.map(p => {
      const inc = p.income_statement || {};
      const bal = p.balance_sheet || {};
      const cf = p.cash_flow || {};
      return {
        period: formatPeriodLabel(p.date),
        revenue: inc.revenue,
        netIncome: inc.net_income,
        totalAssets: bal.total_assets,
        totalEquity: bal.total_equity,
        operatingCF: cf.operating_cash_flow,
        freeCF: cf.free_cash_flow,
      };
    }).reverse();
  };

  const renderTable = () => {
    const periods = financials?.periods || [];
    const metrics = getMetrics();

    if (periods.length === 0) {
      return <div className="flex items-center justify-center h-40 text-gray-500">No data available</div>;
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 px-3 text-gray-400 font-medium sticky left-0 bg-[#0d0d12] min-w-[200px]">
                Metric
              </th>
              {periods.map((p, idx) => (
                <th key={idx} className="text-right py-2 px-3 text-gray-400 font-medium min-w-[90px]">
                  {formatPeriodLabel(p.date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map(({ key, label }) => {
              const values = periods.map(p => getData(p)[key]);
              const hasData = values.some(v => v !== null && v !== undefined);
              if (!hasData) return null;

              return (
                <tr key={key} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="py-2 px-3 text-gray-300 sticky left-0 bg-[#0d0d12]">{label}</td>
                  {values.map((value, idx) => (
                    <td key={idx} className="text-right py-2 px-3 text-white font-medium tabular-nums">
                      {typeof value === 'number' ? formatNumber(value) : '-'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderChart = () => {
    const chartData = getChartData();
    if (chartData.length === 0) {
      return <div className="flex items-center justify-center h-40 text-gray-500">No data available</div>;
    }

    const formatYAxis = (value) => {
      if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(0)}B`;
      if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
      return value;
    };

    const chartConfig = {
      income: [
        { dataKey: 'revenue', name: 'Revenue', fill: CHART_COLORS[0] },
        { dataKey: 'netIncome', name: 'Net Income', fill: CHART_COLORS[2] },
      ],
      balance: [
        { dataKey: 'totalAssets', name: 'Total Assets', fill: CHART_COLORS[0] },
        { dataKey: 'totalEquity', name: 'Total Equity', fill: CHART_COLORS[2] },
      ],
      cashflow: [
        { dataKey: 'operatingCF', name: 'Operating CF', fill: CHART_COLORS[2] },
        { dataKey: 'freeCF', name: 'Free CF', fill: CHART_COLORS[1] },
      ],
    };

    const config = chartConfig[activeTab];

    return (
      <div className="p-4 h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="period" stroke="#666" fontSize={10} />
            <YAxis stroke="#666" fontSize={10} tickFormatter={formatYAxis} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
              labelStyle={{ color: '#fff' }}
              formatter={(value) => formatNumber(value)}
            />
            <Legend />
            {config.map((item, idx) => (
              <Bar key={idx} dataKey={item.dataKey} name={item.name} fill={item.fill} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className={WIDGET_STYLES.container}>
      <WidgetHeader
        icon={FileText}
        iconColor="text-purple-400"
        title={`Financial Statement`}
        loading={loading}
        onRefresh={loadFinancials}
        onRemove={onRemove}
      >
        {/* Period Toggle */}
        <div className="flex bg-gray-800 rounded p-0.5 mr-1">
          <button
            onClick={() => setPeriod('quarterly')}
            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
              period === 'quarterly' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            QTR
          </button>
          <button
            onClick={() => setPeriod('annual')}
            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
              period === 'annual' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Annual
          </button>
        </div>
        {/* View Mode Toggle */}
        <div className="flex bg-gray-800 rounded p-0.5">
          <button
            onClick={() => setViewMode('table')}
            className={`p-1 rounded transition-colors ${
              viewMode === 'table' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Table2 size={12} />
          </button>
          <button
            onClick={() => setViewMode('chart')}
            className={`p-1 rounded transition-colors ${
              viewMode === 'chart' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <BarChart3 size={12} />
          </button>
        </div>
      </WidgetHeader>

      {/* Statement Tabs */}
      <div className="flex border-b border-gray-800 px-3">
        {STATEMENT_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-purple-400 border-purple-400'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={WIDGET_STYLES.content}>
        {loading ? (
          <LoadingSpinner color="border-purple-500" />
        ) : viewMode === 'table' ? (
          renderTable()
        ) : (
          renderChart()
        )}
      </div>
    </div>
  );
}
