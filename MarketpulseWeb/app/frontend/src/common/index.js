/**
 * 프론트 공통 진입점 — 화면·위젯은 common 내부 파일이 아니라 여기서 import 한다.
 * (common 안의 파일끼리는 순환을 피하려고 서로 상대 경로로 import 한다)
 *
 *   format/   숫자·날짜 표기
 *   api/      백엔드 요청(apiClient · 도메인별 *API · useApi) · 로컬 Fetcher
 *   ui/       Modal · openDialog/confirmDialog · notify (+ App 에 한 번 올리는 DialogHost · NotifyHost)
 *
 * 공통으로 올리는 기준: 도메인과 무관하고 두 곳 이상에서 쓴다. 한 화면 전용은 그 폴더에 둔다.
 * 상태(store)는 여기 두지 않는다.
 */
export { isNum, fmtPct, fmtCompact, fmtNumber, fmtPrice, toneOf } from './format/number';
export { fmtDate } from './format/date';

export { API_BASE_URL, API_BASE } from './api/base';
export {
  apiClient, setAccessToken, getAccessToken, setForceLogoutCallback, getForceLogout,
} from './api/client';
export * from './api/endpoints';
export { useApi, request } from './api/useApi';
export {
  FETCHER_BASE, FETCHER_WORKER_CONNECTED, pingFetcher, shutdownFetcher,
  syncFetcherToken, clearFetcherToken, isUsableToken,
} from './api/localFetcher';
export { errorMessage } from './api/errors';

export { default as Modal } from './ui/Modal';
export { openDialog, confirmDialog } from './ui/dialog';
export { default as DialogHost } from './ui/DialogHost';
export { notify } from './ui/notify';
export { default as NotifyHost } from './ui/NotifyHost';
