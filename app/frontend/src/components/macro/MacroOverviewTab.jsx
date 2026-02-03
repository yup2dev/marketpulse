/**
 * Macro Overview Tab - Data-Focused Layout
 */
import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { API_BASE } from '../../config/api';

const MiniSparkline = ({ data, isPositive }) => {
  if (!data || data.length < 2) return <div className="w-20 h-6" />;
  return (
    <div className="w-20 h-6">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="value" stroke={isPositive ? '#22c55e' : '#ef4444'} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default function MacroOverviewTab() {
  const [indicators, setIndicators] = useState([]);
  const [regime, setRegime] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [indicatorsRes, regimeRes] = await Promise.all([
        fetch(`${API_BASE}/macro/indicators/overview`),
        fetch(`${API_BASE}/macro/regime/current`)
      ]);
      if (indicatorsRes.ok) {
        const data = await indicatorsRes.json();
        setIndicators(data.indicators || []);
      }
      if (regimeRes.ok) {
        setRegime(await regimeRes.json());
      }
    } catch (error) {
      console.error('Error loading macro data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value, format) => {
    if (value === null || value === undefined) return '-';
    if (format === 'percent') return `${value.toFixed(2)}%`;
    if (format === 'number') return value.toLocaleString();
    return value.toFixed(2);
  };

  const getRegimeColor = (regime) => {
    const colors = {
      goldilocks: 'text-green-400',
      reflation: 'text-yellow-400',
      stagflation: 'text-red-400',
      deflation: 'text-blue-400'
    };
    return colors[regime] || 'text-gray-400';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Economic Overview</h3>
        <button onClick={loadData} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Current Regime */}
      {regime && (
        <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gray-400 text-xs mb-1">Current Economic Regime</div>
              <div className={`text-2xl font-bold capitalize ${getRegimeColor(regime.regime)}`}>
                {regime.regime || 'Unknown'}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-right">
              <div>
                <div className="text-gray-500 text-xs">Growth Score</div>
                <div className={`text-lg font-bold ${regime.growth_score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {regime.growth_score?.toFixed(0) || 0}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Inflation Score</div>
                <div className={`text-lg font-bold ${regime.inflation_score >= 50 ? 'text-red-400' : 'text-green-400'}`}>
                  {regime.inflation_score?.toFixed(0) || 0}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Indicators Table */}
      <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#0a0a0f]">
            <tr className="text-[10px] text-gray-500">
              <th className="py-2 px-4 text-left font-medium">Indicator</th>
              <th className="py-2 px-4 text-right font-medium">Current</th>
              <th className="py-2 px-4 text-right font-medium">Change</th>
              <th className="py-2 px-4 text-right font-medium">YoY</th>
              <th className="py-2 px-4 text-right font-medium">Trend</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array(6).fill(0).map((_, i) => (
                <tr key={i} className="border-b border-gray-800/50">
                  <td colSpan={5} className="py-3 px-4">
                    <div className="h-4 bg-gray-800 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : indicators.length > 0 ? (
              indicators.map((item, idx) => {
                const isPositive = (item.change || 0) >= 0;
                return (
                  <tr key={idx} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="py-2 px-4">
                      <div className="text-sm font-medium text-white">{item.name}</div>
                      <div className="text-xs text-gray-500">{item.description}</div>
                    </td>
                    <td className="py-2 px-4 text-right">
                      <span className="text-sm font-medium text-white">
                        {formatValue(item.value, item.format)}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right">
                      <span className={`text-sm font-medium flex items-center justify-end gap-1 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {item.change ? `${isPositive ? '+' : ''}${item.change.toFixed(2)}%` : '-'}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right">
                      <span className={`text-sm ${(item.yoy || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {item.yoy ? `${item.yoy >= 0 ? '+' : ''}${item.yoy.toFixed(2)}%` : '-'}
                      </span>
                    </td>
                    <td className="py-2 px-4">
                      <MiniSparkline data={item.history} isPositive={isPositive} />
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500">No data available</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
