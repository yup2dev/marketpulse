/**
 * Macro Commodities Tab - Data-Focused Layout
 */
import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { API_BASE } from '../../config/api';

export default function MacroCommoditiesTab() {
  const [series, setSeries] = useState([]);
  const [ratios, setRatios] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [seriesRes, ratiosRes] = await Promise.all([
        fetch(`${API_BASE}/macro/fred/series`),
        fetch(`${API_BASE}/macro/commodities/ratios`)
      ]);
      if (seriesRes.ok) {
        const data = await seriesRes.json();
        setSeries(data.series || []);
      }
      if (ratiosRes.ok) {
        const data = await ratiosRes.json();
        setRatios(data.ratios || {});
      }
    } catch (error) {
      console.error('Error loading commodities data:', error);
    } finally {
      setLoading(false);
    }
  };

  const commoditySeries = series.filter(s =>
    ['precious_metals', 'energy', 'industrial_metals'].includes(s.category)
  );

  const categoryLabels = {
    precious_metals: 'Precious Metals',
    energy: 'Energy',
    industrial_metals: 'Industrial Metals'
  };

  const groupedSeries = commoditySeries.reduce((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const formatNumber = (value) => {
    if (value === null || value === undefined) return '-';
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Commodities</h3>
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
          {/* Summary Cards */}
          <div className="col-span-12">
            <div className="grid grid-cols-4 gap-4">
              {commoditySeries.slice(0, 4).map((item, idx) => (
                <div key={idx} className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
                  <div className="text-gray-400 text-xs mb-1">{item.name}</div>
                  <div className="text-2xl font-bold text-white">{formatNumber(item.value)}</div>
                  {item.change !== undefined && (
                    <div className={`flex items-center gap-1 text-sm mt-1 ${item.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {item.change >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                      {Math.abs(item.change).toFixed(2)}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Category Tables */}
          {Object.entries(groupedSeries).map(([category, items]) => (
            <div key={category} className="col-span-6">
              <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden">
                <div className="p-3 border-b border-gray-800">
                  <span className="text-gray-400 text-xs">{categoryLabels[category] || category}</span>
                </div>
                <table className="w-full">
                  <thead className="bg-[#0a0a0f]">
                    <tr className="text-[10px] text-gray-500">
                      <th className="py-2 px-4 text-left font-medium">Name</th>
                      <th className="py-2 px-4 text-right font-medium">Value</th>
                      <th className="py-2 px-4 text-right font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                        <td className="py-2 px-4 text-sm text-white">{item.name}</td>
                        <td className="py-2 px-4 text-right text-sm text-white">{formatNumber(item.value)}</td>
                        <td className="py-2 px-4 text-right">
                          {item.change !== undefined ? (
                            <span className={`text-sm flex items-center justify-end gap-1 ${item.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {item.change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                              {Math.abs(item.change).toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Commodity Ratios */}
          {Object.keys(ratios).length > 0 && (
            <div className="col-span-12">
              <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden">
                <div className="p-3 border-b border-gray-800">
                  <span className="text-gray-400 text-xs">Commodity Ratios</span>
                </div>
                <div className="grid grid-cols-12 gap-4 p-4">
                  {/* Ratios Table */}
                  <div className="col-span-6">
                    <table className="w-full">
                      <thead className="bg-[#0a0a0f]">
                        <tr className="text-[10px] text-gray-500">
                          <th className="py-2 px-4 text-left font-medium">Ratio</th>
                          <th className="py-2 px-4 text-right font-medium">Value</th>
                          <th className="py-2 px-4 text-right font-medium">Signal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(ratios).map(([key, ratio]) => (
                          <tr key={key} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                            <td className="py-2 px-4 text-sm text-white">{ratio.name || key}</td>
                            <td className="py-2 px-4 text-right text-sm text-white">{ratio.value?.toFixed(4) || '-'}</td>
                            <td className="py-2 px-4 text-right">
                              <span className={`text-xs px-2 py-0.5 rounded ${ratio.signal === 'bullish' ? 'bg-green-900/50 text-green-400' : ratio.signal === 'bearish' ? 'bg-red-900/50 text-red-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                                {ratio.signal || 'neutral'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Ratios Chart */}
                  <div className="col-span-6">
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={Object.entries(ratios).map(([key, ratio]) => ({ name: ratio.name || key, value: ratio.value || 0 }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis dataKey="name" stroke="#666" fontSize={9} angle={-15} textAnchor="end" height={60} />
                          <YAxis stroke="#666" fontSize={10} />
                          <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {Object.entries(ratios).map(([key, ratio], idx) => (
                              <Cell key={idx} fill={ratio.signal === 'bullish' ? '#22c55e' : ratio.signal === 'bearish' ? '#ef4444' : '#f59e0b'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Performance Chart */}
          <div className="col-span-12">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-3">Performance Comparison</div>
              {commoditySeries.length > 0 ? (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={commoditySeries.slice(0, 10).map(item => ({ name: item.name, change: item.change || 0 }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="name" stroke="#666" fontSize={9} angle={-15} textAnchor="end" height={60} />
                      <YAxis stroke="#666" fontSize={10} tickFormatter={(v) => `${v}%`} />
                      <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} formatter={(v) => `${v.toFixed(2)}%`} />
                      <Bar dataKey="change" radius={[4, 4, 0, 0]}>
                        {commoditySeries.slice(0, 10).map((item, idx) => (
                          <Cell key={idx} fill={(item.change || 0) >= 0 ? '#22c55e' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-500">No data available</div>
              )}
            </div>
          </div>

          {commoditySeries.length === 0 && (
            <div className="col-span-12 text-center py-8 text-gray-500">
              No commodities data available
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Export for WidgetDashboard compatibility
export function CommoditiesWidget(props) {
  return <MacroCommoditiesTab {...props} />;
}
