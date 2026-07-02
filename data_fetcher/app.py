"""
MarketPulse Fetcher — 로컬 PC 상주 데스크탑 앱 진입점.

Windows / Mac 실행파일(.exe / .app)로 배포된다.
GUI 환경이면 시스템 트레이 아이콘으로, 없으면 헤드리스 REST 서버로 동작한다.

빌드:
    ./build/build.sh        (Mac → .app)
    ./build/build.bat       (Windows → .exe)

환경변수 (.env 또는 OS 환경):
    FETCHER_HOST             기본 127.0.0.1
    FETCHER_PORT             기본 8765
    FETCHER_ALLOWED_ORIGINS  CORS 허용 origin(쉼표구분).  예) https://app.example.com
    FETCHER_LOG_LEVEL        기본 info
    FETCHER_HEADLESS         1이면 트레이 없이 REST만 기동 (서버·CI 환경용)
    FETCHER_BACKEND_WS_URL   백엔드 /ws/fetcher 워커 풀 주소. 미설정이면 클라우드 기본값
                             (wss://api.finance.dns-co.kr/ws/fetcher)으로 합류한다.
                             빈 문자열("")로 설정하면 합류 비활성(로컬 전용).
    FETCHER_USER_TOKEN       워커 풀 합류 시 사용할 사용자 로그인 JWT(access token).
                             데스크톱 앱이 로그인 후 토큰 파일로 주입한다(env로도 가능).
                             백엔드가 이 토큰의 user_id로 워커를 등록 → 그 사용자 요청만 위임.
    FMP_API_KEY 등            provider 키 (REST /keys 로도 등록 가능)
"""
from __future__ import annotations

import logging
import os
import sys


def _load_dotenv() -> None:
    try:
        from dotenv import load_dotenv
        # exe 옆 .env 우선, 없으면 홈 디렉토리
        from pathlib import Path
        exe_dir = Path(sys.executable).parent if getattr(sys, "frozen", False) else Path(__file__).parent
        candidates = [exe_dir / ".env", Path.home() / ".marketpulse_fetcher" / ".env"]
        for p in candidates:
            if p.exists():
                load_dotenv(p)
                break
        else:
            load_dotenv()
    except Exception:
        pass


def _setup_logging(port: int) -> None:
    from pathlib import Path
    log_dir = Path.home() / ".marketpulse_fetcher"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "fetcher.log"

    level = os.getenv("FETCHER_LOG_LEVEL", "info").upper()
    handlers: list = [logging.StreamHandler()]
    try:
        handlers.append(logging.FileHandler(log_file, encoding="utf-8"))
    except Exception:
        pass

    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        handlers=handlers,
    )


def _run_headless(port: int) -> None:
    """트레이 없이 REST 서버만 기동 (헤드리스 모드)."""
    import data_fetcher.providers_init  # noqa: F401
    from data_fetcher.server import create_app

    host = os.getenv("FETCHER_HOST", "127.0.0.1")
    raw_origins = os.getenv("FETCHER_ALLOWED_ORIGINS", "")
    origins = [o.strip() for o in raw_origins.split(",") if o.strip()] or None
    app = create_app(allowed_origins=origins)

    import uvicorn
    logging.getLogger(__name__).info(
        "[fetcher] headless mode — http://%s:%d", host, port
    )
    uvicorn.run(app, host=host, port=port,
                log_level=os.getenv("FETCHER_LOG_LEVEL", "info"),
                # console=False exe 는 sys.stdout=None → uvicorn 컬러 포매터가
                # isatty 접근에서 죽는다. 자체 로깅을 쓰므로 uvicorn 로그설정 비활성.
                log_config=None)


def main() -> None:
    _load_dotenv()
    port = int(os.getenv("FETCHER_PORT", "8765"))
    _setup_logging(port)

    # marketpulse:// 스킴 자가등록 — 웹의 'Fetcher 실행' 딥링크가 동작하도록(best-effort).
    try:
        from data_fetcher.server.protocol import register_url_scheme
        register_url_scheme()
    except Exception as exc:  # 등록 실패는 무시 (웹 실행 버튼만 비활성)
        logging.getLogger(__name__).debug("[fetcher] URL 스킴 등록 건너뜀: %s", exc)

    headless = os.getenv("FETCHER_HEADLESS", "0") == "1"

    if headless:
        _run_headless(port)
        return

    # 트레이 모드 — pystray 없거나 headless 환경이면 자동으로 헤드리스로 낙하
    try:
        import pystray  # noqa: F401 — import 가능 여부 먼저 확인
        import importlib
        _tray_mod = importlib.import_module("data_fetcher.tray")
        _tray_mod.TrayApp(port=port).run()
    except (ImportError, Exception) as exc:
        logging.getLogger(__name__).warning(
            "[fetcher] tray unavailable (%s), falling back to headless", exc
        )
        _run_headless(port)


if __name__ == "__main__":
    main()
