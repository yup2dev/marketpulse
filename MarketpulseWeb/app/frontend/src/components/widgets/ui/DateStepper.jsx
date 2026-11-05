/**
 * DateStepper — 하루씩 넘기는 날짜 선택 (◀ Today ▶ 2026-11-05).
 * 일자 단위 위젯(경제·실적 캘린더 등)이 FilterBar 에서 같이 쓴다.
 *
 * value: 'YYYY-MM-DD' (로컬 날짜)
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';

function toIso(d) {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}

function shiftIso(iso, days) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

const STEP_CLS = 'h-6 w-6 inline-flex items-center justify-center rounded text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors';

export default function DateStepper({ value, onChange }) {
  const today = toIso(new Date());
  const isToday = value === today;
  return (
    <div className="inline-flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => onChange(shiftIso(value, -1))} className={STEP_CLS} title="Previous day" aria-label="Previous day">
        <ChevronLeft size={13} />
      </button>
      <button
        type="button"
        onClick={() => onChange(today)}
        aria-pressed={isToday}
        className={`h-6 px-2 rounded text-[11px] transition-colors ${
          isToday ? 'bg-gray-700 text-white' : 'bg-gray-800/60 text-gray-400 hover:text-gray-200'
        }`}
      >
        Today
      </button>
      <button type="button" onClick={() => onChange(shiftIso(value, 1))} className={STEP_CLS} title="Next day" aria-label="Next day">
        <ChevronRight size={13} />
      </button>
      <span className="text-[11px] text-gray-400 tabular-nums ml-1">{value}</span>
    </div>
  );
}
