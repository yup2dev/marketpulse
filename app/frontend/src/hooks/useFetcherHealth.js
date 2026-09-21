/**
 * useFetcherHealth — 로컬 Fetcher(:8765) 실행 여부와 클라우드 워커 풀 합류 여부를 감지한다.
 *
 * 브라우저가 loopback(127.0.0.1)으로 직접 헬스체크하며,
 * loopback은 mixed-content 차단 예외라 https 페이지에서도 호출 가능하다.
 * Fetcher REST는 CORS `*` 를 내려주므로 별도 설정 없이 동작한다.
 *
 * 로컬 프로세스가 떠 있어도 토큰 거부(만료·덮어쓰기) 등으로 풀에 합류하지 못하면 데이터
 * 조회는 '워커 미연결'로 실패한다. 그래서 백엔드 /api/fetcher/status로 합류 여부를 함께 본다.
 *
 * 반환:
 *   status   'checking' | 'online'(실행+합류) | 'joining'(실행 중, 풀 미합류) | 'offline'
 *   recheck  즉시 재확인 함수 (로컬 실행 여부를 boolean으로 반환)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE, apiClient } from '../config/api';
import { syncFetcherToken } from '../utils/fetcherToken';

const FETCHER_HEALTH_URL = 'http://127.0.0.1:8765/health';
const POLL_INTERVAL_MS = 15000;
const JOINING_POLL_INTERVAL_MS = 3000;  // 실행 중인데 미합류 — 합류를 곧바로 반영하도록 짧게

/** 워커가 풀에 (재)합류하면 window에 발행 — 합류 전에 실패한 조회의 재시도 신호. */
export const FETCHER_WORKER_CONNECTED = 'marketpulse:fetcher-worker-connected';

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

/** 내 워커의 풀 합류 여부. 알 수 없으면(비로그인·구버전 백엔드·네트워크 오류) null. */
async function fetchWorkerConnected() {
  if (!localStorage.getItem('access_token')) return null;
  try {
    const res = await apiClient.get(`${API_BASE}/fetcher/status`);
    return typeof res?.connected === 'boolean' ? res.connected : null;
  } catch {
    return null;
  }
}

export default function useFetcherHealth() {
  const [status, setStatus] = useState('checking');
  const mountedRef = useRef(true);
  const wasOnlineRef = useRef(false);
  const workerConnectedRef = useRef(null);

  const recheck = useCallback(async () => {
    const ok = await pingFetcher();
    // 토큰은 로그인/페이지 로드 시점에만 전달되므로, Fetcher를 페이지보다 늦게
    // 띄우면 토큰 파일이 비어 워커가 클라우드 풀에 합류하지 못한다(연결됨으로
    // 보이지만 fetch 위임이 실행 안 되는 증상). online 전환을 감지하면 저장된
    // 토큰을 다시 전달해 실행 순서와 무관하게 합류하도록 한다.
    if (ok && !wasOnlineRef.current) {
      syncFetcherToken(localStorage.getItem('fetcher_token'));
    }
    wasOnlineRef.current = ok;

    let next = ok ? 'online' : 'offline';
    const connected = ok ? await fetchWorkerConnected() : false;
    if (connected === false && ok) {
      next = 'joining';
      // 미합류로 막 바뀌었다면 다른 탭·환경이 토큰을 덮어썼을 수 있다 — 내 토큰을 다시 넣는다.
      if (workerConnectedRef.current !== false) {
        syncFetcherToken(localStorage.getItem('fetcher_token'));
      }
    } else if (connected === true && workerConnectedRef.current === false) {
      window.dispatchEvent(new Event(FETCHER_WORKER_CONNECTED));
    }
    workerConnectedRef.current = connected;

    if (mountedRef.current) setStatus(next);
    return ok;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    let timer;

    const loop = async () => {
      await recheck();
      if (cancelled) return;
      const joining = wasOnlineRef.current && workerConnectedRef.current === false;
      timer = setTimeout(loop, joining ? JOINING_POLL_INTERVAL_MS : POLL_INTERVAL_MS);
    };
    loop();

    const onFocus = () => recheck();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      mountedRef.current = false;
      clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [recheck]);

  return { status, recheck };
}
