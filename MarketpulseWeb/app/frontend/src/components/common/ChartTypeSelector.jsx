/**
 * ChartTypeSelector — 차트형 아이콘 버튼 묶음 (차트 본문 안 툴바용).
 * 위젯 헤더에서는 쓰지 않는다 — 헤더는 BaseWidget 의 View 드롭다운 하나로 고른다.
 * 차트형 목록은 widgets/ui/views.js 가 단일 기준이다.
 */
import { CHART_TYPES } from '../widgets/ui/views';

/**
 * @param {string}   value     – currently active type id
 * @param {function} onChange  – called with new type id
 * @param {string[]} [types]   – allowed type ids (default: all 6)
 */
export default function ChartTypeSelector({ value, onChange, types }) {
  const options = types ? CHART_TYPES.filter((t) => types.includes(t.value)) : CHART_TYPES;

  return (
    <div className="flex items-center gap-0.5 bg-gray-800/60 rounded p-0.5">
      {options.map(({ value: id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          title={label}
          className={`p-1 rounded transition-colors ${
            value === id
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
          }`}
        >
          <Icon size={12} />
        </button>
      ))}
    </div>
  );
}
