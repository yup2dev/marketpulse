/**
 * ui/ 부품이 같이 쓰는 비컴포넌트 도우미. (.jsx 에서 컴포넌트와 섞어 내보내면
 * Fast Refresh 경고가 나서 따로 둔다)
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** 문자열 배열이든 { value, label } 배열이든 같은 모양으로 맞춘다 */
export function normalizeOptions(options) {
  return (options || []).map((o) =>
    (o !== null && typeof o === 'object') ? { ...o, label: o.label ?? String(o.value) } : { value: o, label: String(o) });
}

export const INPUT_CLS =
  'w-full h-8 bg-[#0a0a0f] border border-gray-800 rounded px-2 text-xs text-gray-200 ' +
  'outline-none focus:border-cyan-700 tabular-nums';

export const PANEL_CLS =
  'absolute top-full mt-1 bg-[#1a1a1f] border border-gray-700 rounded shadow-xl z-50';

/** 바깥 클릭·Esc 로 닫히는 열림 상태 */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => setOpen(false), []);
  return { open, setOpen, toggle, close, ref };
}

/** apiClient 오류 → WidgetState props. 위젯은 <WidgetState {...stateFromError(e)} /> 로 넘긴다. */
export function stateFromError(err) {
  if (!err) return null;
  if (err.code === 'missing_key') return { kind: 'missing-key', provider: err.provider };
  if (err.status === 503) return { kind: 'fetcher-off' };
  return { kind: 'error', message: err.detail || err.message };
}
