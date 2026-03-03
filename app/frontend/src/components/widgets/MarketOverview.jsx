/**
 * Market Overview Widget - Real-time market indices display
 * Shows major indices with mini sparkline charts
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, TrendingDown, Globe } from 'lucide-react';
import { API_BASE } from '../../config/api';
import WidgetHeader from './common/WidgetHeader';

// Major indices to display
const MARKET_INDICES = [
  { symbol: '^GSPC', name: 'S&P 500', shortName: 'S&P 500' },
  { symbol: '^IXIC', name: 'NASDAQ Composite', shortName: 'Nasdaq' },
  { symbol: '^DJI', name: 'Dow Jones', shortName: 'Dow Jones' },
  { symbol: '^RUT', name: 'Russell 2000', shortName: 'Russell 2000' },
  { symbol: '^GDAXI', name: 'DAX', shortName: 'DAX' },
  { symbol: '^N225', name: 'Nikkei 225', shortName: 'Nikkei 225' },
  { symbol: '^KS11', name: 'KOSPI', shortName: 'KOSPI' },
  { symbol: '^KQ11', name: 'KOSDAQ', shortName: 'KOSDAQ' },
];

const MiniSparkline = ({ data, isPositive }) => {
  const divRef = useRef(null);

  useEffect(() => {
    if (!divRef.current || !data?.length) return;
    let ro;
    const draw = async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      const color = isPositive ? '#22c55e' : '#ef4444';
      await Plotly.react(
        divRef.current,
        [{ type: 'scatter', mode: 'lines', y: data.map(d => d.close), line: { color, width: 1 } }],
        {
          paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
          margin: { t: 0, r: 0, b: 0, l: 0 },
          xaxis: { visible: false }, yaxis: { visible: false },
          showlegend: false,
        },
        { displayModeBar: false, responsive: true },
      );
      ro = new ResizeObserver(() => Plotly.Plots.resize(divRef.current));
      ro.observe(divRef.current);
    };
    draw();
    return () => { if (ro) ro.disconnect(); };
  }, [data, isPositive]);

  if (!data?.length) return null;
  return <div ref={divRef} className="w-16 h-6" />;
};

const IndexCard = ({ symbol, name, shortName, quote, history }) => {
  const price = quote?.price || quote?.regularMarketPrice || 0;
  const change = quote?.change || quote?.regularMarketChange || 0;
  const changePercent = quote?.change_percent ?? quote?.changePercent ?? quote?.regularMarketChangePercent ?? 0;
  const isPositive = change >= 0;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-r border-gray-800 last:border-r-0 min-w-[140px]">
      <div className="flex-1">
        <div className="text-[10px] text-gray-500 font-medium">{shortName}</div>
        <div className="text-[11px] font-bold text-white">
          {price ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
        </div>
        <div className={`text-[10px] font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
          {isPositive ? '+' : ''}{change?.toFixed(2)} ({isPositive ? '+' : ''}{changePercent?.toFixed(2)}%)
        </div>
      </div>
      <MiniSparkline data={history} isPositive={isPositive} />
    </div>
  );
};

export default function MarketOverview({ symbols = MARKET_INDICES, onRemove }) {
  const [quotes, setQuotes] = useState({});
  const [histories, setHistories] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      // Fetch quotes for all indices
      const quotePromises = symbols.map(async ({ symbol }) => {
        try {
          const res = await fetch(`${API_BASE}/stock/quote/${encodeURIComponent(symbol)}`);
          if (res.ok) {
            const data = await res.json();
            return { symbol, data };
          }
        } catch (e) {
          console.error(`Failed to fetch quote for ${symbol}:`, e);
        }
        return { symbol, data: null };
      });

      // Fetch mini history for sparklines (5 days)
      const historyPromises = symbols.map(async ({ symbol }) => {
        try {
          const res = await fetch(`${API_BASE}/stock/history/${encodeURIComponent(symbol)}?period=5d&interval=1h`);
          if (res.ok) {
            const data = await res.json();
            return { symbol, data: data.data || [] };
          }
        } catch (e) {
          console.error(`Failed to fetch history for ${symbol}:`, e);
        }
        return { symbol, data: [] };
      });

      const [quoteResults, historyResults] = await Promise.all([
        Promise.all(quotePromises),
        Promise.all(historyPromises)
      ]);

      const newQuotes = {};
      quoteResults.forEach(({ symbol, data }) => {
        if (data) newQuotes[symbol] = data;
      });

      const newHistories = {};
      historyResults.forEach(({ symbol, data }) => {
        newHistories[symbol] = data;
      });

      setQuotes(newQuotes);
      setHistories(newHistories);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch market data:', error);
    } finally {
      setLoading(false);
    }
  }, [symbols]);

  useEffect(() => {
    fetchData();
    // Refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="bg-[#0d0d12] border border-gray-800 rounded-lg overflow-hidden h-full flex flex-col">
      {/* Header */}
      <WidgetHeader
        icon={Globe}
        iconColor="text-green-400"
        title="Market Overview"
        subtitle="Global Indices"
        loading={loading}
        onRefresh={fetchData}
        onRemove={onRemove}
      />

      {/* Scrollable indices */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex h-full">
          {symbols.map(({ symbol, name, shortName }) => (
            <IndexCard
              key={symbol}
              symbol={symbol}
              name={name}
              shortName={shortName}
              quote={quotes[symbol]}
              history={histories[symbol]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
