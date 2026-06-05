@echo off
REM MarketPulse Fetcher Windows 빌드 스크립트
REM 출력: build\dist\MarketPulseFetcher.exe
REM 사용: build\build.bat [--clean]

setlocal enabledelayedexpansion
set ROOT=%~dp0..
set BUILD_DIR=%ROOT%\build
set DIST_DIR=%BUILD_DIR%\dist
set WORK_DIR=%BUILD_DIR%\work

echo ^> MarketPulse Fetcher 빌드 시작 (Windows)
echo   루트: %ROOT%

if "%1"=="--clean" (
  echo   이전 빌드 정리...
  if exist "%DIST_DIR%" rmdir /s /q "%DIST_DIR%"
  if exist "%WORK_DIR%" rmdir /s /q "%WORK_DIR%"
)

echo   의존성 설치...
pip install pyinstaller pystray pillow -q

cd /d "%ROOT%"
pyinstaller ^
  "%BUILD_DIR%\MarketPulseFetcher.spec" ^
  --distpath "%DIST_DIR%" ^
  --workpath "%WORK_DIR%" ^
  --noconfirm

if errorlevel 1 (
  echo.
  echo ❌ 빌드 실패
  exit /b 1
)

echo.
echo ✅ 빌드 완료: %DIST_DIR%\MarketPulseFetcher.exe
echo.
echo ^> 데스크탑에 복사
copy "%DIST_DIR%\MarketPulseFetcher.exe" "%USERPROFILE%\Desktop\MarketPulseFetcher.exe"
echo    %%USERPROFILE%%\Desktop\MarketPulseFetcher.exe
echo.
echo ^> 사용법:
echo    1. 바탕화면 MarketPulseFetcher.exe 더블클릭
echo    2. 작업표시줄 시스템 트레이 아이콘 확인
echo    3. API 키 설정 ^> 브라우저에서 http://127.0.0.1:8765/docs

endlocal
