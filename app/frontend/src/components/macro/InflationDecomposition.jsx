/**
 * Inflation Decomposition - Detailed CPI Breakdown
 */
import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  ReferenceLine
} from 'recharts';
import {
  Activity,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  AlertTriangle
} from 'lucide-react';
import { API_BASE } from '../../config/api';
import { CARD_CLASSES } from '../../styles/designTokens';

export default function InflationDecomposition() {
  const [inflationData, setInflationData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInflationData();
  }, []);

  const fetchInflationData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/macro/inflation/decomposition`);
      const data = await response.json();
      setInflationData(data);
    } catch (error) {
      console.error('Error fetching inflation data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Activity className="animate-spin text-blue-400" size={48} />
      </div>
    );
  }

  if (!inflationData) {
    return (
      <div className="text-center py-12 text-gray-400">
        <AlertCircle className="mx-auto mb-4" size={48} />
        <p>Unable to load inflation data</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold mb-2">{data.category}</p>
          <p className="text-sm text-gray-400">Weight: {data.weight}%</p>
          <p className={`text-sm ${data.yoy_change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            YoY Change: {data.yoy_change > 0 ? '+' : ''}{data.yoy_change}%
          </p>
          <p className="text-sm text-blue-400">
            Contribution: {data.contribution > 0 ? '+' : ''}{data.contribution}%
          </p>
        </div>
      );
    }
    return null;
  };

  // Determine overall inflation status
  const inflationStatus = inflationData.headline_cpi.yoy > 3 ? 'high' :
                         inflationData.headline_cpi.yoy < 1.5 ? 'low' : 'moderate';

  const statusConfig = {
    high: { color: '#ef4444', emoji: '🔥', label: 'High Inflation', description: 'Above Fed target' },
    moderate: { color: '#10b981', emoji: '✓', label: 'Moderate Inflation', description: 'Near target' },
    low: { color: '#3b82f6', emoji: '❄️', label: 'Low Inflation', description: 'Below target' }
  };

  const status = statusConfig[inflationStatus];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`${CARD_CLASSES.default} p-6`}>
        <h2 className="text-2xl font-bold text-white mb-2">Inflation Deep Dive</h2>
        <p className="text-gray-400">Comprehensive CPI breakdown and analysis</p>
      </div>

      {/* Headline vs Core CPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Headline CPI */}
        <div
          className={`${CARD_CLASSES.default} p-6`}
          style={{
            backgroundColor: status.color + '15',
            borderColor: status.color,
            borderWidth: '2px'
          }}
        >
          <div className="text-center mb-4">
            <span className="text-5xl mb-3 block">{status.emoji}</span>
            <h3 className="text-xl font-bold text-white mb-1">Headline CPI</h3>
            <p className="text-sm text-gray-400">All Items</p>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-700/30 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Year-over-Year</div>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-white">
                  {inflationData.headline_cpi.yoy}%
                </div>
                {inflationData.headline_cpi.yoy >= 2 ? (
                  <TrendingUp className="text-orange-400" size={32} />
                ) : (
                  <TrendingDown className="text-blue-400" size={32} />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-700/30 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Month-over-Month</div>
                <div className="text-xl font-bold text-white">
                  {inflationData.headline_cpi.mom}%
                </div>
              </div>
              <div className="bg-gray-700/30 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Index Level</div>
                <div className="text-xl font-bold text-white">
                  {inflationData.headline_cpi.current}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Core CPI */}
        <div className={`${CARD_CLASSES.default} p-6`}>
          <div className="text-center mb-4">
            <span className="text-5xl mb-3 block">🎯</span>
            <h3 className="text-xl font-bold text-white mb-1">Core CPI</h3>
            <p className="text-sm text-gray-400">Ex Food & Energy</p>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-700/30 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Year-over-Year</div>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-white">
                  {inflationData.core_cpi.yoy || 'N/A'}%
                </div>
                {inflationData.core_cpi.yoy >= 2 ? (
                  <TrendingUp className="text-orange-400" size={32} />
                ) : (
                  <TrendingDown className="text-blue-400" size={32} />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-700/30 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Month-over-Month</div>
                <div className="text-xl font-bold text-white">
                  {inflationData.core_cpi.mom || 'N/A'}%
                </div>
              </div>
              <div className="bg-gray-700/30 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Index Level</div>
                <div className="text-xl font-bold text-white">
                  {inflationData.core_cpi.current || 'N/A'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Component Breakdown */}
      <div className={`${CARD_CLASSES.default} p-6`}>
        <h3 className="text-lg font-semibold text-white mb-4">
          CPI Components & Contribution
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={inflationData.components}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="category"
              stroke="#9ca3af"
              tick={{ fill: '#9ca3af' }}
              angle={-15}
              textAnchor="end"
              height={80}
            />
            <YAxis
              stroke="#9ca3af"
              tick={{ fill: '#9ca3af' }}
              label={{ value: 'YoY Change (%)', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#6b7280" strokeWidth={2} />
            <ReferenceLine y={2} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Fed Target', fill: '#f59e0b' }} />
            <Bar dataKey="yoy_change" radius={[8, 8, 0, 0]}>
              {inflationData.components.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.yoy_change >= 3 ? '#ef4444' : entry.yoy_change >= 1.5 ? '#f59e0b' : '#10b981'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="mt-4 flex justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500" />
            <span className="text-gray-400">Hot (≥3%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-orange-500" />
            <span className="text-gray-400">Moderate (1.5-3%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500" />
            <span className="text-gray-400">Cool (&lt;1.5%)</span>
          </div>
        </div>
      </div>

      {/* Sticky vs Flexible */}
      {(inflationData.sticky_vs_flexible.sticky_cpi_yoy || inflationData.sticky_vs_flexible.flexible_cpi_yoy) && (
        <div className={`${CARD_CLASSES.default} p-6`}>
          <h3 className="text-lg font-semibold text-white mb-4">
            Sticky vs Flexible Prices
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            Sticky prices (services) are harder to change; flexible prices (goods) adjust quickly
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-700/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-semibold text-white">Sticky CPI</span>
                <span className="text-2xl">🔒</span>
              </div>
              <div className="text-4xl font-bold text-orange-400">
                {inflationData.sticky_vs_flexible.sticky_cpi_yoy}%
              </div>
              <p className="text-xs text-gray-500 mt-2">Services, rent, medical care</p>
            </div>

            <div className="bg-gray-700/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-semibold text-white">Flexible CPI</span>
                <span className="text-2xl">⚡</span>
              </div>
              <div className="text-4xl font-bold text-blue-400">
                {inflationData.sticky_vs_flexible.flexible_cpi_yoy}%
              </div>
              <p className="text-xs text-gray-500 mt-2">Food, energy, commodities</p>
            </div>
          </div>
        </div>
      )}

      {/* Inflation Expectations */}
      {(inflationData.expectations['5y_breakeven'] || inflationData.expectations['10y_breakeven']) && (
        <div className={`${CARD_CLASSES.default} p-6`}>
          <h3 className="text-lg font-semibold text-white mb-4">
            Inflation Expectations (Breakeven Rates)
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            Market-implied inflation expectations from Treasury Inflation-Protected Securities (TIPS)
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inflationData.expectations['5y_breakeven'] && (
              <div className="bg-gray-700/30 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-2">5-Year Forward Expectation</div>
                <div className="text-4xl font-bold text-white">
                  {inflationData.expectations['5y_breakeven']}%
                </div>
                <p className="text-xs text-gray-500 mt-2">Market expects this CPI avg over next 5 years</p>
              </div>
            )}

            {inflationData.expectations['10y_breakeven'] && (
              <div className="bg-gray-700/30 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-2">10-Year Forward Expectation</div>
                <div className="text-4xl font-bold text-white">
                  {inflationData.expectations['10y_breakeven']}%
                </div>
                <p className="text-xs text-gray-500 mt-2">Market expects this CPI avg over next 10 years</p>
              </div>
            )}
          </div>

          {/* Anchoring Alert */}
          {(inflationData.expectations['5y_breakeven'] > 3.0 || inflationData.expectations['10y_breakeven'] > 3.0) && (
            <div className="mt-4 bg-orange-900/20 border border-orange-500 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="text-orange-400 mt-0.5 flex-shrink-0" size={20} />
              <div>
                <p className="text-orange-400 font-semibold">Inflation Expectations Elevated</p>
                <p className="text-orange-300 text-sm mt-1">
                  Market expectations above 3% suggest inflation may not be well-anchored to Fed's 2% target.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Last Updated */}
      {inflationData.timestamp && (
        <div className="text-center text-xs text-gray-500">
          Last updated: {new Date(inflationData.timestamp).toLocaleString()}
        </div>
      )}
    </div>
  );
}
