/**
 * ChipToggle — 켜고 끄는 필터 칩. 여러 개를 동시에 켤 수 있는 필터에 쓴다
 * (예: 중요도 ★, 'US only'). 하나만 고르는 필터는 SegmentedControl.
 */
export default function ChipToggle({ active, onChange, children, title, icon: Icon }) {
  return (
    <button
      type="button"
      aria-pressed={!!active}
      title={title}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={() => onChange?.(!active)}
      className={`inline-flex items-center gap-1 h-6 px-2 rounded border text-[11px] whitespace-nowrap transition-colors ${
        active
          ? 'border-cyan-700 bg-cyan-900/30 text-cyan-300'
          : 'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
      }`}
    >
      {Icon && <Icon size={11} />}
      {children}
    </button>
  );
}
