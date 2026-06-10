# -*- mode: python ; coding: utf-8 -*-
"""
MarketPulse Fetcher — PyInstaller 빌드 스펙 (Windows / Mac 공용)

생성 파일:
    Windows: dist/MarketPulseFetcher.exe   (단일 파일)
    Mac    : dist/MarketPulseFetcher.app   (앱 번들)
"""
import sys
from pathlib import Path

project_root = Path(SPECPATH).parent          # marketpulse/
data_fetcher = project_root / "data_fetcher"

# ── 수집할 데이터 파일 ────────────────────────────────────────────────────────
datas = [
    # 트레이 아이콘
    (str(data_fetcher / "assets"), "data_fetcher/assets"),
]

# ── 숨겨진 import (런타임에 동적으로 로드되는 모듈) ───────────────────────────
hiddenimports = [
    # pystray 백엔드 — Windows는 win32, Mac은 darwin
    "pystray._win32" if sys.platform == "win32" else "pystray._darwin",
    "pystray",
    # PIL 이미지 핸들러
    "PIL.Image", "PIL.ImageDraw", "PIL.ImageFont", "PIL.PngImagePlugin",
    # uvicorn 내부 모듈
    "uvicorn.logging", "uvicorn.loops", "uvicorn.loops.asyncio",
    "uvicorn.protocols", "uvicorn.protocols.http", "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.http.httptools_impl",
    "uvicorn.protocols.websockets", "uvicorn.protocols.websockets.websockets_impl",
    "uvicorn.lifespan", "uvicorn.lifespan.on",
    # fastapi / starlette
    "fastapi", "starlette.routing",
    # pydantic
    "pydantic", "pydantic_core",
    # data_fetcher providers — providers_init.py가 동적으로 임포트함
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
    # dotenv (선택)
    "dotenv",
]

# ── 분석 ─────────────────────────────────────────────────────────────────────
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
        # 백엔드 서버 의존성 제외 (Fetcher는 필요 없음)
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

# ── Windows: 단일 .exe ───────────────────────────────────────────────────────
if sys.platform == "win32":
    exe = EXE(
        pyz, a.scripts, a.binaries, a.zipfiles, a.datas,
        name="MarketPulseFetcher",
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=True,          # UPX 압축 (설치돼 있으면 적용)
        upx_exclude=[],
        runtime_tmpdir=None,
        console=False,     # 콘솔 창 숨김 (트레이 앱)
        icon=str(data_fetcher / "assets" / "icon.ico"),
        onefile=True,
    )

# ── Mac: .app 번들 ───────────────────────────────────────────────────────────
else:
    exe = EXE(
        pyz,
        a.scripts,
        [],               # Mac 번들은 binaries/datas를 COLLECT에 넘김
        exclude_binaries=True,
        name="MarketPulseFetcher",
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=False,
        console=False,
        icon=str(data_fetcher / "assets" / "icon.png"),
    )
    coll = COLLECT(
        exe,
        a.binaries,
        a.zipfiles,
        a.datas,
        strip=False,
        upx=False,
        name="MarketPulseFetcher",
    )
    app = BUNDLE(
        coll,
        name="MarketPulseFetcher.app",
        icon=str(data_fetcher / "assets" / "icon.png"),
        bundle_identifier="com.marketpulse.fetcher",
        info_plist={
            "CFBundleName":               "MarketPulse Fetcher",
            "CFBundleDisplayName":        "MarketPulse Fetcher",
            "CFBundleVersion":            "0.1.0",
            "CFBundleShortVersionString": "0.1.0",
            "NSHighResolutionCapable":    True,
            "LSUIElement":                True,   # Dock에 안 뜸 (트레이 전용)
            "NSHumanReadableCopyright":   "MarketPulse",
        },
    )
