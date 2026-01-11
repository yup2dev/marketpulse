/**
 * Yield Curve Chart - Treasury Yield Curve Visualization
 */
import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart
} from 'recharts';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { API_BASE } from '../../config/api';
import { CARD_CLASSES } from '../../styles/designTokens';

const SHAPE_CONFIG = {
  normal: {
    name: 'Normal',
    emoji: '📈',
    color: '#10b981',
    description: 'Longer-term rates higher than short-term (healthy)',
    signal: 'Economic expansion expected'
  },
  flat: {
    name: 'Flat',
    emoji: '➡️',
    color: '#f59e0b',
    description: 'Little difference between short and long rates',
    signal: 'Economic uncertainty or transition'
  },
  inverted: {
    name: 'Inverted',
    emoji: '📉',
    color: '#ef4444',
    description: 'Short-term rates higher than long-term (warning)',
    signal: 'Recession signal - historically precedes downturn'
  },
  humped: {
    name: 'Humped',
    emoji: '🏔️',
    color: '#3b82f6',
    description: 'Mid-term rates higher than both short and long',
    signal: 'Market expects rates to decline in future'
  }
};

export default function YieldCurveChart() {
  const [curveData, setCurveData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('5y');
  const [viewMode, setViewMode] = useState('current'); // 'current' or 'historical'

  useEffect(() => {
    fetchCurrentCurve();
  }, []);

  useEffect(() => {
    if (viewMode === 'historical') {
      fetchHistoricalData();
    }
  }, [viewMode, selectedPeriod]);

  const fetchCurrentCurve = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/macro/yield-curve`);
      const data = await response.json();
      setCurveData(data);
    } catch (error) {
      console.error('Error fetching yield curve:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoricalData = async () => {
    try {
      const response = await fetch(`${API_BASE}/macro/yield-curve/history?period=${selectedPeriod}`);
      const data = await response.json();
      setHistoryData(data);
    } catch (error) {
      console.error('Error fetching yield curve history:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Activity className="animate-spin text-blue-400" size={48} />
      </div>
    );
  }

  if (!curveData) {
    return (
      <div className="text-center py-12 text-gray-400">
        <AlertCircle className="mx-auto mb-4" size={48} />
        <p>Unable to load yield curve data</p>
      </div>
    );
  }

  const shapeConfig = SHAPE_CONFIG[curveData.curve_shape];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold mb-1">{data.maturity}</p>
          <p className="text-blue-400">Yield: {data.yield?.toFixed(2)}%</p>
        </div>
      );
    }
    return null;
  };

  const CustomHistoricalTooltip = ({ active, payload }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold mb-2">
            {new Date(data.date).toLocaleDateString()}
          </p>
          {data['2y10y'] !== undefined && (
            <p className={`text-sm ${data['2y10y'] < 0 ? 'text-red-400' : 'text-green-400'}`}>
              2y-10y: {data['2y10y'].toFixed(2)}%
            </p>
          )}
          {data['3m10y'] !== undefined && (
            <p className={`text-sm ${data['3m10y'] < 0 ? 'text-red-400' : 'text-green-400'}`}>
              3m-10y: {data['3m10y'].toFixed(2)}%
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`${CARD_CLASSES.default} p-6`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Yield Curve Analysis</h2>
            <p className="text-gray-400">US Treasury yield curve and spread analysis</p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('current')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                viewMode === 'current'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Current Curve
            </button>
            <button
              onClick={() => setViewMode('historical')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                viewMode === 'historical'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Historical Spreads
            </button>
          </div>
        </div>

        {/* Inversion Warning */}
        {curveData.inversion_signal && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="text-red-400 mt-0.5 flex-shrink-0" size={20} />
            <div>
              <p className="text-red-400 font-semibold">Yield Curve Inversion Detected</p>
              <p className="text-red-300 text-sm mt-1">
                Historically, yield curve inversions have preceded recessions by 12-24 months.
                Monitor economic indicators closely.
              </p>
            </div>
          </div>
        )}
      </div>

      {viewMode === 'current' ? (
        <>
          {/* Curve Shape Card */}
          <div
            className={`${CARD_CLASSES.default} p-6`}
            style={{
              backgroundColor: shapeConfig.color + '15',
              borderColor: shapeConfig.color,
              borderWidth: '2px'
            }}
          >
            <div className="text-center">
              <span className="text-5xl mb-3 block">{shapeConfig.emoji}</span>
              <h3 className="text-2xl font-bold text-white mb-2">{shapeConfig.name} Curve</h3>
              <p className="text-gray-300 mb-2">{shapeConfig.description}</p>
              <p className="text-sm" style={{ color: shapeConfig.color }}>
                💡 {shapeConfig.signal}
              </p>
            </div>
          </div>

          {/* Current Yield Curve Chart */}
          <div className={`${CARD_CLASSES.default} p-6`}>
            <h3 className="text-lg font-semibold text-white mb-4">
              Current Yield Curve
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={curveData.curve}>
                <defs>
                  <linearGradient id="yieldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="maturity"
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af' }}
                />
                <YAxis
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af' }}
                  label={{ value: 'Yield (%)', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="yield"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fill="url(#yieldGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Key Spreads */}
          <div className={`${CARD_CLASSES.default} p-6`}>
            <h3 className="text-lg font-semibold text-white mb-4">Key Spreads</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {curveData.spreads['2y10y'] !== undefined && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">2Y-10Y Spread</span>
                    {curveData.spreads['2y10y'] < 0 ? (
                      <AlertTriangle className="text-red-400" size={18} />
                    ) : (
                      <TrendingUp className="text-green-400" size={18} />
                    )}
                  </div>
                  <div className={`text-3xl font-bold ${
                    curveData.spreads['2y10y'] < 0 ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {curveData.spreads['2y10y'] > 0 ? '+' : ''}{curveData.spreads['2y10y']}%
                  </div>
                  {curveData.historical_percentile['2y10y'] !== undefined && (
                    <p className="text-xs text-gray-500 mt-2">
                      {curveData.historical_percentile['2y10y']}th percentile historically
                    </p>
                  )}
                </div>
              )}

              {curveData.spreads['3m10y'] !== undefined && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">3M-10Y Spread</span>
                    {curveData.spreads['3m10y'] < 0 ? (
                      <AlertTriangle className="text-red-400" size={18} />
                    ) : (
                      <TrendingUp className="text-green-400" size={18} />
                    )}
                  </div>
                  <div className={`text-3xl font-bold ${
                    curveData.spreads['3m10y'] < 0 ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {curveData.spreads['3m10y'] > 0 ? '+' : ''}{curveData.spreads['3m10y']}%
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Most reliable recession indicator
                  </p>
                </div>
              )}

              {curveData.spreads['5y30y'] !== undefined && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">5Y-30Y Spread</span>
                    {curveData.spreads['5y30y'] < 0 ? (
                      <TrendingDown className="text-orange-400" size={18} />
                    ) : (
                      <TrendingUp className="text-blue-400" size={18} />
                    )}
                  </div>
                  <div className={`text-3xl font-bold ${
                    curveData.spreads['5y30y'] < 0 ? 'text-orange-400' : 'text-blue-400'
                  }`}>
                    {curveData.spreads['5y30y'] > 0 ? '+' : ''}{curveData.spreads['5y30y']}%
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Long-end steepness
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Historical View */}
          <div className={`${CARD_CLASSES.default} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Historical Spread Analysis</h3>
              <div className="flex gap-2">
                {['1y', '3y', '5y', '10y'].map(period => (
                  <button
                    key={period}
                    onClick={() => setSelectedPeriod(period)}
                    className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                      selectedPeriod === period
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>

            {historyData && historyData.spreads_history && (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={historyData.spreads_history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="date"
                    stroke="#9ca3af"
                    tick={{ fill: '#9ca3af' }}
                    tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { year: '2-digit', month: 'short' })}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    tick={{ fill: '#9ca3af' }}
                    label={{ value: 'Spread (%)', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
                  />
                  <Tooltip content={<CustomHistoricalTooltip />} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="2y10y"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    name="2Y-10Y"
                  />
                  <Line
                    type="monotone"
                    dataKey="3m10y"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    name="3M-10Y"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Inversion Events */}
          {historyData && historyData.inversion_events && historyData.inversion_events.length > 0 && (
            <div className={`${CARD_CLASSES.default} p-6`}>
              <h3 className="text-lg font-semibold text-white mb-4">
                Inversion Events ({historyData.inversion_events.length})
              </h3>
              <div className="space-y-3">
                {historyData.inversion_events.map((event, idx) => (
                  <div key={idx} className="bg-red-900/20 border border-red-500/50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-red-400 font-semibold">Inversion Period</p>
                        <p className="text-sm text-gray-400 mt-1">
                          {new Date(event.start).toLocaleDateString()} → {new Date(event.end).toLocaleDateString()}
                        </p>
                      </div>
                      <AlertTriangle className="text-red-400" size={24} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Last Updated */}
      {curveData.timestamp && (
        <div className="text-center text-xs text-gray-500">
          Last updated: {new Date(curveData.timestamp).toLocaleString()}
        </div>
      )}
    </div>
  );
}
