#!/bin/bash

set -e

echo "🚀 MarketPulse Desktop 설정을 시작합니다..."
echo ""

PROJECT_DIR="/Users/yup2dev/PycharmProjects/marketpulse"
DESKTOP="$HOME/Desktop"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"

# 1️⃣ 프로덕션 빌드
echo "📦 [1/5] Desktop 앱을 빌드하는 중..."
cd "$PROJECT_DIR/app/frontend"
npm run build > /dev/null 2>&1

cd "$PROJECT_DIR/desktop"
npm run build > /dev/null 2>&1

if [ -d "/Applications/MarketPulse.app" ]; then
    echo "✅ Desktop 앱 빌드 완료"
else
    echo "❌ 빌드 실패"
    exit 1
fi

# 2️⃣ launchd 에이전트 등록
echo ""
echo "🔧 [2/5] 자동 실행 설정 중..."

# 기존 설정 제거
launchctl unload "$LAUNCH_AGENTS/com.marketpulse.desktop.plist" 2>/dev/null || true
launchctl unload "$LAUNCH_AGENTS/com.marketpulse.fetcher.plist" 2>/dev/null || true

# 새로 등록
launchctl load "$LAUNCH_AGENTS/com.marketpulse.desktop.plist"
launchctl load "$LAUNCH_AGENTS/com.marketpulse.fetcher.plist"

echo "✅ 자동 실행 설정 완료"

# 3️⃣ 바탕화면 아이콘 추가
echo ""
echo "🖥️  [3/5] 바탕화면에 앱 아이콘 추가 중..."

if [ -L "$DESKTOP/MarketPulse.app" ]; then
    rm "$DESKTOP/MarketPulse.app"
fi

ln -s /Applications/MarketPulse.app "$DESKTOP/MarketPulse.app"
echo "✅ 바탕화면에 앱 아이콘 추가 완료"

# 4️⃣ 불필요한 파일 정리
echo ""
echo "🧹 [4/5] 불필요한 파일을 정리하는 중..."

# Volume 밑의 마켓펄스 폴더 확인
if [ -d "/Volumes/marketpulse" ]; then
    echo "   - /Volumes/marketpulse 발견, 삭제합니다"
    rm -rf /Volumes/marketpulse
fi

# 캐시 정리
rm -rf ~/.cache/marketpulse 2>/dev/null || true
rm -rf ~/Library/Caches/com.marketpulse.desktop 2>/dev/null || true

echo "✅ 파일 정리 완료"

# 5️⃣ 상태 확인
echo ""
echo "📋 [5/5] 설정 상태 확인 중..."
echo ""

echo "🔍 자동 실행 설정 상태:"
launchctl list | grep marketpulse || echo "   (설정되지 않음)"

echo ""
echo "🔍 설치된 앱:"
ls -d /Applications/MarketPulse.app 2>/dev/null && echo "   ✅ /Applications/MarketPulse.app" || echo "   ❌ 앱이 설치되지 않았습니다"

echo ""
echo "🔍 바탕화면 아이콘:"
ls -d "$DESKTOP/MarketPulse.app" 2>/dev/null && echo "   ✅ $DESKTOP/MarketPulse.app" || echo "   ❌ 바탕화면 아이콘이 없습니다"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ MarketPulse Desktop 설정이 완료되었습니다!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📚 다음 단계:"
echo "   1. 바탕화면의 'MarketPulse' 아이콘을 클릭하여 앱을 실행합니다"
echo "   2. 또는 Applications 폴더에서 MarketPulse.app을 실행합니다"
echo "   3. 시스템을 재시작하면 자동으로 앱이 실행됩니다"
echo ""
echo "📝 로그 확인:"
echo "   - App: tail -f /tmp/marketpulse.log"
echo "   - Fetcher: tail -f /tmp/fetcher.log"
echo ""
echo "🛑 자동 실행 해제:"
echo "   launchctl unload ~/Library/LaunchAgents/com.marketpulse.desktop.plist"
echo "   launchctl unload ~/Library/LaunchAgents/com.marketpulse.fetcher.plist"
echo ""
