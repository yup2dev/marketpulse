/**
 * Popover — 버튼 아래로 펼쳐지는 패널의 공통 껍데기.
 * Select·OverflowMenu·파라미터 폼이 모두 이걸 쓴다 (바깥 클릭·Esc 로 닫힘).
 *
 * 위젯은 react-grid-layout 의 드래그 영역 안에 있으므로 mousedown 전파를 막는다.
 * 막지 않으면 버튼을 누르는 순간 위젯 드래그가 시작된다.
 */
import { PANEL_CLS } from './helpers';

export default function Popover({ popover, trigger, children, align = 'right', className = '' }) {
  return (
    <div ref={popover.ref} className="relative" onMouseDown={(e) => e.stopPropagation()}>
      {trigger}
      {popover.open && (
        <div className={`${PANEL_CLS} ${align === 'left' ? 'left-0' : 'right-0'} ${className}`} role="dialog">
          {children}
        </div>
      )}
    </div>
  );
}
