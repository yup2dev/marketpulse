"""
Load Market Data - 외부 API 기반 동적 데이터 로드
실제 데이터 소스에서 S&P 500 종목 및 주요 원자재 선물 데이터 동적으로 로드
하드코딩 제거 - 모든 데이터는 외부 API 또는 DB에서 관리
"""
import sys
import io
import logging
from pathlib import Path

# Fix Windows encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models.database import get_sqlite_db, MBS_IN_STBD_MST
from app.services.market_data_sync import MarketDataSync

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


def load_market_data(db_path="data/marketpulse.db", enrich=True):
    """
    외부 API로부터 마켓 데이터 로드

    Args:
        db_path: SQLite 데이터베이스 경로
        enrich: yfinance API로 데이터 보강 여부
    """

    log.info("Initializing database...")
    # Use absolute path
    DB_PATH = Path(__file__).parent.parent / "data" / "marketpulse.db"
    DB_PATH.parent.mkdir(exist_ok=True)
    db = get_sqlite_db(str(DB_PATH))
    db.create_tables()

    session = db.get_session()

    try:
        # MarketDataSync 서비스 초기화
        sync_service = MarketDataSync(session)

        # 모든 마켓 데이터 동기화
        results = sync_service.sync_all(enrich=enrich)

        # 통계 출력
        log.info(f"\n{'='*60}")
        log.info(f"Data Load Summary:")
        log.info(f"  S&P 500 stocks:      {results['sp500']:4d}")
        log.info(f"  ETFs:                {results['etfs']:4d}")
        log.info(f"  Commodity futures:   {results['commodities']:4d}")
        log.info(f"  Bonds:               {results['bonds']:4d}")
        log.info(f"  Total synced:        {results['total']:4d}")
        log.info(f"{'='*60}")

    except Exception as e:
        log.error(f"Error loading market data: {e}")
        import traceback
        traceback.print_exc()
        session.rollback()
        raise
    finally:
        session.close()

    return db


def add_custom_ticker(symbol: str, asset_type: str = 'stock', db_path="data/marketpulse.db"):
    """
    커스텀 티커 추가

    Args:
        symbol: 티커 심볼 (예: TSLA, BTC-USD)
        asset_type: 자산 유형 (stock, commodity, etf, crypto, index)
        db_path: 데이터베이스 경로
    """
    DB_PATH = Path(__file__).parent.parent / "data" / "marketpulse.db"
    db = get_sqlite_db(str(DB_PATH))
    session = db.get_session()

    try:
        sync_service = MarketDataSync(session)
        success = sync_service.add_custom_ticker(symbol, asset_type, enrich=True)

        if success:
            log.info(f"✓ Successfully added {symbol} ({asset_type})")
        else:
            log.error(f"✗ Failed to add {symbol}")

        return success
    finally:
        session.close()


def remove_ticker(symbol: str, db_path="data/marketpulse.db"):
    """
    티커 비활성화

    Args:
        symbol: 티커 심볼
        db_path: 데이터베이스 경로
    """
    DB_PATH = Path(__file__).parent.parent / "data" / "marketpulse.db"
    db = get_sqlite_db(str(DB_PATH))
    session = db.get_session()

    try:
        sync_service = MarketDataSync(session)
        success = sync_service.remove_ticker(symbol)

        if success:
            log.info(f"✓ Successfully deactivated {symbol}")
        else:
            log.error(f"✗ Failed to deactivate {symbol}")

        return success
    finally:
        session.close()


# list_tickers 함수 제거 - 조회는 DB 툴이나 API에서 수행


# load_price_history 함수 제거 - 가격 데이터는 별도 크롤러에서 수집


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description='Load ticker metadata to MBS_IN_STBD_MST from external APIs',
        epilog='Examples:\n'
               '  python scripts/load_market_data.py                      # Load all ticker metadata\n'
               '  python scripts/load_market_data.py --reset              # Reset and reload\n'
               '  python scripts/load_market_data.py --no-enrich          # Fast load without yfinance enrichment\n',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        '--path',
        default='data/marketpulse.db',
        help='SQLite database path'
    )
    parser.add_argument(
        '--reset',
        action='store_true',
        help='Reset ticker data before loading'
    )
    parser.add_argument(
        '--no-enrich',
        action='store_true',
        help='Skip yfinance enrichment (faster but less data)'
    )

    args = parser.parse_args()

    log.info("="*60)
    log.info("MarketPulse Market Data Loader")
    log.info("Dynamic data loading from external APIs")
    log.info("="*60)

    # Reset 처리
    if args.reset:
        log.warning("Resetting ticker data...")
        DB_PATH = Path(__file__).parent.parent / "data" / "marketpulse.db"
        db = get_sqlite_db(str(DB_PATH))
        session = db.get_session()
        session.query(MBS_IN_STBD_MST).delete()
        session.commit()
        session.close()
        log.info("✓ Ticker data reset complete (MBS_IN_STBD_MST)")

    # 기본 동작: 전체 데이터 로드
    enrich = not args.no_enrich
    db = load_market_data(args.path, enrich=enrich)

    log.info("\n✓ Market data loaded successfully to MBS_IN_STBD_MST!")
    log.info(f"Database: {Path(__file__).parent.parent / 'data' / 'marketpulse.db'}")
    log.info("\nNote: This script only loads ticker metadata.")
    log.info("Price data will be collected by separate price crawler.")
    log.info("For automated daily updates, use: python -m app.main")
