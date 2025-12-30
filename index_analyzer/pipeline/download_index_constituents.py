"""
지수 구성종목 다운로드 스크립트
GitHub CSV 파일에서 S&P 500, NASDAQ 100, Dow 30 구성종목을 다운로드하여 DB에 저장
"""
import sys
import logging
import requests
import pandas as pd
from pathlib import Path
from datetime import datetime, date
from sqlalchemy.orm import Session

# 프로젝트 루트 추가
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from index_analyzer.models.database import (
    MBS_IN_STBD_MST, MBS_IN_INDX_STBD,
    get_sqlite_db, generate_batch_id
)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


# GitHub CSV URLs
INDEX_URLS = {
    'sp500': {
        'url': 'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv',
        'indx_cd': 'sp500',
        'indx_nm': 'S&P 500',
        'description': 'S&P 500 Index - 500 large-cap US stocks',
        'category': 'Large Cap'
    },
    'nasdaq100': {
        'url': 'https://yfiua.github.io/index-constituents/constituents-nasdaq100.csv',
        'indx_cd': 'nasdaq100',
        'indx_nm': 'NASDAQ 100',
        'description': 'NASDAQ 100 Index - Top 100 non-financial NASDAQ stocks',
        'category': 'Tech/Growth'
    },
    'dow30': {
        'url': None,  # Dow 30은 fallback 리스트 사용
        'indx_cd': 'dow30',
        'indx_nm': 'Dow Jones 30',
        'description': 'Dow Jones Industrial Average - 30 blue chip US stocks',
        'category': 'Blue Chip',
        'fallback': [
            {'ticker_cd': 'AAPL', 'ticker_nm': 'Apple Inc.', 'sector': 'Technology', 'industry': 'Consumer Electronics'},
            {'ticker_cd': 'MSFT', 'ticker_nm': 'Microsoft Corporation', 'sector': 'Technology', 'industry': 'Software'},
            {'ticker_cd': 'UNH', 'ticker_nm': 'UnitedHealth Group Inc.', 'sector': 'Healthcare', 'industry': 'Health Insurance'},
            {'ticker_cd': 'GS', 'ticker_nm': 'The Goldman Sachs Group Inc.', 'sector': 'Financials', 'industry': 'Investment Banking'},
            {'ticker_cd': 'HD', 'ticker_nm': 'The Home Depot Inc.', 'sector': 'Consumer Cyclical', 'industry': 'Home Improvement Retail'},
            {'ticker_cd': 'MCD', 'ticker_nm': 'McDonald\'s Corporation', 'sector': 'Consumer Cyclical', 'industry': 'Restaurants'},
            {'ticker_cd': 'CAT', 'ticker_nm': 'Caterpillar Inc.', 'sector': 'Industrials', 'industry': 'Construction & Farm Machinery'},
            {'ticker_cd': 'V', 'ticker_nm': 'Visa Inc.', 'sector': 'Financials', 'industry': 'Credit Services'},
            {'ticker_cd': 'AMGN', 'ticker_nm': 'Amgen Inc.', 'sector': 'Healthcare', 'industry': 'Biotechnology'},
            {'ticker_cd': 'BA', 'ticker_nm': 'The Boeing Company', 'sector': 'Industrials', 'industry': 'Aerospace & Defense'},
            {'ticker_cd': 'HON', 'ticker_nm': 'Honeywell International Inc.', 'sector': 'Industrials', 'industry': 'Conglomerates'},
            {'ticker_cd': 'IBM', 'ticker_nm': 'International Business Machines Corporation', 'sector': 'Technology', 'industry': 'IT Services'},
            {'ticker_cd': 'CRM', 'ticker_nm': 'Salesforce Inc.', 'sector': 'Technology', 'industry': 'Software - Application'},
            {'ticker_cd': 'TRV', 'ticker_nm': 'The Travelers Companies Inc.', 'sector': 'Financials', 'industry': 'Insurance'},
            {'ticker_cd': 'AXP', 'ticker_nm': 'American Express Company', 'sector': 'Financials', 'industry': 'Credit Services'},
            {'ticker_cd': 'JPM', 'ticker_nm': 'JPMorgan Chase & Co.', 'sector': 'Financials', 'industry': 'Banking'},
            {'ticker_cd': 'JNJ', 'ticker_nm': 'Johnson & Johnson', 'sector': 'Healthcare', 'industry': 'Pharmaceuticals'},
            {'ticker_cd': 'WMT', 'ticker_nm': 'Walmart Inc.', 'sector': 'Consumer Defensive', 'industry': 'Discount Stores'},
            {'ticker_cd': 'CVX', 'ticker_nm': 'Chevron Corporation', 'sector': 'Energy', 'industry': 'Oil & Gas'},
            {'ticker_cd': 'PG', 'ticker_nm': 'The Procter & Gamble Company', 'sector': 'Consumer Defensive', 'industry': 'Personal Products'},
            {'ticker_cd': 'NKE', 'ticker_nm': 'NIKE Inc.', 'sector': 'Consumer Cyclical', 'industry': 'Footwear & Accessories'},
            {'ticker_cd': 'DIS', 'ticker_nm': 'The Walt Disney Company', 'sector': 'Communication Services', 'industry': 'Entertainment'},
            {'ticker_cd': 'MRK', 'ticker_nm': 'Merck & Co. Inc.', 'sector': 'Healthcare', 'industry': 'Pharmaceuticals'},
            {'ticker_cd': 'VZ', 'ticker_nm': 'Verizon Communications Inc.', 'sector': 'Communication Services', 'industry': 'Telecom Services'},
            {'ticker_cd': 'CSCO', 'ticker_nm': 'Cisco Systems Inc.', 'sector': 'Technology', 'industry': 'Communication Equipment'},
            {'ticker_cd': 'KO', 'ticker_nm': 'The Coca-Cola Company', 'sector': 'Consumer Defensive', 'industry': 'Beverages - Non-Alcoholic'},
            {'ticker_cd': 'INTC', 'ticker_nm': 'Intel Corporation', 'sector': 'Technology', 'industry': 'Semiconductors'},
            {'ticker_cd': 'DOW', 'ticker_nm': 'Dow Inc.', 'sector': 'Basic Materials', 'industry': 'Chemicals'},
            {'ticker_cd': 'WBA', 'ticker_nm': 'Walgreens Boots Alliance Inc.', 'sector': 'Healthcare', 'industry': 'Pharmaceutical Retailers'},
            {'ticker_cd': 'MMM', 'ticker_nm': '3M Company', 'sector': 'Industrials', 'industry': 'Conglomerates'}
        ]
    }
}


def download_csv(url: str) -> pd.DataFrame:
    """CSV 파일 다운로드"""
    try:
        log.info(f"Downloading from {url}")
        response = requests.get(url, timeout=30)
        response.raise_for_status()

        # CSV를 DataFrame으로 변환
        from io import StringIO
        df = pd.read_csv(StringIO(response.text))
        log.info(f"Downloaded {len(df)} rows")
        return df
    except Exception as e:
        log.error(f"Error downloading CSV from {url}: {e}")
        return None


def process_sp500(df: pd.DataFrame) -> list:
    """S&P 500 CSV 처리"""
    constituents = []

    for _, row in df.iterrows():
        try:
            # S&P 500 CSV 구조: Symbol, Security, GICS Sector, GICS Sub-Industry, ...
            constituent = {
                'ticker_cd': row.get('Symbol', '').strip(),
                'ticker_nm': row.get('Security', '').strip(),
                'sector': row.get('GICS Sector', None),
                'industry': row.get('GICS Sub-Industry', None),
                'exchange': 'NYSE/NASDAQ',  # S&P 500은 둘 다 포함
                'country': 'US'
            }

            if constituent['ticker_cd'] and constituent['ticker_nm']:
                constituents.append(constituent)
        except Exception as e:
            log.warning(f"Error processing SP500 row: {e}")
            continue

    return constituents


def process_nasdaq100(df: pd.DataFrame) -> list:
    """NASDAQ 100 CSV 처리"""
    constituents = []

    for _, row in df.iterrows():
        try:
            # NASDAQ 100 CSV 구조: ticker, name, sector, industry
            constituent = {
                'ticker_cd': row.get('ticker', row.get('Symbol', '')).strip(),
                'ticker_nm': row.get('name', row.get('Name', '')).strip(),
                'sector': row.get('sector', row.get('Sector', None)),
                'industry': row.get('industry', row.get('Industry', None)),
                'exchange': 'NASDAQ',
                'country': 'US'
            }

            if constituent['ticker_cd'] and constituent['ticker_nm']:
                constituents.append(constituent)
        except Exception as e:
            log.warning(f"Error processing NASDAQ100 row: {e}")
            continue

    return constituents


def process_dow30(df: pd.DataFrame) -> list:
    """Dow 30 CSV 처리"""
    constituents = []

    for _, row in df.iterrows():
        try:
            # Dow 30 CSV 구조: ticker, name, sector, industry
            constituent = {
                'ticker_cd': row.get('ticker', row.get('Symbol', '')).strip(),
                'ticker_nm': row.get('name', row.get('Company', '')).strip(),
                'sector': row.get('sector', row.get('Sector', None)),
                'industry': row.get('industry', row.get('Industry', None)),
                'exchange': 'NYSE/NASDAQ',
                'country': 'US'
            }

            if constituent['ticker_cd'] and constituent['ticker_nm']:
                constituents.append(constituent)
        except Exception as e:
            log.warning(f"Error processing DOW30 row: {e}")
            continue

    return constituents


def save_to_database(session: Session, index_id: str, constituents: list, batch_id: str):
    """DB에 저장"""
    saved_count = 0
    updated_count = 0

    for constituent in constituents:
        try:
            ticker_cd = constituent['ticker_cd']

            # 기존 레코드 확인
            existing = session.query(MBS_IN_STBD_MST).filter_by(ticker_cd=ticker_cd).first()

            if existing:
                # 기존 레코드 업데이트
                existing.ticker_nm = constituent['ticker_nm']
                existing.sector = constituent.get('sector')
                existing.industry = constituent.get('industry')
                existing.exchange = constituent.get('exchange')
                existing.country = constituent.get('country', 'US')
                existing.is_active = True
                existing.data_source = f'github_{index_id}'
                existing.updated_at = datetime.utcnow()
                updated_count += 1
            else:
                # 새 레코드 삽입
                new_ticker = MBS_IN_STBD_MST(
                    ticker_cd=ticker_cd,
                    ticker_nm=constituent['ticker_nm'],
                    asset_type='stock',
                    sector=constituent.get('sector'),
                    industry=constituent.get('industry'),
                    exchange=constituent.get('exchange'),
                    country=constituent.get('country', 'US'),
                    curr='USD',
                    data_source=f'github_{index_id}',
                    is_active=True,
                    start_date=date.today(),
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                session.add(new_ticker)
                saved_count += 1

        except Exception as e:
            log.error(f"Error saving ticker {constituent.get('ticker_cd')}: {e}")
            continue

    session.commit()
    log.info(f"Saved {saved_count} new tickers, updated {updated_count} existing tickers")
    return saved_count, updated_count


def update_index_metadata(session: Session, index_info: dict):
    """지수 메타데이터 업데이트"""
    try:
        indx_cd = index_info['indx_cd']

        # 기존 레코드 확인
        existing = session.query(MBS_IN_INDX_STBD).filter_by(indx_cd=indx_cd).first()

        if existing:
            # 업데이트
            existing.indx_nm = index_info['indx_nm']
            existing.description = index_info['description']
            existing.category = index_info['category']
            existing.is_active = True
            existing.updated_at = datetime.utcnow()
            log.info(f"Updated index metadata: {indx_cd}")
        else:
            # 새 레코드 삽입
            new_index = MBS_IN_INDX_STBD(
                indx_cd=indx_cd,
                indx_nm=index_info['indx_nm'],
                indx_type='universe',
                description=index_info['description'],
                category=index_info['category'],
                region='US',
                is_active=True,
                display_order=0,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            session.add(new_index)
            log.info(f"Created new index metadata: {indx_cd}")

        session.commit()
    except Exception as e:
        log.error(f"Error updating index metadata for {index_info['indx_cd']}: {e}")
        session.rollback()


def main():
    """메인 실행 함수"""
    log.info("=" * 60)
    log.info("지수 구성종목 다운로드 시작")
    log.info("=" * 60)

    # DB 연결
    DB_PATH = Path(__file__).parent.parent.parent / "data" / "marketpulse.db"
    db = get_sqlite_db(str(DB_PATH))
    db.create_tables()  # 테이블이 없으면 생성

    batch_id = generate_batch_id()
    session = db.get_session()

    total_saved = 0
    total_updated = 0

    try:
        for index_id, index_info in INDEX_URLS.items():
            log.info(f"\n{'='*60}")
            log.info(f"Processing {index_info['indx_nm']} ({index_id})")
            log.info(f"{'='*60}")

            constituents = []

            # 1. Fallback 리스트가 있으면 사용
            if 'fallback' in index_info and index_info['fallback']:
                log.info(f"Using fallback list for {index_id}")
                constituents = [
                    {
                        'ticker_cd': item['ticker_cd'],
                        'ticker_nm': item['ticker_nm'],
                        'sector': item.get('sector'),
                        'industry': item.get('industry'),
                        'exchange': 'NYSE/NASDAQ',
                        'country': 'US'
                    }
                    for item in index_info['fallback']
                ]
            # 2. CSV 다운로드
            elif index_info['url']:
                df = download_csv(index_info['url'])
                if df is None or df.empty:
                    log.warning(f"Skipping {index_id} - no data downloaded")
                    continue

                # 데이터 처리
                if index_id == 'sp500':
                    constituents = process_sp500(df)
                elif index_id == 'nasdaq100':
                    constituents = process_nasdaq100(df)
                elif index_id == 'dow30':
                    constituents = process_dow30(df)
                else:
                    log.warning(f"Unknown index: {index_id}")
                    continue

            if not constituents:
                log.warning(f"No constituents for {index_id}")
                continue

            log.info(f"Processed {len(constituents)} constituents")

            # 3. DB에 저장
            saved, updated = save_to_database(session, index_id, constituents, batch_id)
            total_saved += saved
            total_updated += updated

            # 4. 지수 메타데이터 업데이트
            update_index_metadata(session, index_info)

        log.info("\n" + "=" * 60)
        log.info("다운로드 완료")
        log.info(f"총 {total_saved} 종목 추가, {total_updated} 종목 업데이트")
        log.info(f"Batch ID: {batch_id}")
        log.info("=" * 60)

    except Exception as e:
        log.error(f"Error in main: {e}")
        session.rollback()
    finally:
        session.close()


if __name__ == '__main__':
    main()
