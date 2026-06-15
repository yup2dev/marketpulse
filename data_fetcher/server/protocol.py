"""marketpulse:// 커스텀 URL 스킴 자가등록 (Windows / macOS).

웹페이지(finance.dns-co.kr)는 보안상 임의 로컬 exe를 경로로 실행할 수 없다. 대신
'marketpulse://start' 같은 커스텀 스킴을 OS에 등록해두면, 웹의 '실행' 버튼이 그 링크로
딥링크해 OS가 Fetcher를 띄울 수 있다(Zoom/Slack '앱에서 열기'와 동일 방식).

Fetcher는 기동 시 자기 자신을 이 스킴의 핸들러로 등록한다(멱등). 스킴 호출의 유일한
목적은 "Fetcher 프로세스를 띄우는 것"이라, 전달된 URL 인자는 무시하고 평소처럼 기동한다.

- Windows: HKCU\\Software\\Classes\\marketpulse (관리자 불필요)
- macOS  : ~/Applications 에 최소 .app 래퍼 생성 후 Launch Services(lsregister)로 등록.
           (단일 바이너리는 스킴 핸들러가 될 수 없어, 현재 실행파일을 실행하는 래퍼 .app을 둔다)
"""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import List

from data_fetcher.server.keystore import _config_dir

log = logging.getLogger(__name__)

SCHEME = "marketpulse"


def _fetcher_argv() -> List[str]:
    """Fetcher를 기동하는 실행 인자 목록. 동결 빌드면 실행파일, 소스면 python -m."""
    if getattr(sys, "frozen", False):
        return [sys.executable]
    return [sys.executable, "-m", "data_fetcher.app"]


# ── Windows ──────────────────────────────────────────────────────────────────

def _register_windows() -> bool:
    import winreg  # type: ignore

    argv = _fetcher_argv()
    # 핸들러 명령: "<fetcher>" "%1"  (소스 모드면 python -m ... 형태로 펼침)
    cmd = " ".join(f'"{a}"' for a in argv) + ' "%1"'
    base = r"Software\Classes\marketpulse"

    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, base) as k:
        winreg.SetValueEx(k, None, 0, winreg.REG_SZ, "URL:MarketPulse Fetcher")
        winreg.SetValueEx(k, "URL Protocol", 0, winreg.REG_SZ, "")
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, base + r"\shell\open\command") as k:
        winreg.SetValueEx(k, None, 0, winreg.REG_SZ, cmd)
    log.info("[fetcher] URL 스킴 등록(Windows): %s:// → %s", SCHEME, cmd)
    return True


# ── macOS ────────────────────────────────────────────────────────────────────

_LSREGISTER = (
    "/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/"
    "LaunchServices.framework/Versions/A/Support/lsregister"
)


def _mac_app_dir() -> Path:
    return Path.home() / "Applications" / "MarketPulse Fetcher.app"


def _register_macos() -> bool:
    import shlex
    import subprocess

    argv = _fetcher_argv()
    exec_line = " ".join(shlex.quote(a) for a in argv)

    app = _mac_app_dir()
    macos_dir = app / "Contents" / "MacOS"
    macos_dir.mkdir(parents=True, exist_ok=True)

    # 현재 실행 인자 마커 — 바뀌지 않았으면 재등록 생략(lsregister 비용 절감)
    marker = _config_dir() / "scheme_exec"
    if app.exists() and marker.exists() and marker.read_text(encoding="utf-8").strip() == exec_line:
        return True

    launcher = macos_dir / "launch"
    launcher.write_text(
        "#!/bin/sh\n# marketpulse:// 호출 시 Fetcher를 기동(전달 URL은 무시).\nexec " + exec_line + "\n",
        encoding="utf-8",
    )
    os.chmod(launcher, 0o755)

    info_plist = app / "Contents" / "Info.plist"
    info_plist.write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" '
        '"http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n'
        '<plist version="1.0"><dict>\n'
        '  <key>CFBundleName</key><string>MarketPulse Fetcher</string>\n'
        '  <key>CFBundleIdentifier</key><string>kr.dns-co.marketpulse.fetcher-launcher</string>\n'
        '  <key>CFBundleExecutable</key><string>launch</string>\n'
        '  <key>CFBundlePackageType</key><string>APPL</string>\n'
        '  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>\n'
        '  <key>LSBackgroundOnly</key><true/>\n'
        '  <key>CFBundleURLTypes</key><array><dict>\n'
        '    <key>CFBundleURLName</key><string>MarketPulse Fetcher</string>\n'
        '    <key>CFBundleURLSchemes</key><array><string>marketpulse</string></array>\n'
        '  </dict></array>\n'
        '</dict></plist>\n',
        encoding="utf-8",
    )

    if os.path.exists(_LSREGISTER):
        subprocess.run([_LSREGISTER, "-f", str(app)], check=False,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    marker.write_text(exec_line, encoding="utf-8")
    log.info("[fetcher] URL 스킴 등록(macOS): %s:// → %s", SCHEME, app)
    return True


# ── 공개 진입점 ───────────────────────────────────────────────────────────────

def register_url_scheme() -> bool:
    """현재 OS에 맞게 marketpulse:// 스킴을 등록한다(best-effort, 멱등).

    실패해도 예외를 던지지 않는다 — '웹에서 실행' 기능만 비활성될 뿐 Fetcher 동작엔 무관.
    """
    try:
        if sys.platform.startswith("win"):
            return _register_windows()
        if sys.platform == "darwin":
            return _register_macos()
        log.debug("[fetcher] URL 스킴 자가등록 미지원 플랫폼: %s", sys.platform)
        return False
    except Exception as exc:  # 등록 실패는 치명적이지 않다
        log.warning("[fetcher] URL 스킴 등록 실패(무시): %s", exc)
        return False
