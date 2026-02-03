/**
 * Comparison Analysis Tab - Data-Focused Layout with Standard Widget Controls
 * Standard Controls: Close, Refresh, Corner Resize
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, Search, RefreshCw, TrendingUp, TrendingDown, BarChart3, Table2 } from 'lucide-react';
import { API_BASE } from '../../config/api';
import ChartWidget from '../widgets/ChartWidget';
import { WidgetHeader, AddWidgetPlaceholder, ResizeHandle } from '../common/WidgetHeader';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

// Resizable Widget Wrapper
function ResizableWidgetWrapper({ children, minWidth = 300, minHeight = 200, defaultHeight = 400 }) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 'auto', height: defaultHeight });

  const handleResize = useCallback((deltaX, deltaY) => {
    setSize(prev => ({
      width: prev.width === 'auto' ? 'auto' : Math.max(minWidth, prev.width + deltaX),
      height: Math.max(minHeight, (prev.height || defaultHeight) + deltaY)
    }));
  }, [minWidth, minHeight, defaultHeight]);

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{
        height: size.height === 'auto' ? 'auto' : `${size.height}px`,
        minHeight: `${minHeight}px`,
      }}
    >
      {children}
      <ResizeHandle onResize={handleResize} />
    </div>
  );
}

// Key Metrics Widget
function KeyMetricsWidget({ symbols, stocksData, loading, onRefresh, onClose }) {
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
        {symbols.map((sym, idx) => {
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
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden h-full flex flex-col">
      <WidgetHeader
        title="Key Metrics"
        icon={BarChart3}
        iconColor="text-blue-400"
        onRefresh={onRefresh}
        onClose={onClose}
        loading={loading}
      />
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#0a0a0f]">
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
        )}
      </div>
    </div>
  );
}

// Financial Metrics Widget
function FinancialMetricsWidget({ symbols, stocksData, loading, onRefresh, onClose }) {
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
        {symbols.map((sym, idx) => {
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
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden h-full flex flex-col">
      <WidgetHeader
        title="Financial Comparison"
        icon={Table2}
        iconColor="text-purple-400"
        onRefresh={onRefresh}
        onClose={onClose}
        loading={loading}
      />
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#0a0a0f]">
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
        )}
      </div>
    </div>
  );
}

const ComparisonAnalysisTab = ({ symbol }) => {
  const [symbols, setSymbols] = useState([symbol]);
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [stocksData, setStocksData] = useState({});
  const [loading, setLoading] = useState(false);

  // Widget visibility state
  const [visibleWidgets, setVisibleWidgets] = useState({
    chart: true,
    keyMetrics: true,
    financialMetrics: true
  });

  const handleCloseWidget = (widgetId) => {
    setVisibleWidgets(prev => ({ ...prev, [widgetId]: false }));
  };

  const handleAddWidget = (widgetId) => {
    setVisibleWidgets(prev => ({ ...prev, [widgetId]: true }));
  };

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

  const searchStocks = async (query) => {
    if (!query || query.length < 1) {
      setSearchResults([]);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/stock/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.slice(0, 10));
      }
    } catch (error) {
      console.error('Error searching stocks:', error);
    }
  };

  const addSymbol = (sym) => {
    if (!symbols.includes(sym) && symbols.length < 6) {
      setSymbols([...symbols, sym]);
    }
    setSearchInput('');
    setSearchResults([]);
    setShowSearch(false);
  };

  const removeSymbol = (sym) => {
    if (symbols.length > 1) {
      setSymbols(symbols.filter(s => s !== sym));
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Stock Comparison</h3>
        <button
          onClick={loadComparisonData}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh All
        </button>
      </div>

      {/* Symbol Selector Bar */}
      <div className="bg-[#0d0d12] rounded-lg p-4 border border-gray-800">
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
            <div className="relative">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300"
              >
                <Plus size={14} />
                Add Stock
              </button>

              {showSearch && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-[#0d0d12] border border-gray-700 rounded-lg shadow-xl z-50">
                  <div className="p-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
                      <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => {
                          setSearchInput(e.target.value);
                          searchStocks(e.target.value);
                        }}
                        className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                        placeholder="Search symbol..."
                        autoFocus
                      />
                    </div>
                  </div>
                  {searchResults.length > 0 && (
                    <div className="max-h-48 overflow-y-auto border-t border-gray-700">
                      {searchResults.map((result) => (
                        <button
                          key={result.symbol}
                          onClick={() => addSymbol(result.symbol)}
                          disabled={symbols.includes(result.symbol)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-800 disabled:opacity-50"
                        >
                          <div className="text-sm font-medium text-white">{result.symbol}</div>
                          <div className="text-xs text-gray-400 truncate">{result.name}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Chart Widget */}
        <div className="col-span-8">
          {visibleWidgets.chart ? (
            <ResizableWidgetWrapper minHeight={350} defaultHeight={400}>
              <div className="bg-[#0d0d12] rounded-lg border border-gray-800 h-full">
                <ChartWidget
                  widgetId={`comparison-${symbol}`}
                  initialSymbols={symbols}
                />
              </div>
            </ResizableWidgetWrapper>
          ) : (
            <AddWidgetPlaceholder onAdd={() => handleAddWidget('chart')} widgetType="chart" label="Add Chart Widget" />
          )}
        </div>

        {/* Key Metrics Widget */}
        <div className="col-span-4">
          {visibleWidgets.keyMetrics ? (
            <ResizableWidgetWrapper minHeight={350} defaultHeight={400}>
              <KeyMetricsWidget
                symbols={symbols}
                stocksData={stocksData}
                loading={loading}
                onRefresh={loadComparisonData}
                onClose={() => handleCloseWidget('keyMetrics')}
              />
            </ResizableWidgetWrapper>
          ) : (
            <AddWidgetPlaceholder onAdd={() => handleAddWidget('keyMetrics')} widgetType="keyMetrics" label="Add Key Metrics Widget" />
          )}
        </div>

        {/* Financial Metrics Widget - Full Width */}
        <div className="col-span-12">
          {visibleWidgets.financialMetrics ? (
            <ResizableWidgetWrapper minHeight={300} defaultHeight={400}>
              <FinancialMetricsWidget
                symbols={symbols}
                stocksData={stocksData}
                loading={loading}
                onRefresh={loadComparisonData}
                onClose={() => handleCloseWidget('financialMetrics')}
              />
            </ResizableWidgetWrapper>
          ) : (
            <AddWidgetPlaceholder onAdd={() => handleAddWidget('financialMetrics')} widgetType="financialMetrics" label="Add Financial Metrics Widget" />
          )}
        </div>
      </div>
    </div>
  );
};

export default ComparisonAnalysisTab;
