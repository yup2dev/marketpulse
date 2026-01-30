/**
 * Analysis 비교 분석 탭 - WidgetDashboard 기반 동적 레이아웃
 */
import { useState, useEffect } from 'react';
import { GitCompare, Plus, X, TrendingUp, TrendingDown, GripVertical } from 'lucide-react';
import { useStockContext } from './AnalysisDashboard';
import WidgetDashboard from '../WidgetDashboard';
import ChartWidget from '../widgets/ChartWidget';
import StockSelectorModal from '../StockSelectorModal';
import { API_BASE } from '../../config/api';

const COMPARISON_METRICS = [
  { key: 'market_cap', label: '시가총액', format: 'number' },
  { key: 'pe_ratio', label: 'P/E', format: 'ratio' },
  { key: 'price_to_book', label: 'P/B', format: 'ratio' },
  { key: 'price_to_sales', label: 'P/S', format: 'ratio' },
  { key: 'roe', label: 'ROE', format: 'percent' },
  { key: 'roa', label: 'ROA', format: 'percent' },
  { key: 'profit_margin', label: '이익률', format: 'percent' },
  { key: 'debt_to_equity', label: 'D/E', format: 'ratio' },
  { key: 'revenue_growth', label: '매출성장률', format: 'percent' },
  { key: 'dividend_yield', label: '배당수익률', format: 'percent' },
];

// 비교 분석 위젯 컴포넌트
function ComparisonContentWidget({ symbol, onRemove }) {
  const [compareSymbols, setCompareSymbols] = useState([symbol]);
  const [showAddStock, setShowAddStock] = useState(false);
  const [stockData, setStockData] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!compareSymbols.includes(symbol)) {
      setCompareSymbols([symbol]);
    }
  }, [symbol]);

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

          let roe = null, roa = null, profitMargin = null, debtToEquity = null, revenueGrowth = null;

          if (financials?.periods?.length > 0) {
            const latest = financials.periods[0];
            const previous = financials.periods[1];
            const inc = latest.income_statement || {};
            const bal = latest.balance_sheet || {};
            const prevInc = previous?.income_statement || {};

            roe = bal.total_equity && inc.net_income ? (inc.net_income / bal.total_equity * 100) : null;
            roa = bal.total_assets && inc.net_income ? (inc.net_income / bal.total_assets * 100) : null;
            profitMargin = inc.revenue && inc.net_income ? (inc.net_income / inc.revenue * 100) : null;
            debtToEquity = bal.total_equity && bal.total_debt ? (bal.total_debt / bal.total_equity) : null;
            revenueGrowth = prevInc.revenue && inc.revenue ? ((inc.revenue - prevInc.revenue) / prevInc.revenue * 100) : null;
          }

          newData[sym] = {
            ...info,
            roe, roa,
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
      case 'ratio': return value.toFixed(2);
      case 'percent': return `${value.toFixed(2)}%`;
      default: return value;
    }
  };

  const getBestWorst = (metricKey) => {
    const values = compareSymbols
      .map(sym => ({ sym, value: stockData[sym]?.[metricKey] }))
      .filter(item => item.value !== null && item.value !== undefined);
    if (values.length === 0) return { best: null, worst: null };
    const sorted = [...values].sort((a, b) => b.value - a.value);
    return { best: sorted[0]?.sym, worst: sorted[sorted.length - 1]?.sym };
  };

  return (
    <div className="bg-[#1a1f2e] rounded-xl border border-gray-700 h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="drag-handle-area cursor-move p-1 hover:bg-gray-700 rounded">
            <GripVertical size={14} className="text-gray-500" />
          </div>
          <GitCompare className="text-purple-500" size={24} />
          <div>
            <h2 className="text-lg font-bold text-white">비교 분석</h2>
            <p className="text-gray-400 text-xs">여러 종목 비교</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {compareSymbols.map((sym) => (
            <div key={sym} className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
              sym === symbol ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300'
            }`}>
              <span>{sym}</span>
              {compareSymbols.length > 1 && (
                <button onClick={() => handleRemoveStock(sym)} className="hover:text-red-400">
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setShowAddStock(true)}
            className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs text-white"
          >
            <Plus size={12} />
            추가
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {compareSymbols.length > 1 && (
          <div className="bg-gray-800/30 rounded-lg overflow-hidden">
            <div className="p-3 border-b border-gray-700">
              <h3 className="text-sm font-semibold text-white">핵심 지표 비교</h3>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-700 bg-gray-800/50">
                      <th className="text-left py-2 px-3 text-gray-400 font-medium">지표</th>
                      {compareSymbols.map(sym => (
                        <th key={sym} className="text-center py-2 px-3 text-white font-semibold min-w-[80px]">
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
                          <td className="py-2 px-3 text-gray-300">{metric.label}</td>
                          {compareSymbols.map(sym => {
                            const value = stockData[sym]?.[metric.key];
                            const isBest = sym === best && compareSymbols.length > 1;
                            const isWorst = sym === worst && compareSymbols.length > 1;
                            return (
                              <td key={sym} className="text-center py-2 px-3">
                                <div className="flex items-center justify-center gap-1">
                                  {isBest && <TrendingUp size={12} className="text-green-400" />}
                                  {isWorst && <TrendingDown size={12} className="text-red-400" />}
                                  <span className={`font-medium ${
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

        {/* Chart */}
        <div className="bg-gray-800/30 rounded-lg h-[300px]">
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

export { ComparisonContentWidget };

// 사용 가능한 위젯 목록
const AVAILABLE_WIDGETS = [
  { id: 'comparison-content', name: '비교 분석', description: '종목 비교 분석', defaultSize: { w: 12, h: 12 } },
];

export default function AnalysisComparisonTab() {
  const { symbol } = useStockContext();

  const DEFAULT_WIDGETS = [
    { id: 'comparison-content-1', type: 'comparison-content', symbol },
  ];

  const DEFAULT_LAYOUT = [
    { i: 'comparison-content-1', x: 0, y: 0, w: 12, h: 12, minW: 6, minH: 8 },
  ];

  return (
    <WidgetDashboard
      dashboardId={`analysis-comparison-${symbol}`}
      title="비교 분석"
      subtitle={symbol}
      availableWidgets={AVAILABLE_WIDGETS}
      defaultWidgets={DEFAULT_WIDGETS}
      defaultLayout={DEFAULT_LAYOUT}
    />
  );
}
