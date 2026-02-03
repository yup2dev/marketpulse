/**
 * Macro Financial Conditions Tab - Data-Focused Layout
 */
import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ReferenceLine, BarChart, Bar, Cell } from 'recharts';
import { API_BASE } from '../../config/api';

export default function MacroFinConditionsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/financial-conditions`);
      if (res.ok) setData(await res.json());
    } catch (error) {
      console.error('Error loading financial conditions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getConditionColor = (value) => {
    if (value > 0.5) return 'text-red-400';
    if (value < -0.5) return 'text-green-400';
    return 'text-yellow-400';
  };

  const getConditionLabel = (value) => {
    if (value > 1) return 'Very Tight';
    if (value > 0.5) return 'Tight';
    if (value > -0.5) return 'Neutral';
    if (value > -1) return 'Loose';
    return 'Very Loose';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Financial Conditions</h3>
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
          {/* FCI Index */}
          <div className="col-span-4">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-1">Financial Conditions Index</div>
              <div className={`text-4xl font-bold ${getConditionColor(data.fci_index)}`}>
                {data.fci_index?.toFixed(2) || '-'}
              </div>
              <div className="text-gray-500 text-xs mt-1">{getConditionLabel(data.fci_index)}</div>
              <div className="mt-3 pt-3 border-t border-gray-800">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-xs">vs Last Month</span>
                  <span className={`text-sm flex items-center gap-1 ${(data.fci_change || 0) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {(data.fci_change || 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {data.fci_change > 0 ? '+' : ''}{data.fci_change?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Credit Spreads */}
          <div className="col-span-8">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-3">Credit Spreads</div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-gray-500 text-xs">IG Spread</div>
                  <div className="text-xl font-bold text-white">{data.ig_spread?.toFixed(0) || '-'} bps</div>
                  <div className={`text-xs mt-1 ${(data.ig_spread_change || 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {data.ig_spread_change > 0 ? '+' : ''}{data.ig_spread_change?.toFixed(0) || 0} bps
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">HY Spread</div>
                  <div className="text-xl font-bold text-white">{data.hy_spread?.toFixed(0) || '-'} bps</div>
                  <div className={`text-xs mt-1 ${(data.hy_spread_change || 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {data.hy_spread_change > 0 ? '+' : ''}{data.hy_spread_change?.toFixed(0) || 0} bps
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">TED Spread</div>
                  <div className="text-xl font-bold text-white">{data.ted_spread?.toFixed(0) || '-'} bps</div>
                  <div className={`text-xs mt-1 ${(data.ted_spread_change || 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {data.ted_spread_change > 0 ? '+' : ''}{data.ted_spread_change?.toFixed(0) || 0} bps
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FCI History Chart */}
          <div className="col-span-8">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-3">FCI History</div>
              {data.history ? (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.history}>
                      <defs>
                        <linearGradient id="fciGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" stroke="#666" fontSize={10} />
                      <YAxis stroke="#666" fontSize={10} />
                      <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                      <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                      <ReferenceLine y={0.5} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Tight', position: 'right', fontSize: 10, fill: '#ef4444' }} />
                      <ReferenceLine y={-0.5} stroke="#22c55e" strokeDasharray="3 3" label={{ value: 'Loose', position: 'right', fontSize: 10, fill: '#22c55e' }} />
                      <Area type="monotone" dataKey="fci" stroke="#3b82f6" strokeWidth={2} fill="url(#fciGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-gray-500">No history data</div>
              )}
            </div>
          </div>

          {/* Component Contribution */}
          <div className="col-span-4">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-3">Component Contributions</div>
              {data.components ? (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.components} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis type="number" stroke="#666" fontSize={10} />
                      <YAxis dataKey="name" type="category" stroke="#666" fontSize={9} width={80} />
                      <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                      <ReferenceLine x={0} stroke="#666" />
                      <Bar dataKey="contribution" radius={[0, 4, 4, 0]}>
                        {data.components.map((entry, idx) => (
                          <Cell key={idx} fill={entry.contribution >= 0 ? '#ef4444' : '#22c55e'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-gray-500">No component data</div>
              )}
            </div>
          </div>

          {/* Detailed Indicators Table */}
          <div className="col-span-12">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden">
              <div className="p-3 border-b border-gray-800">
                <span className="text-gray-400 text-xs">Detailed Indicators</span>
              </div>
              <table className="w-full">
                <thead className="bg-[#0a0a0f]">
                  <tr className="text-[10px] text-gray-500">
                    <th className="py-2 px-4 text-left font-medium">Indicator</th>
                    <th className="py-2 px-4 text-right font-medium">Current</th>
                    <th className="py-2 px-4 text-right font-medium">1M Ago</th>
                    <th className="py-2 px-4 text-right font-medium">Change</th>
                    <th className="py-2 px-4 text-right font-medium">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {data.indicators?.map((indicator, idx) => (
                    <tr key={idx} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                      <td className="py-2 px-4 text-sm text-white">{indicator.name}</td>
                      <td className="py-2 px-4 text-right text-sm text-white">{indicator.current?.toFixed(2)}</td>
                      <td className="py-2 px-4 text-right text-sm text-gray-400">{indicator.previous?.toFixed(2)}</td>
                      <td className="py-2 px-4 text-right">
                        <span className={`text-sm flex items-center justify-end gap-1 ${indicator.change >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {indicator.change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {indicator.change > 0 ? '+' : ''}{indicator.change?.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-right">
                        <span className={`text-xs px-2 py-0.5 rounded ${indicator.signal === 'tight' ? 'bg-red-900/50 text-red-400' : indicator.signal === 'loose' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                          {indicator.signal || 'neutral'}
                        </span>
                      </td>
                    </tr>
                  )) || (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-gray-500 text-sm">No indicator data available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Volatility Metrics */}
          <div className="col-span-12">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-3">Volatility & Risk Metrics</div>
              <div className="grid grid-cols-5 gap-4">
                <div>
                  <div className="text-gray-500 text-xs">VIX</div>
                  <div className={`text-xl font-bold ${(data.vix || 0) > 25 ? 'text-red-400' : (data.vix || 0) > 18 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {data.vix?.toFixed(1) || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">MOVE Index</div>
                  <div className={`text-xl font-bold ${(data.move || 0) > 120 ? 'text-red-400' : (data.move || 0) > 100 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {data.move?.toFixed(1) || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Put/Call Ratio</div>
                  <div className={`text-xl font-bold ${(data.put_call || 0) > 1.2 ? 'text-red-400' : (data.put_call || 0) < 0.8 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {data.put_call?.toFixed(2) || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">DXY (Dollar)</div>
                  <div className="text-xl font-bold text-white">{data.dxy?.toFixed(2) || '-'}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">10Y Real Rate</div>
                  <div className={`text-xl font-bold ${(data.real_rate || 0) > 1.5 ? 'text-red-400' : 'text-green-400'}`}>
                    {data.real_rate?.toFixed(2) || '-'}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-8">No data available</div>
      )}
    </div>
  );
}
