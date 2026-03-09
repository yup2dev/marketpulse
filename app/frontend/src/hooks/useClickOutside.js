/**
 * useClickOutside.js — 외부 클릭 감지 hook (OpenBB tables 패턴)
 *
 * import useClickOutside from '../hooks/useClickOutside';
 * const ref = useRef(null);
 * useClickOutside(ref, () => setOpen(false));
 */
import { useEffect } from 'react';

export default function useClickOutside(ref, handler) {
  useEffect(() => {
    if (!handler) return;
    const listener = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return;
      handler(e);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}
