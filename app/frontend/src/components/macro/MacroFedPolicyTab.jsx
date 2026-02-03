/**
 * Macro Fed Policy Tab - Data-Focused Layout
 */
import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ReferenceLine } from 'recharts';
import { API_BASE } from '../../config/api';

export default function MacroFedPolicyTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/fed-policy/stance`);
      if (res.ok) setData(await res.json());
    } catch (error) {
      console.error('Error loading Fed policy data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStanceColor = (stance) => {
    const colors = {
      hawkish: 'text-red-400',
      dovish: 'text-green-400',
      neutral: 'text-yellow-400'
    };
    return colors[stance] || 'text-gray-400';
  };

  const getStanceDescription = (stance) => {
    const descriptions = {
      hawkish: 'Tightening bias - fighting inflation',
      dovish: 'Easing bias - supporting growth',
      neutral: 'Data dependent - balanced approach'
    };
    return descriptions[stance] || 'Unknown';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Federal Reserve Policy</h3>
        <button onClick={loadData} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : data ? (
        <div className="grid grid-cols-12 gap-4">
          {/* Current Stance */}
          <div className="col-span-4">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-1">Policy Stance</div>
              <div className={`text-3xl font-bold capitalize ${getStanceColor(data.stance)}`}>
                {data.stance || 'Unknown'}
              </div>
              <div className="text-gray-500 text-xs mt-1">{getStanceDescription(data.stance)}</div>
            </div>
          </div>

          {/* Fed Funds Rate */}
          <div className="col-span-4">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-1">Fed Funds Rate</div>
              <div className="text-3xl font-bold text-white">
                {data.fed_funds_rate?.toFixed(2) || '-'}%
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-gray-500 text-xs">Target:</span>
                <span className="text-white text-xs">
                  {data.target_range?.lower?.toFixed(2) || '-'}% - {data.target_range?.upper?.toFixed(2) || '-'}%
                </span>
              </div>
            </div>
          </div>

          {/* Next Meeting */}
          <div className="col-span-4">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-1">Next FOMC Meeting</div>
              <div className="text-xl font-bold text-white">{data.next_meeting || '-'}</div>
              {data.market_expectation && (
                <div className="mt-2">
                  <div className="text-gray-500 text-xs">Market Expectation</div>
                  <div className={`text-sm font-medium ${data.market_expectation.direction === 'hike' ? 'text-red-400' : data.market_expectation.direction === 'cut' ? 'text-green-400' : 'text-yellow-400'}`}>
                    {data.market_expectation.probability?.toFixed(0)}% prob. of {data.market_expectation.direction || 'hold'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Rate Path Chart */}
          <div className="col-span-8">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-3">Fed Funds Rate History & Projections</div>
              {data.rate_history ? (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.rate_history}>
                      <defs>
                        <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" stroke="#666" fontSize={10} />
                      <YAxis stroke="#666" fontSize={10} tickFormatter={(v) => `${v}%`} />
                      <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                      <ReferenceLine y={2} stroke="#22c55e" strokeDasharray="3 3" label={{ value: '2% Target', position: 'right', fontSize: 10, fill: '#22c55e' }} />
                      <Area type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={2} fill="url(#rateGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-gray-500">No history data</div>
              )}
            </div>
          </div>

          {/* Dot Plot Summary */}
          <div className="col-span-4">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-3">FOMC Dot Plot Median</div>
              <div className="space-y-3">
                {data.dot_plot?.map((year, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">{year.year}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold">{year.median?.toFixed(2)}%</span>
                      {year.change !== 0 && (
                        <span className={`text-xs flex items-center ${year.change > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {year.change > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                          {Math.abs(year.change).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                )) || (
                  <div className="text-gray-500 text-sm">No dot plot data</div>
                )}
              </div>
            </div>
          </div>

          {/* Policy Signals Table */}
          <div className="col-span-12">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden">
              <div className="p-3 border-b border-gray-800">
                <span className="text-gray-400 text-xs">Policy Signals & Indicators</span>
              </div>
              <table className="w-full">
                <thead className="bg-[#0a0a0f]">
                  <tr className="text-[10px] text-gray-500">
                    <th className="py-2 px-4 text-left font-medium">Indicator</th>
                    <th className="py-2 px-4 text-right font-medium">Current</th>
                    <th className="py-2 px-4 text-right font-medium">Target/Threshold</th>
                    <th className="py-2 px-4 text-right font-medium">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="py-2 px-4 text-sm text-white">Core PCE (YoY)</td>
                    <td className="py-2 px-4 text-right text-sm text-white">{data.core_pce?.toFixed(2) || '-'}%</td>
                    <td className="py-2 px-4 text-right text-sm text-gray-400">2.00%</td>
                    <td className="py-2 px-4 text-right">
                      <span className={`text-sm ${(data.core_pce || 0) > 2.5 ? 'text-red-400' : (data.core_pce || 0) < 1.5 ? 'text-blue-400' : 'text-green-400'}`}>
                        {(data.core_pce || 0) > 2.5 ? 'Hawkish' : (data.core_pce || 0) < 1.5 ? 'Dovish' : 'Neutral'}
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="py-2 px-4 text-sm text-white">Unemployment Rate</td>
                    <td className="py-2 px-4 text-right text-sm text-white">{data.unemployment?.toFixed(1) || '-'}%</td>
                    <td className="py-2 px-4 text-right text-sm text-gray-400">4.0-4.5%</td>
                    <td className="py-2 px-4 text-right">
                      <span className={`text-sm ${(data.unemployment || 0) < 4 ? 'text-red-400' : (data.unemployment || 0) > 5 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {(data.unemployment || 0) < 4 ? 'Hawkish' : (data.unemployment || 0) > 5 ? 'Dovish' : 'Neutral'}
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="py-2 px-4 text-sm text-white">Real GDP Growth</td>
                    <td className="py-2 px-4 text-right text-sm text-white">{data.gdp_growth?.toFixed(1) || '-'}%</td>
                    <td className="py-2 px-4 text-right text-sm text-gray-400">1.8-2.0%</td>
                    <td className="py-2 px-4 text-right">
                      <span className={`text-sm ${(data.gdp_growth || 0) > 3 ? 'text-red-400' : (data.gdp_growth || 0) < 1 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {(data.gdp_growth || 0) > 3 ? 'Hawkish' : (data.gdp_growth || 0) < 1 ? 'Dovish' : 'Neutral'}
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="py-2 px-4 text-sm text-white">Balance Sheet (Trillions)</td>
                    <td className="py-2 px-4 text-right text-sm text-white">${data.balance_sheet?.toFixed(2) || '-'}T</td>
                    <td className="py-2 px-4 text-right text-sm text-gray-400">QT Pace</td>
                    <td className="py-2 px-4 text-right">
                      <span className={`text-sm ${data.qt_active ? 'text-red-400' : 'text-green-400'}`}>
                        {data.qt_active ? 'Tightening' : 'Stable'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-8">No data available</div>
      )}
    </div>
  );
}
