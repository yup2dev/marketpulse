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
import { syncFetcherToken } from '../utils/fetcherToken';

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
  const wasOnlineRef = useRef(false);

  const recheck = useCallback(async () => {
    const ok = await pingFetcher();
    if (mountedRef.current) setStatus(ok ? 'online' : 'offline');
    // 토큰은 로그인/페이지 로드 시점에만 전달되므로, Fetcher를 페이지보다 늦게
    // 띄우면 토큰 파일이 비어 워커가 클라우드 풀에 합류하지 못한다(연결됨으로
    // 보이지만 fetch 위임이 실행 안 되는 증상). online 전환을 감지하면 저장된
    // 토큰을 다시 전달해 실행 순서와 무관하게 합류하도록 한다.
    if (ok && !wasOnlineRef.current) {
      const token = localStorage.getItem('fetcher_token');
      if (token) syncFetcherToken(token);
    }
    wasOnlineRef.current = ok;
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
