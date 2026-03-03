/**
 * Macro Commodities Tab - CommonTable design
 * API: /macro/fred/series
 */
import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { API_BASE } from '../../config/api';
import CommonTable from '../common/CommonTable';

const COLUMNS = [
  {
    key: 'name',
    header: 'Series',
    renderFn: (value, row) => (
      <div>
        <div className="text-white font-medium">{value}</div>
        {row.series_id && <div className="text-[10px] text-gray-500">{row.series_id}</div>}
      </div>
    ),
  },
  {
    key: 'category',
    header: 'Category',
    renderFn: (value) => <span className="text-gray-400">{value || '-'}</span>,
  },
  {
    key: 'value',
    header: 'Value',
    align: 'right',
    sortable: true,
    formatter: 'magnitude',
    renderFn: (value) => (
      <span className="text-white tabular-nums font-medium">
        {value == null ? '-' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </span>
    ),
  },
  {
    key: 'change',
    header: 'Change',
    align: 'right',
    sortable: true,
    renderFn: (value) => {
      if (value == null) return <span className="text-gray-500">-</span>;
      const color = value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-400';
      return (
        <span className={`flex items-center justify-end gap-1 tabular-nums ${color}`}>
          {value > 0 && <TrendingUp size={12} />}
          {value < 0 && <TrendingDown size={12} />}
          {value > 0 ? '+' : ''}{Number(value).toFixed(2)}%
        </span>
      );
    },
  },
  {
    key: 'date',
    header: 'Date',
    align: 'right',
    formatter: 'date',
    renderFn: (value, row) => <span className="text-gray-400">{value || row.observation_date || '-'}</span>,
  },
];

export default function MacroCommoditiesTab() {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/fred/series`);
      if (res.ok) {
        const data = await res.json();
        setSeries(data.series || []);
      }
    } catch (error) {
      console.error('Error loading FRED series data:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    const catSet = new Set();
    series.forEach(s => { if (s.category) catSet.add(s.category); });
    const cats = [{ id: 'all', name: 'All' }];
    Array.from(catSet).sort().forEach(c => cats.push({ id: c, name: c }));
    return cats;
  }, [series]);

  const filteredSeries = useMemo(() =>
    activeCategory === 'all' ? series : series.filter(s => s.category === activeCategory),
  [series, activeCategory]);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-white">FRED Economic Series</h3>
          <span className="text-xs text-gray-500">{filteredSeries.length} series</span>
        </div>
        <button onClick={loadData} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {categories.length > 1 && (
        <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800 overflow-x-auto">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded transition-colors ${
                activeCategory === cat.id ? 'text-cyan-400 bg-cyan-400/10' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={20} className="animate-spin text-cyan-400" />
          </div>
        ) : (
          <CommonTable
            columns={COLUMNS}
            data={filteredSeries}
            searchable
            exportable
            compact
            pageSize={30}
          />
        )}
      </div>
    </div>
  );
}
