/**
 * useFetcherHealth — 로컬 Fetcher(:8765) 실행 여부를 감지한다.
 *
 * 웹/데스크탑 공용. 브라우저는 loopback(127.0.0.1)으로 직접 헬스체크하며,
 * loopback은 mixed-content 차단 예외라 https 페이지에서도 호출 가능하다.
 * Fetcher REST는 CORS `*` 를 내려주므로 별도 설정 없이 동작한다.
 *
 * 반환:
 *   status   'checking' | 'online' | 'offline'
 *   isTauri  데스크탑(Tauri) 웹뷰 여부 — 실행 버튼 노출 분기에 사용
 *   recheck  즉시 재확인 함수
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const FETCHER_HEALTH_URL = 'http://127.0.0.1:8765/health';
const POLL_INTERVAL_MS = 15000;

export function isTauriRuntime() {
  return (
    typeof window !== 'undefined' &&
    (!!window.__TAURI__ || !!window.__TAURI_INTERNALS__)
  );
}

async function pingFetcher() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(FETCHER_HEALTH_URL, {
      method: 'GET',
      signal: ctrl.signal,
      cache: 'no-store',
    });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

export default function useFetcherHealth() {
  const [status, setStatus] = useState('checking');
  const mountedRef = useRef(true);

  const recheck = useCallback(async () => {
    const ok = await pingFetcher();
    if (mountedRef.current) setStatus(ok ? 'online' : 'offline');
    return ok;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    recheck();

    const id = setInterval(recheck, POLL_INTERVAL_MS);
    const onFocus = () => recheck();
    window.addEventListener('focus', onFocus);

    return () => {
      mountedRef.current = false;
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [recheck]);

  return { status, isTauri: isTauriRuntime(), recheck };
}
