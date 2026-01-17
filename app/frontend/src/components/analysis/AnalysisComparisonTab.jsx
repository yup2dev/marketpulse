/**
 * Analysis 비교 분석 탭
 */
import { useState, useEffect } from 'react';
import { GitCompare, Plus, X, TrendingUp, TrendingDown } from 'lucide-react';
import { useStockContext } from './AnalysisDashboard';
import ChartWidget from '../widgets/ChartWidget';
import StockSelectorModal from '../StockSelectorModal';
import { API_BASE } from '../../config/api';

// Metrics to compare
const COMPARISON_METRICS = [
  { key: 'market_cap', label: '시가총액', format: 'number' },
  { key: 'pe_ratio', label: 'P/E', format: 'ratio', highlight: { good: '<15', bad: '>30' } },
  { key: 'price_to_book', label: 'P/B', format: 'ratio', highlight: { good: '<1', bad: '>3' } },
  { key: 'price_to_sales', label: 'P/S', format: 'ratio', highlight: { good: '<2', bad: '>5' } },
  { key: 'roe', label: 'ROE', format: 'percent', highlight: { good: '>15', bad: '<5' } },
  { key: 'roa', label: 'ROA', format: 'percent', highlight: { good: '>10', bad: '<3' } },
  { key: 'profit_margin', label: '이익률', format: 'percent', highlight: { good: '>15', bad: '<0' } },
  { key: 'debt_to_equity', label: 'D/E', format: 'ratio', highlight: { good: '<0.5', bad: '>2' } },
  { key: 'revenue_growth', label: '매출성장률', format: 'percent', highlight: { good: '>10', bad: '<0' } },
  { key: 'dividend_yield', label: '배당수익률', format: 'percent', highlight: { good: '>3', bad: null } },
];

export default function AnalysisComparisonTab() {
  const { symbol } = useStockContext();
  const [compareSymbols, setCompareSymbols] = useState([symbol]);
  const [showAddStock, setShowAddStock] = useState(false);
  const [stockData, setStockData] = useState({});
  const [loading, setLoading] = useState(false);

  // Load data for all selected symbols
  useEffect(() => {
    loadAllStockData();
  }, [compareSymbols]);

  const loadAllStockData = async () => {
    setLoading(true);
    const newData = {};

    await Promise.all(
      compareSymbols.map(async (sym) => {
        try {
          const [infoRes, financialsRes] = await Promise.all([
            fetch(`${API_BASE}/stock/info/${sym}`),
            fetch(`${API_BASE}/stock/financials/${sym}?freq=annual&limit=2`)
          ]);

          const info = infoRes.ok ? await infoRes.json() : {};
          const financials = financialsRes.ok ? await financialsRes.json() : {};

          // Calculate additional metrics from financials
          let roe = null, roa = null, profitMargin = null, debtToEquity = null, revenueGrowth = null;

          if (financials?.periods?.length > 0) {
            const latest = financials.periods[0];
            const previous = financials.periods[1];

            const inc = latest.income_statement || {};
            const bal = latest.balance_sheet || {};
            const prevInc = previous?.income_statement || {};

            roe = bal.total_equity && inc.net_income
              ? (inc.net_income / bal.total_equity * 100) : null;
            roa = bal.total_assets && inc.net_income
              ? (inc.net_income / bal.total_assets * 100) : null;
            profitMargin = inc.revenue && inc.net_income
              ? (inc.net_income / inc.revenue * 100) : null;
            debtToEquity = bal.total_equity && bal.total_debt
              ? (bal.total_debt / bal.total_equity) : null;
            revenueGrowth = prevInc.revenue && inc.revenue
              ? ((inc.revenue - prevInc.revenue) / prevInc.revenue * 100) : null;
          }

          newData[sym] = {
            ...info,
            roe,
            roa,
            profit_margin: profitMargin,
            debt_to_equity: debtToEquity,
            revenue_growth: revenueGrowth,
            dividend_yield: info.dividend_yield ? info.dividend_yield * 100 : null
          };
        } catch (error) {
          console.error(`Error loading data for ${sym}:`, error);
          newData[sym] = {};
        }
      })
    );

    setStockData(newData);
    setLoading(false);
  };

  const handleAddStock = (stock) => {
    if (!compareSymbols.includes(stock.symbol)) {
      setCompareSymbols([...compareSymbols, stock.symbol]);
    }
    setShowAddStock(false);
  };

  const handleRemoveStock = (sym) => {
    if (compareSymbols.length > 1) {
      setCompareSymbols(compareSymbols.filter(s => s !== sym));
    }
  };

  const formatValue = (value, format) => {
    if (value === null || value === undefined) return 'N/A';

    switch (format) {
      case 'number':
        if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
        if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
        if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
        return value.toLocaleString();
      case 'ratio':
        return value.toFixed(2);
      case 'percent':
        return `${value.toFixed(2)}%`;
      default:
        return value;
    }
  };

  const getHighlightClass = (value, highlight) => {
    if (!highlight || value === null || value === undefined) return '';

    const checkCondition = (condition) => {
      if (!condition) return false;
      const match = condition.match(/([<>])(\d+(?:\.\d+)?)/);
      if (!match) return false;
      const [, op, num] = match;
      const threshold = parseFloat(num);
      return op === '>' ? value > threshold : value < threshold;
    };

    if (checkCondition(highlight.good)) return 'text-green-400 font-bold';
    if (checkCondition(highlight.bad)) return 'text-red-400';
    return '';
  };

  // Find best/worst for each metric
  const getBestWorst = (metricKey) => {
    const values = compareSymbols
      .map(sym => ({ sym, value: stockData[sym]?.[metricKey] }))
      .filter(item => item.value !== null && item.value !== undefined);

    if (values.length === 0) return { best: null, worst: null };

    const sorted = [...values].sort((a, b) => b.value - a.value);
    return { best: sorted[0]?.sym, worst: sorted[sorted.length - 1]?.sym };
  };

  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitCompare className="text-purple-500" size={28} />
            <div>
              <h2 className="text-xl font-bold text-white">비교 분석</h2>
              <p className="text-gray-400 text-sm mt-0.5">여러 종목을 비교 분석하세요</p>
            </div>
          </div>

          <button
            onClick={() => setShowAddStock(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors text-white"
          >
            <Plus size={18} />
            <span>종목 추가</span>
          </button>
        </div>

        {/* Selected Stocks */}
        <div className="flex flex-wrap gap-2">
          {compareSymbols.map((sym) => (
            <div
              key={sym}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                sym === symbol ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300'
              }`}
            >
              <span className="font-medium">{sym}</span>
              {compareSymbols.length > 1 && (
                <button
                  onClick={() => handleRemoveStock(sym)}
                  className="hover:text-red-400 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Metrics Comparison Table */}
        {compareSymbols.length > 1 && (
          <div className="bg-[#1a1f2e] rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">핵심 지표 비교</h3>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 bg-gray-800/50">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium sticky left-0 bg-gray-800/50">지표</th>
                      {compareSymbols.map(sym => (
                        <th key={sym} className="text-center py-3 px-4 text-white font-semibold min-w-[100px]">
                          {sym}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON_METRICS.map(metric => {
                      const { best, worst } = getBestWorst(metric.key);
                      return (
                        <tr key={metric.key} className="border-b border-gray-800 hover:bg-gray-800/30">
                          <td className="py-3 px-4 text-gray-300 sticky left-0 bg-[#1a1f2e]">
                            {metric.label}
                          </td>
                          {compareSymbols.map(sym => {
                            const value = stockData[sym]?.[metric.key];
                            const isBest = sym === best && compareSymbols.length > 1;
                            const isWorst = sym === worst && compareSymbols.length > 1;
                            return (
                              <td key={sym} className="text-center py-3 px-4">
                                <div className="flex items-center justify-center gap-1">
                                  {isBest && <TrendingUp size={14} className="text-green-400" />}
                                  {isWorst && <TrendingDown size={14} className="text-red-400" />}
                                  <span className={`font-medium ${getHighlightClass(value, metric.highlight)} ${
                                    isBest ? 'text-green-400' : isWorst ? 'text-red-400' : 'text-white'
                                  }`}>
                                    {formatValue(value, metric.format)}
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
              </div>
            )}
          </div>
        )}

        {/* Chart Comparison */}
        <div className="bg-[#1a1f2e] rounded-xl border border-gray-700 p-4" style={{ height: '500px' }}>
          <ChartWidget
            widgetId="comparison-chart"
            initialSymbols={compareSymbols}
            onRemove={() => {}}
          />
        </div>
      </div>

      {/* Add Stock Modal */}
      {showAddStock && (
        <StockSelectorModal
          onSelect={handleAddStock}
          onClose={() => setShowAddStock(false)}
        />
      )}
    </div>
  );
}
