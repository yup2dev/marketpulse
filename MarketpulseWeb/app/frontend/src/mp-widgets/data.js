/**
 * 데이터 계층 — 스펙의 endpoint 문자열을 요청으로 바꾼다.
 *
 *   fill('/stock/history/{symbol}?period={period}', params)   {이름} 자리 채우기
 *   useApi(path, { refresh })                                 위젯의 주 요청 (자동 새로고침)
 *   useSeries(symbols, template)                              심볼마다 한 번씩 (스파크라인) — 캐시 + 동시 요청 제한
 *   useExtra({ favorites: '/watchlist/my-tickers' })          보조 요청 — transform·filter 의 ctx.extra 로 간다
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from './adapter';

/**
 * '{name}' 자리를 params 값으로 채운다 (URL 인코딩).
 * 값이 빈 쿼리 항목(date= 처럼)은 뺀다 — 안 고른 값은 보내지 않는다 (서버 기본값: 최신 · 자동 선택).
 */
export function fill(template, params) {
  const filled = template.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(params[k] ?? ''));
  const at = filled.indexOf('?');
  if (at < 0) return filled;
  const kept = filled.slice(at + 1).split('&').filter((pair) => pair && !/^[^=]+=$/.test(pair));
  return kept.length ? `${filled.slice(0, at)}?${kept.join('&')}` : filled.slice(0, at);
}

/** 응답에서 행을 꺼낸다 — 'results'(기본) · 'a.b.c' · ''(응답 그대로) */
export function pick(res, path = 'results') {
  if (res == null || path === '') return res;
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), res);
}

/** 봉 응답의 필드 이름을 소문자로 맞춘다 (date·open·high·low·close·volume) */
export function normalizeBars(rows) {
  return (rows || [])
    .map((r) => ({
      date:   r.date ?? r.Date ?? r.datetime ?? r.timestamp,
      open:   r.open ?? r.Open,
      high:   r.high ?? r.High,
      low:    r.low ?? r.Low,
      close:  r.close ?? r.Close,
      volume: r.volume ?? r.Volume,
    }))
    .filter((b) => b.close != null);
}

/** 마지막 거래일의 종가 배열 + 그 전날 종가 — 분봉 며칠치를 날짜로 가른다 */
export function lastSession(bars) {
  if (!bars?.length) return { closes: [], prevClose: null, last: null };
  const day = String(bars[bars.length - 1].date).slice(0, 10);
  const closes = [];
  let prevClose = null;
  for (const b of bars) {
    if (String(b.date).slice(0, 10) === day) closes.push(b.close);
    else prevClose = b.close;
  }
  return { closes, prevClose, last: closes[closes.length - 1] ?? null };
}

// ── 주 요청 ────────────────────────────────────────────────────────────────────

/**
 * path 가 바뀌면 다시 요청한다. refresh(ms) 를 주면 그 간격으로 조용히 갱신한다
 * (갱신이 실패해도 화면의 데이터는 그대로 둔다).
 */
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

  // path 가 막 바뀐 렌더에서는 아직 앞 요청의 응답을 들고 있다 — 다른 요청의 행을 넘기지 않는다
  if (state.path !== path) return { data: null, error: null, loading: !!path, reload: load };
  return { data: state.data, error: state.error, loading: state.loading, reload: load };
}

// ── 심볼별 시계열 (스파크라인) ──────────────────────────────────────────────────

const TTL_MS = 3 * 60 * 1000;
const MAX_PARALLEL = 4;
const cache = new Map();   // path → { at, promise }
let active = 0;
const waiting = [];

function limited(task) {
  return new Promise((resolve, reject) => {
    const start = () => {
      active += 1;
      task().then(resolve, reject).finally(() => {
        active -= 1;
        waiting.shift()?.();
      });
    };
    if (active < MAX_PARALLEL) start(); else waiting.push(start);
  });
}

/** 같은 경로는 TTL 동안 한 번만 나간다 (진행 중인 요청도 공유) */
export function cachedRequest(path) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const promise = limited(() => request(path));
  cache.set(path, { at: Date.now(), promise });
  promise.catch(() => { if (cache.get(path)?.promise === promise) cache.delete(path); });
  return promise;
}

/**
 * 심볼마다 template('…/{symbol}?…') 을 요청한다 → { series: { [symbol]: bars }, error, loading }.
 * 도착하는 대로 채워지고, 전부 실패했을 때만 error 를 준다.
 */
export function useSeries(symbols, template) {
  const [series, setSeries] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const key = symbols.join(',');

  useEffect(() => {
    const list = key && template ? key.split(',') : [];
    if (!list.length) { setLoading(false); return undefined; }
    let alive = true;
    let done = 0, failed = 0, firstError = null;
    setLoading(true);
    setError(null);
    list.forEach((symbol) => {
      cachedRequest(fill(template, { symbol }))
        .then((res) => { if (alive) setSeries((prev) => ({ ...prev, [symbol]: normalizeBars(pick(res)) })); })
        .catch((e) => { failed += 1; firstError = firstError || e; })
        .finally(() => {
          done += 1;
          if (!alive || done < list.length) return;
          setLoading(false);
          if (failed === list.length) setError(firstError);
        });
    });
    return () => { alive = false; };
  }, [key, template]);

  return { series, error, loading };
}

// ── 보조 요청 ──────────────────────────────────────────────────────────────────

/** { name: path } → { name: rows }. path 의 {이름} 은 params 로 채운다. 실패한 항목은 빈 배열 */
export function useExtra(extra, params) {
  const [data, setData] = useState({});
  const key = extra
    ? JSON.stringify(Object.fromEntries(Object.entries(extra).map(([name, path]) => [name, fill(String(path), params || {})])))
    : '';

  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    Object.entries(JSON.parse(key)).forEach(([name, path]) => {
      request(path)
        .then((res) => { if (alive) setData((prev) => ({ ...prev, [name]: pick(res) || [] })); })
        .catch(() => { if (alive) setData((prev) => ({ ...prev, [name]: [] })); });
    });
    return () => { alive = false; };
  }, [key]);

  return data;
}
