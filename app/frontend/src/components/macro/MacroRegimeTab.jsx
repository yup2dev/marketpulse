/**
 * Macro Economic Regime Tab - Data-Focused Layout
 */
import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from 'recharts';
import { API_BASE } from '../../config/api';

export default function MacroRegimeTab() {
  const [regime, setRegime] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [regimeRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/macro/regime/current`),
        fetch(`${API_BASE}/macro/regime/history`)
      ]);
      if (regimeRes.ok) setRegime(await regimeRes.json());
      if (historyRes.ok) {
        const data = await historyRes.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error loading regime data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRegimeColor = (regimeType) => {
    const colors = {
      goldilocks: { text: 'text-green-400', bg: 'bg-green-400' },
      reflation: { text: 'text-yellow-400', bg: 'bg-yellow-400' },
      stagflation: { text: 'text-red-400', bg: 'bg-red-400' },
      deflation: { text: 'text-blue-400', bg: 'bg-blue-400' }
    };
    return colors[regimeType] || { text: 'text-gray-400', bg: 'bg-gray-400' };
  };

  const getRegimeDescription = (regimeType) => {
    const descriptions = {
      goldilocks: 'Strong Growth + Low Inflation',
      reflation: 'Rising Growth + Rising Inflation',
      stagflation: 'Weak Growth + High Inflation',
      deflation: 'Weak Growth + Falling Prices'
    };
    return descriptions[regimeType] || 'Unknown';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Economic Regime</h3>
        <button onClick={loadData} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {/* Current Regime */}
          <div className="col-span-4">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-1">Current Regime</div>
              <div className={`text-3xl font-bold capitalize ${getRegimeColor(regime?.regime).text}`}>
                {regime?.regime || 'Unknown'}
              </div>
              <div className="text-gray-500 text-xs mt-1">{getRegimeDescription(regime?.regime)}</div>
              {regime?.confidence && (
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <div className="text-gray-500 text-xs">Confidence</div>
                  <div className="text-xl font-bold text-white">{(regime.confidence * 100).toFixed(0)}%</div>
                </div>
              )}
            </div>
          </div>

          {/* Growth & Inflation Scores */}
          <div className="col-span-8">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-3">Regime Indicators</div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-gray-500 text-xs mb-2">Growth Score</div>
                  <div className={`text-3xl font-bold ${(regime?.growth_score || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {regime?.growth_score?.toFixed(0) || 0}
                  </div>
                  <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${(regime?.growth_score || 0) >= 0 ? 'bg-green-400' : 'bg-red-400'}`}
                      style={{ width: `${Math.min(100, Math.abs(regime?.growth_score || 0))}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs mb-2">Inflation Score</div>
                  <div className={`text-3xl font-bold ${(regime?.inflation_score || 0) >= 50 ? 'text-red-400' : 'text-green-400'}`}>
                    {regime?.inflation_score?.toFixed(0) || 0}
                  </div>
                  <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${(regime?.inflation_score || 0) >= 50 ? 'bg-red-400' : 'bg-green-400'}`}
                      style={{ width: `${Math.min(100, regime?.inflation_score || 0)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Regime Quadrant */}
          <div className="col-span-6">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-3">Regime Quadrant</div>
              <div className="grid grid-cols-2 gap-1 h-[200px]">
                <div className={`rounded-tl-lg p-3 ${regime?.regime === 'reflation' ? 'bg-yellow-900/50 border-2 border-yellow-400' : 'bg-gray-800/50'}`}>
                  <div className="text-yellow-400 text-xs font-medium">Reflation</div>
                  <div className="text-gray-500 text-[10px] mt-1">↑ Growth, ↑ Inflation</div>
                </div>
                <div className={`rounded-tr-lg p-3 ${regime?.regime === 'goldilocks' ? 'bg-green-900/50 border-2 border-green-400' : 'bg-gray-800/50'}`}>
                  <div className="text-green-400 text-xs font-medium">Goldilocks</div>
                  <div className="text-gray-500 text-[10px] mt-1">↑ Growth, ↓ Inflation</div>
                </div>
                <div className={`rounded-bl-lg p-3 ${regime?.regime === 'stagflation' ? 'bg-red-900/50 border-2 border-red-400' : 'bg-gray-800/50'}`}>
                  <div className="text-red-400 text-xs font-medium">Stagflation</div>
                  <div className="text-gray-500 text-[10px] mt-1">↓ Growth, ↑ Inflation</div>
                </div>
                <div className={`rounded-br-lg p-3 ${regime?.regime === 'deflation' ? 'bg-blue-900/50 border-2 border-blue-400' : 'bg-gray-800/50'}`}>
                  <div className="text-blue-400 text-xs font-medium">Deflation</div>
                  <div className="text-gray-500 text-[10px] mt-1">↓ Growth, ↓ Inflation</div>
                </div>
              </div>
            </div>
          </div>

          {/* Regime History Chart */}
          <div className="col-span-6">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-3">Score History</div>
              {history.length > 0 ? (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" stroke="#666" fontSize={10} />
                      <YAxis stroke="#666" fontSize={10} />
                      <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Line type="monotone" dataKey="growth_score" name="Growth" stroke="#22c55e" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="inflation_score" name="Inflation" stroke="#ef4444" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-500 text-sm">No history data</div>
              )}
            </div>
          </div>

          {/* Key Drivers Table */}
          <div className="col-span-12">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden">
              <div className="p-3 border-b border-gray-800">
                <span className="text-gray-400 text-xs">Key Drivers</span>
              </div>
              <table className="w-full">
                <thead className="bg-[#0a0a0f]">
                  <tr className="text-[10px] text-gray-500">
                    <th className="py-2 px-4 text-left font-medium">Driver</th>
                    <th className="py-2 px-4 text-right font-medium">Value</th>
                    <th className="py-2 px-4 text-right font-medium">Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {regime?.drivers?.map((driver, idx) => (
                    <tr key={idx} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                      <td className="py-2 px-4 text-sm text-white">{driver.name}</td>
                      <td className="py-2 px-4 text-right text-sm text-white">{driver.value?.toFixed(2)}</td>
                      <td className="py-2 px-4 text-right">
                        <span className={`text-sm flex items-center justify-end gap-1 ${driver.impact >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {driver.impact >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {driver.impact > 0 ? '+' : ''}{driver.impact?.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  )) || (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-gray-500 text-sm">No driver data available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
