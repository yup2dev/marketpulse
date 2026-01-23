import { useState, useEffect } from 'react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Plus, X, Search, RefreshCw, GitCompare } from 'lucide-react';
import { API_BASE } from '../../config/api';
import { formatCurrency } from '../../utils/widgetUtils';
import ChartWidget from '../widgets/ChartWidget';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const ComparisonAnalysisTab = ({ symbol }) => {
  const [symbols, setSymbols] = useState([symbol]);
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [stocksData, setStocksData] = useState({});
  const [loading, setLoading] = useState(false);

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
        const [quoteRes, infoRes] = await Promise.all([
          fetch(`${API_BASE}/stock/quote/${sym}`),
          fetch(`${API_BASE}/stock/info/${sym}`)
        ]);

        const quote = quoteRes.ok ? await quoteRes.json() : null;
        const info = infoRes.ok ? await infoRes.json() : null;

        return { symbol: sym, quote, info };
      });

      const results = await Promise.all(dataPromises);

      const newStocksData = {};
      results.forEach(result => {
        newStocksData[result.symbol] = {
          quote: result.quote,
          info: result.info
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

  // Prepare radar chart data for metrics comparison
  const prepareRadarData = () => {
    const metrics = ['profitMargin', 'operatingMargin', 'returnOnEquity', 'returnOnAssets', 'debtToEquity'];
    const labels = ['Profit Margin', 'Operating Margin', 'ROE', 'ROA', 'D/E Ratio'];

    return labels.map((label, idx) => {
      const dataPoint = { metric: label };
      symbols.forEach(sym => {
        const info = stocksData[sym]?.info;
        if (info) {
          let value = 0;
          switch(metrics[idx]) {
            case 'profitMargin': value = (info.profit_margin || 0) * 100; break;
            case 'operatingMargin': value = (info.operating_margin || 0) * 100; break;
            case 'returnOnEquity': value = (info.roe || 0) * 100; break;
            case 'returnOnAssets': value = (info.roa || 0) * 100; break;
            case 'debtToEquity': value = info.debt_to_equity || 0; break;
          }
          dataPoint[sym] = Math.abs(value);
        }
      });
      return dataPoint;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with Symbol Selection */}
      <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-white flex items-center gap-2">
              <GitCompare className="text-blue-500" size={24} />
              Comparison Analysis
            </h3>
            <p className="text-gray-400 text-sm mt-1">Compare up to 6 stocks side by side</p>
          </div>
          <button
            onClick={loadComparisonData}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white text-sm"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Selected Symbols */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {symbols.map((sym, idx) => (
            <div
              key={sym}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ backgroundColor: `${COLORS[idx]}20`, color: COLORS[idx], border: `1px solid ${COLORS[idx]}40` }}
            >
              <span>{sym}</span>
              {symbols.length > 1 && (
                <button
                  onClick={() => removeSymbol(sym)}
                  className="hover:opacity-70 transition-opacity"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}

          {symbols.length < 6 && (
            <div className="relative">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300 transition-colors"
              >
                <Plus size={14} />
                Add Stock
              </button>

              {showSearch && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-xl z-50">
                  <div className="p-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                      <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => {
                          setSearchInput(e.target.value);
                          searchStocks(e.target.value);
                        }}
                        className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                        placeholder="Search by symbol or name..."
                        autoFocus
                      />
                    </div>
                  </div>
                  {searchResults.length > 0 && (
                    <div className="max-h-60 overflow-y-auto border-t border-gray-700">
                      {searchResults.map((result) => (
                        <button
                          key={result.symbol}
                          onClick={() => addSymbol(result.symbol)}
                          disabled={symbols.includes(result.symbol)}
                          className="w-full px-4 py-2 text-left hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="font-medium text-white">{result.symbol}</div>
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

      {/* Advanced Chart Widget */}
      <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 min-h-[600px] relative overflow-visible">
        <ChartWidget
          widgetId={`comparison-${symbol}`}
          initialSymbols={symbols}
        />
      </div>

      {/* Metrics Comparison Table */}
      <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
        <h4 className="text-lg font-semibold text-white mb-4">Key Metrics Comparison</h4>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Metric</th>
                {symbols.map((sym, idx) => (
                  <th key={sym} className="text-right py-3 px-4 font-medium" style={{ color: COLORS[idx] }}>
                    {sym}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                <td className="py-3 px-4 text-gray-300">Current Price</td>
                {symbols.map((sym) => (
                  <td key={sym} className="text-right py-3 px-4 text-white font-medium">
                    ${stocksData[sym]?.quote?.price?.toFixed(2) || '-'}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                <td className="py-3 px-4 text-gray-300">Day Change</td>
                {symbols.map((sym) => {
                  const change = stocksData[sym]?.quote?.change_percent;
                  return (
                    <td key={sym} className={`text-right py-3 px-4 font-medium ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {change ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '-'}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                <td className="py-3 px-4 text-gray-300">Market Cap</td>
                {symbols.map((sym) => (
                  <td key={sym} className="text-right py-3 px-4 text-white">
                    {formatCurrency(stocksData[sym]?.info?.market_cap)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                <td className="py-3 px-4 text-gray-300">P/E Ratio</td>
                {symbols.map((sym) => (
                  <td key={sym} className="text-right py-3 px-4 text-white">
                    {stocksData[sym]?.info?.pe_ratio?.toFixed(2) || '-'}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                <td className="py-3 px-4 text-gray-300">EPS (TTM)</td>
                {symbols.map((sym) => (
                  <td key={sym} className="text-right py-3 px-4 text-white">
                    ${stocksData[sym]?.info?.eps?.toFixed(2) || '-'}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                <td className="py-3 px-4 text-gray-300">Revenue (TTM)</td>
                {symbols.map((sym) => (
                  <td key={sym} className="text-right py-3 px-4 text-white">
                    {formatCurrency(stocksData[sym]?.info?.revenue)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                <td className="py-3 px-4 text-gray-300">Profit Margin</td>
                {symbols.map((sym) => (
                  <td key={sym} className="text-right py-3 px-4 text-white">
                    {stocksData[sym]?.info?.profit_margin ? `${(stocksData[sym].info.profit_margin * 100).toFixed(1)}%` : '-'}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                <td className="py-3 px-4 text-gray-300">52W High</td>
                {symbols.map((sym) => (
                  <td key={sym} className="text-right py-3 px-4 text-white">
                    ${stocksData[sym]?.info?.fifty_two_week_high?.toFixed(2) || '-'}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                <td className="py-3 px-4 text-gray-300">52W Low</td>
                {symbols.map((sym) => (
                  <td key={sym} className="text-right py-3 px-4 text-white">
                    ${stocksData[sym]?.info?.fifty_two_week_low?.toFixed(2) || '-'}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                <td className="py-3 px-4 text-gray-300">Dividend Yield</td>
                {symbols.map((sym) => (
                  <td key={sym} className="text-right py-3 px-4 text-white">
                    {stocksData[sym]?.info?.dividend_yield ? `${(stocksData[sym].info.dividend_yield * 100).toFixed(2)}%` : '-'}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                <td className="py-3 px-4 text-gray-300">Beta</td>
                {symbols.map((sym) => (
                  <td key={sym} className="text-right py-3 px-4 text-white">
                    {stocksData[sym]?.info?.beta?.toFixed(2) || '-'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Radar Chart for Financial Metrics */}
      {symbols.length > 1 && (
        <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
          <h4 className="text-lg font-semibold text-white mb-4">Financial Metrics Radar</h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={prepareRadarData()}>
                <PolarGrid stroke="#333" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: '#666', fontSize: 12 }} />
                <PolarRadiusAxis tick={{ fill: '#666' }} />
                {symbols.map((sym, idx) => (
                  <Radar
                    key={sym}
                    name={sym}
                    dataKey={sym}
                    stroke={COLORS[idx]}
                    fill={COLORS[idx]}
                    fillOpacity={0.2}
                  />
                ))}
                <Legend />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                  labelStyle={{ color: '#fff' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComparisonAnalysisTab;
