import { useState, useEffect, useCallback } from 'react';
import { Calendar } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import { apiClient, API_BASE } from '../../config/api';

const IMPACT_STYLES = {
  high:   'bg-red-900/40 text-red-300 border-red-700',
  medium: 'bg-yellow-900/40 text-yellow-300 border-yellow-700',
  low:    'bg-gray-800 text-gray-400 border-gray-700',
};

const CATEGORY_COLORS = {
  Growth:           'text-blue-400',
  Employment:       'text-green-400',
  Inflation:        'text-red-400',
  Consumer:         'text-yellow-400',
  Sentiment:        'text-purple-400',
  Manufacturing:    'text-cyan-400',
  Services:         'text-emerald-400',
  'Monetary Policy':'text-orange-400',
  Housing:          'text-pink-400',
  Trade:            'text-indigo-400',
  Energy:           'text-amber-400',
};

export default function EconomicCalendarWidget({ onRemove }) {
  const [indicators, setIndicators] = useState([]);
  const [weekRange, setWeekRange] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`${API_BASE}/macro/economic-calendar`);
      setIndicators(res.indicators || []);
      if (res.week_start && res.week_end) {
        setWeekRange(`${fmtDate(res.week_start)} – ${fmtDate(res.week_end)}`);
      }
    } catch {
      setIndicators([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

  const categories = [...new Set(indicators.map((i) => i.category))].sort();
  const filtered = filter === 'all'
    ? indicators
    : filter === 'high'
    ? indicators.filter((i) => i.impact === 'high')
    : indicators.filter((i) => i.category === filter);

  return (
    <BaseWidget
      title="Economic Calendar"
      icon={Calendar}
      loading={loading}
      onRefresh={fetchCalendar}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
    >
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-2 px-3 pt-2 pb-1 flex-shrink-0 flex-wrap">
          <Calendar size={12} className="text-gray-500" />
          <span className="text-[10px] text-gray-400">{weekRange}</span>
          <div className="flex gap-1 ml-auto flex-wrap">
            <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterBtn>
            <FilterBtn active={filter === 'high'} onClick={() => setFilter('high')}>High Impact</FilterBtn>
            {categories.slice(0, 4).map((cat) => (
              <FilterBtn key={cat} active={filter === cat} onClick={() => setFilter(cat)}>{cat}</FilterBtn>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <div className="text-center text-gray-500 text-[11px] py-8">No indicators found</div>
          ) : (
            <div className="px-2 pb-2 space-y-1">
              {filtered.map((ind, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2 bg-[#0a0a0f] rounded hover:bg-gray-800/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-white">{ind.name}</span>
                      <span className={`text-[9px] ${CATEGORY_COLORS[ind.category] || 'text-gray-400'}`}>
                        {ind.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-gray-500">{ind.frequency}</span>
                      <span className="text-[9px] text-gray-600">·</span>
                      <span className="text-[9px] text-gray-500">{ind.source}</span>
                    </div>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${IMPACT_STYLES[ind.impact] || IMPACT_STYLES.low}`}>
                    {ind.impact}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}

function FilterBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`text-[9px] px-1.5 py-0.5 rounded ${
        active ? 'bg-cyan-900/50 text-cyan-300' : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      {children}
    </button>
  );
}

function fmtDate(iso) {
  if (!iso) return '';
  return iso.slice(0, 10);
}
