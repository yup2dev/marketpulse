/**
 * Consensus Rating Widget - Analyst consensus with rating distribution
 */
import { useState, useEffect, useCallback } from 'react';
import { Star } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import BaseWidget from '../common/BaseWidget';
import { API_BASE } from '../../../config/api';

const COLORS = {
  buy: '#22c55e',
  hold: '#eab308',
  sell: '#ef4444'
};

export default function ConsensusRatingWidget({ symbol: initialSymbol = 'AAPL', onRemove }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [estimatesData, setEstimatesData] = useState(null);
  const [analystData, setAnalystData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('table');

  useEffect(() => {
    setSymbol(initialSymbol);
  }, [initialSymbol]);

  const loadData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const [estimatesRes, analystRes] = await Promise.all([
        fetch(`${API_BASE}/stock/estimates/${symbol}`),
        fetch(`${API_BASE}/stock/analyst/${symbol}`)
      ]);
      if (estimatesRes.ok) setEstimatesData(await estimatesRes.json());
      if (analystRes.ok) setAnalystData(await analystRes.json());
    } catch (error) {
      console.error('Error loading consensus data:', error);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const ratings = estimatesData?.recommendations || analystData?.ratings || {};
  const totalRatings = (ratings.strong_buy || 0) + (ratings.buy || 0) +
    (ratings.hold || 0) + (ratings.sell || 0) + (ratings.strong_sell || 0);
  const buyCount = (ratings.strong_buy || 0) + (ratings.buy || 0);
  const sellCount = (ratings.sell || 0) + (ratings.strong_sell || 0);
  const holdCount = ratings.hold || 0;

  const getConsensusRating = () => {
    if (totalRatings === 0) return analystData?.consensus_rating || 'N/A';
    if (buyCount / totalRatings >= 0.6) return 'Buy';
    if (sellCount / totalRatings >= 0.6) return 'Sell';
    return 'Hold';
  };

  const consensusRating = getConsensusRating();
  const ratingColor = consensusRating.toLowerCase().includes('buy') ? 'text-green-400' :
    consensusRating.toLowerCase().includes('sell') ? 'text-red-400' : 'text-yellow-400';

  const getChartData = () => {
    if (totalRatings === 0) return [];
    return [
      { name: 'Buy', value: buyCount, color: COLORS.buy },
      { name: 'Hold', value: holdCount, color: COLORS.hold },
      { name: 'Sell', value: sellCount, color: COLORS.sell },
    ].filter(d => d.value > 0);
  };

  const renderChart = () => {
    const chartData = getChartData();
    if (chartData.length === 0) return <div className="flex items-center justify-center h-full text-gray-500">No data</div>;

    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="w-32 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={55}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1f', border: '1px solid #374151', borderRadius: '8px' }}
                formatter={(value, name) => [`${value} analysts`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className={`text-2xl font-bold ${ratingColor} mt-2`}>{consensusRating}</div>
        <div className="text-xs text-gray-500">{totalRatings || analystData?.number_of_analysts || 0} analysts</div>
      </div>
    );
  };

  const renderTable = () => {
    if (totalRatings === 0 && !analystData) {
      return <div className="flex items-center justify-center h-full text-gray-500">No data</div>;
    }

    return (
      <div className="h-full flex flex-col items-center justify-center space-y-3">
        <div className="text-center">
          <div className={`text-3xl font-bold ${ratingColor}`}>{consensusRating}</div>
          <div className="text-xs text-gray-400 mt-1">
            Based on {totalRatings > 0 ? totalRatings : analystData?.number_of_analysts || 0} analysts
          </div>
        </div>

        {totalRatings > 0 && (
          <>
            <div className="w-full px-4">
              <div className="flex h-5 rounded-lg overflow-hidden">
                {buyCount > 0 && (
                  <div className="bg-green-600 flex items-center justify-center text-[10px] text-white font-medium"
                    style={{ width: `${(buyCount / totalRatings) * 100}%` }}>{buyCount}</div>
                )}
                {holdCount > 0 && (
                  <div className="bg-yellow-500 flex items-center justify-center text-[10px] text-white font-medium"
                    style={{ width: `${(holdCount / totalRatings) * 100}%` }}>{holdCount}</div>
                )}
                {sellCount > 0 && (
                  <div className="bg-red-500 flex items-center justify-center text-[10px] text-white font-medium"
                    style={{ width: `${(sellCount / totalRatings) * 100}%` }}>{sellCount}</div>
                )}
              </div>
            </div>
            <div className="flex justify-between w-full px-4 text-[10px] text-gray-500">
              <span className="text-green-400">Buy ({buyCount})</span>
              <span className="text-yellow-400">Hold ({holdCount})</span>
              <span className="text-red-400">Sell ({sellCount})</span>
            </div>
          </>
        )}
      </div>
    );
  };

  const getExportData = () => ({
    columns: [
      { key: 'metric', header: 'Metric' },
      { key: 'value',  header: 'Value'  },
    ],
    rows: [
      { metric: 'Consensus Rating', value: consensusRating },
      { metric: 'Total Analysts',   value: totalRatings || analystData?.number_of_analysts || 0 },
      { metric: 'Buy',              value: buyCount  },
      { metric: 'Hold',             value: holdCount },
      { metric: 'Sell',             value: sellCount },
    ],
  });

  return (
    <BaseWidget
      title="Consensus"
      icon={Star}
      iconColor="text-yellow-400"
      symbol={symbol}
      onSymbolChange={setSymbol}
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showPeriodSelector={false}
      exportData={analystData || estimatesData ? getExportData : undefined}
      syncable={true}
    >
      <div className="h-full p-3">
        {viewMode === 'chart' ? renderChart() : renderTable()}
      </div>
    </BaseWidget>
  );
}
