/**
 * Analysis Comparison Tab - Data-Focused Layout
 */
import { useState, useEffect } from 'react';
import { Plus, X, Search, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { useStockContext } from './AnalysisDashboard';
import ChartWidget from '../widgets/ChartWidget';
import StockSelectorModal from '../StockSelectorModal';
import { API_BASE } from '../../config/api';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function AnalysisComparisonTab() {
  const { symbol } = useStockContext();
  const [symbols, setSymbols] = useState([symbol]);
  const [stocksData, setStocksData] = useState({});
  const [loading, setLoading] = useState(false);
  const [showStockSelector, setShowStockSelector] = useState(false);

  useEffect(() => {
    if (symbol && !symbols.includes(symbol)) {
      setSymbols([symbol]);
    }
  }, [symbol]);

  useEffect(() => {
    loadComparisonData();
  }, [symbols]);

  const loadComparisonData = async () => {
    if (symbols.length === 0) return;

    setLoading(true);
    try {
      const dataPromises = symbols.map(async (sym) => {
        const [quoteRes, infoRes, financialsRes] = await Promise.all([
          fetch(`${API_BASE}/stock/quote/${sym}`),
          fetch(`${API_BASE}/stock/info/${sym}`),
          fetch(`${API_BASE}/stock/financials/${sym}?freq=annual&limit=2`)
        ]);

        const quote = quoteRes.ok ? await quoteRes.json() : null;
        const info = infoRes.ok ? await infoRes.json() : null;
        const financials = financialsRes.ok ? await financialsRes.json() : null;

        return { symbol: sym, quote, info, financials };
      });

      const results = await Promise.all(dataPromises);

      const newStocksData = {};
      results.forEach(result => {
        newStocksData[result.symbol] = {
          quote: result.quote,
          info: result.info,
          financials: result.financials
        };
      });

      setStocksData(newStocksData);
    } catch (error) {
      console.error('Error loading comparison data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addSymbol = (stock) => {
    if (!symbols.includes(stock.symbol) && symbols.length < 6) {
      setSymbols([...symbols, stock.symbol]);
    }
    setShowStockSelector(false);
  };

  const removeSymbol = (sym) => {
    if (symbols.length > 1) {
      setSymbols(symbols.filter(s => s !== sym));
    }
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined) return '-';
    if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return value.toLocaleString();
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return '-';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const formatRatio = (value) => {
    if (value === null || value === undefined) return '-';
    return value.toFixed(2);
  };

  const getMetrics = (sym) => {
    const data = stocksData[sym];
    if (!data) return {};

    const financials = data.financials;
    const latest = financials?.periods?.[0];
    const previous = financials?.periods?.[1];

    const incomeStatement = latest?.income_statement || {};
    const balanceSheet = latest?.balance_sheet || {};
    const prevIncomeStatement = previous?.income_statement || {};

    const roe = balanceSheet.total_equity && incomeStatement.net_income
      ? (incomeStatement.net_income / balanceSheet.total_equity * 100)
      : null;
    const roa = balanceSheet.total_assets && incomeStatement.net_income
      ? (incomeStatement.net_income / balanceSheet.total_assets * 100)
      : null;
    const netMargin = incomeStatement.revenue && incomeStatement.net_income
      ? (incomeStatement.net_income / incomeStatement.revenue * 100)
      : null;
    const debtToEquity = balanceSheet.total_equity && balanceSheet.total_debt
      ? (balanceSheet.total_debt / balanceSheet.total_equity)
      : null;
    const revenueGrowth = prevIncomeStatement.revenue && incomeStatement.revenue
      ? ((incomeStatement.revenue - prevIncomeStatement.revenue) / prevIncomeStatement.revenue * 100)
      : null;

    return { roe, roa, netMargin, debtToEquity, revenueGrowth };
  };

  const MetricRow = ({ label, getValue, format = 'value', higherIsBetter = true }) => {
    const values = symbols.map(sym => ({
      sym,
      value: getValue(sym)
    }));

    const validValues = values.filter(v => v.value !== null && v.value !== undefined && v.value !== '-');
    let best = null, worst = null;

    if (validValues.length > 1) {
      const sorted = [...validValues].sort((a, b) =>
        higherIsBetter ? b.value - a.value : a.value - b.value
      );
      best = sorted[0]?.sym;
      worst = sorted[sorted.length - 1]?.sym;
    }

    return (
      <tr className="border-b border-gray-800/50">
        <td className="py-3 px-4 text-gray-400 text-sm">{label}</td>
        {symbols.map((sym) => {
          const v = values.find(x => x.sym === sym);
          const isBest = sym === best;
          const isWorst = sym === worst;

          let displayValue = '-';
          if (v?.value !== null && v?.value !== undefined) {
            if (format === 'percent') displayValue = formatPercent(v.value);
            else if (format === 'ratio') displayValue = formatRatio(v.value);
            else if (format === 'number') displayValue = formatNumber(v.value);
            else if (format === 'price') displayValue = `$${v.value.toFixed(2)}`;
            else displayValue = v.value;
          }

          return (
            <td key={sym} className="py-3 px-4 text-right">
              <div className="flex items-center justify-end gap-1">
                {isBest && <TrendingUp size={12} className="text-green-500" />}
                {isWorst && <TrendingDown size={12} className="text-red-500" />}
                <span className={`font-medium ${
                  isBest ? 'text-green-400' : isWorst ? 'text-red-400' : 'text-white'
                }`}>
                  {displayValue}
                </span>
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid grid-cols-12 gap-4">
        {/* Symbol Selector Bar */}
        <div className="col-span-12">
          <div className="bg-[#0d0d12] rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {symbols.map((sym, idx) => (
                  <div
                    key={sym}
                    className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium"
                    style={{ backgroundColor: `${COLORS[idx]}15`, color: COLORS[idx], border: `1px solid ${COLORS[idx]}30` }}
                  >
                    <span>{sym}</span>
                    {symbols.length > 1 && (
                      <button onClick={() => removeSymbol(sym)} className="hover:opacity-70">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}

                {symbols.length < 6 && (
                  <button
                    onClick={() => setShowStockSelector(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300"
                  >
                    <Plus size={14} />
                    Add
                  </button>
                )}
              </div>

              <button
                onClick={loadComparisonData}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="col-span-8">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800 h-[400px]">
            <ChartWidget
              widgetId={`comparison-${symbol}`}
              initialSymbols={symbols}
            />
          </div>
        </div>

        {/* Key Metrics */}
        <div className="col-span-4">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800 h-[400px] overflow-hidden">
            <div className="p-4 border-b border-gray-800">
              <h4 className="text-sm font-semibold text-white">Key Metrics</h4>
            </div>
            <div className="overflow-auto h-[calc(100%-52px)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#0d0d12]">
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-2 px-4 text-gray-500 text-xs font-medium">Metric</th>
                    {symbols.map((sym, idx) => (
                      <th key={sym} className="text-right py-2 px-4 text-xs font-medium" style={{ color: COLORS[idx] }}>
                        {sym}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <MetricRow
                    label="Price"
                    getValue={(sym) => stocksData[sym]?.quote?.price}
                    format="price"
                    higherIsBetter={false}
                  />
                  <MetricRow
                    label="Change"
                    getValue={(sym) => stocksData[sym]?.quote?.change_percent}
                    format="percent"
                  />
                  <MetricRow
                    label="Market Cap"
                    getValue={(sym) => stocksData[sym]?.info?.market_cap}
                    format="number"
                  />
                  <MetricRow
                    label="P/E"
                    getValue={(sym) => stocksData[sym]?.info?.pe_ratio}
                    format="ratio"
                    higherIsBetter={false}
                  />
                  <MetricRow
                    label="P/B"
                    getValue={(sym) => stocksData[sym]?.info?.price_to_book}
                    format="ratio"
                    higherIsBetter={false}
                  />
                  <MetricRow
                    label="EPS"
                    getValue={(sym) => stocksData[sym]?.info?.eps}
                    format="price"
                  />
                  <MetricRow
                    label="Dividend"
                    getValue={(sym) => stocksData[sym]?.info?.dividend_yield ? stocksData[sym].info.dividend_yield * 100 : null}
                    format="percent"
                  />
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Financial Metrics Table */}
        <div className="col-span-12">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800">
            <div className="p-4 border-b border-gray-800">
              <h4 className="text-sm font-semibold text-white">Financial Comparison</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-3 px-4 text-gray-500 text-xs font-medium">Metric</th>
                    {symbols.map((sym, idx) => (
                      <th key={sym} className="text-right py-3 px-4 text-xs font-medium" style={{ color: COLORS[idx] }}>
                        {sym}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <MetricRow
                    label="ROE"
                    getValue={(sym) => getMetrics(sym).roe}
                    format="percent"
                  />
                  <MetricRow
                    label="ROA"
                    getValue={(sym) => getMetrics(sym).roa}
                    format="percent"
                  />
                  <MetricRow
                    label="Net Margin"
                    getValue={(sym) => getMetrics(sym).netMargin}
                    format="percent"
                  />
                  <MetricRow
                    label="D/E Ratio"
                    getValue={(sym) => getMetrics(sym).debtToEquity}
                    format="ratio"
                    higherIsBetter={false}
                  />
                  <MetricRow
                    label="Revenue Growth"
                    getValue={(sym) => getMetrics(sym).revenueGrowth}
                    format="percent"
                  />
                  <MetricRow
                    label="Beta"
                    getValue={(sym) => stocksData[sym]?.info?.beta}
                    format="ratio"
                    higherIsBetter={false}
                  />
                  <MetricRow
                    label="52W High"
                    getValue={(sym) => stocksData[sym]?.info?.fifty_two_week_high}
                    format="price"
                  />
                  <MetricRow
                    label="52W Low"
                    getValue={(sym) => stocksData[sym]?.info?.fifty_two_week_low}
                    format="price"
                    higherIsBetter={false}
                  />
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Selector Modal */}
      {showStockSelector && (
        <StockSelectorModal
          onSelect={addSymbol}
          onClose={() => setShowStockSelector(false)}
        />
      )}
    </div>
  );
}
