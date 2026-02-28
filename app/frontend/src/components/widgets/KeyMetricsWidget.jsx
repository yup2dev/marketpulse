/**
 * KeyMetricsWidget - Displays key financial metrics using BaseWidget
 */
import { useState, useEffect, useCallback } from 'react';
import { BarChart2 } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import { formatNumber, formatPrice, API_BASE } from './constants';

const KeyMetricsWidget = ({ symbol, onRemove }) => {
  const [quote, setQuote] = useState(null);
  const [info, setInfo] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const [quoteRes, infoRes, financialsRes] = await Promise.all([
        fetch(`${API_BASE}/stock/quote/${symbol}`),
        fetch(`${API_BASE}/stock/info/${symbol}`),
        fetch(`${API_BASE}/stock/financials/${symbol}?freq=annual&limit=2`)
      ]);

      if (quoteRes.ok) setQuote(await quoteRes.json());
      if (infoRes.ok) setInfo(await infoRes.json());
      if (financialsRes.ok) setFinancials(await financialsRes.json());
    } catch (error) {
      console.error('Error loading key metrics:', error);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getMetrics = () => {
    if (!financials?.periods || financials.periods.length === 0) return {};

    const latest = financials.periods[0];
    const previous = financials.periods[1];

    const incomeStatement = latest?.income_statement || {};
    const balanceSheet = latest?.balance_sheet || {};
    const prevIncomeStatement = previous?.income_statement || {};

    const grossMargin = incomeStatement.revenue && incomeStatement.gross_profit
      ? (incomeStatement.gross_profit / incomeStatement.revenue * 100) : null;
    const operatingMargin = incomeStatement.revenue && incomeStatement.operating_income
      ? (incomeStatement.operating_income / incomeStatement.revenue * 100) : null;
    const netMargin = incomeStatement.revenue && incomeStatement.net_income
      ? (incomeStatement.net_income / incomeStatement.revenue * 100) : null;
    const roe = balanceSheet.total_equity && incomeStatement.net_income
      ? (incomeStatement.net_income / balanceSheet.total_equity * 100) : null;
    const roa = balanceSheet.total_assets && incomeStatement.net_income
      ? (incomeStatement.net_income / balanceSheet.total_assets * 100) : null;
    const debtToEquity = balanceSheet.total_equity && balanceSheet.total_debt
      ? (balanceSheet.total_debt / balanceSheet.total_equity) : null;
    const currentRatio = balanceSheet.current_assets && balanceSheet.current_liabilities
      ? (balanceSheet.current_assets / balanceSheet.current_liabilities) : null;
    const revenueGrowth = prevIncomeStatement.revenue && incomeStatement.revenue
      ? ((incomeStatement.revenue - prevIncomeStatement.revenue) / prevIncomeStatement.revenue * 100) : null;
    const earningsGrowth = prevIncomeStatement.net_income && incomeStatement.net_income
      ? ((incomeStatement.net_income - prevIncomeStatement.net_income) / Math.abs(prevIncomeStatement.net_income) * 100) : null;

    return { grossMargin, operatingMargin, netMargin, roe, roa, debtToEquity, currentRatio, revenueGrowth, earningsGrowth };
  };

  const metrics = getMetrics();

  const MetricRow = ({ label, value, highlight = false, highlightColor = 'text-blue-400' }) => (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-800 last:border-0">
      <span className="text-gray-400 text-xs">{label}</span>
      <span className={`font-medium text-sm ${highlight ? highlightColor : 'text-white'}`}>
        {value}
      </span>
    </div>
  );

  // Build flat rows for export
  const getExportData = () => {
    const rows = [];
    if (info) {
      rows.push(
        { category: 'Valuation',  metric: 'Market Cap',       value: formatNumber(info.market_cap) },
        { category: 'Valuation',  metric: 'P/E Ratio',        value: info.pe_ratio?.toFixed(2) ?? 'N/A' },
        { category: 'Valuation',  metric: 'P/B Ratio',        value: info.price_to_book?.toFixed(2) ?? 'N/A' },
        { category: 'Valuation',  metric: 'P/S Ratio',        value: info.price_to_sales?.toFixed(2) ?? 'N/A' },
        { category: 'Valuation',  metric: 'PEG Ratio',        value: info.peg_ratio?.toFixed(2) ?? 'N/A' },
        { category: 'Valuation',  metric: 'EPS (TTM)',        value: info.eps?.toFixed(2) ?? 'N/A' },
        { category: 'Profitability', metric: 'ROE',           value: metrics.roe ? metrics.roe.toFixed(2) + '%' : 'N/A' },
        { category: 'Profitability', metric: 'ROA',           value: metrics.roa ? metrics.roa.toFixed(2) + '%' : 'N/A' },
        { category: 'Profitability', metric: 'Gross Margin',  value: metrics.grossMargin ? metrics.grossMargin.toFixed(2) + '%' : 'N/A' },
        { category: 'Profitability', metric: 'Op. Margin',    value: metrics.operatingMargin ? metrics.operatingMargin.toFixed(2) + '%' : 'N/A' },
        { category: 'Profitability', metric: 'Net Margin',    value: metrics.netMargin ? metrics.netMargin.toFixed(2) + '%' : 'N/A' },
        { category: 'Health',     metric: 'Debt/Equity',      value: metrics.debtToEquity?.toFixed(2) ?? 'N/A' },
        { category: 'Health',     metric: 'Current Ratio',    value: metrics.currentRatio?.toFixed(2) ?? 'N/A' },
        { category: 'Growth',     metric: 'Revenue Growth',   value: metrics.revenueGrowth ? metrics.revenueGrowth.toFixed(2) + '%' : 'N/A' },
        { category: 'Growth',     metric: 'Earnings Growth',  value: metrics.earningsGrowth ? metrics.earningsGrowth.toFixed(2) + '%' : 'N/A' },
        { category: 'Other',      metric: 'Dividend Yield',   value: info.dividend_yield ? (info.dividend_yield * 100).toFixed(2) + '%' : 'N/A' },
        { category: 'Other',      metric: 'Beta',             value: info.beta?.toFixed(2) ?? 'N/A' },
      );
    }
    return {
      columns: [
        { key: 'category', header: 'Category' },
        { key: 'metric',   header: 'Metric'   },
        { key: 'value',    header: 'Value'    },
      ],
      rows,
    };
  };

  return (
    <BaseWidget
      title={`${symbol} - Metrics`}
      icon={BarChart2}
      iconColor="text-green-400"
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
      exportData={quote && info ? getExportData : undefined}
      symbol={symbol}
    >
      <div className="p-3 overflow-auto h-full">
        {quote && info ? (
          <div className="space-y-4">
            {/* Valuation */}
            <div>
              <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Valuation</h4>
              <MetricRow label="Market Cap" value={formatNumber(info.market_cap)} />
              <MetricRow label="P/E Ratio" value={info.pe_ratio?.toFixed(2) || 'N/A'} highlight={info.pe_ratio && info.pe_ratio < 15} highlightColor="text-green-400" />
              <MetricRow label="P/B Ratio" value={info.price_to_book?.toFixed(2) || 'N/A'} />
              <MetricRow label="P/S Ratio" value={info.price_to_sales?.toFixed(2) || 'N/A'} />
              <MetricRow label="PEG Ratio" value={info.peg_ratio?.toFixed(2) || 'N/A'} />
              <MetricRow label="EPS (TTM)" value={info.eps ? formatPrice(info.eps) : 'N/A'} />
            </div>

            {/* Profitability */}
            <div>
              <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Profitability</h4>
              <MetricRow label="ROE" value={metrics.roe ? metrics.roe.toFixed(2) + '%' : 'N/A'} highlight={metrics.roe && metrics.roe > 15} highlightColor="text-green-400" />
              <MetricRow label="ROA" value={metrics.roa ? metrics.roa.toFixed(2) + '%' : 'N/A'} />
              <MetricRow label="Gross Margin" value={metrics.grossMargin ? metrics.grossMargin.toFixed(2) + '%' : 'N/A'} />
              <MetricRow label="Operating Margin" value={metrics.operatingMargin ? metrics.operatingMargin.toFixed(2) + '%' : 'N/A'} />
              <MetricRow label="Net Margin" value={metrics.netMargin ? metrics.netMargin.toFixed(2) + '%' : 'N/A'} />
            </div>

            {/* Financial Health */}
            <div>
              <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Financial Health</h4>
              <MetricRow label="Debt/Equity" value={metrics.debtToEquity ? metrics.debtToEquity.toFixed(2) : 'N/A'} highlight={metrics.debtToEquity && metrics.debtToEquity < 0.5} highlightColor="text-green-400" />
              <MetricRow label="Current Ratio" value={metrics.currentRatio ? metrics.currentRatio.toFixed(2) : 'N/A'} />
            </div>

            {/* Growth */}
            <div>
              <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Growth (YoY)</h4>
              <MetricRow label="Revenue Growth" value={metrics.revenueGrowth ? metrics.revenueGrowth.toFixed(2) + '%' : 'N/A'} highlight={metrics.revenueGrowth && metrics.revenueGrowth > 10} highlightColor={metrics.revenueGrowth > 0 ? 'text-green-400' : 'text-red-400'} />
              <MetricRow label="Earnings Growth" value={metrics.earningsGrowth ? metrics.earningsGrowth.toFixed(2) + '%' : 'N/A'} highlight={metrics.earningsGrowth && Math.abs(metrics.earningsGrowth) > 10} highlightColor={metrics.earningsGrowth > 0 ? 'text-green-400' : 'text-red-400'} />
            </div>

            {/* Dividend & Trading */}
            <div>
              <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Dividend & Trading</h4>
              <MetricRow label="Dividend Yield" value={info.dividend_yield ? (info.dividend_yield * 100).toFixed(2) + '%' : 'N/A'} />
              <MetricRow label="Volume" value={formatNumber(quote.volume)} />
              <MetricRow label="Avg Volume" value={info.avg_volume ? formatNumber(info.avg_volume) : 'N/A'} />
              <MetricRow label="Beta" value={info.beta?.toFixed(2) || 'N/A'} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">No data available</div>
        )}
      </div>
    </BaseWidget>
  );
};

export default KeyMetricsWidget;
