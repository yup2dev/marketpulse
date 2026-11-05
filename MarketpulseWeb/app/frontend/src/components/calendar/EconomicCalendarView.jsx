/**
 * EconomicCalendarView — 일자별 경제 이벤트 타임라인 (목록만 그린다).
 * 데이터: /api/data/nasdaq/economic_calendar?date= (라이브, 하드코딩 없음)
 *
 * 필터(중요도·US only)는 위젯이 FilterBar 에 그리고 값만 넘긴다 — 이 컴포넌트는 필터 UI 를 갖지 않는다.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient, API_BASE } from '../../config/api';
import { WidgetState, stateFromError } from '../widgets/ui';
import { IMPACT_STARS } from './calendarUtils';

const IMPACT_COLORS = {
  high:   'text-red-400',
  medium: 'text-yellow-400',
  low:    'text-gray-500',
};

export default function EconomicCalendarView({ date, impact = 'all', usOnly = false, compact = false }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`${API_BASE}/data/nasdaq/economic_calendar?date=${date}`);
      setEvents(res?.results || []);
    } catch (e) {
      setError(stateFromError(e));
      setEvents([]);
    }
    setLoading(false);
  }, [date]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const filtered = events.filter((ev) => {
    if (impact === 'high' && ev.impact !== 'high') return false;
    if (impact === 'medium' && ev.impact === 'low') return false;
    if (usOnly && !(ev.country || '').toLowerCase().includes('united states')) return false;
    return true;
  });

  if (loading) return <WidgetState kind="loading" />;
  if (error) return <WidgetState {...error} onRetry={fetchEvents} />;
  if (filtered.length === 0) {
    return <WidgetState kind="empty" title="No events" message="No economic events match this date and filter." />;
  }

  return (
    <div className="h-full overflow-auto">
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
                  Actual: {ev.actual || 'Pending'}
                </span>
                <span className="text-gray-500">Forecast: {ev.consensus || '-'}</span>
                <span className="text-gray-500">Previous: {ev.previous || '-'}</span>
              </div>
              {compact && ev.country && (
                <div className="text-[9px] text-gray-600 mt-0.5">{ev.country}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
