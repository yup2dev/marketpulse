/**
 * FetcherStatus — 헤더에 표시되는 로컬 Fetcher 상태 표시기 + 실행/설치 안내.
 *
 * 온라인:  초록 점 + "Fetcher" (클릭 시 상태 패널)
 * 오프라인: 빨간 점 + "Fetcher 꺼짐" — 클릭하면 패널이 열리고
 *           - 데스크탑(Tauri): "Fetcher 실행" 버튼(Tauri 명령 호출)
 *           - 웹: 다운로드/설치 안내 링크
 */
import { useEffect, useRef, useState } from 'react';
import { Activity, Download, Play, RefreshCw, X } from 'lucide-react';
import useFetcherHealth from '../../hooks/useFetcherHealth';

// 스탠드얼론 Fetcher 다운로드 위치 (웹 사용자용)
const FETCHER_DOWNLOAD_URL =
  'https://github.com/sangyeopKim/marketpulse/releases/latest';

const DOT = {
  checking: 'bg-yellow-500 animate-pulse',
  online: 'bg-green-500',
  offline: 'bg-red-500',
};

const LABEL = {
  checking: 'Fetcher 확인 중',
  online: 'Fetcher',
  offline: 'Fetcher 꺼짐',
};

export default function FetcherStatus() {
  const { status, isTauri, recheck } = useFetcherHealth();
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleStart = async () => {
    setStarting(true);
    try {
      const invoke = window.__TAURI__?.core?.invoke;
      if (invoke) await invoke('start_fetcher');
      // 기동까지 잠깐 대기 후 재확인
      await new Promise((r) => setTimeout(r, 1500));
      for (let i = 0; i < 6; i += 1) {
        if (await recheck()) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (e) {
      console.error('[fetcher] start failed', e);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={status === 'online' ? 'Fetcher 실행 중' : 'Fetcher가 실행되고 있지 않습니다'}
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
                {status === 'checking' && '상태 확인 중…'}
                {status === 'offline' && '실행되고 있지 않습니다.'}
              </span>
            </div>

            {status === 'offline' && (
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                시세·재무 등 외부 데이터를 가져오려면 로컬 Fetcher가 실행되어 있어야 합니다.
                {isTauri
                  ? ' 아래 버튼으로 바로 실행하세요.'
                  : ' MarketPulse Fetcher를 설치·실행한 뒤 다시 확인하세요.'}
              </p>
            )}

            <div className="flex items-center gap-2">
              {status === 'offline' && isTauri && (
                <button
                  onClick={handleStart}
                  disabled={starting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 transition-colors"
                >
                  {starting ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
                  {starting ? '실행 중…' : 'Fetcher 실행'}
                </button>
              )}

              {status === 'offline' && !isTauri && (
                <a
                  href={FETCHER_DOWNLOAD_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
                >
                  <Download size={13} />
                  Fetcher 다운로드
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
