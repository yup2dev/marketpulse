/**
 * FinancialWidget - Displays key financial data using BaseWidget
 */
import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3 } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import { formatNumber, API_BASE } from './constants';

const FinancialWidget = ({ symbol, onRemove }) => {
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('table');

  const loadData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/financials/${symbol}`);
      if (res.ok) setFinancials(await res.json());
    } catch (error) {
      console.error('Error loading financials:', error);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatFinancialNumber = (num) => {
    const formatted = formatNumber(num);
    return formatted === 'N/A' ? formatted : '$' + formatted;
  };

  const getChartData = () => {
    if (!financials) return [];
    const income = financials.income_statement || {};
    return [
      { name: 'Revenue', value: income.revenue || 0 },
      { name: 'Gross Profit', value: income.gross_profit || 0 },
      { name: 'Op. Income', value: income.operating_income || 0 },
      { name: 'Net Income', value: income.net_income || 0 },
      { name: 'EBITDA', value: income.ebitda || 0 },
    ];
  };

  const renderChart = () => {
    const chartData = getChartData();
    if (chartData.length === 0) return <div className="flex items-center justify-center h-full text-gray-500">No data</div>;

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 9 }} angle={-45} textAnchor="end" height={60} axisLine={{ stroke: '#374151' }} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={{ stroke: '#374151' }} tickFormatter={(v) => formatFinancialNumber(v)} />
          <Tooltip contentStyle={{ backgroundColor: '#1a1a1f', border: '1px solid #374151', borderRadius: '8px' }} formatter={(v) => formatFinancialNumber(v)} />
          <Bar dataKey="value" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderTable = () => {
    if (!financials) return <div className="flex items-center justify-center h-full text-gray-500">No data</div>;

    const MetricRow = ({ label, value, highlight = false }) => (
      <tr className="border-b border-gray-800 hover:bg-gray-800/30">
        <td className="py-1.5 text-gray-300 text-xs">{label}</td>
        <td className={`text-right py-1.5 text-xs font-medium ${highlight ? 'text-green-400' : 'text-white'}`}>{value}</td>
      </tr>
    );

    const SectionHeader = ({ title }) => (
      <tr className="border-b border-gray-700">
        <td colSpan="2" className="py-1.5 text-blue-400 font-semibold text-[10px] uppercase">{title}</td>
      </tr>
    );

    return (
      <div className="overflow-auto h-full">
        <table className="w-full text-xs">
          <tbody>
            <SectionHeader title="Income Statement" />
            <MetricRow label="Revenue" value={formatFinancialNumber(financials.income_statement?.revenue)} />
            <MetricRow label="Cost of Revenue" value={formatFinancialNumber(financials.income_statement?.cost_of_revenue)} />
            <MetricRow label="Gross Profit" value={formatFinancialNumber(financials.income_statement?.gross_profit)} />
            <MetricRow label="Operating Income" value={formatFinancialNumber(financials.income_statement?.operating_income)} />
            <MetricRow label="Net Income" value={formatFinancialNumber(financials.income_statement?.net_income)} highlight />
            <MetricRow label="EBITDA" value={formatFinancialNumber(financials.income_statement?.ebitda)} />
            <MetricRow label="EPS (Basic)" value={formatFinancialNumber(financials.income_statement?.basic_eps)} />

            <SectionHeader title="Balance Sheet" />
            <MetricRow label="Total Assets" value={formatFinancialNumber(financials.balance_sheet?.total_assets)} />
            <MetricRow label="Current Assets" value={formatFinancialNumber(financials.balance_sheet?.current_assets)} />
            <MetricRow label="Cash" value={formatFinancialNumber(financials.balance_sheet?.cash)} />
            <MetricRow label="Total Liabilities" value={formatFinancialNumber(financials.balance_sheet?.total_liabilities)} />
            <MetricRow label="Total Equity" value={formatFinancialNumber(financials.balance_sheet?.total_equity)} />
            <MetricRow label="Total Debt" value={formatFinancialNumber(financials.balance_sheet?.total_debt)} />

            <SectionHeader title="Cash Flow" />
            <MetricRow label="Operating CF" value={formatFinancialNumber(financials.cash_flow?.operating_cash_flow)} />
            <MetricRow label="Free Cash Flow" value={formatFinancialNumber(financials.cash_flow?.free_cash_flow)} highlight />
            <MetricRow label="CapEx" value={formatFinancialNumber(financials.cash_flow?.capital_expenditure)} />
          </tbody>
        </table>
      </div>
    );
  };

  const getExportData = () => {
    const cols = [
      { key: 'section', header: 'Section' },
      { key: 'metric',  header: 'Metric'  },
      { key: 'value',   header: 'Value'   },
    ];
    const is = financials?.income_statement || {};
    const bs = financials?.balance_sheet || {};
    const cf = financials?.cash_flow || {};
    const rows = [
      { section: 'Income Statement', metric: 'Revenue',           value: is.revenue },
      { section: 'Income Statement', metric: 'Cost of Revenue',   value: is.cost_of_revenue },
      { section: 'Income Statement', metric: 'Gross Profit',      value: is.gross_profit },
      { section: 'Income Statement', metric: 'Operating Income',  value: is.operating_income },
      { section: 'Income Statement', metric: 'Net Income',        value: is.net_income },
      { section: 'Income Statement', metric: 'EBITDA',            value: is.ebitda },
      { section: 'Income Statement', metric: 'EPS (Basic)',       value: is.basic_eps },
      { section: 'Balance Sheet',    metric: 'Total Assets',      value: bs.total_assets },
      { section: 'Balance Sheet',    metric: 'Current Assets',    value: bs.current_assets },
      { section: 'Balance Sheet',    metric: 'Cash',              value: bs.cash },
      { section: 'Balance Sheet',    metric: 'Total Liabilities', value: bs.total_liabilities },
      { section: 'Balance Sheet',    metric: 'Total Equity',      value: bs.total_equity },
      { section: 'Balance Sheet',    metric: 'Total Debt',        value: bs.total_debt },
      { section: 'Cash Flow',        metric: 'Operating CF',      value: cf.operating_cash_flow },
      { section: 'Cash Flow',        metric: 'Free Cash Flow',    value: cf.free_cash_flow },
      { section: 'Cash Flow',        metric: 'CapEx',             value: cf.capital_expenditure },
    ].map(r => ({ ...r, value: r.value != null ? r.value : '' }));
    return { columns: cols, rows };
  };

  return (
    <BaseWidget
      title={`${symbol} - Financials`}
      icon={BarChart3}
      iconColor="text-blue-400"
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showPeriodSelector={false}
      symbol={symbol}
      exportData={financials ? getExportData : undefined}
    >
      <div className="h-full p-3">
        {viewMode === 'chart' ? renderChart() : renderTable()}
      </div>
    </BaseWidget>
  );
};

export default FinancialWidget;
