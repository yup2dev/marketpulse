@echo off
REM MarketPulse 일일 배치 (Windows 작업 스케줄러용) — 실행기 run_job.py 의 daily 묶음을 부른다.
REM
REM   daily = universe_kr → universe_us(일) → stk_backfill → fx → 13f(일) → sync_cloud
REM   (순서·요일 조건·실패 처리·lock·로그는 MarketpulseBatch\run_job.py 가 담당)
REM
REM 등록 (매일 07:30 실행):
REM   schtasks /Create /TN "MarketPulse Daily Batch" ^
REM     /TR "C:\Users\TRIA\PycharmProjects\marketpulse\MarketpulseBatch\jobs\daily_ingest.bat" ^
REM     /SC DAILY /ST 07:30
REM 해제: schtasks /Delete /TN "MarketPulse Daily Batch" /F
REM
REM 인증: MarketpulseBatch\jobs\sync.env 에 MP_SYNC_EMAIL / MP_SYNC_PASSWORD (sync.env.example 참고, 커밋 금지)
REM 로그: logs\batch\<작업>_<YYYYMMDD>.log, 이력: logs\batch\history.jsonl, 요약: logs\batch\daily_console.log
REM 종료 코드: 0 성공 / 1 일부 작업 실패 / 2 이미 실행 중 — 작업 스케줄러 "마지막 실행 결과"에 그대로 보인다.

setlocal
cd /d "%~dp0..\.."
if not exist logs\batch mkdir logs\batch
.venv\Scripts\python.exe MarketpulseBatch\run_job.py daily >> logs\batch\daily_console.log 2>&1
set RC=%ERRORLEVEL%
endlocal & exit /b %RC%
