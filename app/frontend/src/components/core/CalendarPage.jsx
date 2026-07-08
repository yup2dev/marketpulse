/**
 * CalendarPage — 경제캘린더 / 실적캘린더 (StockNow 스타일).
 *
 * - 상단 날짜 스트립: 어제/오늘/내일 중심 D-3 ~ D+5, 클릭으로 일자 선택
 * - 탭: 경제캘린더(경제 이벤트 타임라인) / 실적캘린더(실적 발표 종목)
 * - 데이터: /api/data/nasdaq/* 라이브 조회 (하드코딩 없음)
 * - ?tab=economic|earnings 쿼리와 동기화 (헤더 메뉴 하위항목 진입 지원)
 */
import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, Globe, BarChart3 } from 'lucide-react';
import EconomicCalendarView from '../calendar/EconomicCalendarView';
import EarningsCalendarView from '../calendar/EarningsCalendarView';
import { isoDate, addDays, dayLabel } from '../calendar/calendarUtils';

const TABS = [
  { id: 'economic', label: '경제캘린더', icon: Globe },
  { id: 'earnings', label: '실적캘린더', icon: BarChart3 },
];

export default function CalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const todayIso = useMemo(() => isoDate(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(todayIso);

  const tabParam = searchParams.get('tab');
  const activeTab = TABS.some((t) => t.id === tabParam) ? tabParam : 'economic';
  const setActiveTab = (id) => setSearchParams({ tab: id }, { replace: true });

  // 날짜 스트립: D-3 ~ D+5
  const days = useMemo(() => {
    const base = new Date(todayIso);
    return Array.from({ length: 9 }, (_, i) => addDays(base, i - 3));
  }, [todayIso]);

  return (
    <div className="px-6 py-4 min-h-[calc(100vh-3.5rem-4rem)]">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className="text-cyan-400" size={18} />
        <h1 className="text-lg font-semibold text-white">Calendar</h1>
        <span className="text-[11px] text-gray-500 ml-2">
          경제지표 발표 · 실적 발표 일정 (Nasdaq 라이브 데이터)
        </span>
      </div>

      {/* 날짜 스트립 */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
        {days.map((d) => {
          const iso = isoDate(d);
          const active = iso === selectedDate;
          const isToday = iso === todayIso;
          return (
            <button
              key={iso}
              onClick={() => setSelectedDate(iso)}
              className={`flex flex-col items-center px-4 py-2 rounded-xl flex-shrink-0 transition-colors border ${
                active
                  ? 'bg-cyan-600 border-cyan-500 text-white'
                  : isToday
                    ? 'bg-[#0d0d12] border-cyan-800/60 text-cyan-300 hover:bg-gray-800/50'
                    : 'bg-[#0d0d12] border-gray-800 text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
              }`}
            >
              <span className="text-base font-semibold leading-tight">{d.getDate()}</span>
              <span className={`text-[10px] ${active ? 'text-cyan-100' : 'text-gray-500'}`}>
                {dayLabel(d, todayIso)}
              </span>
            </button>
          );
        })}
        <span className="text-[10px] text-gray-600 ml-2 flex-shrink-0">{selectedDate}</span>
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-1 mb-3 border-b border-gray-800">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? 'text-cyan-400 border-cyan-400'
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 콘텐츠 */}
      <div className="bg-[#0d0d12] rounded-lg border border-gray-800 min-h-[480px] flex flex-col">
        {activeTab === 'economic' ? (
          <EconomicCalendarView date={selectedDate} />
        ) : (
          <EarningsCalendarView date={selectedDate} />
        )}
      </div>
    </div>
  );
}
