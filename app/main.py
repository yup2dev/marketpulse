"""
MarketPulse Background Worker
백그라운드 데이터 파이프라인 전용 모드

실행 방법:
    python -m app.main
"""
from app.worker import main

if __name__ == "__main__":
    main()
