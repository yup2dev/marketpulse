/**
 * EarningsCalendarWidget — 일자별 실적 발표 캘린더 위젯.
 * 데이터: /api/data/nasdaq/earnings_calendar (라이브).
 * 본문은 캘린더 페이지와 공유하는 EarningsCalendarView, 헤더에서 일자 이동.
 */
import { useState, useMemo } from 'react';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import EarningsCalendarView from '../calendar/EarningsCalendarView';
import { isoDate, addDays } from '../calendar/calendarUtils';

export default function EarningsCalendarWidget({ onRemove }) {
  const todayIso = useMemo(() => isoDate(new Date()), []);
  const [date, setDate] = useState(todayIso);

  const shift = (n) => setDate((d) => isoDate(addDays(new Date(d), n)));

  return (
    <BaseWidget
      title="Earnings Calendar"
      icon={BarChart3}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
    >
      <div className="flex flex-col h-full min-h-0">
        {/* 일자 네비게이션 */}
        <div className="flex items-center gap-1 px-3 pt-2 flex-shrink-0">
          <button onClick={() => shift(-1)} className="p-1 text-gray-500 hover:text-gray-200 rounded hover:bg-gray-800" title="전날">
            <ChevronLeft size={13} />
          </button>
          <button
            onClick={() => setDate(todayIso)}
            className={`text-[10px] px-2 py-0.5 rounded ${
              date === todayIso ? 'bg-cyan-900/50 text-cyan-300' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            오늘
          </button>
          <button onClick={() => shift(1)} className="p-1 text-gray-500 hover:text-gray-200 rounded hover:bg-gray-800" title="다음날">
            <ChevronRight size={13} />
          </button>
          <span className="text-[10px] text-gray-500 ml-1">{date}</span>
        </div>
        <div className="flex-1 min-h-0">
          <EarningsCalendarView date={date} compact />
        </div>
      </div>
    </BaseWidget>
  );
}
