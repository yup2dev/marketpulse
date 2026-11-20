/**
 * useApi(path, { refresh }) — GET 조회 훅. path 는 /api 뒤부터 ('/stock/ranking/live?…').
 *
 *   - path 가 바뀌면 다시 요청한다. 늦게 온 앞 요청의 응답은 버린다.
 *   - refresh(ms) 를 주면 그 간격으로 조용히 갱신한다 (갱신이 실패해도 화면의 데이터는 그대로).
 *   - 오류 상태에서 로컬 Fetcher 워커가 풀에 (재)합류하면 다시 불러온다
 *     (워커 미연결로 실패한 조회가 Fetcher 를 켠 뒤 저절로 살아난다).
 *   - path 가 falsy 면 요청하지 않는다.
 *
 * 반환: { data, error, loading, reload }   error 는 apiClient 의 Error (status · code · provider …)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE } from './base';
import { apiClient } from './client';
import { FETCHER_WORKER_CONNECTED } from './localFetcher';

export const request = (path) => apiClient.get(`${API_BASE}${path}`);

export function useApi(path, { refresh } = {}) {
  const [state, setState] = useState({ path, data: null, error: null, loading: !!path });
  const seq = useRef(0);

  const load = useCallback((silent = false) => {
    if (!path) { setState({ path, data: null, error: null, loading: false }); return; }
    const id = ++seq.current;
    if (!silent) setState({ path, data: null, error: null, loading: true });
    request(path).then(
      (data) => { if (id === seq.current) setState({ path, data, error: null, loading: false }); },
      (error) => { if (id === seq.current && !silent) setState({ path, data: null, error, loading: false }); },
    );
  }, [path]);

  useEffect(() => {
    load();
    if (!refresh) return undefined;
    const timer = setInterval(() => load(true), refresh);
    return () => clearInterval(timer);
  }, [load, refresh]);

  const failed = state.path === path && !!state.error;
  useEffect(() => {
    if (!failed) return undefined;
    const retry = () => load();
    window.addEventListener(FETCHER_WORKER_CONNECTED, retry);
    return () => window.removeEventListener(FETCHER_WORKER_CONNECTED, retry);
  }, [failed, load]);

  // path 가 막 바뀐 렌더에서는 아직 앞 요청의 응답을 들고 있다 — 다른 요청의 행을 넘기지 않는다
  if (state.path !== path) return { data: null, error: null, loading: !!path, reload: load };
  return { data: state.data, error: state.error, loading: state.loading, reload: load };
}
