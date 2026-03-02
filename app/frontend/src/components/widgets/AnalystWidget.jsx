/**
 * AnalystWidget - Displays analyst recommendations using BaseWidget
 */
import { useState, useEffect, useCallback } from 'react';
import { Users, TrendingUp, TrendingDown, Target } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import DistributionDisplay from '../common/DistributionDisplay';
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


  // DistributionDisplay에 넘길 ratings 항목 배열
  const getRatingItems = () => {
    if (!analyst?.ratings) return [];
    return [
      { label: 'Strong Buy',  value: analyst.ratings.strong_buy  || 0, color: '#16a34a' },
      { label: 'Buy',         value: analyst.ratings.buy         || 0, color: '#22c55e' },
      { label: 'Hold',        value: analyst.ratings.hold        || 0, color: '#eab308' },
      { label: 'Sell',        value: analyst.ratings.sell        || 0, color: '#f87171' },
      { label: 'Strong Sell', value: analyst.ratings.strong_sell || 0, color: '#dc2626' },
    ];
  };

  const renderContent = () => {
    if (!analyst) return <div className="flex items-center justify-center h-full text-gray-500">No data</div>;
    const ratingItems = getRatingItems();

    return (
      <div className="space-y-3 overflow-auto h-full">
        {/* Consensus */}
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

        {/* Rating Distribution — 공통 컴포넌트 */}
        {ratingItems.length > 0 && analyst.ratings?.total > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">Distribution</h4>
            <DistributionDisplay
              items={ratingItems}
              total={analyst.ratings.total}
              view={viewMode === 'chart' ? 'donut' : 'bars'}
              showToggle
            />
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
      <div className="h-full p-3 overflow-auto">
        {renderContent()}
      </div>
    </BaseWidget>
  );
};

export default AnalystWidget;
