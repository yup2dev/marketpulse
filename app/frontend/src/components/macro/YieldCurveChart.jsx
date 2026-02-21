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
import { SkeletonLoader } from '../widgets/constants';

const SHAPE_CONFIG = {
  normal: {
    name: 'Normal',
    color: '#10b981',
    textColor: 'text-green-400',
    description: 'Longer-term rates higher than short-term (healthy)',
    signal: 'Economic expansion expected'
  },
  flat: {
    name: 'Flat',
    color: '#f59e0b',
    textColor: 'text-amber-400',
    description: 'Little difference between short and long rates',
    signal: 'Economic uncertainty or transition'
  },
  inverted: {
    name: 'Inverted',
    color: '#ef4444',
    textColor: 'text-red-400',
    description: 'Short-term rates higher than long-term (warning)',
    signal: 'Recession signal - historically precedes downturn'
  },
  humped: {
    name: 'Humped',
    color: '#3b82f6',
    textColor: 'text-blue-400',
    description: 'Mid-term rates higher than both short and long',
    signal: 'Market expects rates to decline in future'
  }
};

const MATURITY_OPTIONS = [
  { key: '3m', label: '3-Month', color: '#ef4444' },
  { key: '6m', label: '6-Month', color: '#f97316' },
  { key: '1y', label: '1-Year', color: '#f59e0b' },
  { key: '2y', label: '2-Year', color: '#ec4899' },
  { key: '5y', label: '5-Year', color: '#3b82f6' },
  { key: '10y', label: '10-Year', color: '#10b981' },
  { key: '30y', label: '30-Year', color: '#8b5cf6' }
];

// Generate all possible spread combinations
const SPREAD_OPTIONS = [
  // 3-month based spreads
  { short: '3m', long: '6m', label: '3M-6M', color: '#ef4444' },
  { short: '3m', long: '1y', label: '3M-1Y', color: '#f97316' },
  { short: '3m', long: '2y', label: '3M-2Y', color: '#f59e0b' },
  { short: '3m', long: '5y', label: '3M-5Y', color: '#eab308' },
  { short: '3m', long: '10y', label: '3M-10Y', color: '#10b981' },
  { short: '3m', long: '30y', label: '3M-30Y', color: '#06b6d4' },

  // 6-month based spreads
  { short: '6m', long: '1y', label: '6M-1Y', color: '#f97316' },
  { short: '6m', long: '2y', label: '6M-2Y', color: '#f59e0b' },
  { short: '6m', long: '5y', label: '6M-5Y', color: '#eab308' },
  { short: '6m', long: '10y', label: '6M-10Y', color: '#84cc16' },
  { short: '6m', long: '30y', label: '6M-30Y', color: '#10b981' },

  // 1-year based spreads
  { short: '1y', long: '2y', label: '1Y-2Y', color: '#f59e0b' },
  { short: '1y', long: '5y', label: '1Y-5Y', color: '#eab308' },
  { short: '1y', long: '10y', label: '1Y-10Y', color: '#84cc16' },
  { short: '1y', long: '30y', label: '1Y-30Y', color: '#22c55e' },

  // 2-year based spreads
  { short: '2y', long: '5y', label: '2Y-5Y', color: '#eab308' },
  { short: '2y', long: '10y', label: '2Y-10Y', color: '#3b82f6' },
  { short: '2y', long: '30y', label: '2Y-30Y', color: '#06b6d4' },

  // 5-year based spreads
  { short: '5y', long: '10y', label: '5Y-10Y', color: '#14b8a6' },
  { short: '5y', long: '30y', label: '5Y-30Y', color: '#0ea5e9' },

  // 10-year based spreads
  { short: '10y', long: '30y', label: '10Y-30Y', color: '#8b5cf6' }
];

export default function YieldCurveChart() {
  const [curveData, setCurveData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('5y');
  const [viewMode, setViewMode] = useState('current'); // 'current', 'historical-spreads', or 'historical-yields'
  const [selectedMaturities, setSelectedMaturities] = useState(['1y', '10y']); // Default selection
  const [selectedSpreads, setSelectedSpreads] = useState([
    { short: '3m', long: '10y' },
    { short: '2y', long: '10y' }
  ]); // Default spread selection

  useEffect(() => {
    fetchCurrentCurve();
  }, []);

  useEffect(() => {
    if (viewMode === 'historical-spreads' || viewMode === 'historical-yields') {
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

  const shapeConfig = curveData ? SHAPE_CONFIG[curveData.curve_shape] : null;

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

  const CustomYieldsTooltip = ({ active, payload }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold mb-2">
            {new Date(data.date).toLocaleDateString()}
          </p>
          {selectedMaturities.map(maturity => {
            if (data[maturity] !== undefined) {
              const maturityOption = MATURITY_OPTIONS.find(opt => opt.key === maturity);
              return (
                <p key={maturity} className="text-sm" style={{ color: maturityOption?.color }}>
                  {maturityOption?.label}: {data[maturity].toFixed(2)}%
                </p>
              );
            }
            return null;
          })}
        </div>
      );
    }
    return null;
  };

  const toggleMaturity = (maturityKey) => {
    setSelectedMaturities(prev => {
      if (prev.includes(maturityKey)) {
        // Don't allow deselecting if it's the only one selected
        if (prev.length === 1) return prev;
        return prev.filter(m => m !== maturityKey);
      } else {
        return [...prev, maturityKey];
      }
    });
  };

  const toggleSpread = (spreadOption) => {
    setSelectedSpreads(prev => {
      const exists = prev.some(s => s.short === spreadOption.short && s.long === spreadOption.long);
      if (exists) {
        // Don't allow deselecting if it's the only one selected
        if (prev.length === 1) return prev;
        return prev.filter(s => !(s.short === spreadOption.short && s.long === spreadOption.long));
      } else {
        return [...prev, { short: spreadOption.short, long: spreadOption.long }];
      }
    });
  };

  const isSpreadSelected = (spreadOption) => {
    return selectedSpreads.some(s => s.short === spreadOption.short && s.long === spreadOption.long);
  };

  // Calculate spreads dynamically from yields_history
  const calculateSpreadsData = () => {
    if (!historyData || !historyData.yields_history) return [];

    return historyData.yields_history.map(point => {
      const result = { date: point.date };

      selectedSpreads.forEach(spread => {
        const shortYield = point[spread.short];
        const longYield = point[spread.long];

        if (shortYield !== undefined && longYield !== undefined) {
          const spreadKey = `${spread.short}${spread.long}`;
          result[spreadKey] = parseFloat((longYield - shortYield).toFixed(2));
        }
      });

      return result;
    });
  };

  const CustomSpreadsTooltip = ({ active, payload }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold mb-2">
            {new Date(data.date).toLocaleDateString()}
          </p>
          {selectedSpreads.map((spread, idx) => {
            const spreadKey = `${spread.short}${spread.long}`;
            if (data[spreadKey] !== undefined) {
              const spreadOption = SPREAD_OPTIONS.find(opt => opt.short === spread.short && opt.long === spread.long);
              return (
                <p key={idx} className={`text-sm ${data[spreadKey] < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {spreadOption?.label}: {data[spreadKey].toFixed(2)}%
                </p>
              );
            }
            return null;
          })}
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
              Current
            </button>
            <button
              onClick={() => setViewMode('historical-spreads')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                viewMode === 'historical-spreads'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Spreads
            </button>
            <button
              onClick={() => setViewMode('historical-yields')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                viewMode === 'historical-yields'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Yields
            </button>
          </div>
        </div>

        {/* Inversion Warning */}
        {curveData?.inversion_signal && (
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

      {viewMode === 'current' && (
        <>
          {/* Curve Shape Card */}
          {loading || !curveData || !shapeConfig ? (
            <div className={`${CARD_CLASSES.default} p-6`}>
              <SkeletonLoader variant="card" count={3} />
            </div>
          ) : (
            <div
              className={`${CARD_CLASSES.default} p-6`}
              style={{
                backgroundColor: shapeConfig.color + '15',
                borderColor: shapeConfig.color,
                borderWidth: '2px'
              }}
            >
              <div className="text-center">
                <h3 className={`text-3xl font-bold mb-2 ${shapeConfig.textColor}`}>{shapeConfig.name} Curve</h3>
                <p className="text-gray-300 mb-2">{shapeConfig.description}</p>
                <p className="text-sm text-gray-400">{shapeConfig.signal}</p>
              </div>
            </div>
          )}

          {/* Current Yield Curve Chart */}
          <div className={`${CARD_CLASSES.default} p-6`}>
            <h3 className="text-lg font-semibold text-white mb-4">
              Current Yield Curve
            </h3>
            {loading || !curveData ? (
              <div style={{ height: 400 }}>
                <SkeletonLoader variant="chart" />
              </div>
            ) : (
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
            )}
          </div>

          {/* Key Spreads */}
          <div className={`${CARD_CLASSES.default} p-6`}>
            <h3 className="text-lg font-semibold text-white mb-4">Key Spreads</h3>
            {loading || !curveData ? (
              <SkeletonLoader variant="card" count={3} />
            ) : (
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
            )}
          </div>
        </>
      )}

      {viewMode === 'historical-spreads' && (
        <>
          {/* Historical Spreads View */}
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

            {/* Spread Selection */}
            <div className="mb-4">
              <p className="text-sm text-gray-400 mb-3">Select Spreads to Compare:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {SPREAD_OPTIONS.map(option => (
                  <button
                    key={`${option.short}-${option.long}`}
                    onClick={() => toggleSpread(option)}
                    className={`px-3 py-2 rounded-lg text-xs transition-all ${
                      isSpreadSelected(option)
                        ? 'ring-2'
                        : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                    }`}
                    style={
                      isSpreadSelected(option)
                        ? {
                            backgroundColor: option.color + '20',
                            color: option.color,
                            ringColor: option.color
                          }
                        : {}
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {historyData && historyData.yields_history && (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={calculateSpreadsData()}>
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
                  <Tooltip content={<CustomSpreadsTooltip />} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                  {selectedSpreads.map((spread, idx) => {
                    const spreadKey = `${spread.short}${spread.long}`;
                    const spreadOption = SPREAD_OPTIONS.find(opt => opt.short === spread.short && opt.long === spread.long);
                    return (
                      <Line
                        key={idx}
                        type="monotone"
                        dataKey={spreadKey}
                        stroke={spreadOption?.color}
                        strokeWidth={2}
                        dot={false}
                        name={spreadOption?.label}
                        connectNulls
                      />
                    );
                  })}
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

      {viewMode === 'historical-yields' && (
        <>
          {/* Historical Yields View */}
          <div className={`${CARD_CLASSES.default} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Historical Treasury Yields</h3>
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

            {/* Maturity Selection */}
            <div className="mb-4">
              <p className="text-sm text-gray-400 mb-3">Select Treasury Maturities:</p>
              <div className="flex flex-wrap gap-2">
                {MATURITY_OPTIONS.map(option => (
                  <button
                    key={option.key}
                    onClick={() => toggleMaturity(option.key)}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      selectedMaturities.includes(option.key)
                        ? 'ring-2'
                        : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                    }`}
                    style={
                      selectedMaturities.includes(option.key)
                        ? {
                            backgroundColor: option.color + '20',
                            color: option.color,
                            ringColor: option.color
                          }
                        : {}
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {historyData && historyData.yields_history && (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={historyData.yields_history}>
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
                    label={{ value: 'Yield (%)', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
                  />
                  <Tooltip content={<CustomYieldsTooltip />} />
                  {selectedMaturities.map(maturity => {
                    const option = MATURITY_OPTIONS.find(opt => opt.key === maturity);
                    return (
                      <Line
                        key={maturity}
                        type="monotone"
                        dataKey={maturity}
                        stroke={option?.color}
                        strokeWidth={2}
                        dot={false}
                        name={option?.label}
                        connectNulls
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}

      {/* Last Updated */}
      {curveData?.timestamp && (
        <div className="text-center text-xs text-gray-500">
          Last updated: {new Date(curveData.timestamp).toLocaleString()}
        </div>
      )}
    </div>
  );
}
