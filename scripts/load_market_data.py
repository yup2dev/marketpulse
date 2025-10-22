"""
Load S&P 500 and Major Commodities Data from Real Sources
실제 데이터 소스에서 S&P 500 종목 및 주요 원자재 선물 데이터 동적으로 로드
"""
import sys
import io
import logging
from pathlib import Path
import pandas as pd
import requests
from bs4 import BeautifulSoup

# Fix Windows encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models.database import get_sqlite_db, Ticker

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


def get_sp500_tickers():
    """
    Wikipedia에서 실제 S&P 500 편입 종목 목록을 가져옴
    Returns: List of dicts with ticker info
    """
    log.info("Fetching S&P 500 constituents from Wikipedia...")

    try:
        # Wikipedia S&P 500 페이지에서 데이터 가져오기
        url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'

        # Set user agent to avoid 403 errors
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

        # Read HTML tables with custom headers
        tables = pd.read_html(url, storage_options=headers)
        sp500_table = tables[0]

        log.info(f"✓ Found {len(sp500_table)} S&P 500 companies")

        tickers = []
        for _, row in sp500_table.iterrows():
            ticker_info = {
                'symbol': row['Symbol'].replace('.', '-'),  # Yahoo Finance format
                'name': row['Security'],
                'sector': row['GICS Sector'],
                'industry': row['GICS Sub-Industry'],
                'exchange': 'NYSE' if 'NYSE' in str(row.get('Exchange', 'NYSE')) else 'NASDAQ'
            }
            tickers.append(ticker_info)

        return tickers

    except Exception as e:
        log.error(f"Error fetching S&P 500 data: {e}")
        log.warning("Falling back to cached S&P 500 list...")
        return get_fallback_sp500()


def get_fallback_sp500():
    """
    API 실패 시 사용할 최소한의 주요 종목 목록
    """
    return [
        {'symbol': 'AAPL', 'name': 'Apple Inc.', 'sector': 'Information Technology', 'industry': 'Technology Hardware, Storage & Peripherals', 'exchange': 'NASDAQ'},
        {'symbol': 'MSFT', 'name': 'Microsoft Corporation', 'sector': 'Information Technology', 'industry': 'Software', 'exchange': 'NASDAQ'},
        {'symbol': 'GOOGL', 'name': 'Alphabet Inc. Class A', 'sector': 'Communication Services', 'industry': 'Interactive Media & Services', 'exchange': 'NASDAQ'},
        {'symbol': 'AMZN', 'name': 'Amazon.com Inc.', 'sector': 'Consumer Discretionary', 'industry': 'Internet & Direct Marketing Retail', 'exchange': 'NASDAQ'},
        {'symbol': 'NVDA', 'name': 'NVIDIA Corporation', 'sector': 'Information Technology', 'industry': 'Semiconductors', 'exchange': 'NASDAQ'},
        {'symbol': 'META', 'name': 'Meta Platforms Inc.', 'sector': 'Communication Services', 'industry': 'Interactive Media & Services', 'exchange': 'NASDAQ'},
        {'symbol': 'TSLA', 'name': 'Tesla Inc.', 'sector': 'Consumer Discretionary', 'industry': 'Automobiles', 'exchange': 'NASDAQ'},
        {'symbol': 'BRK-B', 'name': 'Berkshire Hathaway Inc. Class B', 'sector': 'Financials', 'industry': 'Multi-Sector Holdings', 'exchange': 'NYSE'},
        {'symbol': 'JPM', 'name': 'JPMorgan Chase & Co.', 'sector': 'Financials', 'industry': 'Banks', 'exchange': 'NYSE'},
        {'symbol': 'V', 'name': 'Visa Inc.', 'sector': 'Financials', 'industry': 'Financial Services', 'exchange': 'NYSE'},
    ]


def get_commodity_futures():
    """
    주요 원자재 선물 티커 목록
    (선물은 표준화된 심볼이므로 정적 리스트 사용)
    """
    return [
        # Energy Futures
        {'symbol': 'CL', 'name': 'Crude Oil WTI Futures', 'exchange': 'NYMEX', 'sector': 'Energy', 'industry': 'Crude Oil'},
        {'symbol': 'BZ', 'name': 'Brent Crude Oil Futures', 'exchange': 'ICE', 'sector': 'Energy', 'industry': 'Crude Oil'},
        {'symbol': 'NG', 'name': 'Natural Gas Futures', 'exchange': 'NYMEX', 'sector': 'Energy', 'industry': 'Natural Gas'},
        {'symbol': 'HO', 'name': 'Heating Oil Futures', 'exchange': 'NYMEX', 'sector': 'Energy', 'industry': 'Heating Oil'},
        {'symbol': 'RB', 'name': 'RBOB Gasoline Futures', 'exchange': 'NYMEX', 'sector': 'Energy', 'industry': 'Gasoline'},

        # Precious Metals
        {'symbol': 'GC', 'name': 'Gold Futures', 'exchange': 'COMEX', 'sector': 'Metals', 'industry': 'Precious Metals'},
        {'symbol': 'SI', 'name': 'Silver Futures', 'exchange': 'COMEX', 'sector': 'Metals', 'industry': 'Precious Metals'},
        {'symbol': 'PL', 'name': 'Platinum Futures', 'exchange': 'NYMEX', 'sector': 'Metals', 'industry': 'Precious Metals'},
        {'symbol': 'PA', 'name': 'Palladium Futures', 'exchange': 'NYMEX', 'sector': 'Metals', 'industry': 'Precious Metals'},

        # Industrial Metals
        {'symbol': 'HG', 'name': 'Copper Futures', 'exchange': 'COMEX', 'sector': 'Metals', 'industry': 'Industrial Metals'},

        # Agricultural
        {'symbol': 'ZC', 'name': 'Corn Futures', 'exchange': 'CBOT', 'sector': 'Agriculture', 'industry': 'Grains'},
        {'symbol': 'ZW', 'name': 'Wheat Futures', 'exchange': 'CBOT', 'sector': 'Agriculture', 'industry': 'Grains'},
        {'symbol': 'ZS', 'name': 'Soybean Futures', 'exchange': 'CBOT', 'sector': 'Agriculture', 'industry': 'Grains'},
        {'symbol': 'KC', 'name': 'Coffee Futures', 'exchange': 'ICE', 'sector': 'Agriculture', 'industry': 'Softs'},
        {'symbol': 'SB', 'name': 'Sugar Futures', 'exchange': 'ICE', 'sector': 'Agriculture', 'industry': 'Softs'},
        {'symbol': 'CT', 'name': 'Cotton Futures', 'exchange': 'ICE', 'sector': 'Agriculture', 'industry': 'Softs'},
        {'symbol': 'CC', 'name': 'Cocoa Futures', 'exchange': 'ICE', 'sector': 'Agriculture', 'industry': 'Softs'},

        # Livestock
        {'symbol': 'LE', 'name': 'Live Cattle Futures', 'exchange': 'CME', 'sector': 'Agriculture', 'industry': 'Livestock'},
        {'symbol': 'HE', 'name': 'Lean Hogs Futures', 'exchange': 'CME', 'sector': 'Agriculture', 'industry': 'Livestock'},

        # Index Futures
        {'symbol': 'ES', 'name': 'E-mini S&P 500 Futures', 'exchange': 'CME', 'sector': 'Index', 'industry': 'Equity Index'},
        {'symbol': 'NQ', 'name': 'E-mini NASDAQ-100 Futures', 'exchange': 'CME', 'sector': 'Index', 'industry': 'Equity Index'},
        {'symbol': 'YM', 'name': 'E-mini Dow Futures', 'exchange': 'CBOT', 'sector': 'Index', 'industry': 'Equity Index'},
    ]


def get_major_etfs():
    """
    주요 ETF 목록
    """
    return [
        {'symbol': 'SPY', 'name': 'SPDR S&P 500 ETF Trust', 'exchange': 'NYSE', 'sector': 'ETF', 'industry': 'Large Cap'},
        {'symbol': 'QQQ', 'name': 'Invesco QQQ Trust', 'exchange': 'NASDAQ', 'sector': 'ETF', 'industry': 'Technology'},
        {'symbol': 'DIA', 'name': 'SPDR Dow Jones Industrial Average ETF', 'exchange': 'NYSE', 'sector': 'ETF', 'industry': 'Large Cap'},
        {'symbol': 'IWM', 'name': 'iShares Russell 2000 ETF', 'exchange': 'NYSE', 'sector': 'ETF', 'industry': 'Small Cap'},
        {'symbol': 'VTI', 'name': 'Vanguard Total Stock Market ETF', 'exchange': 'NYSE', 'sector': 'ETF', 'industry': 'Total Market'},
        {'symbol': 'GLD', 'name': 'SPDR Gold Shares', 'exchange': 'NYSE', 'sector': 'ETF', 'industry': 'Commodities'},
        {'symbol': 'SLV', 'name': 'iShares Silver Trust', 'exchange': 'NYSE', 'sector': 'ETF', 'industry': 'Commodities'},
        {'symbol': 'USO', 'name': 'United States Oil Fund', 'exchange': 'NYSE', 'sector': 'ETF', 'industry': 'Energy'},
        {'symbol': 'TLT', 'name': 'iShares 20+ Year Treasury Bond ETF', 'exchange': 'NASDAQ', 'sector': 'ETF', 'industry': 'Bonds'},
        {'symbol': 'EEM', 'name': 'iShares MSCI Emerging Markets ETF', 'exchange': 'NYSE', 'sector': 'ETF', 'industry': 'International'},
    ]


def load_market_data(db_path="data/marketpulse.db"):
    """실제 소스에서 마켓 데이터 로드"""

    log.info("Initializing database...")
    # Use absolute path
    DB_PATH = Path(__file__).parent.parent / "data" / "marketpulse.db"
    DB_PATH.parent.mkdir(exist_ok=True)
    db = get_sqlite_db(str(DB_PATH))
    db.create_tables()

    session = db.get_session()

    try:
        # 1. S&P 500 종목 로드 (실제 데이터)
        sp500_tickers = get_sp500_tickers()
        log.info(f"Loading {len(sp500_tickers)} S&P 500 stocks...")

        sp500_count = 0
        for ticker_info in sp500_tickers:
            existing = session.query(Ticker).filter_by(symbol=ticker_info['symbol']).first()
            if not existing:
                ticker = Ticker(
                    symbol=ticker_info['symbol'],
                    name=ticker_info['name'],
                    exchange=ticker_info['exchange'],
                    sector=ticker_info['sector'],
                    industry=ticker_info['industry']
                )
                session.add(ticker)
                sp500_count += 1

        session.commit()
        log.info(f"✓ Loaded {sp500_count} new S&P 500 stocks")

        # 2. 원자재 선물 로드
        commodity_futures = get_commodity_futures()
        log.info(f"Loading {len(commodity_futures)} commodity futures...")

        commodity_count = 0
        for ticker_info in commodity_futures:
            existing = session.query(Ticker).filter_by(symbol=ticker_info['symbol']).first()
            if not existing:
                ticker = Ticker(
                    symbol=ticker_info['symbol'],
                    name=ticker_info['name'],
                    exchange=ticker_info['exchange'],
                    sector=ticker_info['sector'],
                    industry=ticker_info['industry']
                )
                session.add(ticker)
                commodity_count += 1

        session.commit()
        log.info(f"✓ Loaded {commodity_count} new commodity futures")

        # 3. ETF 로드
        major_etfs = get_major_etfs()
        log.info(f"Loading {len(major_etfs)} major ETFs...")

        etf_count = 0
        for ticker_info in major_etfs:
            existing = session.query(Ticker).filter_by(symbol=ticker_info['symbol']).first()
            if not existing:
                ticker = Ticker(
                    symbol=ticker_info['symbol'],
                    name=ticker_info['name'],
                    exchange=ticker_info['exchange'],
                    sector=ticker_info['sector'],
                    industry=ticker_info['industry']
                )
                session.add(ticker)
                etf_count += 1

        session.commit()
        log.info(f"✓ Loaded {etf_count} new ETFs")

        # 통계
        total_tickers = session.query(Ticker).count()

        # 섹터별 통계
        from sqlalchemy import func
        sector_stats = session.query(
            Ticker.sector,
            func.count(Ticker.symbol)
        ).group_by(Ticker.sector).all()

        log.info(f"\n{'='*60}")
        log.info(f"Data Load Summary:")
        log.info(f"  S&P 500 stocks: {sp500_count} new (total: {len(sp500_tickers)})")
        log.info(f"  Commodity futures: {commodity_count} new")
        log.info(f"  ETFs: {etf_count} new")
        log.info(f"  Total tickers in database: {total_tickers}")
        log.info(f"\nSector Distribution:")
        for sector, count in sorted(sector_stats, key=lambda x: -x[1]):
            log.info(f"  {sector or 'N/A':30s} {count:4d} tickers")
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


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Load S&P 500 and commodity futures data')
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

    args = parser.parse_args()

    log.info("="*60)
    log.info("MarketPulse Market Data Loader")
    log.info("Loading Real-Time S&P 500, Commodities, and ETF data")
    log.info("="*60)

    if args.reset:
        log.warning("Resetting ticker data...")
        DB_PATH = Path(__file__).parent.parent / "data" / "marketpulse.db"
        db = get_sqlite_db(str(DB_PATH))
        session = db.get_session()
        session.query(Ticker).delete()
        session.commit()
        session.close()
        log.info("✓ Ticker data reset complete")

    db = load_market_data(args.path)

    print("\n✓ Market data loaded successfully!")
    print(f"Database: {Path(__file__).parent.parent / 'data' / 'marketpulse.db'}")
    print("\nRun crawler: python run_integrated_crawler.py")
    print("Start API: python -m app.main")
