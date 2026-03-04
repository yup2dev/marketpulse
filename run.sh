#!/usr/bin/env bash
# MarketPulse — 백엔드 + 프론트엔드 동시 실행
# 사용법: bash run.sh [--backend-only | --frontend-only]

ROOT="$(cd "$(dirname "$0")" && pwd)"
VENV_PYTHON="$ROOT/.venv/Scripts/python"
FRONTEND_DIR="$ROOT/app/frontend"

run_backend() {
    echo "[backend] Starting uvicorn on http://localhost:8000 ..."
    cd "$ROOT"
    "$VENV_PYTHON" -m uvicorn app.backend.main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --reload \
        --reload-dir app/backend
}

run_frontend() {
    echo "[frontend] Starting Vite dev server on http://localhost:5173 ..."
    cd "$FRONTEND_DIR"
    npm run dev
}

case "${1:-}" in
    --backend-only)
        run_backend
        ;;
    --frontend-only)
        run_frontend
        ;;
    *)
        # 둘 다 실행 — Ctrl+C 로 둘 다 종료
        trap 'kill 0' INT TERM
        run_backend &
        run_frontend &
        wait
        ;;
esac
