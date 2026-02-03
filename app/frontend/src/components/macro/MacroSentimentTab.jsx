/**
 * Macro Sentiment Tab - Data-Focused Layout
 */
import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, PieChart, Pie, Legend } from 'recharts';
import { API_BASE } from '../../config/api';

export default function MacroSentimentTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/sentiment/composite`);
      if (res.ok) setData(await res.json());
    } catch (error) {
      console.error('Error loading sentiment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSentimentColor = (value) => {
    if (value >= 70) return 'text-green-400';
    if (value >= 50) return 'text-yellow-400';
    if (value >= 30) return 'text-orange-400';
    return 'text-red-400';
  };

  const getSentimentLabel = (value) => {
    if (value >= 80) return 'Extreme Greed';
    if (value >= 60) return 'Greed';
    if (value >= 40) return 'Neutral';
    if (value >= 20) return 'Fear';
    return 'Extreme Fear';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Market Sentiment</h3>
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
          {/* Composite Score */}
          <div className="col-span-4">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-1">Composite Sentiment</div>
              <div className={`text-5xl font-bold ${getSentimentColor(data.composite_score)}`}>
                {data.composite_score?.toFixed(0) || '-'}
              </div>
              <div className="text-gray-500 text-xs mt-1">{getSentimentLabel(data.composite_score)}</div>
              <div className="mt-3">
                <div className="h-2 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full overflow-hidden relative">
                  <div
                    className="absolute top-0 w-1 h-full bg-white shadow-lg"
                    style={{ left: `${data.composite_score || 50}%`, transform: 'translateX(-50%)' }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  <span>Fear</span>
                  <span>Neutral</span>
                  <span>Greed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-Indicators Summary */}
          <div className="col-span-8">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-3">Sentiment Components</div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <div className="text-gray-500 text-xs">AAII Bulls</div>
                  <div className={`text-xl font-bold ${(data.aaii_bulls || 0) > 45 ? 'text-green-400' : (data.aaii_bulls || 0) < 25 ? 'text-red-400' : 'text-yellow-400'}`}>
                    {data.aaii_bulls?.toFixed(1) || '-'}%
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Put/Call Ratio</div>
                  <div className={`text-xl font-bold ${(data.put_call || 0) > 1 ? 'text-red-400' : (data.put_call || 0) < 0.7 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {data.put_call?.toFixed(2) || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">VIX Level</div>
                  <div className={`text-xl font-bold ${(data.vix || 0) > 25 ? 'text-red-400' : (data.vix || 0) < 15 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {data.vix?.toFixed(1) || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Margin Debt</div>
                  <div className={`text-xl font-bold ${(data.margin_debt_change || 0) > 5 ? 'text-green-400' : (data.margin_debt_change || 0) < -5 ? 'text-red-400' : 'text-yellow-400'}`}>
                    {data.margin_debt_change > 0 ? '+' : ''}{data.margin_debt_change?.toFixed(1) || '-'}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sentiment History Chart */}
          <div className="col-span-8">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-3">Sentiment History</div>
              {data.history ? (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.history}>
                      <defs>
                        <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" stroke="#666" fontSize={10} />
                      <YAxis stroke="#666" fontSize={10} domain={[0, 100]} />
                      <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                      <Area type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} fill="url(#sentimentGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-gray-500">No history data</div>
              )}
            </div>
          </div>

          {/* AAII Survey */}
          <div className="col-span-4">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-3">AAII Investor Survey</div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-green-400">Bullish</span>
                    <span className="text-white font-medium">{data.aaii_bulls?.toFixed(1) || '-'}%</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-green-400" style={{ width: `${data.aaii_bulls || 0}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-yellow-400">Neutral</span>
                    <span className="text-white font-medium">{data.aaii_neutral?.toFixed(1) || '-'}%</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400" style={{ width: `${data.aaii_neutral || 0}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-red-400">Bearish</span>
                    <span className="text-white font-medium">{data.aaii_bears?.toFixed(1) || '-'}%</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400" style={{ width: `${data.aaii_bears || 0}%` }} />
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-800">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Bull-Bear Spread</span>
                  <span className={`font-medium ${(data.aaii_bulls - data.aaii_bears) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {((data.aaii_bulls || 0) - (data.aaii_bears || 0)).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Indicators Table */}
          <div className="col-span-12">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden">
              <div className="p-3 border-b border-gray-800">
                <span className="text-gray-400 text-xs">Sentiment Indicators</span>
              </div>
              <table className="w-full">
                <thead className="bg-[#0a0a0f]">
                  <tr className="text-[10px] text-gray-500">
                    <th className="py-2 px-4 text-left font-medium">Indicator</th>
                    <th className="py-2 px-4 text-right font-medium">Current</th>
                    <th className="py-2 px-4 text-right font-medium">1W Ago</th>
                    <th className="py-2 px-4 text-right font-medium">Change</th>
                    <th className="py-2 px-4 text-right font-medium">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="py-2 px-4 text-sm text-white">AAII Bull/Bear Spread</td>
                    <td className="py-2 px-4 text-right text-sm text-white">{((data.aaii_bulls || 0) - (data.aaii_bears || 0)).toFixed(1)}%</td>
                    <td className="py-2 px-4 text-right text-sm text-gray-400">{data.aaii_spread_prev?.toFixed(1) || '-'}%</td>
                    <td className="py-2 px-4 text-right">
                      <span className={`text-sm flex items-center justify-end gap-1 ${(data.aaii_spread_change || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(data.aaii_spread_change || 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {data.aaii_spread_change > 0 ? '+' : ''}{data.aaii_spread_change?.toFixed(1) || '0'}%
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded ${((data.aaii_bulls || 0) - (data.aaii_bears || 0)) > 20 ? 'bg-green-900/50 text-green-400' : ((data.aaii_bulls || 0) - (data.aaii_bears || 0)) < -20 ? 'bg-red-900/50 text-red-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                        {((data.aaii_bulls || 0) - (data.aaii_bears || 0)) > 20 ? 'Bullish' : ((data.aaii_bulls || 0) - (data.aaii_bears || 0)) < -20 ? 'Bearish' : 'Neutral'}
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="py-2 px-4 text-sm text-white">Put/Call Ratio</td>
                    <td className="py-2 px-4 text-right text-sm text-white">{data.put_call?.toFixed(2) || '-'}</td>
                    <td className="py-2 px-4 text-right text-sm text-gray-400">{data.put_call_prev?.toFixed(2) || '-'}</td>
                    <td className="py-2 px-4 text-right">
                      <span className={`text-sm flex items-center justify-end gap-1 ${(data.put_call_change || 0) <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(data.put_call_change || 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {data.put_call_change > 0 ? '+' : ''}{data.put_call_change?.toFixed(2) || '0'}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded ${(data.put_call || 0) > 1 ? 'bg-red-900/50 text-red-400' : (data.put_call || 0) < 0.7 ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                        {(data.put_call || 0) > 1 ? 'Fearful' : (data.put_call || 0) < 0.7 ? 'Complacent' : 'Neutral'}
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="py-2 px-4 text-sm text-white">VIX</td>
                    <td className="py-2 px-4 text-right text-sm text-white">{data.vix?.toFixed(2) || '-'}</td>
                    <td className="py-2 px-4 text-right text-sm text-gray-400">{data.vix_prev?.toFixed(2) || '-'}</td>
                    <td className="py-2 px-4 text-right">
                      <span className={`text-sm flex items-center justify-end gap-1 ${(data.vix_change || 0) <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(data.vix_change || 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {data.vix_change > 0 ? '+' : ''}{data.vix_change?.toFixed(2) || '0'}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded ${(data.vix || 0) > 25 ? 'bg-red-900/50 text-red-400' : (data.vix || 0) < 15 ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                        {(data.vix || 0) > 25 ? 'High Fear' : (data.vix || 0) < 15 ? 'Low Fear' : 'Normal'}
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="py-2 px-4 text-sm text-white">Margin Debt Growth (YoY)</td>
                    <td className="py-2 px-4 text-right text-sm text-white">{data.margin_debt_change?.toFixed(1) || '-'}%</td>
                    <td className="py-2 px-4 text-right text-sm text-gray-400">{data.margin_debt_prev?.toFixed(1) || '-'}%</td>
                    <td className="py-2 px-4 text-right">
                      <span className={`text-sm flex items-center justify-end gap-1 ${(data.margin_change_diff || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(data.margin_change_diff || 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {data.margin_change_diff > 0 ? '+' : ''}{data.margin_change_diff?.toFixed(1) || '0'}%
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded ${(data.margin_debt_change || 0) > 10 ? 'bg-green-900/50 text-green-400' : (data.margin_debt_change || 0) < -10 ? 'bg-red-900/50 text-red-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                        {(data.margin_debt_change || 0) > 10 ? 'Risk-On' : (data.margin_debt_change || 0) < -10 ? 'Risk-Off' : 'Neutral'}
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
