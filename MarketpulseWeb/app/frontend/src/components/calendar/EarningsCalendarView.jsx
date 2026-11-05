/**
 * EarningsCalendarView — 일자별 실적 발표 종목 리스트 (목록만 그린다).
 * 데이터: /api/data/nasdaq/earnings_calendar?date= (라이브, 하드코딩 없음)
 * 소스가 발표 후 실제 EPS는 제공하지 않아 예상 EPS·전년 EPS·시총·발표시간 중심.
 *
 * 정렬은 위젯이 FilterBar 에 그리고 값만 넘긴다. 건수는 onCount 로 알린다.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient, API_BASE } from '../../config/api';
import { WidgetState, stateFromError } from '../widgets/ui';
import { fmtMarketCap, fmtEps, TIME_LABELS } from './calendarUtils';

const TIME_BADGES = {
  'pre-market':  'bg-blue-900/40 text-blue-300 border-blue-800/50',
  'after-hours': 'bg-purple-900/40 text-purple-300 border-purple-800/50',
};

export default function EarningsCalendarView({ date, sort = 'mcap', compact = false, onCount }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`${API_BASE}/data/nasdaq/earnings_calendar?date=${date}`);
      setRows(res?.results || []);
    } catch (e) {
      setError(stateFromError(e));
      setRows([]);
    }
    setLoading(false);
  }, [date]);

  useEffect(() => { fetchRows(); }, [fetchRows]);
  useEffect(() => { onCount?.(loading ? null : rows.length); }, [rows, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = [...rows].sort((a, b) =>
    sort === 'eps'
      ? (b.eps_forecast ?? -Infinity) - (a.eps_forecast ?? -Infinity)
      : (b.market_cap ?? 0) - (a.market_cap ?? 0)
  );

  if (loading) return <WidgetState kind="loading" />;
  if (error) return <WidgetState {...error} onRetry={fetchRows} />;
  if (sorted.length === 0) {
    return <WidgetState kind="empty" title="No earnings" message="No earnings reports are scheduled for this date." />;
  }

  return (
    <div className="h-full overflow-auto">
      <div className={`${compact ? 'px-2' : 'px-3'} py-2 space-y-1`}>
        {sorted.map((r) => (
          <div
            key={r.symbol}
            className="flex items-center gap-3 px-3 py-2 bg-[#0a0a0f] rounded hover:bg-gray-800/30 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-cyan-400">{r.symbol}</span>
                {r.time && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border flex-shrink-0 ${TIME_BADGES[r.time] || ''}`}>
                    {TIME_LABELS[r.time] || r.time}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-gray-500 truncate mt-0.5">
                {r.name}
                {!compact && r.fiscal_quarter_ending && (
                  <span className="text-gray-600"> · FQ {r.fiscal_quarter_ending}</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end flex-shrink-0 w-20">
              <span className="text-[9px] text-gray-600">Market cap</span>
              <span className="text-[11px] text-gray-300">{fmtMarketCap(r.market_cap)}</span>
            </div>
            <div className="flex flex-col items-end flex-shrink-0 w-20">
              <span className="text-[9px] text-gray-600">EPS forecast</span>
              <span className={`text-[11px] font-medium ${
                r.eps_forecast == null ? 'text-gray-500'
                  : r.eps_forecast >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {fmtEps(r.eps_forecast)}
              </span>
            </div>
            {!compact && (
              <div className="flex flex-col items-end flex-shrink-0 w-20">
                <span className="text-[9px] text-gray-600">Last year EPS</span>
                <span className="text-[11px] text-gray-400">{fmtEps(r.last_year_eps)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
