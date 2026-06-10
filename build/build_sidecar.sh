#!/usr/bin/env bash
# Fetcher를 PyInstaller로 빌드해 Tauri sidecar 위치에 자동 배치한다.
#
# 문제: desktop/src-tauri/binaries/marketpulse-fetcher-* 가 한 번 수동으로
#       복사된 뒤 데이터 소스 코드가 바뀌어도 갱신되지 않아, 구 버전 Fetcher가
#       번들된 채 배포되는 사고가 있었다 (예: EarningsQueryParams.ticker→symbol
#       리네임 이전 바이너리가 새 백엔드와 통신해 502 에러 발생).
#
# 해결: 이 스크립트가 "항상 현재 소스 기준으로" Fetcher를 새로 빌드해
#       sidecar 디렉터리를 덮어쓴다. tauri.conf.json의 beforeBuildCommand에
#       연결되어 있어 `npm run build`(desktop) 실행만으로 자동 갱신된다.
#
# 사용: bash build/build_sidecar.sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$ROOT/build"
DIST_DIR="$BUILD_DIR/dist"
WORK_DIR="$BUILD_DIR/work"
SIDECAR_DIR="$ROOT/desktop/src-tauri/binaries"

# Rust target triple (sidecar 바이너리 네이밍 규칙: <name>-<target-triple>)
TARGET_TRIPLE="$(rustc -Vv | awk '/^host:/ {print $2}')"
SIDECAR_NAME="marketpulse-fetcher"

echo "▶ Fetcher sidecar 빌드 시작 (target: $TARGET_TRIPLE)"

# 의존성 확인 (이미 설치돼 있으면 빠르게 스킵)
pip install pyinstaller pystray pillow -q

UPX_FLAG=""
if command -v upx &>/dev/null; then
  UPX_FLAG="--upx-dir=$(dirname "$(which upx)")"
fi

cd "$ROOT"
# onefile(self-contained) 빌드 — Tauri externalBin은 단일 실행파일을 요구하며,
# onedir(.app) 빌드의 실행파일만 추출하면 Frameworks 의존성이 빠져 구동되지 않는다.
pyinstaller \
  "$BUILD_DIR/MarketPulseFetcherSidecar.spec" \
  --distpath "$DIST_DIR" \
  --workpath "$WORK_DIR" \
  --noconfirm \
  $UPX_FLAG

# Windows에서는 PyInstaller가 .exe 확장자를 붙인다
EXT=""
[[ "$OSTYPE" == "msys"* || "$OSTYPE" == "cygwin"* || "$OSTYPE" == "win32" ]] && EXT=".exe"

SRC_BIN="$DIST_DIR/marketpulse-fetcher-sidecar${EXT}"
if [[ ! -f "$SRC_BIN" ]]; then
  echo "❌ 빌드 산출물을 찾을 수 없습니다: $SRC_BIN"
  exit 1
fi

echo ""
echo "▶ sidecar 디렉터리에 배치: $SIDECAR_DIR"
mkdir -p "$SIDECAR_DIR"

# Tauri externalBin 규칙: <name>-<target-triple>[.exe]
DST_BIN="$SIDECAR_DIR/${SIDECAR_NAME}-${TARGET_TRIPLE}${EXT}"
rm -f "$DST_BIN"
cp "$SRC_BIN" "$DST_BIN"
chmod +x "$DST_BIN"

echo ""
echo "✅ sidecar 갱신 완료: $DST_BIN"
