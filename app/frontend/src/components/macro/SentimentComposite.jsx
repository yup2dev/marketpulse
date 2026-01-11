/**
 * Sentiment Composite - Fear & Greed Index and Market Sentiment
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import {
  Activity,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target
} from 'lucide-react';
import { API_BASE } from '../../config/api';
import { CARD_CLASSES } from '../../styles/designTokens';

const FEAR_GREED_CONFIG = {
  extreme_fear: {
    name: 'Extreme Fear',
    emoji: '😱',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    description: 'Maximum pessimism, potential buying opportunity'
  },
  fear: {
    name: 'Fear',
    emoji: '😰',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    description: 'Investors are worried, markets nervous'
  },
  neutral: {
    name: 'Neutral',
    emoji: '😐',
    color: '#6b7280',
    bgColor: 'rgba(107, 114, 128, 0.1)',
    description: 'Balanced sentiment, no extreme emotions'
  },
  greed: {
    name: 'Greed',
    emoji: '🤑',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
    description: 'Investors are optimistic, buying interest'
  },
  extreme_greed: {
    name: 'Extreme Greed',
    emoji: '🤩',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.1)',
    description: 'Maximum euphoria, potential market top'
  }
};

const VIX_STATUS_CONFIG = {
  low: { label: 'Low', color: '#10b981', emoji: '😌' },
  normal: { label: 'Normal', color: '#3b82f6', emoji: '😐' },
  elevated: { label: 'Elevated', color: '#f59e0b', emoji: '😟' },
  high: { label: 'High', color: '#ef4444', emoji: '😱' }
};

export default function SentimentComposite() {
  const [sentimentData, setSentimentData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('1y');
  const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard' or 'historical'

  useEffect(() => {
    fetchSentimentData();
  }, []);

  useEffect(() => {
    if (viewMode === 'historical') {
      fetchHistoricalData();
    }
  }, [viewMode, selectedPeriod]);

  const fetchSentimentData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/macro/sentiment/composite`);
      const data = await response.json();
      setSentimentData(data);
    } catch (error) {
      console.error('Error fetching sentiment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoricalData = async () => {
    try {
      const response = await fetch(`${API_BASE}/macro/sentiment/history?period=${selectedPeriod}`);
      const data = await response.json();
      setHistoryData(data);
    } catch (error) {
      console.error('Error fetching sentiment history:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Activity className="animate-spin text-blue-400" size={48} />
      </div>
    );
  }

  if (!sentimentData || !sentimentData.fear_greed_index) {
    return (
      <div className="text-center py-12 text-gray-400">
        <AlertCircle className="mx-auto mb-4" size={48} />
        <p>Unable to load sentiment data</p>
      </div>
    );
  }

  const statusConfig = FEAR_GREED_CONFIG[sentimentData.fear_greed_index.status];
  const vixConfig = sentimentData.volatility.vix_status ? VIX_STATUS_CONFIG[sentimentData.volatility.vix_status] : null;

  // Prepare radar chart data
  const radarData = Object.entries(sentimentData.fear_greed_index.components)
    .filter(([key, value]) => value.score !== null && value.score !== undefined)
    .map(([key, value]) => ({
      component: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      score: value.score,
      fullMark: 100
    }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold mb-2">
            {new Date(data.date).toLocaleDateString()}
          </p>
          <p className="text-sm text-blue-400">F&G Score: {data.fear_greed_score}</p>
          {data.vix && <p className="text-sm text-orange-400">VIX: {data.vix}</p>}
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
            <h2 className="text-2xl font-bold text-white mb-2">Market Sentiment & Risk Appetite</h2>
            <p className="text-gray-400">Fear & Greed Index, volatility, and positioning</p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('dashboard')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                viewMode === 'dashboard'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setViewMode('historical')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                viewMode === 'historical'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Historical
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'dashboard' ? (
        <>
          {/* Fear & Greed Index */}
          <div
            className={`${CARD_CLASSES.default} p-8`}
            style={{
              backgroundColor: statusConfig.bgColor,
              borderColor: statusConfig.color,
              borderWidth: '2px'
            }}
          >
            <div className="text-center mb-6">
              <span className="text-7xl mb-4 block">{statusConfig.emoji}</span>
              <h3 className="text-4xl font-bold text-white mb-2">
                {statusConfig.name}
              </h3>
              <p className="text-gray-400 mb-4">{statusConfig.description}</p>
              <div className="text-2xl text-gray-300">
                Fear & Greed Score: <span className="font-bold text-white">{sentimentData.fear_greed_index.value}</span>
              </div>
            </div>

            {/* Fear & Greed Gauge */}
            <div className="relative w-full h-10 bg-gray-700 rounded-full overflow-hidden mb-4">
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to right, #ef4444 0%, #f59e0b 25%, #6b7280 50%, #10b981 75%, #22c55e 100%)'
                }}
              />
              <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
                style={{
                  left: `${sentimentData.fear_greed_index.value}%`,
                  boxShadow: '0 0 20px rgba(255, 255, 255, 0.8)'
                }}
              >
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-black px-3 py-1 rounded font-bold text-lg whitespace-nowrap">
                  {sentimentData.fear_greed_index.value}
                </div>
              </div>
            </div>

            {/* Scale Labels */}
            <div className="flex justify-between text-sm">
              <span className="text-red-400">Extreme Fear</span>
              <span className="text-gray-400">Neutral</span>
              <span className="text-green-400">Extreme Greed</span>
            </div>
          </div>

          {/* Component Breakdown - Radar Chart */}
          {radarData.length > 0 && (
            <div className={`${CARD_CLASSES.default} p-6`}>
              <h3 className="text-lg font-semibold text-white mb-4">Sentiment Component Breakdown</h3>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#374151" />
                  <PolarAngleAxis dataKey="component" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                  <Radar name="Score" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>

              {/* Component Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                {sentimentData.fear_greed_index.components.vix && (
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-2">VIX (Volatility)</div>
                    <div className="text-2xl font-bold text-white">
                      {sentimentData.fear_greed_index.components.vix.value}
                    </div>
                    <div className="text-sm text-blue-400 mt-1">
                      Score: {sentimentData.fear_greed_index.components.vix.score}
                    </div>
                  </div>
                )}

                {sentimentData.fear_greed_index.components.high_yield_spread && (
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-2">High Yield Spread</div>
                    <div className="text-2xl font-bold text-white">
                      {sentimentData.fear_greed_index.components.high_yield_spread.value} bp
                    </div>
                    <div className="text-sm text-blue-400 mt-1">
                      Score: {sentimentData.fear_greed_index.components.high_yield_spread.score}
                    </div>
                  </div>
                )}

                {sentimentData.fear_greed_index.components.safe_haven_demand && (
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-2">Safe Haven Demand</div>
                    <div className="text-2xl font-bold text-white">
                      {sentimentData.fear_greed_index.components.safe_haven_demand.score}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Based on Treasury yields</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Volatility Metrics */}
          {sentimentData.volatility.vix && (
            <div className={`${CARD_CLASSES.default} p-6`}>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Activity size={24} />
                Market Volatility
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                  className="rounded-lg p-6"
                  style={{
                    backgroundColor: vixConfig.color + '20',
                    borderColor: vixConfig.color,
                    borderWidth: '2px'
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-4xl">{vixConfig.emoji}</span>
                    <span className="text-sm font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: vixConfig.color + '40', color: vixConfig.color }}>
                      {vixConfig.label}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400 mb-1">CBOE VIX</div>
                  <div className="text-4xl font-bold text-white">
                    {sentimentData.volatility.vix}
                  </div>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-6">
                  <div className="text-sm text-gray-400 mb-2">Historical Percentile</div>
                  <div className="text-4xl font-bold text-white">
                    {sentimentData.volatility.vix_percentile}%
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Of historical VIX range</p>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-6">
                  <div className="text-sm text-gray-400 mb-2">SKEW Index</div>
                  <div className="text-4xl font-bold text-gray-400">
                    N/A
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Tail risk premium (CBOE data)</p>
                </div>
              </div>

              {/* VIX Interpretation */}
              <div className="mt-4 bg-gray-700/30 rounded-lg p-4">
                <p className="text-sm text-gray-300">
                  <strong>Interpretation:</strong> {
                    sentimentData.volatility.vix < 15 ? 'Very low volatility indicates complacency and low hedging demand. Market may be too optimistic.' :
                    sentimentData.volatility.vix < 20 ? 'Normal volatility levels suggest balanced risk assessment and healthy market conditions.' :
                    sentimentData.volatility.vix < 30 ? 'Elevated volatility indicates increased uncertainty. Investors are hedging against downside risk.' :
                    'High volatility signals market stress and fear. Typically associated with sharp market declines and uncertainty.'
                  }
                </p>
              </div>
            </div>
          )}

          {/* Cross-Asset Risk Signals */}
          <div className={`${CARD_CLASSES.default} p-6`}>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Target size={24} />
              Risk Environment
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`rounded-lg p-6 ${
                sentimentData.cross_asset_signals.risk_on_off === 'risk_on' ? 'bg-green-900/20 border-2 border-green-500' :
                sentimentData.cross_asset_signals.risk_on_off === 'risk_off' ? 'bg-red-900/20 border-2 border-red-500' :
                'bg-gray-700/50'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-400">Market Mode</span>
                  {sentimentData.cross_asset_signals.risk_on_off === 'risk_on' ? (
                    <TrendingUp className="text-green-400" size={24} />
                  ) : sentimentData.cross_asset_signals.risk_on_off === 'risk_off' ? (
                    <TrendingDown className="text-red-400" size={24} />
                  ) : (
                    <AlertTriangle className="text-gray-400" size={24} />
                  )}
                </div>
                <div className={`text-3xl font-bold ${
                  sentimentData.cross_asset_signals.risk_on_off === 'risk_on' ? 'text-green-400' :
                  sentimentData.cross_asset_signals.risk_on_off === 'risk_off' ? 'text-red-400' :
                  'text-gray-400'
                }`}>
                  {sentimentData.cross_asset_signals.risk_on_off.replace('_', '-').toUpperCase()}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {sentimentData.cross_asset_signals.risk_on_off === 'risk_on' ? 'Investors favoring risky assets' :
                   sentimentData.cross_asset_signals.risk_on_off === 'risk_off' ? 'Flight to safety underway' :
                   'Mixed signals, no clear trend'}
                </p>
              </div>

              <div className="bg-gray-700/50 rounded-lg p-6">
                <div className="text-sm text-gray-400 mb-2">Safe Haven Strength</div>
                <div className="text-4xl font-bold text-white">
                  {sentimentData.cross_asset_signals.safe_haven_strength}
                </div>
                <p className="text-xs text-gray-500 mt-2">Treasury & gold demand (0-100)</p>
              </div>
            </div>
          </div>

          {/* Positioning Note */}
          <div className={`${CARD_CLASSES.default} p-6`}>
            <h3 className="text-lg font-semibold text-white mb-4">Positioning Indicators</h3>
            <p className="text-gray-400 mb-4">
              Real-time positioning data (AAII sentiment, CFTC, fund flows) requires additional data sources.
              Future enhancement will include:
            </p>
            <ul className="list-disc list-inside text-gray-400 space-y-2">
              <li>AAII Investor Sentiment Survey (Bullish/Bearish/Neutral %)</li>
              <li>CFTC Commitments of Traders positioning</li>
              <li>Weekly fund flows (equity, bond, money market)</li>
              <li>NYSE margin debt levels</li>
            </ul>
          </div>
        </>
      ) : (
        <>
          {/* Historical Fear & Greed */}
          <div className={`${CARD_CLASSES.default} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Historical Fear & Greed Index</h3>
              <div className="flex gap-2">
                {['6mo', '1y', '3y', '5y'].map(period => (
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

            {historyData && historyData.sentiment_history && historyData.sentiment_history.length > 0 && (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={historyData.sentiment_history}>
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
                    domain={[0, 100]}
                    label={{ value: 'Fear & Greed Score', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Extreme Fear', fill: '#ef4444', fontSize: 12 }} />
                  <ReferenceLine y={50} stroke="#6b7280" strokeDasharray="3 3" label={{ value: 'Neutral', fill: '#6b7280', fontSize: 12 }} />
                  <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="3 3" label={{ value: 'Extreme Greed', fill: '#22c55e', fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="fear_greed_score"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Historical VIX */}
          {historyData && historyData.vix_history && historyData.vix_history.length > 0 && (
            <div className={`${CARD_CLASSES.default} p-6`}>
              <h3 className="text-lg font-semibold text-white mb-4">Historical VIX (Volatility Index)</h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={historyData.vix_history}>
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
                    label={{ value: 'VIX Level', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
                  />
                  <Tooltip />
                  <ReferenceLine y={15} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Low', fill: '#10b981' }} />
                  <ReferenceLine y={20} stroke="#3b82f6" strokeDasharray="3 3" label={{ value: 'Normal', fill: '#3b82f6' }} />
                  <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'High', fill: '#ef4444' }} />
                  <Line
                    type="monotone"
                    dataKey="vix"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Last Updated */}
      {sentimentData.timestamp && (
        <div className="text-center text-xs text-gray-500">
          Last updated: {new Date(sentimentData.timestamp).toLocaleString()}
        </div>
      )}
    </div>
  );
}
