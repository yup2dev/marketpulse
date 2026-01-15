/**
 * Economic Regime Dashboard
 * 4-Quadrant visualization of Growth vs Inflation
 */
import { useState, useEffect } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Legend
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { API_BASE } from '../../config/api';
import { CARD_CLASSES } from '../../styles/designTokens';
import { SkeletonLoader } from '../widgets/common';

const REGIME_CONFIG = {
  goldilocks: {
    name: 'Goldilocks',
    emoji: '🌟',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
    description: 'Positive growth + moderate inflation',
    quadrant: 'Q1',
    x: 1,
    y: 1
  },
  reflation: {
    name: 'Reflation',
    emoji: '🔥',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    description: 'Growth recovering + inflation rising',
    quadrant: 'Q2',
    x: -1,
    y: 1
  },
  stagflation: {
    name: 'Stagflation',
    emoji: '⚠️',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    description: 'Weak growth + high inflation',
    quadrant: 'Q3',
    x: -1,
    y: -1
  },
  deflation: {
    name: 'Deflation',
    emoji: '❄️',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    description: 'Weak growth + low inflation',
    quadrant: 'Q4',
    x: 1,
    y: -1
  }
};

export default function RegimeDashboard() {
  const [currentRegime, setCurrentRegime] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('5y');

  useEffect(() => {
    fetchRegimeData();
  }, [selectedPeriod]);

  const fetchRegimeData = async () => {
    setLoading(true);
    try {
      const [currentRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/macro/regime/current`),
        fetch(`${API_BASE}/macro/regime/history?period=${selectedPeriod}`)
      ]);

      const currentData = await currentRes.json();
      const historyData = await historyRes.json();

      setCurrentRegime(currentData);
      setHistory(historyData.history || []);
    } catch (error) {
      console.error('Error fetching regime data:', error);
    } finally {
      setLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;

      // Ensure we have valid data
      if (!data || !data.regime) return null;

      const config = REGIME_CONFIG[data.regime];
      if (!config) return null;

      // Format date properly
      const formattedDate = data.date
        ? new Date(data.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })
        : 'N/A';

      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{config.emoji}</span>
            <span className="font-semibold text-white">{config.name}</span>
            {data.isCurrent && (
              <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full">
                LATEST
              </span>
            )}
          </div>
          <div className="text-xs space-y-1">
            <div className={data.isCurrent ? 'font-bold text-white' : 'text-gray-400'}>
              📅 Date: {formattedDate}
            </div>
            <div className="text-gray-300">
              📈 Growth Score: {data.growth_score != null ? data.growth_score.toFixed(1) : 'N/A'}
            </div>
            <div className="text-gray-300">
              🔥 Inflation Score: {data.inflation_score != null ? data.inflation_score.toFixed(1) : 'N/A'}
            </div>
            {data.gdp_growth != null && (
              <div className="text-gray-300">
                💰 GDP Growth: {data.gdp_growth.toFixed(1)}%
              </div>
            )}
            {data.cpi_yoy != null && (
              <div className="text-gray-300">
                📊 CPI YoY: {data.cpi_yoy.toFixed(1)}%
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const currentConfig = currentRegime ? REGIME_CONFIG[currentRegime.regime] : null;

  // Prepare scatter data - mark the last item as current
  const scatterData = history.map((h, index) => ({
    ...h,
    isCurrent: index === history.length - 1
  }));

  const mostRecentData = history.length > 0
    ? history[history.length - 1]
    : null;

  const mostRecentConfig = mostRecentData
    ? REGIME_CONFIG[mostRecentData.regime]
    : currentConfig;

  return (
    <div className="space-y-6">
      {/* Header with Current Regime */}
      <div className={`${CARD_CLASSES.default} p-6`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Economic Regime</h2>
            <p className="text-gray-400">Growth vs Inflation Analysis</p>
          </div>

          {/* Period Selector */}
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

        {/* Current Regime Card - Using most recent history data */}
        {loading || !mostRecentConfig ? (
          <div className="rounded-lg p-6 border-2 border-gray-700 bg-gray-800/30">
            <SkeletonLoader variant="card" count={3} />
          </div>
        ) : (
          <div
            className="rounded-lg p-6 border-2"
            style={{
              backgroundColor: mostRecentConfig.bgColor,
              borderColor: mostRecentConfig.color
            }}
          >
            <div className="flex items-center gap-4 mb-4">
              <span className="text-6xl">{mostRecentConfig.emoji}</span>
              <div>
                <h3 className="text-3xl font-bold text-white mb-1">
                  {mostRecentConfig.name}
                </h3>
                <p className="text-gray-400">{mostRecentConfig.description}</p>
                {mostRecentData && (
                  <p className="text-xs text-gray-500 mt-1">
                    Latest data: {new Date(mostRecentData.date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Growth Score</div>
                <div className="text-2xl font-bold text-white flex items-center gap-2">
                  {mostRecentData && mostRecentData.growth_score > 0 ? (
                    <TrendingUp className="text-green-400" size={20} />
                  ) : (
                    <TrendingDown className="text-red-400" size={20} />
                  )}
                  {mostRecentData?.growth_score?.toFixed(1) || 'N/A'}
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Inflation Score</div>
                <div className="text-2xl font-bold text-white flex items-center gap-2">
                  {mostRecentData && mostRecentData.inflation_score > 0 ? (
                    <TrendingUp className="text-orange-400" size={20} />
                  ) : (
                    <TrendingDown className="text-blue-400" size={20} />
                  )}
                  {mostRecentData?.inflation_score?.toFixed(1) || 'N/A'}
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">GDP Growth</div>
                <div className="text-2xl font-bold text-white">
                  {mostRecentData?.gdp_growth?.toFixed(1) || 'N/A'}%
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">CPI YoY</div>
                <div className="text-2xl font-bold text-white">
                  {mostRecentData?.cpi_yoy?.toFixed(1) || 'N/A'}%
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4-Quadrant Chart */}
      <div className={`${CARD_CLASSES.default} p-6`}>
        <h3 className="text-lg font-semibold text-white mb-4">
          Historical Regime Transitions
        </h3>

        {loading || history.length === 0 ? (
          <div style={{ height: 500 }}>
            <SkeletonLoader variant="chart" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={500}>
          <ScatterChart
            margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />

            {/* Axes */}
            <XAxis
              type="number"
              dataKey="growth_score"
              domain={[-100, 100]}
              stroke="#9ca3af"
              label={{ value: 'Growth Score', position: 'bottom', fill: '#9ca3af' }}
            />
            <YAxis
              type="number"
              dataKey="inflation_score"
              domain={[-100, 100]}
              stroke="#9ca3af"
              label={{ value: 'Inflation Score', angle: -90, position: 'left', fill: '#9ca3af' }}
            />

            {/* Reference Lines (Quadrant Dividers) */}
            <ReferenceLine x={0} stroke="#6b7280" strokeWidth={2} />
            <ReferenceLine y={0} stroke="#6b7280" strokeWidth={2} />

            <Tooltip content={<CustomTooltip />} />

            {/* Background Quadrant Labels */}
            <text x="75%" y="20%" fill="#10b981" opacity={0.3} fontSize={20} fontWeight="bold">
              Goldilocks 🌟
            </text>
            <text x="15%" y="20%" fill="#f59e0b" opacity={0.3} fontSize={20} fontWeight="bold">
              Reflation 🔥
            </text>
            <text x="15%" y="85%" fill="#ef4444" opacity={0.3} fontSize={20} fontWeight="bold">
              Stagflation ⚠️
            </text>
            <text x="75%" y="85%" fill="#3b82f6" opacity={0.3} fontSize={20} fontWeight="bold">
              Deflation ❄️
            </text>

            {/* All data points - single Scatter */}
            <Scatter
              name="Regime Data"
              data={scatterData}
              fill="#6b7280"
            >
              {scatterData.map((entry, index) => {
                const config = REGIME_CONFIG[entry.regime];
                const isLatest = entry.isCurrent;

                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={config.color}
                    opacity={isLatest ? 1 : 0.4}
                    r={isLatest ? 16 : 4}
                    stroke={isLatest ? "#fff" : "none"}
                    strokeWidth={isLatest ? 4 : 0}
                    style={isLatest ? {
                      filter: 'drop-shadow(0 0 8px currentColor)'
                    } : {}}
                  />
                );
              })}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        )}

        {/* Legend */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(REGIME_CONFIG).map(([key, config]) => (
            <div
              key={key}
              className="flex items-center gap-3 bg-gray-700/30 rounded-lg p-3"
            >
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <div className="flex items-center gap-2">
                <span className="text-xl">{config.emoji}</span>
                <span className="text-sm text-gray-300">{config.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Component Breakdown */}
      {currentRegime?.components && (
        <div className={`${CARD_CLASSES.default} p-6`}>
          <h3 className="text-lg font-semibold text-white mb-4">
            Growth Components (Real-time Calculation)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-2">GDP Growth Rate</div>
              <div className="text-2xl font-bold text-white">
                {currentRegime.components?.gdp_growth?.toFixed(2)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">Weight: 50%</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-2">Industrial Production YoY</div>
              <div className="text-2xl font-bold text-white">
                {currentRegime.components?.industrial_production_yoy?.toFixed(2)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">Weight: 25%</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-2">Employment YoY</div>
              <div className="text-2xl font-bold text-white">
                {currentRegime.components?.employment_yoy?.toFixed(2)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">Weight: 25%</div>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-white mt-6 mb-4">
            Momentum Indicators (Real-time Calculation)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-2">Growth Momentum (3M)</div>
              <div className="flex items-center gap-2">
                <div className={`text-2xl font-bold ${
                  currentRegime.growth_momentum > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {currentRegime.growth_momentum > 0 ? '+' : ''}
                  {currentRegime.growth_momentum?.toFixed(2)}%
                </div>
                {currentRegime.growth_momentum > 0 ? (
                  <TrendingUp className="text-green-400" size={24} />
                ) : (
                  <TrendingDown className="text-red-400" size={24} />
                )}
              </div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-2">Inflation Momentum (3M)</div>
              <div className="flex items-center gap-2">
                <div className={`text-2xl font-bold ${
                  currentRegime.inflation_momentum > 0 ? 'text-orange-400' : 'text-blue-400'
                }`}>
                  {currentRegime.inflation_momentum > 0 ? '+' : ''}
                  {currentRegime.inflation_momentum?.toFixed(2)}%
                </div>
                {currentRegime.inflation_momentum > 0 ? (
                  <TrendingUp className="text-orange-400" size={24} />
                ) : (
                  <TrendingDown className="text-blue-400" size={24} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
