"""
MarketPulse Launcher — Discord 스타일 백그라운드 상주 런처.

실행 흐름:
  launch.vbs 더블클릭
    → pythonw.exe launcher.py  (콘솔창 없음)
      → 트레이 아이콘 상주
        우클릭 → App 열기  : Tauri 앱 (Vercel 프론트 로드 + sidecar fetcher 자동 기동, 백엔드는 별도 관리)
               → Web 열기  : 브라우저로 Vercel 앱 바로 접속 (로컬 서비스 불필요)
               → 종료
"""
from __future__ import annotations

import logging
import os
import subprocess
import sys
import webbrowser
from pathlib import Path

ROOT        = Path(__file__).parent
DESKTOP_DIR = ROOT / "desktop"

WEB_URL = "https://frontend-yup2devs-projects.vercel.app"

_NO_WINDOW = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0


# ── 아이콘 ────────────────────────────────────────────────────────────────────

def _load_icon():
    from PIL import Image
    p = ROOT / "desktop" / "src-tauri" / "icons" / "32x32.png"
    if p.exists():
        return Image.open(p).convert("RGBA")
    from PIL import ImageDraw
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([2, 2, 62, 62], fill="#0a0e14", outline="#06b6d4", width=4)
    return img


# ── 런처 ─────────────────────────────────────────────────────────────────────

class MarketPulseLauncher:
    def __init__(self):
        self._procs: list[subprocess.Popen] = []
        self._tauri_proc: subprocess.Popen | None = None

    def _spawn(self, cmd: str, cwd=None, extra_env: dict | None = None) -> subprocess.Popen:
        env = {**os.environ, **(extra_env or {})}
        p = subprocess.Popen(cmd, shell=True, cwd=str(cwd or ROOT),
                             env=env, creationflags=_NO_WINDOW)
        self._procs.append(p)
        return p

    def _kill_all(self) -> None:
        for p in self._procs:
            if p and p.poll() is None:
                try:
                    subprocess.Popen(f"taskkill /F /T /PID {p.pid}",
                                     shell=True, creationflags=_NO_WINDOW)
                except Exception:
                    pass

    # ── 트레이 메뉴 액션 ────────────────────────────────────────────────────

    def _open_app(self, icon, item) -> None:
        """Tauri 앱 실행 (Tauri가 Vercel 프론트를 WebView로 로드, sidecar로 fetcher도 함께 기동). 백엔드는 직접 관리."""
        if self._tauri_proc and self._tauri_proc.poll() is None:
            return
        self._tauri_proc = self._spawn("npm run dev", cwd=DESKTOP_DIR)

    def _open_web(self, icon, item) -> None:
        """브라우저로 배포된 웹 앱 바로 열기 (로컬 서비스 불필요)."""
        webbrowser.open(WEB_URL)

    def _quit(self, icon, item) -> None:
        self._kill_all()
        icon.stop()
        os._exit(0)

    # ── 진입점 ──────────────────────────────────────────────────────────────

    def run(self) -> None:
        import pystray
        from pystray import MenuItem as Item, Menu

        menu = Menu(
            Item("MarketPulse", None, enabled=False),
            Menu.SEPARATOR,
            Item("App 열기",  self._open_app),
            Item("Web 열기",  self._open_web),
            Menu.SEPARATOR,
            Item("종료",       self._quit),
        )

        icon = pystray.Icon(
            name="MarketPulse",
            icon=_load_icon(),
            title="MarketPulse",
            menu=menu,
        )
        icon.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    MarketPulseLauncher().run()
