/**
 * Macro Commodities Tab - Data-driven commodities dashboard
 */
import { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { API_BASE } from '../../config/api';

export default function MacroCommoditiesTab() {
  const [fredSeries, setFredSeries] = useState([]);
  const [commodityRatios, setCommodityRatios] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCommoditiesData();
  }, []);

  const fetchCommoditiesData = async () => {
    try {
      setLoading(true);
      const [seriesRes, ratiosRes] = await Promise.all([
        fetch(`${API_BASE}/macro/fred/series`),
        fetch(`${API_BASE}/macro/commodities/ratios`)
      ]);

      if (seriesRes.ok) {
        const data = await seriesRes.json();
        setFredSeries(data.series || []);
      }

      if (ratiosRes.ok) {
        const data = await ratiosRes.json();
        setCommodityRatios(data.ratios || {});
      }
    } catch (error) {
      console.error('Error fetching commodities data:', error);
    } finally {
      setLoading(false);
    }
  };

  const commoditySeries = fredSeries.filter(s =>
    ['precious_metals', 'energy', 'industrial_metals'].includes(s.category)
  );

  const categoryLabels = {
    precious_metals: 'Precious Metals',
    energy: 'Energy',
    industrial_metals: 'Industrial Metals'
  };

  const groupedSeries = commoditySeries.reduce((acc, series) => {
    const cat = series.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(series);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800 animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="h-8 bg-gray-700 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Commodity Categories */}
      {Object.entries(groupedSeries).map(([category, series]) => (
        <div key={category} className="bg-[#1a1a1a] rounded-lg border border-gray-800">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">
              {categoryLabels[category] || category}
            </h3>
            <button onClick={fetchCommoditiesData} className="text-gray-400 hover:text-white">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium text-right">Value</th>
                  <th className="px-4 py-3 font-medium text-right">Change</th>
                  <th className="px-4 py-3 font-medium text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {series.map((item) => (
                  <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3 font-medium text-white">{item.name}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{item.id}</td>
                    <td className="px-4 py-3 text-right text-white font-medium">
                      {item.value !== undefined ? item.value.toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.change !== undefined ? (
                        <div className={`flex items-center justify-end gap-1 ${
                          item.change >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {item.change >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                          {Math.abs(item.change).toFixed(2)}%
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 text-sm">
                      {item.date ? new Date(item.date).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Commodity Ratios */}
      {Object.keys(commodityRatios).length > 0 && (
        <div className="bg-[#1a1a1a] rounded-lg border border-gray-800">
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-lg font-semibold text-white">Commodity Ratios</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                  <th className="px-4 py-3 font-medium">Ratio</th>
                  <th className="px-4 py-3 font-medium text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(commodityRatios).map(([key, ratio]) => (
                  <tr key={key} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3 font-medium text-white">{ratio.name || key}</td>
                    <td className="px-4 py-3 text-right text-white font-medium">
                      {ratio.value?.toFixed(4) || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {commoditySeries.length === 0 && (
        <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-12 text-center">
          <p className="text-gray-400">No commodities data available</p>
        </div>
      )}
    </div>
  );
}
