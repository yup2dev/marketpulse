/**
 * 오류 → 사용자에게 보일 한 줄. apiClient 가 던진 Error(status · detail · code · provider)를 받는다.
 *
 *   errorMessage(e, '저장 실패')
 *   errorMessage(e, '조회 실패', { provider: 'fred' })   // 오류에 provider 가 없을 때 쓸 이름
 *
 * - code=missing_key → '<PROVIDER> 키가 필요합니다 …'
 * - FastAPI 422 의 detail 배열 → 첫 항목의 msg
 * - 내부 주소(127.0.0.1:8765, http://…)는 지운다
 * - 쓸 문구가 없으면 fallback
 */
const INTERNAL_URL = /\s*\(?https?:\/\/[^\s)]+\)?/g;

export function errorMessage(err, fallback = '요청 실패', { provider } = {}) {
  if (!err) return fallback;
  if (typeof err === 'string') return err.replace(INTERNAL_URL, '').trim() || fallback;

  if (err.code === 'missing_key') {
    const name = (err.provider || provider || 'API').toUpperCase();
    return `${name} 키가 필요합니다 (설정 > API 키에서 등록)`;
  }

  let msg = err.detail ?? err.message;
  if (Array.isArray(msg)) msg = msg[0]?.msg;
  if (typeof msg !== 'string') return fallback;
  return msg.replace(INTERNAL_URL, '').trim() || fallback;
}
