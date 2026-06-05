#!/usr/bin/env bash
# MarketPulse Fetcher Mac 빌드 스크립트
# 출력: build/dist/MarketPulseFetcher.app
# 사용: bash build/build.sh [--clean]
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$ROOT/build"
DIST_DIR="$BUILD_DIR/dist"
WORK_DIR="$BUILD_DIR/work"

echo "▶ MarketPulse Fetcher 빌드 시작 (Mac)"
echo "  루트: $ROOT"

# --clean 옵션 처리
if [[ "$1" == "--clean" ]]; then
  echo "  이전 빌드 정리..."
  rm -rf "$DIST_DIR" "$WORK_DIR"
fi

# 의존성 확인
pip install pyinstaller pystray pillow -q

# UPX 없어도 빌드 진행
UPX_FLAG=""
if command -v upx &>/dev/null; then
  UPX_FLAG="--upx-dir=$(dirname $(which upx))"
  echo "  UPX 압축 적용"
fi

cd "$ROOT"
pyinstaller \
  "$BUILD_DIR/MarketPulseFetcher.spec" \
  --distpath "$DIST_DIR" \
  --workpath "$WORK_DIR" \
  --noconfirm \
  $UPX_FLAG

echo ""
echo "✅ 빌드 완료: $DIST_DIR/MarketPulseFetcher.app"
echo ""
echo "▶ 데스크탑에 복사"
cp -r "$DIST_DIR/MarketPulseFetcher.app" ~/Desktop/
echo "   ~/Desktop/MarketPulseFetcher.app"
echo ""
echo "▶ 사용법:"
echo "   1. ~/Desktop/MarketPulseFetcher.app 더블클릭"
echo "   2. 메뉴바 우측 트레이 아이콘 확인"
echo "   3. API 키 설정 → 브라우저에서 http://127.0.0.1:8765/docs"
