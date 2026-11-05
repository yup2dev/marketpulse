/**
 * FilterBar — 헤더 바로 아래 한 줄짜리 필터 칸. 위젯 필터는 본문이 아니라 여기 둔다.
 * BaseWidget 의 `filters` prop 으로 넘기면 BaseWidget 이 그린다 (위젯이 직접 쓰지 않는다).
 *
 * filters: node | { left, right } — right 는 기준 시각·건수 같은 부가 정보
 */
export default function FilterBar({ filters }) {
  if (!filters) return null;
  const isSlots = typeof filters === 'object' && !Array.isArray(filters) && ('left' in filters || 'right' in filters);
  const left = isSlots ? filters.left : filters;
  const right = isSlots ? filters.right : null;
  return (
    <div
      className="flex items-center justify-between gap-2 px-3 py-1.5 border-b widget-border flex-shrink-0 min-w-0"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 flex-wrap min-w-0">{left}</div>
      {right && <div className="flex items-center gap-2 flex-shrink-0 text-[11px] text-gray-500">{right}</div>}
    </div>
  );
}

/** 필터 그룹 사이 구분선 */
export function FilterDivider() {
  return <span className="w-px h-4 bg-gray-700" aria-hidden="true" />;
}
