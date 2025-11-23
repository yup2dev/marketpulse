import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, RefreshCw, X, BarChart3, Table2, Maximize2 } from 'lucide-react';

const API_BASE = 'http://localhost:8000/api';

const ResizableStockWidget = ({ symbol, onRemove, onExpand }) => {
  const [quote, setQuote] = useState(null);
  const [history, setHistory] = useState([]);
  const [viewMode, setViewMode] = useState('chart'); // 'chart' or 'table'
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (symbol) {
      loadData();
    }
  }, [symbol]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [quoteRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/stock/quote/${symbol}`),
        fetch(`${API_BASE}/stock/history/${symbol}?period=1mo`)
      ]);

      if (quoteRes.ok) {
        setQuote(await quoteRes.json());
      }

      if (historyRes.ok) {
        const histData = await historyRes.json();
        setHistory(histData.data || []);
      }
    } catch (error) {
      console.error('Error loading stock data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    if (!price) return 'N/A';
    return '$' + price.toFixed(2);
  };

  const formatPercent = (num) => {
    if (!num && num !== 0) return 'N/A';
    return (num >= 0 ? '+' : '') + num.toFixed(2) + '%';
  };

  const formatNumber = (num) => {
    if (!num) return 'N/A';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  const isPositive = quote?.change_percent >= 0;

  return (
    <div className="h-full bg-[#1a1a1a] rounded-lg border border-gray-800 flex flex-col overflow-hidden">
      {/* Header - Drag Handle */}
      <div className="flex items-center justify-between p-3 border-b border-gray-800">
        <div className="flex items-center gap-2 cursor-move drag-handle-area flex-1">
          <h3 className="font-semibold text-white">{symbol}</h3>
          {quote && (
            <span className={`text-sm font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {formatPercent(quote.change_percent)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* View Toggle */}
          <div className="flex bg-gray-800/50 rounded p-0.5 mr-2">
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setViewMode('chart');
              }}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'chart' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
              title="Chart View"
            >
              <BarChart3 size={14} />
            </button>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setViewMode('table');
              }}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
              title="Table View"
            >
              <Table2 size={14} />
            </button>
          </div>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              loadData();
            }}
            className="hover:text-white p-1 text-gray-400"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {onExpand && (
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onExpand();
              }}
              className="hover:text-white p-1 text-gray-400"
              title="Expand"
            >
              <Maximize2 size={16} />
            </button>
          )}
          {onRemove && (
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="hover:text-red-400 p-1 text-gray-400"
              title="Remove"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="animate-spin text-blue-500" size={24} />
          </div>
        ) : viewMode === 'chart' ? (
          <div className="h-full flex flex-col gap-2">
            {/* Price Info */}
            {quote && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-gray-400 text-xs">Price</div>
                  <div className="text-white font-semibold">{formatPrice(quote.price)}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">Change</div>
                  <div className={`font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                    {isPositive ? <TrendingUp className="inline" size={12} /> : <TrendingDown className="inline" size={12} />}
                    {formatPrice(quote.change)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">Volume</div>
                  <div className="text-white">{formatNumber(quote.volume)}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">High / Low</div>
                  <div className="text-white text-xs">{formatPrice(quote.high)} / {formatPrice(quote.low)}</div>
                </div>
              </div>
            )}

            {/* Chart */}
            <div className="flex-1 min-h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history.slice(-30)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#666', fontSize: 10 }}
                    tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis tick={{ fill: '#666', fontSize: 10 }} domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value) => formatPrice(value)}
                  />
                  <Line type="monotone" dataKey="close" stroke={isPositive ? '#22c55e' : '#ef4444'} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            {/* Table View */}
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#1a1a1a]">
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 text-gray-400 font-medium">Date</th>
                  <th className="text-right py-2 text-gray-400 font-medium">Close</th>
                  <th className="text-right py-2 text-gray-400 font-medium">Volume</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(-10).reverse().map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="py-2 text-gray-300">
                      {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="text-right text-white">{formatPrice(item.close)}</td>
                    <td className="text-right text-gray-400">{formatNumber(item.volume)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResizableStockWidget;
