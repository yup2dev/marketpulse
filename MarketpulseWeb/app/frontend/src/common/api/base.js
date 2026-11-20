// 백엔드는 클라우드. 로컬 Fetcher는 사용자 PC에서 돌며 /ws/fetcher 워커풀에 합류한다.
//
// 운영 URL은 빌드 환경변수 VITE_API_URL 로만 주입한다(.env.production / Vercel 환경변수).
// 폴백을 운영 서버로 두면 .env 없이 dev 서버를 띄운 개발자가 운영 API를 직접 때린다 —
// useQuoteSocket.js 도 localhost 로 폴백하므로 그쪽과 기준을 맞춘다.
//
// 의존성 없는 파일로 둔다 — client · endpoints · localFetcher 가 모두 여기서 읽어 순환 import 가 없다.
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const API_BASE = `${API_BASE_URL}/api`;
