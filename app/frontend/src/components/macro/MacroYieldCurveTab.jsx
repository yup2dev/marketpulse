/**
 * Macro Yield Curve Tab - Data-Focused Layout
 */
import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { API_BASE } from '../../config/api';

export default function MacroYieldCurveTab() {
  const [curveData, setCurveData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/yield-curve`);
      if (res.ok) setCurveData(await res.json());
    } catch (error) {
      console.error('Error loading yield curve:', error);
    } finally {
      setLoading(false);
    }
  };

  const getShapeColor = (shape) => {
    const colors = { normal: 'text-green-400', flat: 'text-yellow-400', inverted: 'text-red-400', humped: 'text-blue-400' };
    return colors[shape] || 'text-gray-400';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Yield Curve Analysis</h3>
        <button onClick={loadData} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Inversion Warning */}
      {curveData?.inversion_signal && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-3 flex items-center gap-3">
          <AlertTriangle className="text-red-400" size={20} />
          <div>
            <p className="text-red-400 font-semibold text-sm">Yield Curve Inversion Detected</p>
            <p className="text-red-300 text-xs">Historically precedes recessions by 12-24 months</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* Curve Shape */}
        <div className="col-span-4">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
            <div className="text-gray-400 text-xs mb-1">Curve Shape</div>
            <div className={`text-2xl font-bold capitalize ${getShapeColor(curveData?.curve_shape)}`}>
              {curveData?.curve_shape || '-'}
            </div>
          </div>
        </div>

        {/* Key Spreads */}
        <div className="col-span-8">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
            <div className="text-gray-400 text-xs mb-3">Key Spreads</div>
            <div className="grid grid-cols-3 gap-4">
              {curveData?.spreads && Object.entries(curveData.spreads).map(([key, value]) => (
                <div key={key}>
                  <div className="text-gray-500 text-xs">{key.toUpperCase()}</div>
                  <div className={`text-lg font-bold flex items-center gap-1 ${value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {value >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {value > 0 ? '+' : ''}{value?.toFixed(2)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Yield Curve Chart */}
        <div className="col-span-12">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
            <div className="text-gray-400 text-xs mb-3">Current Yield Curve</div>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            ) : curveData?.curve ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={curveData.curve}>
                    <defs>
                      <linearGradient id="yieldGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="maturity" stroke="#666" fontSize={11} />
                    <YAxis stroke="#666" fontSize={11} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                    <Area type="monotone" dataKey="yield" stroke="#3b82f6" strokeWidth={2} fill="url(#yieldGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">No data</div>
            )}
          </div>
        </div>

        {/* Yields Table */}
        <div className="col-span-12">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#0a0a0f]">
                <tr className="text-[10px] text-gray-500">
                  <th className="py-2 px-4 text-left font-medium">Maturity</th>
                  <th className="py-2 px-4 text-right font-medium">Yield</th>
                  <th className="py-2 px-4 text-right font-medium">Years</th>
                </tr>
              </thead>
              <tbody>
                {curveData?.curve?.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="py-2 px-4 text-sm font-medium text-white">{item.maturity}</td>
                    <td className="py-2 px-4 text-right text-sm text-white">{item.yield?.toFixed(2)}%</td>
                    <td className="py-2 px-4 text-right text-sm text-gray-400">{item.years}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
