/**
 * Ticker Information Widget - Real-time ticker info with chart
 */
import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { API_BASE } from '../../config/api';

export default function TickerInformation({ symbol = 'AAPL', onSymbolChange }) {
  const [quote, setQuote] = useState(null);
  const [info, setInfo] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!symbol) return;

    setLoading(true);
    try {
      const [quoteRes, infoRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/stock/quote/${encodeURIComponent(symbol)}`),
        fetch(`${API_BASE}/stock/info/${encodeURIComponent(symbol)}`),
        fetch(`${API_BASE}/stock/history/${encodeURIComponent(symbol)}?period=1mo&interval=1d`)
      ]);

      if (quoteRes.ok) setQuote(await quoteRes.json());
      if (infoRes.ok) setInfo(await infoRes.json());
      if (historyRes.ok) {
        const data = await historyRes.json();
        setHistory(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch ticker data:', error);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const price = quote?.price || quote?.regularMarketPrice || 0;
  const change = quote?.change || quote?.regularMarketChange || 0;
  const changePercent = quote?.changePercent || quote?.regularMarketChangePercent || 0;
  const volume = quote?.volume || quote?.regularMarketVolume || 0;
  const isPositive = change >= 0;

  const formatVolume = (vol) => {
    if (!vol) return '-';
    if (vol >= 1e9) return `${(vol / 1e9).toFixed(2)}B`;
    if (vol >= 1e6) return `${(vol / 1e6).toFixed(2)}M`;
    if (vol >= 1e3) return `${(vol / 1e3).toFixed(2)}K`;
    return vol.toString();
  };

  return (
    <div className="bg-[#0d0d12] border border-gray-800 rounded-lg overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#12121a]">
        <div className="flex items-center gap-2">
          <RefreshCw
            size={14}
            className={`text-gray-400 ${loading ? 'animate-spin' : 'cursor-pointer hover:text-white'}`}
            onClick={() => !loading && fetchData()}
          />
          <span className="text-sm font-medium text-white">Ticker Information</span>
          <select
            value={symbol}
            onChange={(e) => onSymbolChange?.(e.target.value)}
            className="bg-gray-800 text-xs text-cyan-400 border border-gray-700 rounded px-2 py-1 outline-none"
          >
            <option value="AAPL">AAPL</option>
            <option value="MSFT">MSFT</option>
            <option value="NVDA">NVDA</option>
            <option value="GOOGL">GOOGL</option>
            <option value="TSLA">TSLA</option>
            <option value="META">META</option>
            <option value="AMZN">AMZN</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1 text-gray-500 hover:text-white">⋮</button>
          <button className="p-1 text-gray-500 hover:text-white">↗</button>
          <button className="p-1 text-gray-500 hover:text-white">×</button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 flex gap-4">
        {/* Chart */}
        <div className="w-32 h-20">
          {history.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke={isPositive ? '#22c55e' : '#ef4444'}
                  strokeWidth={1.5}
                  fill={`url(#gradient-${symbol})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Info */}
        <div className="flex-1">
          <div className="flex items-baseline gap-4 mb-2">
            <div>
              <span className="text-xs text-gray-500">Price</span>
              <div className="text-xl font-bold text-white">
                ${price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <span className="text-xs text-gray-500">Day's Change</span>
              <div className={`text-lg font-bold flex items-center gap-1 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {change?.toFixed(2)} ({isPositive ? '+' : ''}{changePercent?.toFixed(2)}%)
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-400">
            <span className="text-gray-500">Volume: </span>
            <span className="text-white font-medium">{formatVolume(volume)}</span>
          </div>

          {info && (
            <div className="text-xs text-gray-500 mt-1">
              {info.sector} | {info.country || 'US'} | {info.exchange}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
