@echo off
REM MarketPulse 일일 적재 + 클라우드 동기화 (Windows 작업 스케줄러용)
REM
REM 등록 (매일 07:30 실행):
REM   schtasks /Create /TN "MarketPulse Ingest Sync" ^
REM     /TR "C:\Users\pro\PycharmProjects\index_analyzer\scripts\daily_ingest.bat" ^
REM     /SC DAILY /ST 07:30
REM 해제: schtasks /Delete /TN "MarketPulse Ingest Sync" /F
REM
REM 인증: scripts\sync.env 에 MP_SYNC_EMAIL / MP_SYNC_PASSWORD 를 넣는다
REM       (sync.env.example 참고 — git에 커밋하지 말 것)

setlocal
cd /d "%~dp0.."
set LOG=data\ingest_sync.log

REM sync.env 로드 (KEY=VALUE 한 줄씩)
if exist "scripts\sync.env" (
  for /f "usebackq eol=# tokens=1,* delims==" %%a in ("scripts\sync.env") do set "%%a=%%b"
)

echo [%date% %time%] ==== daily ingest start ==== >> "%LOG%"

REM 1) 로컬 적재 — 최근 1개월치 백필 (누락 구간 보정 겸)
.venv\Scripts\python.exe scripts\backfill_stk_stbd.py 1mo >> "%LOG%" 2>&1
if errorlevel 1 echo [%date% %time%] backfill FAILED >> "%LOG%"

REM 2) 클라우드 동기화 — 서버 max_base_ymd 이후 증분만 전송
.venv\Scripts\python.exe scripts\sync_db_to_cloud.py >> "%LOG%" 2>&1
if errorlevel 1 echo [%date% %time%] cloud sync FAILED >> "%LOG%"

echo [%date% %time%] ==== daily ingest done ==== >> "%LOG%"
endlocal
