/**
 * Fed Policy Gauge - Hawkish/Dovish Stance Visualization
 */
import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  AlertCircle
} from 'lucide-react';
import { API_BASE } from '../../config/api';
import { CARD_CLASSES } from '../../styles/designTokens';
import ChartWidget from '../widgets/ChartWidget';
import { SkeletonLoader } from '../widgets/common';

const STANCE_CONFIG = {
  hawkish: {
    name: 'Hawkish',
    emoji: '🦅',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    description: 'Tightening policy, higher rates likely'
  },
  neutral: {
    name: 'Neutral',
    emoji: '⚖️',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    description: 'Balanced approach, rates stable'
  },
  dovish: {
    name: 'Dovish',
    emoji: '🕊️',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
    description: 'Accommodative policy, lower rates likely'
  }
};

export default function FedPolicyGauge() {
  const [policyData, setPolicyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [historicalData, setHistoricalData] = useState(null);

  useEffect(() => {
    fetchPolicyData();
  }, []);

  const fetchPolicyData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/macro/fed-policy/stance`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setPolicyData(data);
    } catch (error) {
      console.error('Error fetching Fed policy data:', error);
      setPolicyData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoricalData = async (metric, period = '5y') => {
    try {
      const response = await fetch(`${API_BASE}/macro/indicators/${metric}/history?period=${period}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setHistoricalData(data);
    } catch (error) {
      console.error('Error fetching historical data:', error);
      setHistoricalData(null);
    }
  };

  const handleMetricClick = (metric, name) => {
    setSelectedMetric({ key: metric, name });
    fetchHistoricalData(metric);
  };

  const config = policyData ? STANCE_CONFIG[policyData.stance] : null;

  // Calculate gauge position (-100 to +100 -> 0% to 100%)
  const gaugePosition = policyData ? ((policyData.stance_score + 100) / 200) * 100 : 50;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`${CARD_CLASSES.default} p-6`}>
        <h2 className="text-2xl font-bold text-white mb-2">Fed Policy Tracker</h2>
        <p className="text-gray-400">Current monetary policy stance and outlook</p>
      </div>

      {/* Main Gauge Card */}
      {loading || !policyData || !config ? (
        <div className={`${CARD_CLASSES.default} p-8`}>
          <SkeletonLoader variant="card" count={3} />
        </div>
      ) : (
        <div
          className={`${CARD_CLASSES.default} p-8`}
        style={{
          backgroundColor: config.bgColor,
          borderColor: config.color,
          borderWidth: '2px'
        }}
      >
        <div className="text-center mb-8">
          <span className="text-6xl mb-4 block">{config.emoji}</span>
          <h3 className="text-4xl font-bold text-white mb-2">
            {config.name}
          </h3>
          <p className="text-gray-400 mb-4">{config.description}</p>
          <div className="text-xl text-gray-300">
            Stance Score: <span className="font-bold text-white">{policyData.stance_score}</span>
          </div>
        </div>

        {/* Gauge Visualization */}
        <div className="relative w-full h-8 bg-gray-700 rounded-full overflow-hidden mb-8">
          {/* Gradient background */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to right, #10b981 0%, #f59e0b 50%, #ef4444 100%)'
            }}
          />

          {/* Indicator */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
            style={{
              left: `${gaugePosition}%`,
              transform: 'translateX(-50%)',
              boxShadow: '0 0 20px rgba(255, 255, 255, 0.8)'
            }}
          >
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-black px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
              {policyData.stance_score}
            </div>
          </div>

          {/* Scale markers */}
          <div className="absolute inset-0 flex justify-between items-center px-2 text-xs text-white font-bold">
            <span>-100</span>
            <span>0</span>
            <span>+100</span>
          </div>
        </div>

        {/* Labels */}
        <div className="flex justify-between text-sm">
          <div className="text-left">
            <div className="flex items-center gap-1 text-green-400">
              <span className="text-xl">🕊️</span>
              <span className="font-semibold">Dovish</span>
            </div>
            <p className="text-xs text-gray-500">Easy Money</p>
          </div>
          <div className="text-center">
            <div className="flex items-center gap-1 text-orange-400">
              <span className="text-xl">⚖️</span>
              <span className="font-semibold">Neutral</span>
            </div>
            <p className="text-xs text-gray-500">Balanced</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-red-400 justify-end">
              <span className="text-xl">🦅</span>
              <span className="font-semibold">Hawkish</span>
            </div>
            <p className="text-xs text-gray-500">Tight Money</p>
          </div>
        </div>
      </div>
      )}

      {/* Current Metrics */}
      <div className={`${CARD_CLASSES.default} p-6`}>
        <h3 className="text-lg font-semibold text-white mb-4">Current Fed Funds Rate</h3>
        <p className="text-sm text-gray-400 mb-4">Click on each card to view historical data</p>
        {loading || !policyData ? (
          <SkeletonLoader variant="card" count={3} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            className={`bg-gray-700/50 rounded-lg p-4 cursor-pointer hover:border-blue-500 transition-colors ${
              selectedMetric?.key === 'fed_funds_rate' ? 'border-2 border-blue-500' : 'border-2 border-transparent'
            }`}
            onClick={() => handleMetricClick('fed_funds_rate', 'Fed Funds Effective Rate')}
          >
            <div className="text-sm text-gray-400 mb-2">Effective Rate</div>
            <div className="text-3xl font-bold text-white">
              {policyData.fed_funds_rate}%
            </div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-2">Target Range</div>
            <div className="text-2xl font-bold text-white">
              {policyData.fed_funds_target_range.lower}% - {policyData.fed_funds_target_range.upper}%
            </div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-2">Rate Changes (12M)</div>
            <div className="text-3xl font-bold text-white">
              {policyData.historical_context.rate_changes_12m}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Next Meeting Probabilities */}
      <div className={`${CARD_CLASSES.default} p-6`}>
        <h3 className="text-lg font-semibold text-white mb-4">
          Next FOMC Meeting Probabilities
        </h3>
        {loading || !policyData ? (
          <SkeletonLoader variant="card" count={3} />
        ) : (
          <div className="space-y-4">
          {/* Hike */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-red-400" size={20} />
                <span className="text-white font-medium">Rate Hike (+25bp)</span>
              </div>
              <span className="text-white font-bold">
                {policyData.next_meeting.probabilities.hike}%
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className="bg-red-500 h-3 rounded-full transition-all"
                style={{ width: `${policyData.next_meeting.probabilities.hike}%` }}
              />
            </div>
          </div>

          {/* Hold */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <Minus className="text-orange-400" size={20} />
                <span className="text-white font-medium">Hold (No Change)</span>
              </div>
              <span className="text-white font-bold">
                {policyData.next_meeting.probabilities.hold}%
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className="bg-orange-500 h-3 rounded-full transition-all"
                style={{ width: `${policyData.next_meeting.probabilities.hold}%` }}
              />
            </div>
          </div>

          {/* Cut */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <TrendingDown className="text-green-400" size={20} />
                <span className="text-white font-medium">Rate Cut (-25bp)</span>
              </div>
              <span className="text-white font-bold">
                {policyData.next_meeting.probabilities.cut}%
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className="bg-green-500 h-3 rounded-full transition-all"
                style={{ width: `${policyData.next_meeting.probabilities.cut}%` }}
              />
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Historical Context */}
      <div className={`${CARD_CLASSES.default} p-6`}>
        <h3 className="text-lg font-semibold text-white mb-4">Historical Context</h3>
        {loading || !policyData ? (
          <SkeletonLoader variant="card" count={3} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-700/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-2">Peak Rate (Historical)</div>
            <div className="text-2xl font-bold text-white">
              {policyData.historical_context.peak_rate}%
            </div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-2">Trough Rate (Historical)</div>
            <div className="text-2xl font-bold text-white">
              {policyData.historical_context.trough_rate}%
            </div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-2">Current Percentile</div>
            <div className="text-2xl font-bold text-white">
              {policyData.historical_context.percentile}%
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Of historical range
            </p>
          </div>
        </div>
        )}
      </div>

      {/* Historical Chart */}
      {selectedMetric && historicalData && (
        <ChartWidget
          series={[
            {
              id: historicalData.key || selectedMetric.key,
              name: historicalData.name || selectedMetric.name,
              data: historicalData.data || [],
              color: '#3b82f6',
              visible: true
            }
          ]}
          title={historicalData.name || selectedMetric.name}
          subtitle={historicalData.unit || ''}
          showTimeRanges={true}
          showNormalize={false}
          showVolume={false}
          showTechnicalIndicators={true}
          showChartTypeSelector={false}
          showAddStock={false}
          showPairAnalysis={false}
        />
      )}

      {/* Last Updated */}
      {policyData?.last_updated && (
        <div className="text-center text-xs text-gray-500">
          Last updated: {new Date(policyData.last_updated).toLocaleString()}
        </div>
      )}
    </div>
  );
}
