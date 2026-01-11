/**
 * Labor Market Heatmap - Comprehensive Labor Market Analysis
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
  ZAxis
} from 'recharts';
import {
  Activity,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Briefcase,
  DollarSign
} from 'lucide-react';
import { API_BASE } from '../../config/api';
import { CARD_CLASSES } from '../../styles/designTokens';

export default function LaborMarketHeatmap() {
  const [laborData, setLaborData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('5y');
  const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard' or 'phillips'

  useEffect(() => {
    fetchLaborData();
  }, []);

  useEffect(() => {
    if (viewMode === 'phillips') {
      fetchHistoricalData();
    }
  }, [viewMode, selectedPeriod]);

  const fetchLaborData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/macro/labor/dashboard`);
      const data = await response.json();
      setLaborData(data);
    } catch (error) {
      console.error('Error fetching labor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoricalData = async () => {
    try {
      const response = await fetch(`${API_BASE}/macro/labor/history?period=${selectedPeriod}`);
      const data = await response.json();
      setHistoryData(data);
    } catch (error) {
      console.error('Error fetching labor history:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Activity className="animate-spin text-blue-400" size={48} />
      </div>
    );
  }

  if (!laborData) {
    return (
      <div className="text-center py-12 text-gray-400">
        <AlertCircle className="mx-auto mb-4" size={48} />
        <p>Unable to load labor market data</p>
      </div>
    );
  }

  // Determine market status based on heat index
  const getHeatStatus = (heatIndex) => {
    if (heatIndex >= 70) return { label: 'Hot', color: '#ef4444', emoji: '🔥', desc: 'Very tight labor market' };
    if (heatIndex >= 50) return { label: 'Warm', color: '#f59e0b', emoji: '☀️', desc: 'Healthy labor market' };
    if (heatIndex >= 30) return { label: 'Cool', color: '#3b82f6', emoji: '🌤️', desc: 'Balanced labor market' };
    return { label: 'Cold', color: '#6b7280', emoji: '❄️', desc: 'Slack in labor market' };
  };

  const heatStatus = getHeatStatus(laborData.heat_index);

  // Trend icon mapping
  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'improving': return <TrendingDown className="text-green-400" size={20} />;
      case 'deteriorating': return <TrendingUp className="text-red-400" size={20} />;
      default: return <Minus className="text-gray-400" size={20} />;
    }
  };

  const PhillipsTooltip = ({ active, payload }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold mb-2">
            {data.date ? new Date(data.date).toLocaleDateString() : 'Current'}
          </p>
          <p className="text-sm text-blue-400">Unemployment: {data.unemployment}%</p>
          <p className="text-sm text-orange-400">Inflation: {data.inflation}%</p>
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
            <h2 className="text-2xl font-bold text-white mb-2">Labor Market Analysis</h2>
            <p className="text-gray-400">Comprehensive employment and wage data</p>
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
              onClick={() => setViewMode('phillips')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                viewMode === 'phillips'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Phillips Curve
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'dashboard' ? (
        <>
          {/* Labor Market Heat Index */}
          <div
            className={`${CARD_CLASSES.default} p-6`}
            style={{
              backgroundColor: heatStatus.color + '15',
              borderColor: heatStatus.color,
              borderWidth: '2px'
            }}
          >
            <div className="text-center">
              <span className="text-6xl mb-4 block">{heatStatus.emoji}</span>
              <h3 className="text-3xl font-bold text-white mb-2">{heatStatus.label} Labor Market</h3>
              <p className="text-gray-400 mb-4">{heatStatus.desc}</p>
              <div className="text-xl text-gray-300">
                Heat Index: <span className="font-bold text-white">{laborData.heat_index}</span> / 100
              </div>
            </div>

            {/* Heat Gauge */}
            <div className="mt-6 relative w-full h-6 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to right, #6b7280 0%, #3b82f6 30%, #f59e0b 60%, #ef4444 100%)'
                }}
              />
              <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
                style={{
                  left: `${laborData.heat_index}%`,
                  boxShadow: '0 0 20px rgba(255, 255, 255, 0.8)'
                }}
              />
            </div>
          </div>

          {/* Unemployment Metrics */}
          <div className={`${CARD_CLASSES.default} p-6`}>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Users size={24} />
              Unemployment Metrics
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">U3 (Official Rate)</span>
                  {getTrendIcon(laborData.unemployment.trend)}
                </div>
                <div className="text-4xl font-bold text-white">
                  {laborData.unemployment.u3}%
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <div className={`px-2 py-1 rounded text-xs font-semibold ${
                    laborData.unemployment.trend === 'improving' ? 'bg-green-900/30 text-green-400' :
                    laborData.unemployment.trend === 'deteriorating' ? 'bg-red-900/30 text-red-400' :
                    'bg-gray-700 text-gray-400'
                  }`}>
                    {laborData.unemployment.trend.toUpperCase()}
                  </div>
                </div>
              </div>

              {laborData.unemployment.u6 && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">U6 (Broader Measure)</div>
                  <div className="text-4xl font-bold text-white">
                    {laborData.unemployment.u6}%
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Includes underemployed & discouraged
                  </p>
                </div>
              )}

              {laborData.unemployment.participation_rate && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">Participation Rate</div>
                  <div className="text-4xl font-bold text-white">
                    {laborData.unemployment.participation_rate}%
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    % of population working or seeking work
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Job Market Metrics */}
          <div className={`${CARD_CLASSES.default} p-6`}>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Briefcase size={24} />
              Job Market Strength
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-2">Nonfarm Payrolls</div>
                <div className="text-3xl font-bold text-white">
                  {laborData.job_market.nonfarm_payrolls?.toLocaleString() || 'N/A'}
                </div>
                {laborData.job_market.payroll_change_mom !== undefined && (
                  <div className={`text-sm mt-2 ${
                    laborData.job_market.payroll_change_mom > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {laborData.job_market.payroll_change_mom > 0 ? '+' : ''}
                    {laborData.job_market.payroll_change_mom?.toLocaleString()} MoM
                  </div>
                )}
              </div>

              {laborData.job_market.jolts_openings && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">JOLTS Job Openings</div>
                  <div className="text-3xl font-bold text-white">
                    {(laborData.job_market.jolts_openings / 1000).toFixed(1)}M
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Available positions</p>
                </div>
              )}

              {laborData.job_market.quits_rate !== null && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">Quits Rate</div>
                  <div className="text-3xl font-bold text-white">
                    {laborData.job_market.quits_rate}%
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Higher = workers confident
                  </p>
                </div>
              )}

              {laborData.job_market.initial_claims && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">Initial Jobless Claims</div>
                  <div className="text-3xl font-bold text-white">
                    {(laborData.job_market.initial_claims / 1000).toFixed(0)}K
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Weekly (lower is better)</p>
                </div>
              )}

              {laborData.job_market.continuing_claims && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">Continuing Claims</div>
                  <div className="text-3xl font-bold text-white">
                    {(laborData.job_market.continuing_claims / 1000000).toFixed(2)}M
                  </div>
                  <p className="text-xs text-gray-500 mt-2">People receiving benefits</p>
                </div>
              )}
            </div>
          </div>

          {/* Wage Pressure */}
          <div className={`${CARD_CLASSES.default} p-6`}>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <DollarSign size={24} />
              Wage Pressure Indicators
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-2">Hourly Earnings</div>
                <div className="text-3xl font-bold text-white">
                  ${laborData.wages.hourly_earnings || 'N/A'}
                </div>
              </div>

              {laborData.wages.hourly_earnings_yoy !== null && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">Earnings Growth YoY</div>
                  <div className={`text-3xl font-bold ${
                    laborData.wages.hourly_earnings_yoy > 3 ? 'text-orange-400' : 'text-green-400'
                  }`}>
                    {laborData.wages.hourly_earnings_yoy > 0 ? '+' : ''}
                    {laborData.wages.hourly_earnings_yoy}%
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {laborData.wages.hourly_earnings_yoy > 4 ? 'Inflationary pressure' : 'Moderate growth'}
                  </p>
                </div>
              )}

              {laborData.wages.unit_labor_cost !== null && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">Unit Labor Cost</div>
                  <div className="text-3xl font-bold text-white">
                    {laborData.wages.unit_labor_cost}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Index (2012=100)</p>
                </div>
              )}

              {laborData.wages.productivity_growth !== null && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">Productivity Growth</div>
                  <div className="text-3xl font-bold text-white">
                    {laborData.wages.productivity_growth}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Index (2017=100)</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Phillips Curve View */}
          <div className={`${CARD_CLASSES.default} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Phillips Curve</h3>
                <p className="text-sm text-gray-400">Unemployment vs Inflation Trade-off</p>
              </div>
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

            {historyData && historyData.phillips_curve_data && (
              <ResponsiveContainer width="100%" height={500}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    type="number"
                    dataKey="unemployment"
                    stroke="#9ca3af"
                    label={{ value: 'Unemployment Rate (%)', position: 'bottom', fill: '#9ca3af' }}
                    domain={['dataMin - 0.5', 'dataMax + 0.5']}
                  />
                  <YAxis
                    type="number"
                    dataKey="inflation"
                    stroke="#9ca3af"
                    label={{ value: 'Inflation Rate (%)', angle: -90, position: 'left', fill: '#9ca3af' }}
                    domain={['dataMin - 0.5', 'dataMax + 0.5']}
                  />
                  <ZAxis range={[50, 200]} />
                  <Tooltip content={<PhillipsTooltip />} />
                  <ReferenceLine y={2} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Fed Target', fill: '#f59e0b' }} />
                  {laborData.phillips_curve?.historical_average && (
                    <>
                      <ReferenceLine
                        x={laborData.phillips_curve.historical_average.unemployment}
                        stroke="#6b7280"
                        strokeDasharray="5 5"
                        label={{ value: 'Avg U', fill: '#6b7280' }}
                      />
                      <ReferenceLine
                        y={laborData.phillips_curve.historical_average.inflation}
                        stroke="#6b7280"
                        strokeDasharray="5 5"
                        label={{ value: 'Avg I', fill: '#6b7280' }}
                      />
                    </>
                  )}
                  <Scatter data={historyData.phillips_curve_data} fill="#3b82f6">
                    {historyData.phillips_curve_data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#3b82f6" opacity={0.6} />
                    ))}
                  </Scatter>
                  {/* Highlight current point */}
                  {laborData.phillips_curve?.current_point && (
                    <Scatter
                      data={[laborData.phillips_curve.current_point]}
                      fill="#ef4444"
                    >
                      <Cell r={8} stroke="#fff" strokeWidth={2} />
                    </Scatter>
                  )}
                </ScatterChart>
              </ResponsiveContainer>
            )}

            {/* Current Position */}
            {laborData.phillips_curve?.current_point && (
              <div className="mt-4 bg-gray-700/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Current Position</p>
                    <p className="text-lg font-semibold text-white mt-1">
                      Unemployment: {laborData.phillips_curve.current_point.unemployment}% |
                      Inflation: {laborData.phillips_curve.current_point.inflation}%
                    </p>
                  </div>
                  <div className="w-4 h-4 rounded-full bg-red-500" />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Last Updated */}
      {laborData.timestamp && (
        <div className="text-center text-xs text-gray-500">
          Last updated: {new Date(laborData.timestamp).toLocaleString()}
        </div>
      )}
    </div>
  );
}
