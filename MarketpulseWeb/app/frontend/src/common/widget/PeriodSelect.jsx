/**
 * PeriodSelect — 기간 선택. 헤더에서는 드롭다운, 본문 FilterBar 에서는 세그먼트로 쓴다.
 * 옵션은 periods.js 의 프리셋 이름이나 id 배열로 받는다 — 목록을 위젯에 직접 적지 않는다.
 */
import { CalendarRange } from 'lucide-react';
import Select from './Select';
import SegmentedControl from './SegmentedControl';
import { periodOptions } from './periods';

export default function PeriodSelect({ value, onChange, preset = 'macro', variant = 'select', title = 'Period' }) {
  const opts = periodOptions(preset).map((p) => ({ value: p.id, label: p.label }));
  if (variant === 'segmented') {
    return <SegmentedControl value={value} options={opts} onChange={onChange} ariaLabel={title} />;
  }
  return (
    <Select value={value} options={opts} onChange={onChange} icon={CalendarRange} title={title} menuWidth="min-w-[72px]" />
  );
}
