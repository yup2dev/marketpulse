/**
 * EarningsCalendarView — 일자별 실적 발표 종목 리스트.
 * 데이터: /api/data/nasdaq/earnings_calendar?date= (라이브, 하드코딩 없음)
 * 소스가 발표 후 실제 EPS는 제공하지 않아 예상 EPS·전년 EPS·시총·발표시간 중심.
 * CalendarPage 탭과 대시보드 위젯이 공유한다.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient, API_BASE } from '../../config/api';
import { fmtMarketCap, fmtEps, TIME_LABELS } from './calendarUtils';

const SORTS = [
  { id: 'mcap', label: '시가총액순' },
  { id: 'eps',  label: '예상 EPS순' },
];

const TIME_BADGES = {
  'pre-market':  'bg-blue-900/40 text-blue-300 border-blue-800/50',
  'after-hours': 'bg-purple-900/40 text-purple-300 border-purple-800/50',
};

export default function EarningsCalendarView({ date, compact = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('mcap');

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(
        `${API_BASE}/data/nasdaq/earnings_calendar?date=${date}`
      );
      setRows(res?.results || []);
    } catch (e) {
      setError(e.detail || e.message || '실적 일정을 불러오지 못했습니다');
      setRows([]);
    }
    setLoading(false);
  }, [date]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const sorted = [...rows].sort((a, b) =>
    sort === 'eps'
      ? (b.eps_forecast ?? -Infinity) - (a.eps_forecast ?? -Infinity)
      : (b.market_cap ?? 0) - (a.market_cap ?? 0)
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 정렬 바 */}
      <div className="flex items-center gap-1.5 px-3 py-2 flex-shrink-0 border-b border-gray-800">
        {SORTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSort(s.id)}
            className={`text-[10px] px-2 py-1 rounded-full transition-colors ${
              sort === s.id
                ? 'bg-cyan-900/50 text-cyan-300 border border-cyan-800/50'
                : 'text-gray-500 hover:text-gray-300 border border-gray-800'
            }`}
          >
            {s.label}
          </button>
        ))}
        <span className="text-[10px] text-gray-600 ml-auto">{rows.length}개 종목</span>
      </div>

      {/* 종목 리스트 */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="text-center text-gray-500 text-[11px] py-8">불러오는 중…</div>
        ) : error ? (
          <div className="text-center text-red-400 text-[11px] py-8">{error}</div>
        ) : sorted.length === 0 ? (
          <div className="text-center text-gray-500 text-[11px] py-8">
            해당 일자에 예정된 실적 발표가 없습니다
          </div>
        ) : (
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
                  <span className="text-[9px] text-gray-600">시가총액</span>
                  <span className="text-[11px] text-gray-300">{fmtMarketCap(r.market_cap)}</span>
                </div>
                <div className="flex flex-col items-end flex-shrink-0 w-20">
                  <span className="text-[9px] text-gray-600">예상 EPS</span>
                  <span className={`text-[11px] font-medium ${
                    r.eps_forecast == null ? 'text-gray-500'
                      : r.eps_forecast >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {fmtEps(r.eps_forecast)}
                  </span>
                </div>
                {!compact && (
                  <div className="flex flex-col items-end flex-shrink-0 w-20">
                    <span className="text-[9px] text-gray-600">전년 EPS</span>
                    <span className="text-[11px] text-gray-400">{fmtEps(r.last_year_eps)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
