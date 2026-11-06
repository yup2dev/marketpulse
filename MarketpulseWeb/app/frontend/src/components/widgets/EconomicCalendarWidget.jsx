/**
 * EconomicCalendarWidget — 일자별 경제 이벤트 캘린더 위젯.
 * 데이터: /api/data/nasdaq/economic_calendar (라이브).
 * 필터(날짜·중요도·US only)는 BaseWidget FilterBar, 본문은 EconomicCalendarView.
 */
import { useState } from 'react';
import { Calendar, Flag } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import EconomicCalendarView from '../calendar/EconomicCalendarView';
import { isoDate, IMPACT_FILTERS } from '../calendar/calendarUtils';
import { DateStepper, SegmentedControl, ChipToggle, FilterDivider } from './ui';

export default function EconomicCalendarWidget({ onRemove }) {
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [impact, setImpact] = useState('all');
  const [usOnly, setUsOnly] = useState(false);

  return (
    <BaseWidget
      source="nasdaq"
      title="Economic Calendar"
      icon={Calendar}
      onRemove={onRemove}
      showPeriodSelector={false}
      filters={{
        left: (
          <>
            <DateStepper value={date} onChange={setDate} />
            <FilterDivider />
            <SegmentedControl value={impact} options={IMPACT_FILTERS} onChange={setImpact} ariaLabel="Impact" />
          </>
        ),
        right: <ChipToggle active={usOnly} onChange={setUsOnly} icon={Flag}>US only</ChipToggle>,
      }}
    >
      <EconomicCalendarView date={date} impact={impact} usOnly={usOnly} compact />
    </BaseWidget>
  );
}
