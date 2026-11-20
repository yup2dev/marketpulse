/**
 * WidgetState — 위젯이 데이터를 못 보여 줄 때의 화면 하나로 통일.
 * 위젯마다 빨간 원문 오류 / '데이터 없음' / 회색 문구를 따로 그리지 않는다.
 *
 * kind:
 *   loading      불러오는 중
 *   empty        결과 0건 (조건을 바꾸면 나올 수 있음)
 *   error        요청 실패 — message 는 사람이 읽을 문장만, 내부 주소는 숨긴다
 *   missing-key  provider API 키 미등록 → /settings
 *   fetcher-off  로컬 Fetcher 가 꺼져 있음 (서버 503)
 *   idle         아직 실행 전 (예: 'Run backtest' 를 누르기 전)
 *
 * 오류 객체를 kind 로 바꾸는 건 helpers.js 의 stateFromError() — 위젯은 이걸 거쳐 넘긴다.
 */
import { Link } from 'react-router-dom';
import { AlertTriangle, Inbox, KeyRound, PlugZap, MousePointerClick } from 'lucide-react';

const KINDS = {
  empty:         { Icon: Inbox,             tone: 'text-gray-500',  title: 'No data' },
  error:         { Icon: AlertTriangle,     tone: 'text-red-400',   title: 'Could not load data' },
  'missing-key': { Icon: KeyRound,          tone: 'text-amber-400', title: 'API key needed' },
  'fetcher-off': { Icon: PlugZap,           tone: 'text-amber-400', title: 'Fetcher is not running' },
  idle:          { Icon: MousePointerClick, tone: 'text-gray-500',  title: 'Nothing to show yet' },
};

const ACTION_CLS =
  'inline-flex items-center h-7 px-3 rounded text-[11px] font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition-colors';
const SECONDARY_CLS =
  'inline-flex items-center h-7 px-3 rounded text-[11px] font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors';

// 내부 주소(127.0.0.1:8765, http://…)가 사용자에게 보이지 않게 지운다
// (문자열만 손본다 — JSX 노드는 그대로 그린다)
function scrub(message) {
  if (!message || typeof message !== 'string') return message;
  return message.replace(/\s*\(?https?:\/\/[^\s)]+\)?/g, '').trim();
}

export default function WidgetState({
  kind = 'empty',
  title,
  message,
  provider,          // missing-key 일 때 provider 이름
  onRetry,
  action,            // { label, onClick } — 추가 행동 버튼
  compact = false,   // 표 안 같은 좁은 자리
}) {
  if (kind === 'loading') {
    return (
      <div className="w-full h-full flex items-center justify-center" role="status" aria-label="Loading">
        <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const meta = KINDS[kind] || KINDS.empty;
  const { Icon } = meta;
  let heading = title || meta.title;
  let body = scrub(message);
  if (kind === 'missing-key') {
    heading = title || `${(provider || 'Provider').toUpperCase()} API key needed`;
    body = body || 'Add the key in Settings to see this data.';
  }
  if (kind === 'fetcher-off') {
    body = body || 'Start the MarketPulse Fetcher on this PC, then retry.';
  }

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center text-center gap-2 ${compact ? 'p-3' : 'p-6'}`}>
      <Icon size={compact ? 16 : 20} className={meta.tone} aria-hidden="true" />
      <p className="text-xs font-medium text-gray-300">{heading}</p>
      {body && <div className="text-[11px] text-gray-500 max-w-[320px] break-words">{body}</div>}
      <div className="flex items-center gap-2 mt-1">
        {kind === 'missing-key' && <Link to="/settings" className={ACTION_CLS}>Open Settings</Link>}
        {action && <button type="button" onClick={action.onClick} className={ACTION_CLS}>{action.label}</button>}
        {onRetry && kind !== 'empty' && kind !== 'idle' && (
          <button type="button" onClick={onRetry} className={SECONDARY_CLS}>Retry</button>
        )}
      </div>
    </div>
  );
}
