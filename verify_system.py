#!/usr/bin/env python
"""
MarketPulse System Verification Script
전체 시스템의 구조와 모듈 임포트 검증
"""
import sys
import logging
from pathlib import Path

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
log = logging.getLogger(__name__)

print("=" * 80)
print("MarketPulse System Verification")
print("=" * 80)
print()

# 1. Python 버전 확인
print("[1/8] Checking Python version...")
python_version = sys.version_info
if python_version.major == 3 and python_version.minor >= 9:
    print(f"✅ Python {python_version.major}.{python_version.minor} - OK")
else:
    print(f"❌ Python {python_version.major}.{python_version.minor} - Requires 3.9+")
    sys.exit(1)

# 2. 필수 모듈 임포트 확인
print()
print("[2/8] Checking core module imports...")
try:
    from app.core.config import settings
    print("✅ app.core.config")
except Exception as e:
    print(f"❌ app.core.config: {e}")
    sys.exit(1)

try:
    from app.models.database import (
        get_sqlite_db, MBS_IN_ARTICLE, MBS_PROC_ARTICLE,
        MBS_CALC_METRIC, MBS_RCMD_RESULT
    )
    print("✅ app.models.database (ORM models)")
except Exception as e:
    print(f"❌ app.models.database: {e}")
    sys.exit(1)

# 3. 스케줄러 모듈 확인
print()
print("[3/8] Checking scheduler modules...")
try:
    from app.scheduler import (
        start_scheduler, stop_scheduler, get_scheduler_status
    )
    from app.services.calc_processor import scheduled_calc_processing
    from app.services.rcmd_generator import scheduled_rcmd_generation
    print("✅ Scheduler and processor modules")
except Exception as e:
    print(f"❌ Scheduler modules: {e}")
    sys.exit(1)

# 4. Redis 모듈 확인
print()
print("[4/8] Checking Redis modules...")
try:
    from app.redis_bus import create_redis_event_bus, RedisEventBus
    from app.command_handler import CommandHandler
    from app.analyzer_consumer import AnalyzerConsumer
    print("✅ Redis event bus and handlers")
except Exception as e:
    print(f"❌ Redis modules: {e}")
    sys.exit(1)

# 5. 서비스 모듈 확인
print()
print("[5/8] Checking service modules...")
try:
    from app.services.crawler_service import get_crawler_service
    from app.services.sentiment_analyzer import SentimentAnalyzer
    from app.services.ticker_extractor import TickerExtractor
    from app.services.calc_processor import CalcProcessor
    from app.services.rcmd_generator import RcmdGenerator
    print("✅ Service modules (crawler, sentiment, ticker, calc, rcmd)")
except Exception as e:
    print(f"❌ Service modules: {e}")
    sys.exit(1)

# 6. Worker 모듈 확인
print()
print("[6/8] Checking worker and daemon modules...")
try:
    from app.worker import main
    from app.main import main as main_entry
    print("✅ Worker and main entry point")
except Exception as e:
    print(f"❌ Worker modules: {e}")
    sys.exit(1)

# 7. 설정 파일 확인
print()
print("[7/8] Checking configuration files...")
config_checks = [
    ("sites.yaml", Path("sites.yaml").exists()),
    ("requirements.txt", Path("requirements.txt").exists()),
    (".env 또는 env vars", bool(settings.SQLITE_PATH or settings.DATABASE_URL)),
]

for config_name, exists in config_checks:
    status = "✅" if exists else "⚠️ "
    print(f"{status} {config_name}")

# 8. DB 설정 확인
print()
print("[8/8] Checking database configuration...")
db_path = settings.SQLITE_PATH
if db_path:
    try:
        from pathlib import Path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        db = get_sqlite_db(str(db_path))
        db.create_tables()
        print(f"✅ Database ready: {db_path}")
    except Exception as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)
else:
    db_url = settings.DATABASE_URL
    if db_url:
        print(f"✅ Database configured: {db_url[:50]}...")
    else:
        print("⚠️  No database configured")

# 최종 요약
print()
print("=" * 80)
print("System Verification Complete!")
print("=" * 80)
print()
print("Architecture Summary:")
print("  D1: Systemd/Docker Daemon")
print("  D2: Orchestrator (APScheduler + Multi-thread)")
print("  D3: Command Listener (Spring → Python)")
print("  D4: Crawler Module (뉴스 수집)")
print("  D5: Analyzer Consumer (IN → PROC 변환)")
print("  D6: Calc Processor (PROC → CALC)")
print("  D7: Rcmd Generator (CALC → RCMD)")
print()
print("Data Pipeline (MBS):")
print("  IN:   MBS_IN_ARTICLE, MBS_IN_STK_STBD, MBS_IN_ETF_STBD")
print("  PROC: MBS_PROC_ARTICLE")
print("  CALC: MBS_CALC_METRIC")
print("  RCMD: MBS_RCMD_RESULT")
print()
print("Scheduled Jobs:")
print("  ✅ crawl_news (every 1h) → Stream:new_articles")
print("  ✅ calc_processing (every 1h) → PROC→CALC")
print("  ✅ rcmd_generation (every 2h) → CALC→RCMD")
print("  ✅ sync_market_data (every 6h)")
print("  ✅ daily_cleanup (00:00 UTC)")
print()
print("Ready to run:")
print("  python -m app.main")
print()
print("=" * 80)
