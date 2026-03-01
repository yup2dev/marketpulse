/**
 * Live Watchlist Widget - Real-time stock watchlist with sparklines
 */
import { useState, useEffect, useCallback } from 'react';
import { List } from 'lucide-react';
import { API_BASE } from '../../config/api';
import WidgetHeader from './common/WidgetHeader';
import WidgetTable from './common/WidgetTable';

const DEFAULT_SYMBOLS = [
  { symbol: 'BTC-USD', name: 'Bitcoin',    category: 'Crypto'    },
  { symbol: 'ETH-USD', name: 'Ethereum',   category: 'Crypto'    },
  { symbol: 'AAPL',    name: 'Apple',       category: 'Equity.US' },
  { symbol: 'MSFT',    name: 'Microsoft',   category: 'Equity.US' },
  { symbol: 'NVDA',    name: 'NVIDIA',      category: 'Equity.US' },
  { symbol: 'GOOGL',   name: 'Google',      category: 'Equity.US' },
  { symbol: 'TSLA',    name: 'Tesla',       category: 'Equity.US' },
  { symbol: 'QQQ',     name: 'Nasdaq ETF',  category: 'Equity.US' },
];

const formatPrice = (price) => {
  if (!price) return '-';
  if (price >= 1000) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1)    return price.toFixed(2);
  return price.toFixed(4);
};

const formatPct = (value) => {
  if (value == null) return '-';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

const pctRender = (val) => (
  <span className={`font-medium ${val >= 0 ? 'text-green-500' : 'text-red-500'}`}>
    {formatPct(val)}
  </span>
);

const COLUMNS = [
  {
    key: 'label',
    header: 'Symbol',
    sortable: true,
    sortValue: (row) => row.label,
    render: (row) => <span className="font-medium text-white">{row.label}</span>,
  },
  {
    key: 'price',
    header: 'Price',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.price ?? -Infinity,
    exportValue: (row) => row.price?.toString() ?? '',
    render: (row) => <span className="font-medium text-white">{formatPrice(row.price)}</span>,
  },
  {
    key: 'change1h',
    header: '1H',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.change1h ?? -Infinity,
    exportValue: (row) => formatPct(row.change1h),
    render: (row) => pctRender(row.change1h),
  },
  {
    key: 'change24h',
    header: '24H',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.change24h ?? -Infinity,
    exportValue: (row) => formatPct(row.change24h),
    render: (row) => pctRender(row.change24h),
  },
  {
    key: 'change7d',
    header: '7D',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.change7d ?? -Infinity,
    exportValue: (row) => formatPct(row.change7d),
    render: (row) => pctRender(row.change7d),
  },
  {
    key: 'sparklineData',
    header: 'Last 7 Days',
    type: 'sparkline',
    sparkWidth: 64,
    sparkHeight: 22,
  },
];

export default function LiveWatchlist({ defaultSymbols = DEFAULT_SYMBOLS, title = 'Live Watchlist', onRemove }) {
  const [symbols]  = useState(defaultSymbols);
  const [data,     setData]    = useState([]);
  const [loading,  setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const results = await Promise.all(
        symbols.map(async ({ symbol, name, category }) => {
          try {
            const [quoteRes, histRes] = await Promise.all([
              fetch(`${API_BASE}/stock/quote/${encodeURIComponent(symbol)}`),
              fetch(`${API_BASE}/stock/history/${encodeURIComponent(symbol)}?period=7d&interval=1d`),
            ]);
            const quote   = quoteRes.ok ? await quoteRes.json() : null;
            const histData = histRes.ok  ? await histRes.json()  : null;
            const history  = histData?.data || [];

            const price    = quote?.price || quote?.regularMarketPrice || 0;
            const change1h = quote?.change1h || 0;
            const change24h = quote?.change_percent ?? quote?.changePercent ?? quote?.regularMarketChangePercent ?? 0;
            const change7d = quote?.change7d || 0;

            return {
              _key: symbol,
              label: `${category}.${symbol.replace('-USD', '')}/USD`,
              symbol,
              price,
              change1h,
              change24h,
              change7d,
              sparklineData: history.map(h => h.close).filter(Boolean),
            };
          } catch {
            return {
              _key: symbol,
              label: `${category}.${symbol.replace('-USD', '')}/USD`,
              symbol,
              price: 0,
              change1h: 0,
              change24h: 0,
              change7d: 0,
              sparklineData: [],
            };
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
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="bg-[#0d0d12] border border-gray-800 rounded-lg overflow-hidden h-full flex flex-col">
      <WidgetHeader
        icon={List}
        iconColor="text-cyan-400"
        title={title}
        subtitle={`${symbols.length} symbols`}
        loading={loading}
        onRefresh={fetchData}
        onRemove={onRemove}
      />
      <div className="flex-1 overflow-auto">
        <WidgetTable
          columns={COLUMNS}
          data={data}
          loading={loading}
          size="compact"
          resizable={true}
          showExport={true}
          exportFilename="watchlist"
          emptyMessage="No watchlist data"
        />
      </div>
    </div>
  );
}
