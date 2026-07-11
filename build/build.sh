#!/usr/bin/env bash
# MarketPulse Fetcher 빌드 스크립트 (Mac / Windows git-bash 공용)
# 출력: Mac     → build/dist/MarketPulseFetcher.app
#       Windows → build/dist/MarketPulseFetcher.exe
# 사용: bash build/build.sh [--clean]
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$ROOT/build"
DIST_DIR="$BUILD_DIR/dist"
WORK_DIR="$BUILD_DIR/work"

# OS 감지 — git-bash(msys)/cygwin 이면 Windows 빌드
WINDOWS=0
case "$OSTYPE" in
  msys*|cygwin*|win32*) WINDOWS=1 ;;
esac

echo "▶ MarketPulse Fetcher 빌드 시작 ($([[ $WINDOWS == 1 ]] && echo Windows || echo Mac))"
echo "  루트: $ROOT"

# --clean 옵션 처리
if [[ "$1" == "--clean" ]]; then
  echo "  이전 빌드 정리..."
  rm -rf "$DIST_DIR" "$WORK_DIR"
fi

# 반드시 프로젝트 venv 파이썬으로 설치/빌드한다.
# bare pip/pyinstaller 는 PATH의 다른 파이썬을 잡아 구버전 의존성이
# 번들되는 사고(빌드는 되는데 런타임 동작이 다른)의 단골 원인.
if [[ -x "$ROOT/.venv/Scripts/python.exe" ]]; then
  PY="$ROOT/.venv/Scripts/python.exe"
elif [[ -x "$ROOT/.venv/bin/python" ]]; then
  PY="$ROOT/.venv/bin/python"
else
  PY="python"
fi
echo "  python: $PY"

# 의존성 확인
"$PY" -m pip install pyinstaller pystray pillow -q

# UPX 없어도 빌드 진행
UPX_FLAG=""
if command -v upx &>/dev/null; then
  UPX_FLAG="--upx-dir=$(dirname "$(which upx)")"
  echo "  UPX 압축 적용"
fi

# Windows: 실행 중인 Fetcher가 있으면 산출물 덮어쓰기가 실패하므로 먼저 종료(best-effort)
if [[ $WINDOWS == 1 ]]; then
  taskkill //F //IM MarketPulseFetcher.exe 2>/dev/null || true
fi

cd "$ROOT"
"$PY" -m PyInstaller \
  "$BUILD_DIR/MarketPulseFetcher.spec" \
  --distpath "$DIST_DIR" \
  --workpath "$WORK_DIR" \
  --noconfirm \
  $UPX_FLAG

# OS별 산출물 확인
if [[ $WINDOWS == 1 ]]; then
  ARTIFACT="$DIST_DIR/MarketPulseFetcher.exe"
else
  ARTIFACT="$DIST_DIR/MarketPulseFetcher.app"
fi
if [[ ! -e "$ARTIFACT" ]]; then
  echo "❌ 빌드 산출물을 찾을 수 없습니다: $ARTIFACT"
  exit 1
fi

echo ""
echo "✅ 빌드 완료: $ARTIFACT"
echo ""
echo "▶ 데스크탑에 복사"
if [[ $WINDOWS == 1 ]]; then
  # 바탕화면이 OneDrive로 리다이렉트된 PC에서는 ~/Desktop이 실제 바탕화면이
  # 아니다 — 그곳에 복사하면 사용자가 보는 바탕화면의 구버전 exe가 영영 갱신되지
  # 않아 "빌드는 됐는데 옛날 Fetcher가 실행되는" 사고가 난다. 셸 폴더를 조회한다.
  DESKTOP="$(powershell.exe -NoProfile -Command "[Environment]::GetFolderPath('Desktop')" | tr -d '\r')"
  DESKTOP="$(cygpath -u "$DESKTOP" 2>/dev/null || echo "$HOME/Desktop")"
  rm -f "$DESKTOP/MarketPulseFetcher.exe"
  cp "$ARTIFACT" "$DESKTOP/"
else
  DESKTOP="$HOME/Desktop"
  rm -rf "$DESKTOP/MarketPulseFetcher.app"
  cp -r "$ARTIFACT" "$DESKTOP/"
fi
echo "   $DESKTOP/$(basename "$ARTIFACT")"
echo ""
echo "▶ 사용법:"
echo "   1. 바탕화면의 MarketPulseFetcher 실행 (더블클릭)"
echo "   2. 트레이 아이콘 확인 (Windows: 작업표시줄 / Mac: 메뉴바)"
echo "   3. API 키 설정 → 브라우저에서 http://127.0.0.1:8765/docs"
