/**
 * Macro Commodities Tab - Terminal/WidgetTable design
 * API: /macro/fred/series (categories: Banking, Credit, Money Supply, Interest Rates, Trade, Real Estate)
 */
import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { API_BASE } from '../../config/api';
import WidgetTable from '../widgets/common/WidgetTable';

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

  // Build categories from actual API data
  const categories = useMemo(() => {
    const catSet = new Set();
    series.forEach(s => { if (s.category) catSet.add(s.category); });
    const cats = [{ id: 'all', name: 'All' }];
    Array.from(catSet).sort().forEach(c => {
      cats.push({ id: c, name: c });
    });
    return cats;
  }, [series]);

  // Filter series by category
  const filteredSeries = useMemo(() => {
    const filtered = activeCategory === 'all'
      ? series
      : series.filter(s => s.category === activeCategory);
    return filtered.map((s, idx) => ({
      ...s,
      _key: `${s.series_id || s.name || idx}`,
    }));
  }, [series, activeCategory]);

  const formatNumber = (value) => {
    if (value === null || value === undefined) return '-';
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const columns = useMemo(() => [
    {
      key: 'name',
      header: 'Series',
      minWidth: '250px',
      sortable: true,
      sortValue: (row) => row.name?.toLowerCase(),
      render: (row) => (
        <div>
          <div className="text-white font-medium">{row.name}</div>
          {row.series_id && <div className="text-[10px] text-gray-500">{row.series_id}</div>}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      minWidth: '120px',
      sortable: true,
      sortValue: (row) => row.category,
      render: (row) => <span className="text-gray-400">{row.category || '-'}</span>,
    },
    {
      key: 'value',
      header: 'Value',
      align: 'right',
      minWidth: '120px',
      sortable: true,
      sortValue: (row) => row.value,
      render: (row) => <span className="text-white tabular-nums font-medium">{formatNumber(row.value)}</span>,
    },
    {
      key: 'change',
      header: 'Change',
      align: 'right',
      minWidth: '100px',
      sortable: true,
      sortValue: (row) => row.change,
      render: (row) => {
        if (row.change == null) return <span className="text-gray-500">-</span>;
        const color = row.change > 0 ? 'text-green-400' : row.change < 0 ? 'text-red-400' : 'text-gray-400';
        return (
          <span className={`flex items-center justify-end gap-1 tabular-nums ${color}`}>
            {row.change > 0 && <TrendingUp size={12} />}
            {row.change < 0 && <TrendingDown size={12} />}
            {row.change > 0 ? '+' : ''}{row.change.toFixed(2)}%
          </span>
        );
      },
    },
    {
      key: 'date',
      header: 'Date',
      align: 'right',
      minWidth: '100px',
      sortable: true,
      sortValue: (row) => row.date || row.observation_date,
      render: (row) => <span className="text-gray-400">{row.date || row.observation_date || '-'}</span>,
    },
  ], []);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-white">FRED Economic Series</h3>
          <span className="text-xs text-gray-500">{filteredSeries.length} series</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Category tabs */}
      {categories.length > 1 && (
        <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800 overflow-x-auto">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded transition-colors ${
                activeCategory === cat.id
                  ? 'text-cyan-400 bg-cyan-400/10'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={20} className="animate-spin text-cyan-400" />
          </div>
        ) : (
          <WidgetTable
            columns={columns}
            data={filteredSeries}
            size="compact"
            showRowNumbers
            emptyMessage="No series data available"
            stickyHeader
            resizable
            defaultSortKey="value"
            defaultSortDirection="desc"
          />
        )}
      </div>
    </div>
  );
}
