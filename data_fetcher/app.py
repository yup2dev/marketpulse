"""
MarketPulse Fetcher — 로컬 PC 상주 실행파일 진입점 (browser-mediated).

같은 PC의 브라우저가 localhost로 직접 호출하는 REST 서버를 띄운다.
API 키를 보유하고 외부 provider(FMP 등)를 조회해 raw 데이터를 반환한다.

    브라우저 ──http://localhost:8765──▶ 이 서버 ──▶ 외부 provider ──▶ raw
    (브라우저가 raw를 받아 외부 WebServer /api/calc 로 전달)

실행:
    python -m data_fetcher.app

PyInstaller 패키징 (Windows .exe):
    pyinstaller --onefile --name MarketPulseFetcher \
        --collect-submodules data_fetcher \
        data_fetcher/app.py

환경변수 (.env 또는 OS 환경):
    FETCHER_HOST              기본 127.0.0.1 (로컬 전용 — 외부 노출 금지 권장)
    FETCHER_PORT             기본 8765
    FETCHER_ALLOWED_ORIGINS  CORS 허용 origin(쉼표구분).
                             예) https://app.example.com,http://localhost:5173
    FETCHER_LOG_LEVEL        기본 info
    FMP_API_KEY 등            provider 키 (REST /keys 로도 등록 가능)
"""
from __future__ import annotations

import logging
import os


def _load_dotenv() -> None:
    """exe 옆 .env 가 있으면 로드 (python-dotenv 미설치 시 조용히 스킵)."""
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except Exception:
        pass


def main() -> None:
    _load_dotenv()
    log_level = os.getenv("FETCHER_LOG_LEVEL", "info")
    logging.basicConfig(
        level=log_level.upper(),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    # 모든 provider/fetcher 등록 — QueryExecutor 조회의 전제
    import data_fetcher.providers_init  # noqa: F401

    from data_fetcher.server import create_app

    host = os.getenv("FETCHER_HOST", "127.0.0.1")
    port = int(os.getenv("FETCHER_PORT", "8765"))
    raw_origins = os.getenv("FETCHER_ALLOWED_ORIGINS", "")
    origins = [o.strip() for o in raw_origins.split(",") if o.strip()] or None

    app = create_app(allowed_origins=origins)

    import uvicorn
    logging.getLogger("data_fetcher.app").info(
        "starting Fetcher REST on http://%s:%d (origins=%s)", host, port, origins or "['*']"
    )
    uvicorn.run(app, host=host, port=port, log_level=log_level)


if __name__ == "__main__":
    main()
