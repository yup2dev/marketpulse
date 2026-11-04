"""
MarketPulse Fetcher — 시스템 트레이 데스크탑 앱.

트레이 아이콘을 클릭하면 메뉴가 뜨고, 백그라운드에서 REST 서버가 상주한다.
Windows / Mac 둘 다 동작 (pystray 크로스플랫폼).

메뉴:
    상태 (비활성 아이템 — 서버 포트/상태 표시)
    ───
    API 키 설정      → 브라우저로 관리 페이지 열기
    로그 보기        → 로그 파일 열기
    ───
    종료
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys
import threading
import webbrowser
from pathlib import Path
from typing import Optional

log = logging.getLogger(__name__)


def _load_icon():
    """번들 또는 소스에서 아이콘 이미지 로드."""
    from PIL import Image

    # PyInstaller 번들 경로
    base = getattr(sys, "_MEIPASS", None) or Path(__file__).parent
    candidates = [
        Path(base) / "assets" / "icon.png",
        Path(__file__).parent / "assets" / "icon.png",
    ]
    for p in candidates:
        if p.exists():
            return Image.open(p).convert("RGBA")

    # fallback: 코드로 생성
    from PIL import ImageDraw
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([2, 2, 62, 62], fill="#1a2e1a", outline="#00ff88", width=3)
    d.text((32, 32), "F", fill="#00ff88", anchor="mm")
    return img


class TrayApp:
    def __init__(self, port: int) -> None:
        self.port = port
        self._server_thread: Optional[threading.Thread] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._icon = None

    # ── 서버 스레드 ───────────────────────────────────────────────────────────
    def _start_server(self) -> None:
        try:
            import data_fetcher.providers_init  # noqa: F401
            from data_fetcher.server import create_app

            host = os.getenv("FETCHER_HOST", "127.0.0.1")
            raw_origins = os.getenv("FETCHER_ALLOWED_ORIGINS", "")
            origins = [o.strip() for o in raw_origins.split(",") if o.strip()] or None

            app = create_app(allowed_origins=origins)

            import uvicorn
            config = uvicorn.Config(
                app, host=host, port=self.port,
                log_level=os.getenv("FETCHER_LOG_LEVEL", "info"),
                loop="asyncio",
                # console=False 로 패키징된 exe 는 sys.stdout 이 None 이라
                # uvicorn 기본 컬러 포매터(isatty 접근)가 죽는다. 자체 로깅을
                # app.py._setup_logging 에서 구성하므로 uvicorn 로그설정은 끈다.
                log_config=None,
            )
            server = uvicorn.Server(config)
            # asyncio.run()으로 스레드 전용 이벤트 루프 생성 (macOS 호환)
            asyncio.run(server.serve())
        except Exception:
            log.exception("[tray] REST server thread failed — 포트 %d", self.port)

    def _run_server_thread(self) -> None:
        self._server_thread = threading.Thread(
            target=self._start_server, daemon=True, name="fetcher-rest"
        )
        self._server_thread.start()

    # ── 트레이 메뉴 액션 ─────────────────────────────────────────────────────
    def _open_keys(self, icon, item) -> None:
        """브라우저로 API 키 관리 페이지 열기."""
        webbrowser.open(f"http://127.0.0.1:{self.port}/")

    def _open_log(self, icon, item) -> None:
        log_path = Path.home() / ".marketpulse_fetcher" / "fetcher.log"
        if sys.platform == "win32":
            os.startfile(str(log_path)) if log_path.exists() else None
        elif sys.platform == "darwin":
            os.system(f"open -a Console '{log_path}'")
        else:
            os.system(f"xdg-open '{log_path}'")

    def _quit(self, icon, item) -> None:
        icon.stop()
        os._exit(0)

    # ── 트레이 아이콘 빌드 + 실행 ─────────────────────────────────────────────
    def run(self) -> None:
        import pystray
        from pystray import MenuItem as Item, Menu

        self._run_server_thread()

        status_label = f"MarketPulse Fetcher  :{self.port}"

        menu = Menu(
            Item(status_label, None, enabled=False),
            Menu.SEPARATOR,
            Item("API 키 설정 (브라우저)", self._open_keys),
            Item("로그 보기", self._open_log),
            Menu.SEPARATOR,
            Item("종료", self._quit),
        )

        icon = pystray.Icon(
            name="MarketPulseFetcher",
            icon=_load_icon(),
            title=status_label,
            menu=menu,
        )
        self._icon = icon
        log.info("[tray] 트레이 아이콘 시작 — port=%d", self.port)
        icon.run()
