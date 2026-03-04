@echo off
REM MarketPulse — 백엔드 + 프론트엔드 동시 실행 (Windows)
REM 사용법: run.bat [backend | frontend]

set ROOT=%~dp0
set VENV_PYTHON=%ROOT%.venv\Scripts\python.exe

if "%1"=="backend" goto backend
if "%1"=="frontend" goto frontend

:both
echo [backend]  http://localhost:8000
echo [frontend] http://localhost:5173
echo.
start "MarketPulse Backend" cmd /k "cd /d %ROOT% && %VENV_PYTHON% -m uvicorn app.backend.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app/backend"
start "MarketPulse Frontend" cmd /k "cd /d %ROOT%app\frontend && npm run dev"
goto end

:backend
cd /d %ROOT%
%VENV_PYTHON% -m uvicorn app.backend.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app/backend
goto end

:frontend
cd /d %ROOT%app\frontend
npm run dev
goto end

:end
