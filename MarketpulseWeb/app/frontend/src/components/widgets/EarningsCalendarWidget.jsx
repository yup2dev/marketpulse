/**
 * EarningsCalendarWidget — 일자별 실적 발표 캘린더 위젯.
 * 데이터: /api/data/nasdaq/earnings_calendar (라이브).
 * 필터(날짜·정렬)는 BaseWidget FilterBar, 본문은 EarningsCalendarView.
 */
import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import EarningsCalendarView from '../calendar/EarningsCalendarView';
import { isoDate, EARNINGS_SORTS } from '../calendar/calendarUtils';
import { DateStepper, SegmentedControl, FilterDivider } from './ui';

export default function EarningsCalendarWidget({ onRemove }) {
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [sort, setSort] = useState('mcap');
  const [count, setCount] = useState(null);

  return (
    <BaseWidget
      source="nasdaq"
      title="Earnings Calendar"
      icon={BarChart3}
      onRemove={onRemove}
      showPeriodSelector={false}
      filters={{
        left: (
          <>
            <DateStepper value={date} onChange={setDate} />
            <FilterDivider />
            <SegmentedControl value={sort} options={EARNINGS_SORTS} onChange={setSort} ariaLabel="Sort" />
          </>
        ),
        right: count != null ? `${count} companies` : null,
      }}
    >
      <EarningsCalendarView date={date} sort={sort} compact onCount={setCount} />
    </BaseWidget>
  );
}
