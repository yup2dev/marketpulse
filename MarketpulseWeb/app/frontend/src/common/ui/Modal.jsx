/**
 * Modal — 공통 모달 껍데기 (BSHK shicObj.openPop 의 화면 쪽). 화면마다 오버레이를 다시 그리지 말 것.
 *
 *   <Modal open={open} onClose={close} title="Widget Menu" width="lg" height={600}>
 *     …내용…
 *   </Modal>
 *
 * props
 *   open, onClose          열림 여부 · 닫기 요청 (Esc · 배경 클릭 · X 버튼)
 *   title                  헤더 제목. header={false} 면 헤더 없이 내용만
 *   width                  'sm' 400 · 'md' 560(기본) · 'lg' 860 · 'xl' 1100 · 숫자(px)
 *   height                 숫자(px) — 안 주면 내용 높이. 어느 쪽이든 화면의 90% 를 넘지 않는다
 *   placement              'center'(기본) · 'top' (명령 팔레트처럼 위쪽)
 *   footer                 아래 버튼 줄
 *   closeOnBackdrop/closeOnEsc   기본 true
 *   bodyClassName          내용 칸 클래스 (기본: 스크롤 + 안쪽 여백)
 *
 * 동작: body 로 portal · 열린 동안 페이지 스크롤 잠금 · Esc 는 가장 위의 모달만 닫는다 ·
 *       열 때 패널로 포커스(안에 autoFocus 가 있으면 그쪽), 닫으면 원래 자리로 포커스를 돌려준다.
 * 색은 테마 토큰(--mp-*) — 라이트/다크를 따로 맞출 필요 없다.
 */
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const WIDTH = { sm: 400, md: 560, lg: 860, xl: 1100 };

// 열린 모달 순서 (마지막이 가장 위) — Esc 와 스크롤 잠금이 공유한다
const stack = [];
let savedOverflow = '';

export default function Modal({
  open,
  onClose,
  title,
  header = true,
  width = 'md',
  height,
  placement = 'center',
  footer,
  closeOnBackdrop = true,
  closeOnEsc = true,
  bodyClassName = 'flex-1 min-h-0 overflow-auto p-5',
  children,
}) {
  const id = useId();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    if (stack.length === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    stack.push(id);
    const returnFocus = document.activeElement;
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus();

    const onKey = (e) => {
      if (e.key !== 'Escape' || !closeOnEsc || stack[stack.length - 1] !== id) return;
      e.stopPropagation();
      onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(id), 1);
      if (stack.length === 0) document.body.style.overflow = savedOverflow;
      returnFocus?.focus?.();
    };
  }, [open, id, closeOnEsc]);

  if (!open) return null;

  const w = typeof width === 'number' ? width : WIDTH[width] || WIDTH.md;
  const align = placement === 'top' ? 'items-start pt-24' : 'items-center';

  return createPortal(
    <div
      className={`fixed inset-0 z-[1000] flex justify-center ${align} px-4 bg-black/60 backdrop-blur-sm`}
      // mousedown 으로 본다 — 안에서 드래그하다 배경에서 놓아도 닫히지 않게
      onMouseDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className="relative w-full flex flex-col overflow-hidden rounded-xl shadow-2xl outline-none
                   bg-[var(--mp-panel)] border border-[var(--mp-tile-line)] text-[var(--mp-text)]"
        style={{ maxWidth: w, height, maxHeight: '90vh' }}
      >
        {header && (
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[var(--mp-tile-line)] flex-shrink-0">
            <div className="min-w-0 truncate text-sm font-semibold">{title}</div>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="p-1 rounded text-[var(--mp-muted)] hover:text-[var(--mp-text)] hover:bg-[var(--mp-row-hover)] transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div className={bodyClassName}>{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--mp-tile-line)] flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
