/**
 * AnalystWidget - Displays analyst recommendations using BaseWidget
 */
import { useState, useEffect, useCallback } from 'react';
import { Users, TrendingUp, TrendingDown, Target, BarChart2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import BaseWidget from './common/BaseWidget';
import { formatPrice, API_BASE } from './constants';

const RATING_COLORS = {
  'Buy': 'bg-green-500',
  'Strong Buy': 'bg-green-600',
  'Hold': 'bg-yellow-500',
  'Sell': 'bg-red-500',
  'Strong Sell': 'bg-red-600',
  'N/A': 'bg-gray-500'
};

const RATING_LABELS = {
  'Buy': '매수',
  'Strong Buy': '적극 매수',
  'Hold': '중립',
  'Sell': '매도',
  'Strong Sell': '적극 매도',
  'N/A': 'N/A'
};

const AnalystWidget = ({ symbol, onRemove }) => {
  const [analyst, setAnalyst] = useState(null);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('table');

  const loadData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const [analystRes, quoteRes] = await Promise.all([
        fetch(`${API_BASE}/stock/analyst/${symbol}`),
        fetch(`${API_BASE}/stock/quote/${symbol}`)
      ]);
      if (analystRes.ok) setAnalyst(await analystRes.json());
      if (quoteRes.ok) setQuote(await quoteRes.json());
    } catch (error) {
      console.error('Error loading analyst data:', error);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const upside = analyst?.price_target?.average && quote?.price
    ? ((analyst.price_target.average - quote.price) / quote.price * 100) : null;

  const getChartData = () => {
    if (!analyst?.ratings) return [];
    return [
      { name: 'Strong Buy', value: analyst.ratings.strong_buy || 0, fill: '#16a34a' },
      { name: 'Buy', value: analyst.ratings.buy || 0, fill: '#22c55e' },
      { name: 'Hold', value: analyst.ratings.hold || 0, fill: '#eab308' },
      { name: 'Sell', value: analyst.ratings.sell || 0, fill: '#f87171' },
      { name: 'Strong Sell', value: analyst.ratings.strong_sell || 0, fill: '#dc2626' },
    ].filter(d => d.value > 0);
  };

  const RatingBar = ({ label, count, total, color }) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-400 w-16">{label}</span>
        <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
          <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${percentage}%` }} />
        </div>
        <span className="text-[10px] text-gray-400 w-4 text-right">{count}</span>
      </div>
    );
  };

  const renderChart = () => {
    const chartData = getChartData();
    if (chartData.length === 0) return <div className="flex items-center justify-center h-full text-gray-500">No data</div>;

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 10, left: 60, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} width={60} />
          <Tooltip contentStyle={{ backgroundColor: '#1a1a1f', border: '1px solid #374151', borderRadius: '8px' }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderTable = () => {
    if (!analyst) return <div className="flex items-center justify-center h-full text-gray-500">No data</div>;

    return (
      <div className="space-y-3 overflow-auto h-full">
        {/* Consensus Badge */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-gray-500 mb-1">Consensus</div>
            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-white text-xs font-semibold ${
              RATING_COLORS[analyst.consensus_rating] || RATING_COLORS['N/A']
            }`}>
              {analyst.consensus_rating}
              <span className="text-[10px] opacity-80">({RATING_LABELS[analyst.consensus_rating] || 'N/A'})</span>
            </span>
          </div>
          {analyst.number_of_analysts && (
            <div className="text-right">
              <div className="text-lg font-bold text-white">{analyst.number_of_analysts}</div>
              <div className="text-[10px] text-gray-500">Analysts</div>
            </div>
          )}
        </div>

        {/* Rating Distribution */}
        {analyst.ratings?.total > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-semibold text-gray-500 uppercase">Distribution</h4>
            <RatingBar label="Strong Buy" count={analyst.ratings.strong_buy || 0} total={analyst.ratings.total} color="bg-green-600" />
            <RatingBar label="Buy" count={analyst.ratings.buy || 0} total={analyst.ratings.total} color="bg-green-400" />
            <RatingBar label="Hold" count={analyst.ratings.hold || 0} total={analyst.ratings.total} color="bg-yellow-500" />
            <RatingBar label="Sell" count={analyst.ratings.sell || 0} total={analyst.ratings.total} color="bg-red-400" />
            <RatingBar label="Strong Sell" count={analyst.ratings.strong_sell || 0} total={analyst.ratings.total} color="bg-red-600" />
          </div>
        )}

        {/* Price Target */}
        {analyst.price_target?.average && (
          <div className="space-y-2 pt-2 border-t border-gray-800">
            <h4 className="text-[10px] font-semibold text-gray-500 uppercase flex items-center gap-1">
              <Target size={10} /> Price Target
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-800/50 rounded p-1.5 text-center">
                <div className="text-[10px] text-gray-500">Low</div>
                <div className="text-white text-xs font-medium">{formatPrice(analyst.price_target.low)}</div>
              </div>
              <div className="bg-blue-500/20 rounded p-1.5 text-center border border-blue-500/30">
                <div className="text-[10px] text-blue-400">Avg</div>
                <div className="text-blue-400 text-sm font-bold">{formatPrice(analyst.price_target.average)}</div>
              </div>
              <div className="bg-gray-800/50 rounded p-1.5 text-center">
                <div className="text-[10px] text-gray-500">High</div>
                <div className="text-white text-xs font-medium">{formatPrice(analyst.price_target.high)}</div>
              </div>
            </div>

            {upside !== null && (
              <div className="flex items-center justify-between py-1.5 bg-gray-800/30 rounded px-2">
                <span className="text-gray-400 text-xs">Expected Return</span>
                <span className={`flex items-center gap-1 font-bold text-sm ${upside > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {upside > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {upside > 0 ? '+' : ''}{upside.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const getExportData = () => {
    const rows = [];
    if (analyst) {
      rows.push({ category: 'Consensus', metric: 'Rating', value: analyst.consensus_rating || 'N/A' });
      rows.push({ category: 'Consensus', metric: 'Analysts', value: analyst.number_of_analysts ?? '' });
      if (analyst.ratings) {
        rows.push({ category: 'Ratings', metric: 'Strong Buy', value: analyst.ratings.strong_buy ?? 0 });
        rows.push({ category: 'Ratings', metric: 'Buy', value: analyst.ratings.buy ?? 0 });
        rows.push({ category: 'Ratings', metric: 'Hold', value: analyst.ratings.hold ?? 0 });
        rows.push({ category: 'Ratings', metric: 'Sell', value: analyst.ratings.sell ?? 0 });
        rows.push({ category: 'Ratings', metric: 'Strong Sell', value: analyst.ratings.strong_sell ?? 0 });
      }
      if (analyst.price_target) {
        rows.push({ category: 'Price Target', metric: 'Low', value: analyst.price_target.low ?? '' });
        rows.push({ category: 'Price Target', metric: 'Average', value: analyst.price_target.average ?? '' });
        rows.push({ category: 'Price Target', metric: 'High', value: analyst.price_target.high ?? '' });
        if (upside !== null) rows.push({ category: 'Price Target', metric: 'Expected Return', value: upside.toFixed(2) + '%' });
      }
    }
    return {
      columns: [
        { key: 'category', header: 'Category' },
        { key: 'metric',   header: 'Metric'   },
        { key: 'value',    header: 'Value'     },
      ],
      rows,
    };
  };

  return (
    <BaseWidget
      title={`${symbol} - Analyst`}
      icon={Users}
      iconColor="text-blue-400"
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showPeriodSelector={false}
      symbol={symbol}
      exportData={analyst ? getExportData : undefined}
    >
      <div className="h-full p-3">
        {viewMode === 'chart' ? renderChart() : renderTable()}
      </div>
    </BaseWidget>
  );
};

export default AnalystWidget;
