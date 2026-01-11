/**
 * Financial Conditions Widget - FCI, Credit Spreads, Liquidity
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
  ReferenceLine
} from 'recharts';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Building2,
  DollarSign
} from 'lucide-react';
import { API_BASE } from '../../config/api';
import { CARD_CLASSES } from '../../styles/designTokens';

const FCI_STATUS_CONFIG = {
  loose: {
    name: 'Loose',
    emoji: '💸',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
    description: 'Easy financial conditions, credit flowing freely'
  },
  neutral: {
    name: 'Neutral',
    emoji: '⚖️',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    description: 'Balanced financial conditions'
  },
  tight: {
    name: 'Tight',
    emoji: '⚠️',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    description: 'Tightening conditions, credit becoming restrictive'
  },
  very_tight: {
    name: 'Very Tight',
    emoji: '🚨',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    description: 'Severe stress, credit markets strained'
  }
};

export default function FinancialConditionsWidget() {
  const [fciData, setFciData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('5y');
  const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard' or 'historical'

  useEffect(() => {
    fetchFCIData();
  }, []);

  useEffect(() => {
    if (viewMode === 'historical') {
      fetchHistoricalData();
    }
  }, [viewMode, selectedPeriod]);

  const fetchFCIData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/macro/financial-conditions`);
      const data = await response.json();
      setFciData(data);
    } catch (error) {
      console.error('Error fetching FCI data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoricalData = async () => {
    try {
      const response = await fetch(`${API_BASE}/macro/financial-conditions/history?period=${selectedPeriod}`);
      const data = await response.json();
      setHistoryData(data);
    } catch (error) {
      console.error('Error fetching FCI history:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Activity className="animate-spin text-blue-400" size={48} />
      </div>
    );
  }

  if (!fciData || !fciData.fci_composite || !fciData.fci_composite.status) {
    return (
      <div className="text-center py-12 text-gray-400">
        <AlertCircle className="mx-auto mb-4" size={48} />
        <p>Unable to load financial conditions data</p>
      </div>
    );
  }

  const statusConfig = FCI_STATUS_CONFIG[fciData.fci_composite.status];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold mb-2">
            {new Date(data.date).toLocaleDateString()}
          </p>
          <p className="text-sm text-blue-400">
            FCI: {data.value?.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  const SpreadTooltip = ({ active, payload }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold mb-2">
            {new Date(data.date).toLocaleDateString()}
          </p>
          <p className="text-sm text-orange-400">
            HY Spread: {data.high_yield_spread?.toFixed(0)} bp
          </p>
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
            <h2 className="text-2xl font-bold text-white mb-2">Financial Conditions Index</h2>
            <p className="text-gray-400">Credit markets, spreads, and liquidity indicators</p>
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
          {/* FCI Composite Status */}
          <div
            className={`${CARD_CLASSES.default} p-8`}
            style={{
              backgroundColor: statusConfig.bgColor,
              borderColor: statusConfig.color,
              borderWidth: '2px'
            }}
          >
            <div className="text-center mb-6">
              <span className="text-6xl mb-4 block">{statusConfig.emoji}</span>
              <h3 className="text-3xl font-bold text-white mb-2">
                {statusConfig.name} Conditions
              </h3>
              <p className="text-gray-400 mb-4">{statusConfig.description}</p>
              <div className="text-xl text-gray-300">
                FCI Score: <span className="font-bold text-white">{fciData.fci_composite.value}</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Raw NFCI: {fciData.fci_composite.raw_value}
              </p>
            </div>

            {/* FCI Gauge */}
            <div className="relative w-full h-8 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to right, #10b981 0%, #3b82f6 40%, #f59e0b 70%, #ef4444 100%)'
                }}
              />
              <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
                style={{
                  left: `${((fciData.fci_composite.value + 100) / 200) * 100}%`,
                  boxShadow: '0 0 20px rgba(255, 255, 255, 0.8)'
                }}
              />
            </div>

            {/* Scale Labels */}
            <div className="flex justify-between text-sm mt-2">
              <span className="text-green-400">Loose</span>
              <span className="text-blue-400">Neutral</span>
              <span className="text-orange-400">Tight</span>
              <span className="text-red-400">Very Tight</span>
            </div>
          </div>

          {/* Credit Spreads */}
          <div className={`${CARD_CLASSES.default} p-6`}>
            <h3 className="text-lg font-semibold text-white mb-4">Credit Spreads</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {fciData.credit_spreads.investment_grade?.spread && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Investment Grade</span>
                    <TrendingUp className="text-blue-400" size={18} />
                  </div>
                  <div className="text-3xl font-bold text-white">
                    {fciData.credit_spreads.investment_grade.spread} <span className="text-sm">bp</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">AAA Corporate Bonds</p>
                </div>
              )}

              {fciData.credit_spreads.high_yield?.spread && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">High Yield</span>
                    {fciData.credit_spreads.high_yield.spread > 500 ? (
                      <AlertTriangle className="text-orange-400" size={18} />
                    ) : (
                      <TrendingUp className="text-green-400" size={18} />
                    )}
                  </div>
                  <div className={`text-3xl font-bold ${
                    fciData.credit_spreads.high_yield.spread > 800 ? 'text-red-400' :
                    fciData.credit_spreads.high_yield.spread > 500 ? 'text-orange-400' : 'text-green-400'
                  }`}>
                    {fciData.credit_spreads.high_yield.spread} <span className="text-sm">bp</span>
                  </div>
                  {fciData.credit_spreads.high_yield.percentile && (
                    <p className="text-xs text-gray-500 mt-2">
                      {fciData.credit_spreads.high_yield.percentile}th percentile
                    </p>
                  )}
                </div>
              )}

              {fciData.credit_spreads.bbb_treasury?.spread && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">BBB-Treasury</span>
                    <CreditCard className="text-blue-400" size={18} />
                  </div>
                  <div className="text-3xl font-bold text-white">
                    {fciData.credit_spreads.bbb_treasury.spread} <span className="text-sm">bp</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">IG Lower Tier</p>
                </div>
              )}

              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Distressed Ratio</span>
                  {fciData.credit_spreads.distressed_ratio > 10 ? (
                    <AlertTriangle className="text-red-400" size={18} />
                  ) : (
                    <TrendingDown className="text-green-400" size={18} />
                  )}
                </div>
                <div className={`text-3xl font-bold ${
                  fciData.credit_spreads.distressed_ratio > 15 ? 'text-red-400' :
                  fciData.credit_spreads.distressed_ratio > 5 ? 'text-orange-400' : 'text-green-400'
                }`}>
                  {fciData.credit_spreads.distressed_ratio}%
                </div>
                <p className="text-xs text-gray-500 mt-2">Bonds &gt;1000bp spread</p>
              </div>
            </div>
          </div>

          {/* Liquidity Indicators */}
          <div className={`${CARD_CLASSES.default} p-6`}>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <DollarSign size={24} />
              Liquidity Indicators
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {fciData.liquidity.ted_spread !== null && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">TED Spread</div>
                  <div className={`text-3xl font-bold ${
                    fciData.liquidity.ted_spread > 0.5 ? 'text-red-400' :
                    fciData.liquidity.ted_spread > 0.3 ? 'text-orange-400' : 'text-green-400'
                  }`}>
                    {fciData.liquidity.ted_spread}%
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Bank credit risk (normal &lt;0.3%)</p>
                </div>
              )}

              {fciData.liquidity.commercial_paper_outstanding && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">Commercial Paper</div>
                  <div className="text-3xl font-bold text-white">
                    ${(fciData.liquidity.commercial_paper_outstanding / 1000).toFixed(1)}T
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Outstanding short-term debt</p>
                </div>
              )}

              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-2">LIBOR-OIS Spread</div>
                <div className="text-3xl font-bold text-gray-400">
                  N/A
                </div>
                <p className="text-xs text-gray-500 mt-2">LIBOR discontinued</p>
              </div>
            </div>
          </div>

          {/* Consumer Health */}
          <div className={`${CARD_CLASSES.default} p-6`}>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CreditCard size={24} />
              Consumer Credit Health
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {fciData.consumer_health.consumer_credit_growth !== null && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">Credit Growth YoY</div>
                  <div className={`text-3xl font-bold ${
                    fciData.consumer_health.consumer_credit_growth > 5 ? 'text-orange-400' :
                    fciData.consumer_health.consumer_credit_growth < 2 ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {fciData.consumer_health.consumer_credit_growth > 0 ? '+' : ''}
                    {fciData.consumer_health.consumer_credit_growth}%
                  </div>
                </div>
              )}

              {fciData.consumer_health.credit_card_delinquency !== null && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">Credit Card Delinq.</div>
                  <div className={`text-3xl font-bold ${
                    fciData.consumer_health.credit_card_delinquency > 5 ? 'text-red-400' :
                    fciData.consumer_health.credit_card_delinquency > 3 ? 'text-orange-400' : 'text-green-400'
                  }`}>
                    {fciData.consumer_health.credit_card_delinquency}%
                  </div>
                </div>
              )}

              {fciData.consumer_health.auto_loan_delinquency !== null && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">Auto Loan Delinq.</div>
                  <div className={`text-3xl font-bold ${
                    fciData.consumer_health.auto_loan_delinquency > 4 ? 'text-red-400' :
                    fciData.consumer_health.auto_loan_delinquency > 2 ? 'text-orange-400' : 'text-green-400'
                  }`}>
                    {fciData.consumer_health.auto_loan_delinquency}%
                  </div>
                </div>
              )}

              {fciData.consumer_health.mortgage_delinquency !== null && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">Mortgage Delinq.</div>
                  <div className={`text-3xl font-bold ${
                    fciData.consumer_health.mortgage_delinquency > 3 ? 'text-red-400' :
                    fciData.consumer_health.mortgage_delinquency > 2 ? 'text-orange-400' : 'text-green-400'
                  }`}>
                    {fciData.consumer_health.mortgage_delinquency}%
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Corporate Health */}
          <div className={`${CARD_CLASSES.default} p-6`}>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Building2 size={24} />
              Corporate Health
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {fciData.corporate_health.corporate_debt_to_gdp && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">Corporate Debt to GDP</div>
                  <div className={`text-3xl font-bold ${
                    fciData.corporate_health.corporate_debt_to_gdp > 50 ? 'text-red-400' :
                    fciData.corporate_health.corporate_debt_to_gdp > 40 ? 'text-orange-400' : 'text-green-400'
                  }`}>
                    {fciData.corporate_health.corporate_debt_to_gdp}%
                  </div>
                </div>
              )}

              {fciData.corporate_health.debt_growth_yoy !== null && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">Debt Growth YoY</div>
                  <div className={`text-3xl font-bold ${
                    fciData.corporate_health.debt_growth_yoy > 10 ? 'text-red-400' :
                    fciData.corporate_health.debt_growth_yoy > 5 ? 'text-orange-400' : 'text-green-400'
                  }`}>
                    {fciData.corporate_health.debt_growth_yoy > 0 ? '+' : ''}
                    {fciData.corporate_health.debt_growth_yoy}%
                  </div>
                </div>
              )}

              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-2">Interest Coverage</div>
                <div className="text-3xl font-bold text-gray-400">
                  N/A
                </div>
                <p className="text-xs text-gray-500 mt-2">Requires earnings data</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Historical FCI Chart */}
          <div className={`${CARD_CLASSES.default} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Historical FCI (Chicago Fed NFCI)</h3>
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

            {historyData && historyData.fci_history && historyData.fci_history.length > 0 && (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={historyData.fci_history}>
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
                    label={{ value: 'NFCI Value', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#3b82f6" strokeDasharray="3 3" label={{ value: 'Neutral', fill: '#3b82f6' }} />
                  <ReferenceLine y={0.5} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Tight', fill: '#ef4444' }} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Historical Credit Spreads */}
          {historyData && historyData.credit_spread_history && historyData.credit_spread_history.length > 0 && (
            <div className={`${CARD_CLASSES.default} p-6`}>
              <h3 className="text-lg font-semibold text-white mb-4">High Yield Credit Spread History</h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={historyData.credit_spread_history}>
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
                    label={{ value: 'Spread (bp)', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
                  />
                  <Tooltip content={<SpreadTooltip />} />
                  <ReferenceLine y={500} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Elevated', fill: '#f59e0b' }} />
                  <ReferenceLine y={1000} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Distressed', fill: '#ef4444' }} />
                  <Line
                    type="monotone"
                    dataKey="high_yield_spread"
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
      {fciData.timestamp && (
        <div className="text-center text-xs text-gray-500">
          Last updated: {new Date(fciData.timestamp).toLocaleString()}
        </div>
      )}
    </div>
  );
}
