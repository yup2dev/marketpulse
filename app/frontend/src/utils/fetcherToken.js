/**
 * fetcherToken — 로그인 JWT를 사용자 PC의 Fetcher에 전달한다.
 *
 * Fetcher는 이 토큰으로 클라우드 /ws/fetcher 워커풀에 합류한다(사용자별 워커).
 * 토큰은 토큰 파일로 저장되고, Fetcher는 (재)접속 시점에 최신 토큰을 읽으므로
 * 갱신 시 Fetcher 재시작이 필요 없다.
 *
 * 전달 경로:
 *   - 데스크톱(Tauri): set_fetcher_token / clear_fetcher_token 커맨드(앱이 파일 기록)
 *   - 웹(브라우저)   : loopback http://127.0.0.1:8765/user-token 으로 POST/DELETE
 *                      (Fetcher가 안 떠 있으면 조용히 무시 — 워커 미참여)
 *
 * loopback(127.0.0.1)은 mixed-content 차단 예외라 https 페이지에서도 호출 가능하다.
 */
const FETCHER_BASE = 'http://127.0.0.1:8765';

const isTauri = () =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

function tauriInvoke(cmd, args) {
  const fn = window.__TAURI__?.core?.invoke;
  return fn ? fn(cmd, args) : Promise.resolve();
}

/** access token을 Fetcher에 전달. token이 falsy면 제거(로그아웃). */
export async function syncFetcherToken(token) {
  try {
    if (isTauri()) {
      if (token) await tauriInvoke('set_fetcher_token', { token });
      else await tauriInvoke('clear_fetcher_token');
      return;
    }
    // 웹: 로컬 Fetcher가 떠 있으면 토큰 전달, 없으면 fetch 실패 → 무시
    if (token) {
      await fetch(`${FETCHER_BASE}/user-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
    } else {
      await fetch(`${FETCHER_BASE}/user-token`, { method: 'DELETE' });
    }
  } catch {
    /* Fetcher 미실행/네트워크 — 무시 (워커 미참여) */
  }
}
