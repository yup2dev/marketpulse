/**
 * Select — 위젯 안의 모든 드롭다운 (provider·기간·보기·파라미터 select).
 * 브라우저 기본 <select> 는 테마를 따르지 않으므로 위젯 안에서는 이걸 쓴다.
 *
 * options: [{ value, label, icon?, note?, disabled? }] 또는 문자열 배열
 *   note — 항목 오른쪽 보조 문구 (예: provider 의 'Key needed')
 * size: 'sm'(헤더, 기본) | 'md'(폼 안, 전체 폭)
 */
import { Check, ChevronDown } from 'lucide-react';
import Popover from './Popover';
import { normalizeOptions, usePopover } from './helpers';

const TRIGGER_SM =
  'flex items-center gap-1 h-6 px-2 bg-gray-800 hover:bg-gray-700 rounded text-[11px] text-gray-300 transition-colors whitespace-nowrap';
const TRIGGER_MD =
  'flex items-center justify-between gap-2 w-full h-8 px-2 bg-[#0a0a0f] border border-gray-800 hover:border-gray-700 rounded text-xs text-gray-200 transition-colors';

export default function Select({
  value,
  options,
  onChange,
  icon: Icon,
  title,
  size = 'sm',
  align = 'right',
  placeholder = 'Select',
  renderValue,          // (option) => node — 버튼에 보일 내용을 바꿀 때
  menuWidth = 'min-w-[140px]',
  id,
}) {
  const pop = usePopover();
  const opts = normalizeOptions(options);
  const current = opts.find((o) => String(o.value) === String(value));
  const shown = current ? (renderValue ? renderValue(current) : current.label) : (value || placeholder);
  const CurIcon = current?.icon || Icon;

  const trigger = (
    <button
      type="button"
      id={id}
      onClick={pop.toggle}
      className={size === 'md' ? TRIGGER_MD : TRIGGER_SM}
      title={title}
      aria-haspopup="listbox"
      aria-expanded={pop.open}
    >
      <span className="flex items-center gap-1 min-w-0">
        {CurIcon && <CurIcon size={size === 'md' ? 12 : 11} className="text-gray-500 flex-shrink-0" />}
        <span className={`truncate ${size === 'md' ? '' : 'max-w-[110px]'}`}>{shown}</span>
      </span>
      <ChevronDown size={10} className="flex-shrink-0 text-gray-500" />
    </button>
  );

  return (
    <Popover popover={pop} trigger={trigger} align={align} className={`py-1 ${size === 'md' ? 'w-full' : menuWidth} max-h-72 overflow-y-auto`}>
      <ul role="listbox">
        {opts.map((o) => {
          const active = String(o.value) === String(value);
          const OIcon = o.icon;
          return (
            <li key={String(o.value)}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                disabled={o.disabled}
                onClick={() => { onChange?.(o.value); pop.close(); }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-gray-800 disabled:opacity-40 ${
                  active ? 'text-cyan-400' : 'text-gray-300'
                }`}
              >
                {OIcon && <OIcon size={12} className="flex-shrink-0" />}
                <span className="flex-1 truncate">{o.label}</span>
                {o.note && <span className="text-[10px] text-amber-400 whitespace-nowrap">{o.note}</span>}
                {active && <Check size={11} className="flex-shrink-0" />}
              </button>
            </li>
          );
        })}
      </ul>
    </Popover>
  );
}
