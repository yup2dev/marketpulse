"""MarketPulse Fetcher 실행파일 빌드 (Windows / macOS 공용).

Rust 런처(MarketpulseFetcher/launcher) 안에 Python 런타임 + data_fetcher 를 통째로
넣은 단일 실행파일을 만든다. 사용자 PC 에 Python 이 없어도 된다.

    python MarketpulseFetcher/build/build.py [--clean] [--no-desktop]

산출물:
    Windows: MarketpulseFetcher/build/dist/MarketPulseFetcher.exe
    macOS  : MarketpulseFetcher/build/dist/MarketPulseFetcher.app

필요 도구: uv (Python 런타임·패키지 설치), cargo (Rust 런처 빌드).
빌드에 쓰는 파이썬은 아무거나 상관없다 — 번들되는 파이썬은 uv 가 받은
python-build-standalone 이고, 의존성은 requirements-fetcher.txt 로 그 안에 설치한다.

단계:
    1. uv 로 독립 실행형 CPython 확보 → work/payload/python 에 복사, 불필요한 stdlib 정리
    2. requirements-fetcher.txt 를 그 파이썬 site-packages 에 설치 + data_fetcher 복사
    3. 바이트코드 미리 컴파일(unchecked-hash: 풀린 뒤 mtime 이 달라도 재컴파일 안 함)
    4. payload.zip 생성 → sha256 앞 16자를 페이로드 ID 로
    5. MP_PAYLOAD / MP_PAYLOAD_ID 를 넘겨 cargo build --release
"""
from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

PYTHON_VERSION = "3.13"
APP_NAME = "MarketPulseFetcher"

BUILD_DIR = Path(__file__).resolve().parent          # MarketpulseFetcher/build
FETCHER_ROOT = BUILD_DIR.parent                      # MarketpulseFetcher
LAUNCHER_DIR = FETCHER_ROOT / "launcher"
PACKAGE_DIR = FETCHER_ROOT / "data_fetcher"
WORK_DIR = BUILD_DIR / "work"
DIST_DIR = BUILD_DIR / "dist"
PAYLOAD_DIR = WORK_DIR / "payload"
PAYLOAD_ZIP = WORK_DIR / "payload.zip"


def _read_version() -> str:
    """버전 단일 소스: data_fetcher/__init__.py 의 __version__ (Fetcher /health 와 동일)."""
    import re
    text = (PACKAGE_DIR / "__init__.py").read_text(encoding="utf-8")
    m = re.search(r"^__version__\s*=\s*['\"]([^'\"]+)['\"]", text, re.M)
    if not m:
        sys.exit("❌ data_fetcher/__init__.py 에서 __version__ 을 찾지 못했습니다.")
    return m.group(1)


VERSION = _read_version()

WINDOWS = sys.platform == "win32"
MACOS = sys.platform == "darwin"

# python 접두 폴더 기준 상대경로 — Fetcher 가 쓰지 않는 stdlib/개발용 파일
_PRUNE_WIN = [
    "Lib/test", "Lib/idlelib", "Lib/tkinter", "Lib/turtledemo", "Lib/ensurepip",
    "tcl", "include", "libs", "Scripts", "Doc",
    "DLLs/_tkinter.pyd", "DLLs/tcl86t.dll", "DLLs/tk86t.dll",
]
_PRUNE_MAC = [
    f"lib/python{PYTHON_VERSION}/{d}"
    for d in ("test", "idlelib", "tkinter", "turtledemo", "ensurepip")
] + ["include", "share", "lib/pkgconfig"]
# site-packages 안에서 지울 것 (테스트 스위트 — pandas 만 수십 MB)
_PRUNE_SITE = ["pip", "pandas/tests", "numpy/tests", "numpy/_core/tests"]


def log(msg: str) -> None:
    print(f"▶ {msg}", flush=True)


def run(cmd: list, **kw) -> subprocess.CompletedProcess:
    print("  $ " + " ".join(str(c) for c in cmd), flush=True)
    return subprocess.run([str(c) for c in cmd], check=True, **kw)


def which(tool: str, extra: list[Path] = ()) -> str:
    found = shutil.which(tool)
    if found:
        return found
    for d in extra:
        p = d / (tool + (".exe" if WINDOWS else ""))
        if p.exists():
            return str(p)
    sys.exit(f"❌ {tool} 를 찾을 수 없습니다. 설치 후 다시 실행하세요.")


def rmtree(p: Path) -> None:
    if p.is_dir():
        shutil.rmtree(p)
    elif p.exists():
        p.unlink()


# ── 1. 파이썬 런타임 ────────────────────────────────────────────────────────

def standalone_python(uv: str) -> Path:
    """uv 가 관리하는 python-build-standalone 설치 경로(sys.base_prefix)."""
    # `uv python find` 는 활성 venv(VIRTUAL_ENV)를 먼저 잡는다 — 그 기반 파이썬엔 PC 에 깔린
    # 패키지가 섞여 있으므로 쓰면 안 된다. 전용 설치 폴더를 직접 뒤져 uv 가 받은 것만 쓴다.
    install_dir = WORK_DIR / "uv-python"
    env = {k: v for k, v in os.environ.items() if k != "VIRTUAL_ENV"}
    env["UV_PYTHON_INSTALL_DIR"] = str(install_dir)
    run([uv, "python", "install", PYTHON_VERSION], env=env)
    candidates = sorted(
        d for d in install_dir.glob(f"cpython-{PYTHON_VERSION}.*")
        if d.is_dir() and not d.is_symlink() and not getattr(d, "is_junction", lambda: False)()
        and "freethreaded" not in d.name and python_exe(d).exists()
    )
    if not candidates:
        sys.exit(f"❌ uv 가 설치한 Python {PYTHON_VERSION} 을 찾지 못했습니다: {install_dir}")
    return candidates[-1]


def python_exe(prefix: Path) -> Path:
    return prefix / "python.exe" if WINDOWS else prefix / "bin" / "python3"


def prepare_python(uv: str) -> tuple[Path, Path]:
    src = standalone_python(uv)
    log(f"Python 런타임 복사: {src}")
    dst = PAYLOAD_DIR / "python"
    shutil.copytree(src, dst, symlinks=False)  # 링크는 실제 파일로 (zip 에 링크를 못 담는다)
    for rel in _PRUNE_WIN if WINDOWS else _PRUNE_MAC:
        rmtree(dst / rel)
    if MACOS:
        for d in (dst / "lib").glob("t[ck]*"):   # tcl/tk 런타임
            rmtree(d)

    py = python_exe(dst)
    site = Path(subprocess.run(
        [py, "-I", "-c", "import sysconfig; print(sysconfig.get_path('purelib'))"],
        check=True, capture_output=True, text=True).stdout.strip())
    stdlib = Path(subprocess.run(
        [py, "-I", "-c", "import sysconfig; print(sysconfig.get_path('stdlib'))"],
        check=True, capture_output=True, text=True).stdout.strip())
    # uv 관리 파이썬은 PEP 668 마커가 있어 pip 설치를 막는다 — 번들 전용이므로 제거
    rmtree(stdlib / "EXTERNALLY-MANAGED")
    return py, site


# ── 2. 의존성 + 패키지 ──────────────────────────────────────────────────────

def install_packages(uv: str, py: Path, site: Path) -> None:
    log("의존성 설치 (requirements-fetcher.txt)")
    env = {k: v for k, v in os.environ.items() if k != "VIRTUAL_ENV"}
    run([uv, "pip", "install", "--python", py, "--link-mode", "copy",
         "-r", BUILD_DIR / "requirements-fetcher.txt"], env=env)
    for rel in _PRUNE_SITE:
        rmtree(site / rel)

    log("data_fetcher 복사")
    shutil.copytree(
        PACKAGE_DIR, site / "data_fetcher",
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "tests", "tray.py"),
    )
    # 번들된 런타임에서 실제로 import 되는지 확인 (지연 import 누락 등을 빌드에서 잡는다)
    log("import 확인")
    run([py, "-I", "-c",
         "import data_fetcher.providers_init, data_fetcher.server, xmltodict, uvicorn; "
         "from data_fetcher.utils.registry import FetcherRegistry as R; "
         "print('  providers:', len(R.list_providers()))"],
        env={**os.environ, "FETCHER_LAUNCHER": "1"})


def compile_bytecode(py: Path) -> None:
    log("바이트코드 컴파일")
    run([py, "-I", "-m", "compileall", "-q", "-f", "-j", "0",
         "--invalidation-mode", "unchecked-hash", PAYLOAD_DIR / "python"],
        stdout=subprocess.DEVNULL)


# ── 3. 페이로드 zip ─────────────────────────────────────────────────────────

def write_payload(py: Path, site: Path) -> str:
    rel = lambda p: p.relative_to(PAYLOAD_DIR).as_posix()  # noqa: E731
    (PAYLOAD_DIR / "launch.txt").write_text(
        f"python={rel(py)}\nsite={rel(site)}\nversion={VERSION}\n", encoding="utf-8")

    log("payload.zip 생성")
    files = sorted(p for p in PAYLOAD_DIR.rglob("*") if p.is_file())
    with zipfile.ZipFile(PAYLOAD_ZIP, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for p in files:
            zf.write(p, rel(p))

    h = hashlib.sha256()
    with PAYLOAD_ZIP.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    size_mb = PAYLOAD_ZIP.stat().st_size / 1e6
    print(f"  {len(files)} files, {size_mb:.1f} MB, id={h.hexdigest()[:16]}")
    return h.hexdigest()[:16]


# ── 4. Rust 런처 ────────────────────────────────────────────────────────────

def build_launcher(payload_id: str) -> Path:
    cargo = which("cargo", [Path.home() / ".cargo" / "bin"])
    log("Rust 런처 빌드 (cargo build --release)")
    run([cargo, "build", "--release", "--manifest-path", LAUNCHER_DIR / "Cargo.toml"],
        env={**os.environ, "MP_PAYLOAD": str(PAYLOAD_ZIP), "MP_PAYLOAD_ID": payload_id})
    exe = LAUNCHER_DIR / "target" / "release" / (APP_NAME + (".exe" if WINDOWS else ""))

    DIST_DIR.mkdir(parents=True, exist_ok=True)
    if WINDOWS:
        out = DIST_DIR / f"{APP_NAME}.exe"
        rmtree(out)
        shutil.copy2(exe, out)
        return out
    if MACOS:
        return make_app_bundle(exe)
    out = DIST_DIR / APP_NAME
    shutil.copy2(exe, out)
    return out


def make_app_bundle(exe: Path) -> Path:
    """macOS .app — Info.plist 의 CFBundleURLTypes 로 marketpulse:// 스킴도 등록된다."""
    app = DIST_DIR / f"{APP_NAME}.app"
    rmtree(app)
    (app / "Contents" / "MacOS").mkdir(parents=True)
    (app / "Contents" / "Resources").mkdir()
    shutil.copy2(exe, app / "Contents" / "MacOS" / APP_NAME)

    icon_entry = ""
    icns = app / "Contents" / "Resources" / "icon.icns"
    try:
        run(["sips", "-s", "format", "icns", PACKAGE_DIR / "assets" / "icon.png", "--out", icns],
            stdout=subprocess.DEVNULL)
        icon_entry = "  <key>CFBundleIconFile</key><string>icon</string>\n"
    except (OSError, subprocess.CalledProcessError):
        print("  (아이콘 변환 실패 — 기본 아이콘 사용)")

    (app / "Contents" / "Info.plist").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" '
        '"http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n'
        '<plist version="1.0"><dict>\n'
        '  <key>CFBundleName</key><string>MarketPulse Fetcher</string>\n'
        '  <key>CFBundleDisplayName</key><string>MarketPulse Fetcher</string>\n'
        '  <key>CFBundleIdentifier</key><string>com.marketpulse.fetcher</string>\n'
        f'  <key>CFBundleExecutable</key><string>{APP_NAME}</string>\n'
        '  <key>CFBundlePackageType</key><string>APPL</string>\n'
        '  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>\n'
        f'  <key>CFBundleVersion</key><string>{VERSION}</string>\n'
        f'  <key>CFBundleShortVersionString</key><string>{VERSION}</string>\n'
        + icon_entry +
        '  <key>NSHighResolutionCapable</key><true/>\n'
        '  <key>LSUIElement</key><true/>\n'
        '  <key>CFBundleURLTypes</key><array><dict>\n'
        '    <key>CFBundleURLName</key><string>MarketPulse Fetcher</string>\n'
        '    <key>CFBundleURLSchemes</key><array><string>marketpulse</string></array>\n'
        '  </dict></array>\n'
        '</dict></plist>\n',
        encoding="utf-8",
    )
    return app


# ── 5. 바탕화면 복사 ────────────────────────────────────────────────────────

def copy_to_desktop(artifact: Path) -> None:
    if WINDOWS:
        # 실행 중이면 덮어쓰기가 실패한다 (best-effort 종료)
        subprocess.run(["taskkill", "/F", "/IM", f"{APP_NAME}.exe"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        # 바탕화면이 OneDrive 로 리다이렉트된 PC 는 ~/Desktop 이 실제 바탕화면이 아니다
        desktop = Path(subprocess.run(
            ["powershell", "-NoProfile", "-Command", "[Environment]::GetFolderPath('Desktop')"],
            capture_output=True, text=True).stdout.strip() or Path.home() / "Desktop")
    else:
        desktop = Path.home() / "Desktop"
    dst = desktop / artifact.name
    rmtree(dst)
    if artifact.is_dir():
        shutil.copytree(artifact, dst, symlinks=True)
    else:
        shutil.copy2(artifact, dst)
    print(f"  {dst}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--clean", action="store_true", help="uv 로 받은 파이썬 캐시까지 지우고 빌드")
    ap.add_argument("--no-desktop", action="store_true", help="바탕화면 복사 생략 (CI)")
    args = ap.parse_args()
    # 리다이렉트된 콘솔(cp949 등)에서도 이모지/한글 출력이 죽지 않게
    for s in (sys.stdout, sys.stderr):
        s.reconfigure(encoding="utf-8", errors="replace")

    uv = which("uv", [Path.home() / ".local" / "bin", Path.home() / ".cargo" / "bin"])
    if args.clean:
        rmtree(WORK_DIR)
        rmtree(DIST_DIR)
    rmtree(PAYLOAD_DIR)
    rmtree(PAYLOAD_ZIP)
    PAYLOAD_DIR.mkdir(parents=True)

    py, site = prepare_python(uv)
    install_packages(uv, py, site)
    compile_bytecode(py)
    payload_id = write_payload(py, site)
    artifact = build_launcher(payload_id)
    print(f"\n✅ 빌드 완료: {artifact}")

    if not args.no_desktop:
        log("바탕화면에 복사")
        copy_to_desktop(artifact)
    print("\n▶ 사용법:\n"
          "   1. MarketPulseFetcher 실행 (첫 실행은 런타임을 푸느라 1분 정도 걸림)\n"
          "   2. 트레이 아이콘 확인 (Windows: 작업표시줄 / Mac: 메뉴바)\n"
          "   3. API 키 설정 → 트레이 메뉴 또는 http://127.0.0.1:8765/")


if __name__ == "__main__":
    main()
