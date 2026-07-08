/**
 * EconomicCalendarView — 일자별 경제 이벤트 타임라인.
 * 데이터: /api/data/nasdaq/economic_calendar?date= (라이브, 하드코딩 없음)
 * CalendarPage 탭과 대시보드 위젯이 공유한다.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient, API_BASE } from '../../config/api';
import { IMPACT_STARS } from './calendarUtils';

const IMPACT_COLORS = {
  high:   'text-red-400',
  medium: 'text-yellow-400',
  low:    'text-gray-500',
};

const FILTERS = [
  { id: 'all',    label: '전체' },
  { id: 'high',   label: '★★★' },
  { id: 'medium', label: '★★ 이상' },
];

export default function EconomicCalendarView({ date, compact = false }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [impactFilter, setImpactFilter] = useState('all');
  const [usOnly, setUsOnly] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(
        `${API_BASE}/data/nasdaq/economic_calendar?date=${date}`
      );
      setEvents(res?.results || []);
    } catch (e) {
      setError(e.detail || e.message || '경제 이벤트를 불러오지 못했습니다');
      setEvents([]);
    }
    setLoading(false);
  }, [date]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const filtered = events.filter((ev) => {
    if (impactFilter === 'high' && ev.impact !== 'high') return false;
    if (impactFilter === 'medium' && ev.impact === 'low') return false;
    if (usOnly && !(ev.country || '').toLowerCase().includes('united states')) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 필터 바 */}
      <div className="flex items-center gap-1.5 px-3 py-2 flex-shrink-0 flex-wrap border-b border-gray-800">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setImpactFilter(f.id)}
            className={`text-[10px] px-2 py-1 rounded-full transition-colors ${
              impactFilter === f.id
                ? 'bg-cyan-900/50 text-cyan-300 border border-cyan-800/50'
                : 'text-gray-500 hover:text-gray-300 border border-gray-800'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={() => setUsOnly((v) => !v)}
          className={`text-[10px] px-2 py-1 rounded-full transition-colors ml-auto ${
            usOnly
              ? 'bg-blue-900/50 text-blue-300 border border-blue-800/50'
              : 'text-gray-500 hover:text-gray-300 border border-gray-800'
          }`}
        >
          🇺🇸 미국만
        </button>
      </div>

      {/* 이벤트 타임라인 */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="text-center text-gray-500 text-[11px] py-8">불러오는 중…</div>
        ) : error ? (
          <div className="text-center text-red-400 text-[11px] py-8">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-500 text-[11px] py-8">
            해당 조건의 경제 이벤트가 없습니다
          </div>
        ) : (
          <div className={`${compact ? 'px-2' : 'px-3'} py-2 space-y-1`}>
            {filtered.map((ev, i) => (
              <div
                key={i}
                className="flex items-start gap-3 px-3 py-2 bg-[#0a0a0f] rounded hover:bg-gray-800/30 transition-colors"
              >
                <div className="flex flex-col items-center flex-shrink-0 w-12">
                  <span className="text-[11px] font-medium text-gray-300">{ev.time || '—'}</span>
                  <span className={`text-[10px] ${IMPACT_COLORS[ev.impact] || 'text-gray-500'}`}>
                    {IMPACT_STARS[ev.impact] || '★'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-white truncate">{ev.event}</span>
                    {!compact && ev.country && (
                      <span className="text-[9px] text-gray-500 flex-shrink-0">{ev.country}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px]">
                    <span className={ev.actual ? 'text-cyan-300' : 'text-gray-500'}>
                      결과: {ev.actual || '발표예정'}
                    </span>
                    <span className="text-gray-500">예측: {ev.consensus || '-'}</span>
                    <span className="text-gray-500">이전: {ev.previous || '-'}</span>
                  </div>
                  {compact && ev.country && (
                    <div className="text-[9px] text-gray-600 mt-0.5">{ev.country}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
