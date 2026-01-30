/**
 * Macro Commodities Tab - WidgetDashboard 기반 동적 레이아웃
 * 원자재 데이터는 복잡한 내부 상태를 가지므로 단일 위젯으로 처리
 */
import { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, RefreshCw, GripVertical } from 'lucide-react';
import WidgetDashboard from '../WidgetDashboard';
import { API_BASE } from '../../config/api';

// Commodities 위젯 컴포넌트
function CommoditiesWidget({ onRemove }) {
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
      <div className="bg-[#0d0d12] rounded-lg border border-gray-800 h-full flex items-center justify-center">
        <RefreshCw className="animate-spin text-cyan-500" size={32} />
      </div>
    );
  }

  return (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="drag-handle-area cursor-move p-1 hover:bg-gray-700 rounded">
            <GripVertical size={14} className="text-gray-500" />
          </div>
          <h3 className="text-sm font-semibold text-white">원자재</h3>
        </div>
        <button onClick={fetchCommoditiesData} className="text-gray-400 hover:text-white">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {Object.entries(groupedSeries).map(([category, series]) => (
          <div key={category} className="bg-gray-800/30 rounded-lg border border-gray-700/50">
            <div className="p-3 border-b border-gray-700/50">
              <h4 className="text-sm font-medium text-white">
                {categoryLabels[category] || category}
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-700/50">
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium text-right">Value</th>
                    <th className="px-3 py-2 font-medium text-right">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((item) => (
                    <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-3 py-2 font-medium text-white">{item.name}</td>
                      <td className="px-3 py-2 text-right text-white">
                        {item.value !== undefined ? item.value.toLocaleString() : '-'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {item.change !== undefined ? (
                          <div className={`flex items-center justify-end gap-1 ${
                            item.change >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {item.change >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                            {Math.abs(item.change).toFixed(2)}%
                          </div>
                        ) : '-'}
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
          <div className="bg-gray-800/30 rounded-lg border border-gray-700/50">
            <div className="p-3 border-b border-gray-700/50">
              <h4 className="text-sm font-medium text-white">Commodity Ratios</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-700/50">
                    <th className="px-3 py-2 font-medium">Ratio</th>
                    <th className="px-3 py-2 font-medium text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(commodityRatios).map(([key, ratio]) => (
                    <tr key={key} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-3 py-2 font-medium text-white">{ratio.name || key}</td>
                      <td className="px-3 py-2 text-right text-white">
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
          <div className="text-center py-8 text-gray-400">
            No commodities data available
          </div>
        )}
      </div>
    </div>
  );
}

// WidgetDashboard의 renderWidget에서 사용할 수 있도록 export
export { CommoditiesWidget };

// 사용 가능한 위젯 목록
const AVAILABLE_WIDGETS = [
  { id: 'commodities', name: '원자재', description: '원자재 가격 및 비율', defaultSize: { w: 12, h: 12 } },
];

// 기본 위젯 구성
const DEFAULT_WIDGETS = [
  { id: 'commodities-1', type: 'commodities' },
];

// 기본 레이아웃
const DEFAULT_LAYOUT = [
  { i: 'commodities-1', x: 0, y: 0, w: 12, h: 12, minW: 6, minH: 8 },
];

export default function MacroCommoditiesTab() {
  return (
    <WidgetDashboard
      dashboardId="macro-commodities-dashboard"
      title="원자재"
      subtitle="글로벌 원자재 가격"
      availableWidgets={AVAILABLE_WIDGETS}
      defaultWidgets={DEFAULT_WIDGETS}
      defaultLayout={DEFAULT_LAYOUT}
    />
  );
}
