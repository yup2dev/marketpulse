/**
 * OverflowMenu — 헤더 오른쪽 ⋯ 메뉴. 자주 안 쓰는 동작(내보내기·위젯 연동)을 여기 모은다.
 *
 * items: [{ label, icon?, onClick, active?, divider? } | { section: 'View' }]  — falsy 항목은 무시
 *   section — 그 아래 항목들의 소제목 (좁은 위젯에서 보기·provider 선택을 여기로 접을 때)
 */
import { MoreHorizontal } from 'lucide-react';
import Popover from './Popover';
import { usePopover } from './helpers';

export default function OverflowMenu({ items }) {
  const pop = usePopover();
  const list = (items || []).filter(Boolean);
  if (!list.length) return null;

  const trigger = (
    <button
      type="button"
      onClick={pop.toggle}
      className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded transition-colors"
      title="More"
      aria-haspopup="menu"
      aria-expanded={pop.open}
    >
      <MoreHorizontal size={12} />
    </button>
  );

  return (
    <Popover popover={pop} trigger={trigger} className="py-1 min-w-[170px]">
      <div role="menu">
        {list.map((it, i) => {
          if (it.section) {
            return (
              <div key={`s-${it.section}-${i}`} className={`px-3 pt-1.5 pb-0.5 text-[10px] font-medium text-gray-500 ${i ? 'border-t border-gray-800 mt-0.5' : ''}`}>
                {it.section}
              </div>
            );
          }
          const Icon = it.icon;
          return (
            <button
              key={`${it.label}-${i}`}
              type="button"
              role="menuitem"
              onClick={() => { it.onClick?.(); pop.close(); }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left transition-colors hover:bg-gray-800 ${
                it.divider ? 'border-t border-gray-800 mt-0.5 pt-1.5' : ''
              } ${it.active ? 'text-cyan-400' : 'text-gray-300'}`}
            >
              {Icon && <Icon size={11} className="flex-shrink-0" />}
              <span>{it.label}</span>
            </button>
          );
        })}
      </div>
    </Popover>
  );
}
