/**
 * Macro Inflation Tab - Data-Focused Layout
 */
import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { API_BASE } from '../../config/api';

export default function MacroInflationTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/inflation/decomposition`);
      if (res.ok) setData(await res.json());
    } catch (error) {
      console.error('Error loading inflation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInflationColor = (value) => {
    if (value >= 3) return 'text-red-400';
    if (value >= 2) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Inflation Analysis</h3>
        <button onClick={loadData} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Headline CPI */}
        <div className="col-span-6">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
            <div className="text-gray-400 text-xs mb-1">Headline CPI (YoY)</div>
            <div className={`text-3xl font-bold ${getInflationColor(data?.headline_cpi?.yoy)}`}>
              {data?.headline_cpi?.yoy?.toFixed(2) || '-'}%
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-800">
              <div>
                <div className="text-gray-500 text-xs">MoM</div>
                <div className="text-white font-medium">{data?.headline_cpi?.mom?.toFixed(2) || '-'}%</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Index</div>
                <div className="text-white font-medium">{data?.headline_cpi?.current?.toFixed(1) || '-'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Core CPI */}
        <div className="col-span-6">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
            <div className="text-gray-400 text-xs mb-1">Core CPI (Ex Food & Energy)</div>
            <div className={`text-3xl font-bold ${getInflationColor(data?.core_cpi?.yoy)}`}>
              {data?.core_cpi?.yoy?.toFixed(2) || '-'}%
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-800">
              <div>
                <div className="text-gray-500 text-xs">MoM</div>
                <div className="text-white font-medium">{data?.core_cpi?.mom?.toFixed(2) || '-'}%</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Index</div>
                <div className="text-white font-medium">{data?.core_cpi?.current?.toFixed(1) || '-'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Components Chart */}
        <div className="col-span-12">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
            <div className="text-gray-400 text-xs mb-3">CPI Components (YoY Change)</div>
            {loading ? (
              <div className="h-[250px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            ) : data?.components ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.components}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="category" stroke="#666" fontSize={10} angle={-15} textAnchor="end" height={60} />
                    <YAxis stroke="#666" fontSize={11} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                    <ReferenceLine y={2} stroke="#f59e0b" strokeDasharray="3 3" />
                    <Bar dataKey="yoy_change" radius={[4, 4, 0, 0]}>
                      {data.components.map((entry, idx) => (
                        <Cell key={idx} fill={entry.yoy_change >= 3 ? '#ef4444' : entry.yoy_change >= 1.5 ? '#f59e0b' : '#10b981'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500">No data</div>
            )}
          </div>
        </div>

        {/* Components Table */}
        <div className="col-span-12">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#0a0a0f]">
                <tr className="text-[10px] text-gray-500">
                  <th className="py-2 px-4 text-left font-medium">Category</th>
                  <th className="py-2 px-4 text-right font-medium">Weight</th>
                  <th className="py-2 px-4 text-right font-medium">YoY Change</th>
                  <th className="py-2 px-4 text-right font-medium">Contribution</th>
                </tr>
              </thead>
              <tbody>
                {data?.components?.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="py-2 px-4 text-sm font-medium text-white">{item.category}</td>
                    <td className="py-2 px-4 text-right text-sm text-gray-400">{item.weight?.toFixed(1)}%</td>
                    <td className="py-2 px-4 text-right">
                      <span className={`text-sm font-medium flex items-center justify-end gap-1 ${item.yoy_change >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {item.yoy_change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {item.yoy_change?.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right text-sm text-blue-400">{item.contribution?.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expectations */}
        {data?.expectations && (
          <div className="col-span-12">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-3">Inflation Expectations (Breakeven Rates)</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-gray-500 text-xs">5-Year Forward</div>
                  <div className="text-2xl font-bold text-white">{data.expectations['5y_breakeven']?.toFixed(2) || '-'}%</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">10-Year Forward</div>
                  <div className="text-2xl font-bold text-white">{data.expectations['10y_breakeven']?.toFixed(2) || '-'}%</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
