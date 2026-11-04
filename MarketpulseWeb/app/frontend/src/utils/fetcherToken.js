/**
 * fetcherToken — 로그인 JWT를 사용자 PC의 Fetcher에 전달한다.
 *
 * Fetcher는 이 토큰으로 클라우드 /ws/fetcher 워커풀에 합류한다(사용자별 워커).
 * 토큰은 토큰 파일로 저장되고, Fetcher는 파일 변경을 감지해 곧바로 (재)접속하므로
 * 갱신 시 Fetcher 재시작이 필요 없다.
 *
 * 전달 경로: loopback http://127.0.0.1:8765/user-token 으로 POST/DELETE
 *            (Fetcher가 안 떠 있으면 조용히 무시 — 워커 미참여)
 *
 * loopback(127.0.0.1)은 mixed-content 차단 예외라 https 페이지에서도 호출 가능하다.
 *
 * 토큰 파일은 이 PC의 모든 탭·환경(운영/로컬 개발)이 공유한다. 오래된 탭의 만료 토큰이나
 * 다른 백엔드의 토큰이 유효한 토큰을 덮어쓰면 워커가 403으로 풀에서 빠지므로,
 *   - 만료·형식 오류 토큰은 보내지 않고
 *   - 발급 백엔드(API_BASE_URL)를 함께 보내 Fetcher가 접속 대상과 대조하게 하며
 *   - 로그아웃 시엔 '내 토큰'일 때만 지우도록 토큰을 함께 보낸다.
 */
import API_BASE_URL from '../config/api';

const FETCHER_BASE = 'http://127.0.0.1:8765';

/** 형식이 맞고 만료되지 않은 JWT인지 (서명은 검증하지 않음 — 명백한 폐기 토큰만 거른다). */
export function isUsableToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return !!payload.sub && (!payload.exp || payload.exp * 1000 > Date.now());
  } catch {
    return false;
  }
}

/** fetcher 토큰을 Fetcher에 전달. 없거나 쓸 수 없는 토큰이면 기존 토큰을 건드리지 않는다. */
export async function syncFetcherToken(token) {
  if (!token || !isUsableToken(token)) return;
  try {
    // 로컬 Fetcher가 떠 있으면 토큰 전달, 없으면 fetch 실패 → 무시
    const res = await fetch(`${FETCHER_BASE}/user-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, backend: API_BASE_URL }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.warn('[fetcher] 토큰 전달 거부:', body.detail || res.status);
    }
  } catch {
    /* Fetcher 미실행/네트워크 — 무시 (워커 미참여) */
  }
}

/** 로그아웃: 이 세션의 토큰(token)이 Fetcher에 저장된 토큰일 때만 제거한다. */
export async function clearFetcherToken(token) {
  try {
    // 토큰이 없는 세션은 Fetcher에 넣은 토큰도 없다 — 다른 세션의 토큰을 지우지 않게 생략
    if (!token) return;
    await fetch(`${FETCHER_BASE}/user-token`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  } catch {
    /* Fetcher 미실행/네트워크 — 무시 */
  }
}
