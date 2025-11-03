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

from app.models.database import get_sqlite_db, Ticker
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
        log.info(f"  Commodity futures:   {results['commodities']:4d}")
        log.info(f"  ETFs:                {results['etfs']:4d}")
        log.info(f"  Total synced:        {results['total']:4d}")

        # 섹터별 통계
        from sqlalchemy import func
        sector_stats = session.query(
            Ticker.asset_type,
            Ticker.sector,
            func.count(Ticker.symbol)
        ).filter(
            Ticker.is_active == True
        ).group_by(
            Ticker.asset_type,
            Ticker.sector
        ).all()

        log.info(f"\nAsset Type & Sector Distribution:")
        log.info(f"{'Asset Type':<15} {'Sector':<30} {'Count':>5}")
        log.info(f"{'-'*50}")
        for asset_type, sector, count in sorted(sector_stats, key=lambda x: (-x[2], x[0], x[1])):
            log.info(f"{asset_type or 'N/A':<15} {sector or 'N/A':<30} {count:>5}")

        total_active = session.query(Ticker).filter(Ticker.is_active == True).count()
        log.info(f"{'-'*50}")
        log.info(f"Total active tickers in database: {total_active}")
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


def list_tickers(asset_type: str = None, db_path="data/marketpulse.db"):
    """
    현재 DB에 있는 티커 목록 조회

    Args:
        asset_type: 필터링할 자산 유형 (None이면 전체)
        db_path: 데이터베이스 경로
    """
    DB_PATH = Path(__file__).parent.parent / "data" / "marketpulse.db"
    db = get_sqlite_db(str(DB_PATH))
    session = db.get_session()

    try:
        query = session.query(Ticker).filter(Ticker.is_active == True)

        if asset_type:
            query = query.filter(Ticker.asset_type == asset_type)

        tickers = query.order_by(Ticker.asset_type, Ticker.sector, Ticker.symbol).all()

        log.info(f"\n{'='*80}")
        log.info(f"Active Tickers in Database")
        if asset_type:
            log.info(f"Filtered by asset_type: {asset_type}")
        log.info(f"{'='*80}")
        log.info(f"{'Symbol':<10} {'Name':<35} {'Type':<12} {'Sector':<20}")
        log.info(f"{'-'*80}")

        for ticker in tickers:
            log.info(
                f"{ticker.symbol:<10} "
                f"{ticker.name[:34]:<35} "
                f"{ticker.asset_type or 'N/A':<12} "
                f"{ticker.sector or 'N/A':<20}"
            )

        log.info(f"{'-'*80}")
        log.info(f"Total: {len(tickers)} tickers")
        log.info(f"{'='*80}\n")

        return tickers
    finally:
        session.close()


def load_price_history(
    symbols: list = None,
    period: str = '1d', # 전체 기간
    interval: str = '1d',
    db_path="data/marketpulse.db"
):
    """
    ティcker 가격 이력 로드

    Args:
        symbols: 로드할 심볼 리스트 (None이면 모든 활성 티커)
        period: 기간 ('1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'max')
        interval: 간격 ('1m', '5m', '15m', '30m', '60m', '1d')
        db_path: 데이터베이스 경로
    """
    DB_PATH = Path(__file__).parent.parent / "data" / "marketpulse.db"
    db = get_sqlite_db(str(DB_PATH))
    session = db.get_session()

    try:
        sync_service = MarketDataSync(session)
        results = sync_service.sync_all_price_history(
            symbols=symbols,
            period=period,
            interval=interval
        )

        log.info(f"\nPrice History Load Summary:")
        log.info(f"  Total tickers:  {results['total']}")
        log.info(f"  Success:        {results['success']}")
        log.info(f"  Failed:         {results['failed']}")

        # 상세 결과 출력
        if results['details']:
            log.info(f"\nDetailed Results:")
            for symbol, detail in sorted(results['details'].items()):
                if detail['status'] == 'success':
                    log.info(f"  ✓ {symbol:<10} {detail['records']:>5} records")
                else:
                    log.info(f"  ✗ {symbol:<10} Error: {detail.get('error', 'Unknown')}")

        return results

    finally:
        session.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description='Load market data from external APIs (Wikipedia, yfinance)',
        epilog='Examples:\n'
               '  python scripts/load_market_data.py                      # Load all ticker metadata\n'
               '  python scripts/load_market_data.py --reset              # Reset and reload\n'
               '  python scripts/load_market_data.py --prices             # Load price history for all tickers\n'
               '  python scripts/load_market_data.py --prices --symbols AAPL TSLA GC=F  # Load price for specific tickers\n'
               '  python scripts/load_market_data.py --prices --period 6mo # Load last 6 months\n'
               '  python scripts/load_market_data.py --add TSLA stock     # Add custom ticker\n'
               '  python scripts/load_market_data.py --remove TSLA        # Remove ticker\n'
               '  python scripts/load_market_data.py --list               # List all tickers\n'
               '  python scripts/load_market_data.py --list --type etf    # List ETFs only\n',
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
    parser.add_argument(
        '--prices',
        action='store_true',
        help='Load price history data'
    )
    parser.add_argument(
        '--symbols',
        nargs='+',
        metavar='SYMBOL',
        help='Specific symbols to load prices for (use with --prices)'
    )
    parser.add_argument(
        '--period',
        default='1d', # 전체기간
        choices=['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'max'],
        help='Historical period (use with --prices)'
    )
    parser.add_argument(
        '--interval',
        default='1d',
        choices=['1m', '5m', '15m', '30m', '60m', '1d'],
        help='Data interval (use with --prices)'
    )
    parser.add_argument(
        '--add',
        nargs=2,
        metavar=('SYMBOL', 'TYPE'),
        help='Add custom ticker (e.g., --add TSLA stock)'
    )
    parser.add_argument(
        '--remove',
        metavar='SYMBOL',
        help='Remove/deactivate ticker'
    )
    parser.add_argument(
        '--list',
        action='store_true',
        help='List all active tickers'
    )
    parser.add_argument(
        '--type',
        choices=['stock', 'commodity', 'etf', 'crypto', 'index'],
        help='Filter by asset type (use with --list)'
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
        session.query(Ticker).delete()
        session.commit()
        session.close()
        log.info("✓ Ticker data reset complete")

    # 커스텀 티커 추가
    if args.add:
        symbol, asset_type = args.add
        add_custom_ticker(symbol, asset_type, args.path)
        sys.exit(0)

    # 티커 제거
    if args.remove:
        remove_ticker(args.remove, args.path)
        sys.exit(0)

    # 티커 목록 조회
    if args.list:
        list_tickers(args.type, args.path)
        sys.exit(0)

    # 가격 데이터 로드
    if args.prices:
        log.info("Loading price history data...")
        results = load_price_history(
            symbols=args.symbols,
            period=args.period,
            interval=args.interval,
            db_path=args.path
        )
        print("\n✓ Price history loaded successfully!")
        print(f"Database: {Path(__file__).parent.parent / 'data' / 'marketpulse.db'}")
        sys.exit(0)

    # 기본 동작: 전체 데이터 로드
    enrich = not args.no_enrich
    db = load_market_data(args.path, enrich=enrich)

    print("\n✓ Market data loaded successfully!")
    print(f"Database: {Path(__file__).parent.parent / 'data' / 'marketpulse.db'}")
    print("\nNext steps:")
    print("  - Load prices:  python scripts/load_market_data.py --prices")
    print("  - List tickers: python scripts/load_market_data.py --list")
    print("  - Add ticker:   python scripts/load_market_data.py --add TSLA stock")
    print("  - Run crawler:  python run_integrated_crawler.py")
    print("  - Start API:    python -m app.main")
