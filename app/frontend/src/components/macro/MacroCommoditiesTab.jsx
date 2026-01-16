/**
 * Macro 원자재 탭
 */
import { useState, useEffect } from 'react';
import { Globe, TrendingUp, TrendingDown } from 'lucide-react';
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

  // Filter commodity series
  const commoditySeries = fredSeries.filter(s =>
    ['precious_metals', 'energy', 'industrial_metals'].includes(s.category)
  );

  const categoryLabels = {
    precious_metals: '귀금속',
    energy: '에너지',
    industrial_metals: '산업 금속'
  };

  const groupedSeries = commoditySeries.reduce((acc, series) => {
    const cat = series.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(series);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Globe className="text-green-500" size={28} />
          <div>
            <h2 className="text-xl font-bold text-white">원자재</h2>
            <p className="text-gray-400 text-sm mt-0.5">귀금속, 에너지, 산업 금속 가격 동향</p>
          </div>
        </div>

        {/* Commodity Categories */}
        {Object.entries(groupedSeries).map(([category, series]) => (
          <div key={category} className="space-y-4">
            <h3 className="text-lg font-semibold text-white">
              {categoryLabels[category] || category}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {series.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#1a1f2e] rounded-xl border border-gray-700 p-4 hover:border-green-500/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-white">{item.name}</h4>
                      <p className="text-xs text-gray-500">{item.id}</p>
                    </div>
                    {item.change !== undefined && (
                      <div className={`flex items-center gap-1 text-sm ${
                        item.change >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {item.change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {Math.abs(item.change).toFixed(2)}%
                      </div>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {item.value !== undefined ? item.value.toLocaleString() : '-'}
                  </div>
                  {item.date && (
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(item.date).toLocaleDateString('ko-KR')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Commodity Ratios */}
        {Object.keys(commodityRatios).length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">원자재 비율</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(commodityRatios).map(([key, ratio]) => (
                <div
                  key={key}
                  className="bg-[#1a1f2e] rounded-xl border border-gray-700 p-4"
                >
                  <h4 className="font-medium text-white mb-2">{ratio.name || key}</h4>
                  <div className="text-2xl font-bold text-white">
                    {ratio.value?.toFixed(4) || '-'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {commoditySeries.length === 0 && (
          <div className="bg-[#1a1f2e] rounded-xl border border-gray-700 p-12 text-center">
            <Globe className="mx-auto text-gray-500 mb-4" size={48} />
            <p className="text-gray-400">원자재 데이터를 불러오는 중...</p>
          </div>
        )}
      </div>
    </div>
  );
}
