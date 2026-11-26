/**
 * ui/ 부품이 같이 쓰는 비컴포넌트 도우미. (.jsx 에서 컴포넌트와 섞어 내보내면
 * Fast Refresh 경고가 나서 따로 둔다)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/errors';

/** 문자열 배열이든 { value, label } 배열이든 같은 모양으로 맞춘다 */
export function normalizeOptions(options) {
  return (options || []).map((o) =>
    (o !== null && typeof o === 'object') ? { ...o, label: o.label ?? String(o.value) } : { value: o, label: String(o) });
}

// 높이는 padding + line-height 로 (32px = Select md 와 같은 높이). h-8 로 고정하면 textarea 가 한 줄로 접힌다.
export const INPUT_CLS =
  'w-full bg-[#0a0a0f] border border-gray-800 rounded px-2 py-[7px] text-xs leading-4 text-gray-200 ' +
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

// 서버 오류 code → WidgetState kind (PC Fetcher 관련). 코드표는 docs/ARCHITECTURE.ko.md '오류 응답'
const FETCHER_KINDS = {
  fetcher_offline: 'fetcher-off',
  fetcher_timeout: 'fetcher-slow',
  fetcher_outdated: 'fetcher-outdated',
};

/** apiClient 오류 → WidgetState props. 위젯은 <WidgetState {...stateFromError(e)} /> 로 넘긴다.
 *  서버 code 로 먼저 고르고, code 가 없는 옛 응답만 HTTP 상태로 판단한다 (전환기). */
export function stateFromError(err) {
  if (!err) return null;
  if (err.code === 'missing_key') return { kind: 'missing-key', provider: err.provider };
  if (FETCHER_KINDS[err.code]) return { kind: FETCHER_KINDS[err.code] };
  if (!err.code && err.status === 503) return { kind: 'fetcher-off' };
  return { kind: 'error', message: errorMessage(err, detailText(err.detail) || err.message) };
}

/** 오류 detail → 글자. FastAPI 422 는 [{ loc, msg, … }] 목록이라 그대로 그리면 React 가 터진다 (화면 전체가 오류 경계로 간다) */
function detailText(detail) {
  if (detail == null || detail === '') return '';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => (d && typeof d === 'object'
      ? [Array.isArray(d.loc) ? d.loc.filter((p) => p !== 'query' && p !== 'body').join('.') : '', d.msg].filter(Boolean).join(': ')
      : String(d))).join(' · ');
  }
  if (typeof detail === 'object') return detail.msg || detail.message || JSON.stringify(detail);
  return String(detail);
}
