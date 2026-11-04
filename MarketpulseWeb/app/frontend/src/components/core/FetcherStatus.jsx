/**
 * FetcherStatus — 헤더에 표시되는 로컬 Fetcher 상태 표시기 + 실행/설치 안내.
 *
 * 온라인:  초록 점 + "Fetcher" (클릭 시 상태 패널)
 * 연결 중: 노란 점 + "Fetcher 연결 중" — 실행 중이지만 클라우드 워커 풀에 아직 미합류
 * 오프라인: 빨간 점 + "Fetcher 꺼짐" — 클릭하면 패널이 열리고
 *           marketpulse:// 딥링크 실행 버튼과 다운로드/설치 안내가 나온다.
 */
import { useEffect, useRef, useState } from 'react';
import { Activity, Download, Play, Power, RefreshCw, X } from 'lucide-react';
import useFetcherHealth from '../../hooks/useFetcherHealth';

// 로컬 Fetcher 다운로드 위치
const FETCHER_DOWNLOAD_URL =
  'https://github.com/yup2dev/marketpulse/releases/latest';

// 로컬 Fetcher REST (loopback) — 종료 호출용
const FETCHER_BASE = 'http://127.0.0.1:8765';
// 설치돼 있으면 OS가 이 스킴으로 Fetcher를 기동한다(Fetcher가 첫 실행 시 자가등록).
const FETCHER_LAUNCH_URL = 'marketpulse://start';

const DOT = {
  checking: 'bg-yellow-500 animate-pulse',
  online: 'bg-green-500',
  joining: 'bg-amber-500 animate-pulse',
  offline: 'bg-red-500',
};

const LABEL = {
  checking: 'Fetcher 확인 중',
  online: 'Fetcher',
  joining: 'Fetcher 연결 중',
  offline: 'Fetcher 꺼짐',
};

const TITLE = {
  checking: 'Fetcher 상태 확인 중',
  online: 'Fetcher 실행 중',
  joining: 'Fetcher가 실행 중이지만 서버에 아직 연결되지 않았습니다',
  offline: 'Fetcher가 실행되고 있지 않습니다',
};

export default function FetcherStatus() {
  const { status, recheck } = useFetcherHealth();
  const [open, setOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchTried, setLaunchTried] = useState(false);
  const [stopping, setStopping] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // 커스텀 스킴 딥링크로 OS가 Fetcher를 기동 (설치+자가등록돼 있어야 동작).
  // 스킴이 없으면 아무 일도 안 일어나므로, 폴링 후에도 offline이면 다운로드 안내를 노출한다.
  const handleWebStart = async () => {
    setLaunching(true);
    setLaunchTried(true);
    try {
      window.location.href = FETCHER_LAUNCH_URL;
      for (let i = 0; i < 10; i += 1) {
        await new Promise((r) => setTimeout(r, 1000));
        if (await recheck()) break;
      }
    } catch (e) {
      console.error('[fetcher] web launch failed', e);
    } finally {
      setLaunching(false);
    }
  };

  // 종료: 브라우저는 로컬 프로세스를 못 죽이므로 Fetcher의 loopback /shutdown을 호출한다.
  const handleStop = async () => {
    setStopping(true);
    try {
      // 커스텀 헤더로 CORS preflight를 강제 → 허용 origin만 종료 가능(타 사이트의 임의 종료 차단)
      await fetch(`${FETCHER_BASE}/shutdown`, {
        method: 'POST',
        headers: { 'X-MarketPulse-Control': '1' },
      }).catch(() => {});
      for (let i = 0; i < 8; i += 1) {
        await new Promise((r) => setTimeout(r, 800));
        if (!(await recheck())) break;
      }
    } finally {
      setStopping(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={TITLE[status]}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
      >
        <span className={`w-2 h-2 rounded-full ${DOT[status]}`} />
        <span className="text-xs hidden md:inline" style={{ color: 'var(--color-text-secondary)' }}>
          {LABEL[status]}
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-72 rounded-lg shadow-xl border z-50 dark:border-gray-800 border-gray-200"
          style={{ backgroundColor: 'var(--color-bg-widget)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-800 border-gray-200">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-cyan-400" />
              <span className="text-sm font-medium text-white">로컬 Fetcher</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white">
              <X size={14} />
            </button>
          </div>

          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${DOT[status]}`} />
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {status === 'online' && '실행 중 — 데이터 조회가 가능합니다.'}
                {status === 'joining' && '실행 중 — 서버 연결을 기다리는 중입니다.'}
                {status === 'checking' && '상태 확인 중…'}
                {status === 'offline' && '실행되고 있지 않습니다.'}
              </span>
            </div>

            {status === 'offline' && (
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                시세·재무 등 외부 데이터를 가져오려면 로컬 Fetcher가 실행되어 있어야 합니다.
                {' 설치돼 있으면 실행을 누르세요. 처음이면 먼저 다운로드·설치하세요.'}
              </p>
            )}

            {status === 'joining' && (
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                연결되면 실패했던 위젯이 자동으로 다시 조회됩니다. 계속 연결되지 않으면
                로그아웃 후 다시 로그인해 Fetcher 토큰을 갱신하세요.
              </p>
            )}

            {status === 'offline' && launchTried && !launching && (
              <p className="text-[11px] leading-relaxed text-amber-400/80">
                실행되지 않았나요? 아직 설치 전이거나 브라우저가 앱 열기를 차단했을 수 있습니다.
                다운로드·설치 후 다시 시도하세요.
              </p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {/* 종료 — 실행 중일 때 (loopback /shutdown) */}
              {(status === 'online' || status === 'joining') && (
                <button
                  onClick={handleStop}
                  disabled={stopping}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-red-600/90 hover:bg-red-500 text-white disabled:opacity-50 transition-colors"
                >
                  {stopping ? <RefreshCw size={13} className="animate-spin" /> : <Power size={13} />}
                  {stopping ? '종료 중…' : 'Fetcher 종료'}
                </button>
              )}

              {/* 실행 — marketpulse:// 딥링크 */}
              {status === 'offline' && (
                <button
                  onClick={handleWebStart}
                  disabled={launching}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 transition-colors"
                >
                  {launching ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
                  {launching ? '실행 중…' : 'Fetcher 실행'}
                </button>
              )}

              {/* 다운로드 — 미설치/실행 실패 대비 */}
              {status === 'offline' && (
                <a
                  href={FETCHER_DOWNLOAD_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border dark:border-gray-700 border-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <Download size={13} />
                  다운로드
                </a>
              )}

              <button
                onClick={() => recheck()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border dark:border-gray-700 border-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <RefreshCw size={13} />
                새로고침
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
