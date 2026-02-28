/**
 * Price Target Widget - Analyst price targets with upside/downside
 */
import { useState, useEffect, useCallback } from 'react';
import { Target, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import BaseWidget from '../common/BaseWidget';
import { API_BASE } from '../../../config/api';

export default function PriceTargetWidget({ symbol: initialSymbol = 'AAPL', onRemove }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [priceTarget, setPriceTarget] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('table');

  useEffect(() => {
    setSymbol(initialSymbol);
  }, [initialSymbol]);

  const loadData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const [estimatesRes, analystRes, quoteRes] = await Promise.all([
        fetch(`${API_BASE}/stock/estimates/${symbol}`),
        fetch(`${API_BASE}/stock/analyst/${symbol}`),
        fetch(`${API_BASE}/stock/quote/${symbol}`)
      ]);

      if (estimatesRes.ok) {
        const data = await estimatesRes.json();
        setPriceTarget(data.price_target);
      }
      if (!priceTarget && analystRes.ok) {
        const data = await analystRes.json();
        if (data.price_target) setPriceTarget(data.price_target);
      }
      if (quoteRes.ok) {
        const data = await quoteRes.json();
        setCurrentPrice(data.price);
      }
    } catch (error) {
      console.error('Error loading price target:', error);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const targetPrice = priceTarget?.mean || priceTarget?.average;
  const upsidePct = currentPrice && targetPrice
    ? ((targetPrice - currentPrice) / currentPrice * 100).toFixed(1) : null;
  const isPositive = parseFloat(upsidePct) >= 0;

  const getChartData = () => {
    if (!priceTarget) return [];
    return [
      { name: 'Low', value: priceTarget.low || 0, fill: '#ef4444' },
      { name: 'Current', value: currentPrice || 0, fill: '#3b82f6' },
      { name: 'Target', value: targetPrice || 0, fill: '#22c55e' },
      { name: 'High', value: priceTarget.high || 0, fill: '#22c55e' },
    ];
  };

  const renderChart = () => {
    const chartData = getChartData();
    if (chartData.length === 0) return <div className="flex items-center justify-center h-full text-gray-500">No data</div>;

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 20, left: 50, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1f', border: '1px solid #374151', borderRadius: '8px' }}
            formatter={(v) => [`$${v?.toFixed(2)}`, 'Price']}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderTable = () => {
    if (!targetPrice) return <div className="flex items-center justify-center h-full text-gray-500">No data</div>;

    return (
      <div className="h-full flex flex-col items-center justify-center space-y-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-white">${targetPrice?.toFixed(2)}</div>
          {upsidePct && (
            <div className={`text-sm font-medium flex items-center justify-center gap-1 mt-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {isPositive ? '+' : ''}{upsidePct}% upside
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 w-full px-2">
          <div className="bg-red-500/10 rounded p-2 text-center">
            <div className="text-red-400 text-[10px] mb-0.5">Low</div>
            <div className="text-white text-sm font-bold">${priceTarget?.low?.toFixed(2) || '-'}</div>
          </div>
          <div className="bg-blue-500/10 rounded p-2 text-center">
            <div className="text-blue-400 text-[10px] mb-0.5">Current</div>
            <div className="text-white text-sm font-bold">${currentPrice?.toFixed(2) || '-'}</div>
          </div>
          <div className="bg-green-500/10 rounded p-2 text-center">
            <div className="text-green-400 text-[10px] mb-0.5">High</div>
            <div className="text-white text-sm font-bold">${priceTarget?.high?.toFixed(2) || '-'}</div>
          </div>
        </div>
      </div>
    );
  };

  const getExportData = () => ({
    columns: [
      { key: 'metric', header: 'Metric'    },
      { key: 'value',  header: 'Price ($)' },
    ],
    rows: [
      { metric: 'Current Price',  value: currentPrice?.toFixed(2) ?? '' },
      { metric: 'Target (Mean)',  value: targetPrice?.toFixed(2) ?? ''  },
      { metric: 'Target Low',     value: priceTarget?.low?.toFixed(2) ?? '' },
      { metric: 'Target High',    value: priceTarget?.high?.toFixed(2) ?? '' },
      { metric: 'Upside (%)',     value: upsidePct ?? '' },
    ],
  });

  return (
    <BaseWidget
      title="Price Target"
      icon={Target}
      iconColor="text-blue-400"
      symbol={symbol}
      onSymbolChange={setSymbol}
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showPeriodSelector={false}
      exportData={priceTarget ? getExportData : undefined}
      syncable={true}
    >
      <div className="h-full p-3">
        {viewMode === 'chart' ? renderChart() : renderTable()}
      </div>
    </BaseWidget>
  );
}
