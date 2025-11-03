"""
Database Initialization Script
데이터베이스 초기화 및 샘플 티커 데이터 로드
"""
import sys
import logging
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models.database import get_sqlite_db, get_postgresql_db, Ticker
from app.services.ticker_extractor import TickerExtractor

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


def init_database(db_type='sqlite', db_path='data/marketpulse.db'):
    """데이터베이스 초기화"""

    log.info(f"Initializing {db_type} database...")

    # 데이터베이스 선택
    if db_type == 'sqlite':
        db = get_sqlite_db(db_path)
    else:
        # PostgreSQL 설정은 환경 변수에서 읽기
        import os
        db = get_postgresql_db(
            host=os.getenv('DB_HOST', 'localhost'),
            port=int(os.getenv('DB_PORT', 5432)),
            database=os.getenv('DB_NAME', 'marketpulse'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', 'password')
        )

    # 테이블 생성
    log.info("Creating tables...")
    db.create_tables()
    log.info("✓ Tables created successfully")

    # 샘플 티커 데이터 로드
    log.info("Loading sample ticker data...")
    session = db.get_session()

    try:
        # TickerExtractor의 기본 티커 사용
        extractor = TickerExtractor()

        count = 0
        for symbol, info in extractor.ticker_db.items():
            # 이미 존재하는지 확인
            existing = session.query(Ticker).filter_by(symbol=symbol).first()
            if not existing:
                ticker = Ticker(
                    symbol=symbol,
                    name=info.get('name', ''),
                    exchange=info.get('exchange', '')
                )
                session.add(ticker)
                count += 1

        session.commit()
        log.info(f"✓ Loaded {count} sample tickers")

        # 통계
        total_tickers = session.query(Ticker).count()
        log.info(f"Total tickers in database: {total_tickers}")

    except Exception as e:
        log.error(f"Error loading ticker data: {e}")
        session.rollback()
    finally:
        session.close()

    log.info("✓ Database initialization complete!")
    return db


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Initialize MarketPulse database')
    parser.add_argument(
        '--type',
        choices=['sqlite', 'postgresql'],
        default='sqlite',
        help='Database type'
    )
    parser.add_argument(
        '--path',
        default='data/marketpulse.db',
        help='SQLite database path'
    )
    parser.add_argument(
        '--reset',
        action='store_true',
        help='Reset database (drop all tables)'
    )

    args = parser.parse_args()

    # Path 생성
    if args.type == 'sqlite':
        Path(args.path).parent.mkdir(parents=True, exist_ok=True)

    db = init_database(args.type, args.path)

    if args.reset:
        log.warning("Dropping all tables...")
        db.drop_tables()
        log.info("Recreating tables...")
        db.create_tables()

    print("\n" + "="*60)
    print("Database ready!")
    print(f"Type: {args.type}")
    if args.type == 'sqlite':
        print(f"Path: {args.path}")
    print("="*60)
