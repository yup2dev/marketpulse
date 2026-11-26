/**
 * 오류 → 사용자에게 보일 한 줄. apiClient 가 던진 Error(status · detail · code · provider)를 받는다.
 *
 *   errorMessage(e, '저장 실패')
 *   errorMessage(e, '조회 실패', { provider: 'fred' })   // 오류에 provider 가 없을 때 쓸 이름
 *
 * - code=missing_key → '<PROVIDER> 키가 필요합니다 …'
 * - 그 밖의 서버 code(fetcher_* · circuit_open · upstream_*) → 정해 둔 안내 문구 (CODE_MESSAGES)
 * - FastAPI 422 의 detail 배열 → 첫 항목의 msg
 * - 내부 주소(127.0.0.1:8765, http://…)는 지운다
 * - 쓸 문구가 없으면 fallback
 */
const INTERNAL_URL = /\s*\(?https?:\/\/[^\s)]+\)?/g;

// 서버 오류 code → 안내 문구. 코드표는 docs/ARCHITECTURE.ko.md '오류 응답' (upstream_error 는 서버 문구를 그대로)
const CODE_MESSAGES = {
  fetcher_offline: '데스크톱 Fetcher 를 실행하고 로그인하세요',
  fetcher_timeout: 'Fetcher 응답이 늦습니다 — 잠시 후 다시 시도하세요',
  fetcher_outdated: '데스크톱 Fetcher 를 업데이트하세요',
  circuit_open: '데이터 제공처가 잠시 불안정합니다 — 잠시 후 다시 시도하세요',
  upstream_limit: '데이터 제공처 호출 한도를 넘었습니다 — 잠시 후 다시 시도하세요',
  upstream_subscription: '이 데이터는 제공처 구독이 필요합니다',
  upstream_denied: '데이터 제공처가 요청을 거부했습니다 — API 키와 권한을 확인하세요',
  api_not_registered: '위젯에 등록되지 않은 데이터입니다 — 위젯 설정을 확인하세요',
};

export function errorMessage(err, fallback = '요청 실패', { provider } = {}) {
  if (!err) return fallback;
  if (typeof err === 'string') return err.replace(INTERNAL_URL, '').trim() || fallback;

  if (err.code === 'missing_key') {
    const name = (err.provider || provider || 'API').toUpperCase();
    return `${name} 키가 필요합니다 (설정 > API 키에서 등록)`;
  }
  if (CODE_MESSAGES[err.code]) return CODE_MESSAGES[err.code];

  let msg = err.detail ?? err.message;
  if (Array.isArray(msg)) msg = msg[0]?.msg;
  if (typeof msg !== 'string') return fallback;
  return msg.replace(INTERNAL_URL, '').trim() || fallback;
}
