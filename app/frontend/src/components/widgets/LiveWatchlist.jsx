/**
 * Live Watchlist Widget - Real-time stock watchlist with sparklines
 * Similar to trading terminal style
 */
import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, List } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { API_BASE } from '../../config/api';
import WidgetHeader from './common/WidgetHeader';

// Default watchlist symbols
const DEFAULT_SYMBOLS = [
  { symbol: 'BTC-USD', name: 'Bitcoin', category: 'Crypto' },
  { symbol: 'ETH-USD', name: 'Ethereum', category: 'Crypto' },
  { symbol: 'AAPL', name: 'Apple', category: 'Equity.US' },
  { symbol: 'MSFT', name: 'Microsoft', category: 'Equity.US' },
  { symbol: 'NVDA', name: 'NVIDIA', category: 'Equity.US' },
  { symbol: 'GOOGL', name: 'Google', category: 'Equity.US' },
  { symbol: 'TSLA', name: 'Tesla', category: 'Equity.US' },
  { symbol: 'QQQ', name: 'Nasdaq ETF', category: 'Equity.US' },
];

const MiniSparkline = ({ data, isPositive }) => {
  if (!data || data.length < 2) return <div className="w-24 h-8" />;

  return (
    <div className="w-24 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="close"
            stroke={isPositive ? '#22c55e' : '#ef4444'}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const formatPrice = (price) => {
  if (!price) return '-';
  if (price >= 1000) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(2);
  return price.toFixed(4);
};

const formatPercent = (value) => {
  if (value === null || value === undefined) return '-';
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
};

const WatchlistRow = ({ item, onRemove }) => {
  const { symbol, name, category, quote, history } = item;
  const price = quote?.price || quote?.regularMarketPrice || 0;
  const change1h = quote?.change1h || 0;
  const change24h = quote?.change_percent ?? quote?.changePercent ?? quote?.regularMarketChangePercent ?? 0;
  const change7d = quote?.change7d || 0;
  const isPositive = change24h >= 0;

  return (
    <tr className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">
      <td className="py-1.5 px-3">
        <span className="text-[11px] font-medium text-white">{category}.{symbol.replace('-USD', '')}/USD</span>
      </td>
      <td className="py-1.5 px-3 text-right">
        <span className="text-[11px] font-medium text-white">{formatPrice(price)}</span>
      </td>
      <td className="py-1.5 px-3 text-right">
        <span className={`text-[11px] font-medium ${change1h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {formatPercent(change1h)}
        </span>
      </td>
      <td className="py-1.5 px-3 text-right">
        <span className={`text-[11px] font-medium ${change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {formatPercent(change24h)}
        </span>
      </td>
      <td className="py-1.5 px-3 text-right">
        <span className={`text-[11px] font-medium ${change7d >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {formatPercent(change7d)}
        </span>
      </td>
      <td className="py-1.5 px-3">
        <MiniSparkline data={history} isPositive={isPositive} />
      </td>
    </tr>
  );
};

export default function LiveWatchlist({ defaultSymbols = DEFAULT_SYMBOLS, title = "Live Watchlist", onRemove }) {
  const [symbols, setSymbols] = useState(defaultSymbols);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCount, setSelectedCount] = useState(defaultSymbols.length);

  const fetchData = useCallback(async () => {
    try {
      const results = await Promise.all(
        symbols.map(async ({ symbol, name, category }) => {
          try {
            // Fetch quote
            const quoteRes = await fetch(`${API_BASE}/stock/quote/${encodeURIComponent(symbol)}`);
            const quote = quoteRes.ok ? await quoteRes.json() : null;

            // Fetch history for sparkline
            const historyRes = await fetch(`${API_BASE}/stock/history/${encodeURIComponent(symbol)}?period=7d&interval=1d`);
            const historyData = historyRes.ok ? await historyRes.json() : null;

            return {
              symbol,
              name,
              category,
              quote,
              history: historyData?.data || []
            };
          } catch (e) {
            console.error(`Failed to fetch data for ${symbol}:`, e);
            return { symbol, name, category, quote: null, history: [] };
          }
        })
      );

      setData(results);
    } catch (error) {
      console.error('Failed to fetch watchlist data:', error);
    } finally {
      setLoading(false);
    }
  }, [symbols]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRemove = (symbol) => {
    setSymbols(symbols.filter(s => s.symbol !== symbol));
    setData(data.filter(d => d.symbol !== symbol));
    setSelectedCount(prev => prev - 1);
  };

  return (
    <div className="bg-[#0d0d12] border border-gray-800 rounded-lg overflow-hidden h-full flex flex-col">
      {/* Header */}
      <WidgetHeader
        icon={List}
        iconColor="text-cyan-400"
        title={title}
        subtitle={`${selectedCount} symbols`}
        loading={loading}
        onRefresh={fetchData}
        onRemove={onRemove}
      />

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-[#0a0a0f] sticky top-0">
            <tr className="text-[10px] text-gray-500">
              <th className="py-1.5 px-3 text-left font-medium">Symbol</th>
              <th className="py-1.5 px-3 text-right font-medium">Price</th>
              <th className="py-1.5 px-3 text-right font-medium">1H</th>
              <th className="py-1.5 px-3 text-right font-medium">24H</th>
              <th className="py-1.5 px-3 text-right font-medium">7D</th>
              <th className="py-1.5 px-3 text-right font-medium">Last 7 Days</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <tr key={i} className="border-b border-gray-800/50">
                  <td colSpan={6} className="py-3 px-4">
                    <div className="h-4 bg-gray-800 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : (
              data.map((item) => (
                <WatchlistRow
                  key={item.symbol}
                  item={item}
                  onRemove={handleRemove}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
