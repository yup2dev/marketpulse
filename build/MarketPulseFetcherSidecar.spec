# -*- mode: python ; coding: utf-8 -*-
"""
MarketPulse Fetcher — Tauri sidecar 전용 빌드 스펙 (단일 self-contained 실행파일).

MarketPulseFetcher.spec(.app 번들/​.exe)와 달리, Tauri의 externalBin은
"<name>-<target-triple>" 형태의 *단일 실행파일*을 요구한다. onedir(.app) 빌드의
실행파일만 추출하면 옆에 있던 Frameworks/_internal 의존성이 빠져 구동이 안 된다
(`Failed to load Python shared library .../_internal/Python`).

그래서 onefile=True 로 빌드해 모든 의존성을 단일 바이너리에 담는다 — 실행 시
임시 디렉터리(_MEIxxxxxx)에 자동 압축 해제되어 동작한다 (Win/Mac 공용).

생성 파일: dist/marketpulse-fetcher-sidecar(.exe)
"""
import sys
from pathlib import Path

project_root = Path(SPECPATH).parent
data_fetcher = project_root / "data_fetcher"

datas = [
    (str(data_fetcher / "assets"), "data_fetcher/assets"),
]

hiddenimports = [
    "pystray._win32" if sys.platform == "win32" else "pystray._darwin",
    "pystray",
    "PIL.Image", "PIL.ImageDraw", "PIL.ImageFont", "PIL.PngImagePlugin",
    "uvicorn.logging", "uvicorn.loops", "uvicorn.loops.asyncio",
    "uvicorn.protocols", "uvicorn.protocols.http", "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.http.httptools_impl",
    "uvicorn.protocols.websockets", "uvicorn.protocols.websockets.websockets_impl",
    "uvicorn.lifespan", "uvicorn.lifespan.on",
    "fastapi", "starlette.routing",
    "pydantic", "pydantic_core",
    "data_fetcher.providers_init",
    "data_fetcher.providers.yahoo",
    "data_fetcher.providers.fmp",
    "data_fetcher.providers.polygon",
    "data_fetcher.providers.fred",
    "data_fetcher.providers.alphavantage",
    "data_fetcher.providers.sec",
    "data_fetcher.providers.whalewisdom",
    "data_fetcher.providers.krx",
    "data_fetcher.providers.nasdaqtrader",
    "data_fetcher.server",
    "data_fetcher.tray",
    "dotenv",
]

a = Analysis(
    [str(data_fetcher / "app.py")],
    pathex=[str(project_root)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "sqlalchemy", "alembic", "psycopg2",
        "fastapi_mail",
        "pytest", "black", "mypy",
        "matplotlib", "scipy",
        "IPython", "notebook", "jupyter",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data)

exe = EXE(
    pyz, a.scripts, a.binaries, a.zipfiles, a.datas,
    name="marketpulse-fetcher-sidecar",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    runtime_tmpdir=None,
    console=False,
    onefile=True,
)
