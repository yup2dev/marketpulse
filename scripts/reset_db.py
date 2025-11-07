"""
Database Reset Script
모든 테이블을 삭제하고 새로운 스키마로 재생성

Usage:
    python scripts/reset_db.py
"""
import sys
import logging
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models.database import get_sqlite_db, Base

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
log = logging.getLogger(__name__)


def reset_database(db_path='data/marketpulse.db'):
    """데이터베이스 완전 초기화"""

    log.info("="*60)
    log.info("Database Reset Script")
    log.info("="*60)

    # Path 생성
    db_file = Path(db_path)
    db_file.parent.mkdir(parents=True, exist_ok=True)

    log.info(f"Database path: {db_path}")

    # 데이터베이스 연결
    db = get_sqlite_db(db_path)

    # 1. 모든 테이블 삭제
    log.info("\n[1/3] Dropping all existing tables...")
    try:
        db.drop_tables()
        log.info("✓ All tables dropped successfully")
    except Exception as e:
        log.warning(f"Drop tables warning: {e}")

    # 2. 새로운 스키마로 테이블 재생성
    log.info("\n[2/3] Creating tables with current schema...")
    try:
        db.create_tables()
        log.info("✓ Tables created successfully")

        # 생성된 테이블 목록 표시
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        log.info(f"Created tables: {', '.join(tables)}")

    except Exception as e:
        log.error(f"Error creating tables: {e}")
        return False

    # 3. 마켓 데이터 로드
    log.info("\n[3/3] Loading market data...")
    try:
        from scripts.load_market_data import load_sp500_tickers
        count = load_sp500_tickers(db)
        log.info(f"✓ Loaded {count} tickers")

    except Exception as e:
        log.error(f"Error loading market data: {e}")
        log.info("You can load market data later using: python scripts/load_market_data.py")

    log.info("\n" + "="*60)
    log.info("✓ Database reset complete!")
    log.info("="*60)

    return True


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Reset MarketPulse database')
    parser.add_argument(
        '--path',
        default='data/marketpulse.db',
        help='SQLite database path (default: data/marketpulse.db)'
    )
    parser.add_argument(
        '--yes',
        action='store_true',
        help='Skip confirmation prompt'
    )

    args = parser.parse_args()

    # 확인 프롬프트
    if not args.yes:
        print("\n" + "!"*60)
        print("WARNING: This will DELETE ALL DATA in the database!")
        print(f"Database: {args.path}")
        print("!"*60)
        response = input("\nAre you sure you want to continue? (yes/no): ")
        if response.lower() not in ['yes', 'y']:
            print("Cancelled.")
            sys.exit(0)

    # 데이터베이스 리셋 실행
    success = reset_database(args.path)
    sys.exit(0 if success else 1)
