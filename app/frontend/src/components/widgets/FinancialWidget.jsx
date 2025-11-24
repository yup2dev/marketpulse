import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart3, Table2 } from 'lucide-react';
import {
  WidgetHeader,
  LoadingSpinner,
  NoDataState,
  formatNumber,
  API_BASE,
  WIDGET_STYLES,
  WIDGET_ICON_COLORS,
  LOADING_COLORS,
  CHART_THEME,
} from './common';

const FinancialWidget = ({ symbol, onRemove }) => {
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'chart'

  useEffect(() => {
    if (symbol) {
      loadData();
    }
  }, [symbol]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/financials/${symbol}`);
      if (res.ok) {
        setFinancials(await res.json());
      }
    } catch (error) {
      console.error('Error loading financials:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFinancialNumber = (num) => {
    const formatted = formatNumber(num);
    return formatted === 'N/A' ? formatted : '$' + formatted;
  };

  const getChartData = () => {
    if (!financials) return [];

    const income = financials.income_statement || {};
    const balance = financials.balance_sheet || {};

    return [
      { name: 'Revenue', value: income.revenue || 0 },
      { name: 'Gross Profit', value: income.gross_profit || 0 },
      { name: 'Operating Income', value: income.operating_income || 0 },
      { name: 'Net Income', value: income.net_income || 0 },
      { name: 'EBITDA', value: income.ebitda || 0 },
    ];
  };

  return (
    <div className={WIDGET_STYLES.container}>
      <WidgetHeader
        icon={BarChart3}
        iconColor={WIDGET_ICON_COLORS.financial}
        title={`${symbol} - Financials`}
        loading={loading}
        onRefresh={loadData}
        onRemove={onRemove}
      >
        {/* View Toggle */}
        <div className="flex bg-gray-800/50 rounded p-0.5 mr-2">
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setViewMode('table');
            }}
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
            title="Table View"
          >
            <Table2 size={14} />
          </button>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setViewMode('chart');
            }}
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'chart' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
            title="Chart View"
          >
            <BarChart3 size={14} />
          </button>
        </div>
      </WidgetHeader>

      <div className={`${WIDGET_STYLES.content} p-3`}>
        {loading ? (
          <LoadingSpinner color={LOADING_COLORS.financial} />
        ) : viewMode === 'table' && financials ? (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#1a1a1a]">
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 text-gray-400 font-medium">Metric</th>
                  <th className="text-right py-2 text-gray-400 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {/* Income Statement */}
                <tr className="border-b border-gray-700">
                  <td colSpan="2" className="py-2 text-blue-400 font-semibold text-xs uppercase">Income Statement</td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 text-white">Revenue</td>
                  <td className="text-right text-white">{formatFinancialNumber(financials.income_statement?.revenue)}</td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 text-white">Cost of Revenue</td>
                  <td className="text-right text-white">{formatFinancialNumber(financials.income_statement?.cost_of_revenue)}</td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 text-white">Gross Profit</td>
                  <td className="text-right text-white">{formatFinancialNumber(financials.income_statement?.gross_profit)}</td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 text-white">Operating Expenses</td>
                  <td className="text-right text-white">{formatFinancialNumber(financials.income_statement?.operating_expenses)}</td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 text-white">Operating Income</td>
                  <td className="text-right text-white">{formatFinancialNumber(financials.income_statement?.operating_income)}</td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 text-white">Net Income</td>
                  <td className="text-right text-green-500 font-semibold">{formatFinancialNumber(financials.income_statement?.net_income)}</td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 text-white">EBITDA</td>
                  <td className="text-right text-white">{formatFinancialNumber(financials.income_statement?.ebitda)}</td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 text-white">Basic EPS</td>
                  <td className="text-right text-white">{formatFinancialNumber(financials.income_statement?.basic_eps)}</td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 text-white">Diluted EPS</td>
                  <td className="text-right text-white">{formatFinancialNumber(financials.income_statement?.diluted_eps)}</td>
                </tr>

                {/* Balance Sheet */}
                <tr className="border-b border-gray-700">
                  <td colSpan="2" className="py-2 text-blue-400 font-semibold text-xs uppercase pt-4">Balance Sheet</td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 text-white">Total Assets</td>
                  <td className="text-right text-white">{formatFinancialNumber(financials.balance_sheet?.total_assets)}</td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 text-white">Current Assets</td>
                  <td className="text-right text-white">{formatFinancialNumber(financials.balance_sheet?.current_assets)}</td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 text-white">Cash</td>
                  <td className="text-right text-white">{formatFinancialNumber(financials.balance_sheet?.cash)}</td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 text-white">Total Liabilities</td>
                  <td className="text-right text-white">{formatFinancialNumber(financials.balance_sheet?.total_liabilities)}</td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 text-white">Current Liabilities</td>
                  <td className="text-right text-white">{formatFinancialNumber(financials.balance_sheet?.current_liabilities)}</td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 text-white">Total Equity</td>
                  <td className="text-right text-white">{formatFinancialNumber(financials.balance_sheet?.total_equity)}</td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 text-white">Total Debt</td>
                  <td className="text-right text-white">{formatFinancialNumber(financials.balance_sheet?.total_debt)}</td>
                </tr>

                {/* Cash Flow */}
                <tr className="border-b border-gray-700">
                  <td colSpan="2" className="py-2 text-blue-400 font-semibold text-xs uppercase pt-4">Cash Flow</td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 text-white">Operating Cash Flow</td>
                  <td className="text-right text-white">{formatFinancialNumber(financials.cash_flow?.operating_cash_flow)}</td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 text-white">Investing Cash Flow</td>
                  <td className="text-right text-white">{formatFinancialNumber(financials.cash_flow?.investing_cash_flow)}</td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 text-white">Financing Cash Flow</td>
                  <td className="text-right text-white">{formatFinancialNumber(financials.cash_flow?.financing_cash_flow)}</td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 text-white">Free Cash Flow</td>
                  <td className="text-right text-green-500 font-semibold">{formatFinancialNumber(financials.cash_flow?.free_cash_flow)}</td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 text-white">Capital Expenditure</td>
                  <td className="text-right text-white">{formatFinancialNumber(financials.cash_flow?.capital_expenditure)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : viewMode === 'chart' && financials ? (
          <div className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getChartData()}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis dataKey="name" tick={{ fill: CHART_THEME.text, fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
                <YAxis tick={{ fill: CHART_THEME.text, fontSize: 11 }} tickFormatter={(value) => formatFinancialNumber(value)} />
                <Tooltip
                  contentStyle={{ backgroundColor: CHART_THEME.tooltip.background, border: `1px solid ${CHART_THEME.tooltip.border}` }}
                  labelStyle={{ color: CHART_THEME.tooltip.text }}
                  formatter={(value) => formatFinancialNumber(value)}
                />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <NoDataState message="No financial data available" />
        )}
      </div>
    </div>
  );
};

export default FinancialWidget;
