/**
 * Economic Regime Dashboard - Data-driven growth vs inflation analysis
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
  Cell
} from 'recharts';
import { ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { API_BASE } from '../../config/api';

const REGIME_CONFIG = {
  goldilocks: {
    name: 'Goldilocks',
    color: '#10b981',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500',
    textColor: 'text-green-400',
    description: 'Positive growth + moderate inflation'
  },
  reflation: {
    name: 'Reflation',
    color: '#f59e0b',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500',
    textColor: 'text-amber-400',
    description: 'Growth recovering + inflation rising'
  },
  stagflation: {
    name: 'Stagflation',
    color: '#ef4444',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500',
    textColor: 'text-red-400',
    description: 'Weak growth + high inflation'
  },
  deflation: {
    name: 'Deflation',
    color: '#3b82f6',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500',
    textColor: 'text-blue-400',
    description: 'Weak growth + low inflation'
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
      if (!data || !data.regime) return null;

      const config = REGIME_CONFIG[data.regime];
      if (!config) return null;

      return (
        <div className="bg-[#0d0d12] border border-gray-700 rounded-lg p-3 shadow-lg">
          <div className={`font-semibold ${config.textColor} mb-2`}>{config.name}</div>
          <div className="text-xs space-y-1 text-gray-300">
            <div>Date: {new Date(data.date).toLocaleDateString()}</div>
            <div>Growth Score: {data.growth_score?.toFixed(1)}</div>
            <div>Inflation Score: {data.inflation_score?.toFixed(1)}</div>
            {data.gdp_growth != null && <div>GDP Growth: {data.gdp_growth.toFixed(1)}%</div>}
            {data.cpi_yoy != null && <div>CPI YoY: {data.cpi_yoy.toFixed(1)}%</div>}
          </div>
        </div>
      );
    }
    return null;
  };

  const mostRecentData = history.length > 0 ? history[history.length - 1] : null;
  const config = mostRecentData ? REGIME_CONFIG[mostRecentData.regime] : null;

  const scatterData = history.map((h, index) => ({
    ...h,
    isCurrent: index === history.length - 1
  }));

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2].map(i => (
          <div key={i} className="bg-[#0d0d12] rounded-lg p-6 border border-gray-800 animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="h-8 bg-gray-700 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Regime Card */}
      <div className="bg-[#0d0d12] rounded-lg border border-gray-800">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Current Economic Regime</h3>
          <div className="flex items-center gap-2">
            {['1y', '3y', '5y', '10y'].map(period => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  selectedPeriod === period
                    ? 'bg-cyan-500 text-black'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {period}
              </button>
            ))}
            <button onClick={fetchRegimeData} className="ml-2 text-gray-400 hover:text-white">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {config && mostRecentData && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              {/* Regime Status */}
              <div className={`col-span-1 md:col-span-2 p-4 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
                <div className={`text-3xl font-bold ${config.textColor} mb-2`}>{config.name}</div>
                <p className="text-gray-400 text-sm mb-4">{config.description}</p>
                <p className="text-xs text-gray-500">
                  Latest: {new Date(mostRecentData.date).toLocaleDateString()}
                </p>
              </div>

              {/* Metrics */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-1">Growth Score</div>
                <div className="text-2xl font-bold text-white flex items-center gap-2">
                  {mostRecentData.growth_score > 0 ? (
                    <ArrowUp size={20} className="text-green-400" />
                  ) : (
                    <ArrowDown size={20} className="text-red-400" />
                  )}
                  {mostRecentData.growth_score?.toFixed(1)}
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-1">Inflation Score</div>
                <div className="text-2xl font-bold text-white flex items-center gap-2">
                  {mostRecentData.inflation_score > 0 ? (
                    <ArrowUp size={20} className="text-amber-400" />
                  ) : (
                    <ArrowDown size={20} className="text-blue-400" />
                  )}
                  {mostRecentData.inflation_score?.toFixed(1)}
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-1">GDP / CPI</div>
                <div className="text-xl font-bold text-white">
                  {mostRecentData.gdp_growth?.toFixed(1)}% / {mostRecentData.cpi_yoy?.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scatter Chart */}
      <div className="bg-[#0d0d12] rounded-lg border border-gray-800">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Regime History (Growth vs Inflation)</h3>
        </div>
        <div className="p-4">
          {history.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  type="number"
                  dataKey="growth_score"
                  domain={[-100, 100]}
                  stroke="#9ca3af"
                  label={{ value: 'Growth Score', position: 'bottom', fill: '#9ca3af', offset: 20 }}
                />
                <YAxis
                  type="number"
                  dataKey="inflation_score"
                  domain={[-100, 100]}
                  stroke="#9ca3af"
                  label={{ value: 'Inflation Score', angle: -90, position: 'left', fill: '#9ca3af' }}
                />
                <ReferenceLine x={0} stroke="#6b7280" strokeWidth={2} />
                <ReferenceLine y={0} stroke="#6b7280" strokeWidth={2} />
                <Tooltip content={<CustomTooltip />} />
                <Scatter name="Regime Data" data={scatterData}>
                  {scatterData.map((entry, index) => {
                    const entryConfig = REGIME_CONFIG[entry.regime];
                    const isLatest = entry.isCurrent;
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={entryConfig?.color || '#6b7280'}
                        opacity={isLatest ? 1 : 0.4}
                        r={isLatest ? 12 : 4}
                        stroke={isLatest ? "#fff" : "none"}
                        strokeWidth={isLatest ? 3 : 0}
                      />
                    );
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[400px] flex items-center justify-center text-gray-400">
              No historical data available
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="p-4 border-t border-gray-800">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(REGIME_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cfg.color }} />
                <span className={`text-sm ${cfg.textColor}`}>{cfg.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Components Breakdown */}
      {currentRegime?.components && (
        <div className="bg-[#0d0d12] rounded-lg border border-gray-800">
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-lg font-semibold text-white">Component Breakdown</h3>
          </div>
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                    <th className="px-4 py-3 font-medium">Component</th>
                    <th className="px-4 py-3 font-medium text-right">Value</th>
                    <th className="px-4 py-3 font-medium text-right">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-800/50">
                    <td className="px-4 py-3 text-white">GDP Growth Rate</td>
                    <td className="px-4 py-3 text-right text-white font-medium">
                      {currentRegime.components?.gdp_growth?.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">50%</td>
                  </tr>
                  <tr className="border-b border-gray-800/50">
                    <td className="px-4 py-3 text-white">Industrial Production YoY</td>
                    <td className="px-4 py-3 text-right text-white font-medium">
                      {currentRegime.components?.industrial_production_yoy?.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">25%</td>
                  </tr>
                  <tr className="border-b border-gray-800/50">
                    <td className="px-4 py-3 text-white">Employment YoY</td>
                    <td className="px-4 py-3 text-right text-white font-medium">
                      {currentRegime.components?.employment_yoy?.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">25%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
