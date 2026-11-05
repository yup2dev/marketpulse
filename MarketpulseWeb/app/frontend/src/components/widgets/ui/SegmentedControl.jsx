/**
 * SegmentedControl — 옵션 2~7개 중 하나를 고르는 필터 (시장·기간·보기 탭 등).
 * 위젯마다 따로 그리던 pill / 밑줄 탭 / 테두리 버튼을 이걸로 통일한다.
 *
 * options: [{ value, label, icon?, title? }] 또는 문자열 배열
 */
import { normalizeOptions } from './helpers';

export default function SegmentedControl({ value, options, onChange, size = 'sm', ariaLabel }) {
  const opts = normalizeOptions(options);
  const h = size === 'md' ? 'h-7 px-2.5 text-xs' : 'h-6 px-2 text-[11px]';
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 bg-gray-800/60 rounded p-0.5"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {opts.map((o) => {
        const active = String(o.value) === String(value);
        const Icon = o.icon;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title || (Icon ? o.label : undefined)}
            onClick={() => onChange?.(o.value)}
            className={`${h} inline-flex items-center gap-1 rounded whitespace-nowrap transition-colors ${
              active ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {Icon && <Icon size={11} />}
            {(!Icon || !o.iconOnly) && <span>{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
