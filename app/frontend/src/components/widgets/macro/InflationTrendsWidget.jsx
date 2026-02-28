/**
 * Inflation Trends Widget - Historical CPI sector trends with multi-select
 * YieldTrends-style: sector chips + period selector + multi-line chart
 * API: /macro/inflation/sector-history
 */
import { useState, useEffect, useCallback } from 'react';
import { TrendingUp } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import LWChart from '../common/LWChart';
import { API_BASE } from '../../../config/api';

const FALLBACK_SECTORS = [
  { key: 'headline', name: 'Headline CPI', color: '#6366f1' },
  { key: 'core',     name: 'Core CPI',     color: '#06b6d4' },
  { key: 'food',     name: 'Food',         color: '#f59e0b' },
  { key: 'energy',   name: 'Energy',       color: '#ef4444' },
  { key: 'shelter',  name: 'Shelter',      color: '#8b5cf6' },
  { key: 'medical',  name: 'Medical Care', color: '#10b981' },
  { key: 'apparel',  name: 'Apparel',      color: '#f97316' },
  { key: 'vehicles', name: 'New Vehicles', color: '#ec4899' },
];

const DEFAULT_SELECTED = ['headline', 'core', 'energy', 'shelter'];


export default function InflationTrendsWidget({ onRemove }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('chart');
  const [period, setPeriod] = useState('3y');
  const [selected, setSelected] = useState(DEFAULT_SELECTED);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/inflation/sector-history?period=${period}`);
      if (res.ok) setData(await res.json());
    } catch (error) {
      console.error('Error loading inflation sector history:', error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { loadData(); }, [loadData]);

  const sectors = data?.sectors || FALLBACK_SECTORS;

  const toggleSector = (key) => {
    setSelected(prev => {
      if (prev.includes(key)) {
        if (prev.length <= 1) return prev;
        return prev.filter(k => k !== key);
      }
      return [...prev, key];
    });
  };

  // Sector chips for headerExtra
  const sectorChips = (
    <div className="flex items-center gap-1 flex-wrap" onMouseDown={(e) => e.stopPropagation()}>
      {sectors.map(s => {
        const isActive = selected.includes(s.key);
        return (
          <button
            key={s.key}
            onClick={() => toggleSector(s.key)}
            className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${
              isActive
                ? 'text-white border'
                : 'text-gray-500 bg-gray-800/50 hover:text-gray-300'
            }`}
            style={isActive ? { backgroundColor: `${s.color}20`, borderColor: `${s.color}50`, color: s.color } : {}}
            title={s.name}
          >
            {s.key === 'headline' ? 'CPI' : s.key === 'core' ? 'Core' : s.name}
          </button>
        );
      })}
    </div>
  );

  const renderChart = () => {
    if (!data?.history) return null;
    const history = data.history.filter(d => d.date);
    const multiSeries = selected
      .map(key => {
        const s = sectors.find(sec => sec.key === key);
        if (!s) return null;
        return {
          name: s.name,
          data: history.filter(d => d[key] != null).map(d => ({ time: d.date, value: d[key] })),
          type: 'line',
          color: s.color,
          lineWidth: key === 'headline' || key === 'core' ? 2 : 1.5,
        };
      })
      .filter(Boolean);
    return (
      <LWChart
        multiSeries={multiSeries}
        referenceLine={2}
        formatter={v => `${v.toFixed(2)}%`}
      />
    );
  };

  const renderTable = () => {
    if (!data?.history) return null;
    const recentData = [...data.history].reverse().slice(0, 30);
    return (
      <div className="overflow-auto h-full">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0d0d12]">
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 px-3 text-gray-400 font-medium">Date</th>
              {selected.map(key => {
                const s = sectors.find(sec => sec.key === key);
                return (
                  <th key={key} className="text-right py-2 px-3 font-medium" style={{ color: s?.color || '#6b7280' }}>
                    {s?.name || key}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {recentData.map((row, idx) => (
              <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-2 px-3 text-gray-300">{row.date}</td>
                {selected.map(key => {
                  const val = row[key];
                  return (
                    <td key={key} className={`py-2 px-3 text-right tabular-nums ${
                      val != null ? (val >= 3 ? 'text-red-400' : val >= 2 ? 'text-yellow-400' : 'text-green-400') : 'text-gray-500'
                    }`}>
                      {val != null ? `${val.toFixed(2)}%` : '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const getExportData = () => {
    const activeSectors = sectors.filter(s => selected.includes(s.key));
    return {
      columns: [
        { key: 'date', header: 'Date' },
        ...activeSectors.map(s => ({
          key: s.key,
          header: `${s.name} (%)`,
          exportValue: r => r[s.key]?.toFixed(2) ?? '',
        })),
      ],
      rows: data?.history || [],
    };
  };

  return (
    <BaseWidget
      title="Inflation Trends"
      subtitle="CPI Sector YoY"
      icon={TrendingUp}
      iconColor="text-orange-400"
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      period={period}
      onPeriodChange={setPeriod}
      periodType="macro"
      headerExtra={sectorChips}
      source="FRED / BLS"
      exportData={data?.history?.length ? getExportData : undefined}
    >
      <div className="h-full p-3">
        {viewMode === 'chart' ? (
          <div className="h-full">{renderChart()}</div>
        ) : (
          renderTable()
        )}
      </div>
    </BaseWidget>
  );
}
