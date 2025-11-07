"""
Market Data Synchronization Service
외부 API (yfinance, Wikipedia)로부터 ticker/commodity 데이터를 동적으로 가져와 DB에 저장
"""
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Set
import yfinance as yf
import pandas as pd
from sqlalchemy.orm import Session
import ssl
import urllib.request

log = logging.getLogger(__name__)

# SSL 검증 비활성화 (macOS/Linux 환경의 SSL 인증서 문제 해결)
try:
    import ssl
    ssl._create_default_https_context = ssl._create_unverified_context
except Exception as e:
    log.warning(f"Could not disable SSL verification: {e}")


class MarketDataSync:
    """외부 API를 통한 시장 데이터 동기화"""

    def __init__(self, db_session: Session):
        self.session = db_session
        self.sync_results = {
            'success': 0,
            'errors': 0,
            'skipped': 0
        }

    # fallback 로직 제거 - Wikipedia API 사용

    def sync_sp500_from_wikipedia(self) -> List[Dict]:
        """
        Wikipedia에서 S&P 500 편입 종목 실시간 가져오기

        Returns: List of ticker dicts
        """
        log.info("Fetching S&P 500 constituents from Wikipedia...")

        try:
            import requests
            from io import StringIO

            url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'

            # User-Agent를 더 완전하게 설정
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }

            # requests로 HTML 가져오기
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()

            # pandas로 HTML 테이블 파싱
            tables = pd.read_html(StringIO(response.text))

            if not tables:
                log.warning("No tables found in Wikipedia page")
                return []

            sp500_table = tables[0]

            log.info(f"Found {len(sp500_table)} S&P 500 companies from Wikipedia")

            tickers = []
            for _, row in sp500_table.iterrows():
                try:
                    symbol = str(row['Symbol']).strip().replace('.', '-')
                    name = str(row['Security']).strip()
                    sector = str(row.get('GICS Sector', 'Unknown')).strip()
                    industry = str(row.get('GICS Sub-Industry', 'Unknown')).strip()

                    if not symbol or symbol == 'nan':
                        continue

                    ticker_info = {
                        'symbol': symbol,
                        'name': name,
                        'sector': sector,
                        'industry': industry,
                        'exchange': 'NYSE' if 'NYSE' in str(row.get('Exchange', 'NYSE')) else 'NASDAQ',
                        'country': 'USA',
                        'currency': 'USD',
                        'data_source': 'wikipedia'
                    }
                    tickers.append(ticker_info)
                except Exception as row_e:
                    log.debug(f"Error processing row: {row_e}")
                    continue

            if tickers:
                log.info(f"Successfully parsed {len(tickers)} S&P 500 tickers from Wikipedia")
                return tickers
            else:
                log.warning("No valid tickers parsed from Wikipedia table")
                return []

        except Exception as e:
            log.error(f"Error fetching S&P 500 from Wikipedia: {type(e).__name__}: {e}")
            return []

    def sync_commodity_futures_from_config(self) -> List[Dict]:
        """
        주요 원자재 선물 심볼 목록 (표준화된 심볼)
        향후 외부 API로 확장 가능
        """
        return [
            # Energy
            {'symbol': 'CL=F', 'name': 'Crude Oil WTI Futures', 'exchange': 'NYMEX', 'sector': 'Energy', 'industry': 'Crude Oil', 'currency': 'USD'},
            {'symbol': 'BZ=F', 'name': 'Brent Crude Oil Futures', 'exchange': 'ICE', 'sector': 'Energy', 'industry': 'Crude Oil', 'currency': 'USD'},
            {'symbol': 'NG=F', 'name': 'Natural Gas Futures', 'exchange': 'NYMEX', 'sector': 'Energy', 'industry': 'Natural Gas', 'currency': 'USD'},
            {'symbol': 'HO=F', 'name': 'Heating Oil Futures', 'exchange': 'NYMEX', 'sector': 'Energy', 'industry': 'Heating Oil', 'currency': 'USD'},
            {'symbol': 'RB=F', 'name': 'RBOB Gasoline Futures', 'exchange': 'NYMEX', 'sector': 'Energy', 'industry': 'Gasoline', 'currency': 'USD'},

            # Precious Metals
            {'symbol': 'GC=F', 'name': 'Gold Futures', 'exchange': 'COMEX', 'sector': 'Metals', 'industry': 'Precious Metals', 'currency': 'USD'},
            {'symbol': 'SI=F', 'name': 'Silver Futures', 'exchange': 'COMEX', 'sector': 'Metals', 'industry': 'Precious Metals', 'currency': 'USD'},
            {'symbol': 'PL=F', 'name': 'Platinum Futures', 'exchange': 'NYMEX', 'sector': 'Metals', 'industry': 'Precious Metals', 'currency': 'USD'},
            {'symbol': 'PA=F', 'name': 'Palladium Futures', 'exchange': 'NYMEX', 'sector': 'Metals', 'industry': 'Precious Metals', 'currency': 'USD'},

            # Industrial Metals
            {'symbol': 'HG=F', 'name': 'Copper Futures', 'exchange': 'COMEX', 'sector': 'Metals', 'industry': 'Industrial Metals', 'currency': 'USD'},

            # Agricultural
            {'symbol': 'ZC=F', 'name': 'Corn Futures', 'exchange': 'CBOT', 'sector': 'Agriculture', 'industry': 'Grains', 'currency': 'USD'},
            {'symbol': 'ZW=F', 'name': 'Wheat Futures', 'exchange': 'CBOT', 'sector': 'Agriculture', 'industry': 'Grains', 'currency': 'USD'},
            {'symbol': 'ZS=F', 'name': 'Soybean Futures', 'exchange': 'CBOT', 'sector': 'Agriculture', 'industry': 'Grains', 'currency': 'USD'},
            {'symbol': 'KC=F', 'name': 'Coffee Futures', 'exchange': 'ICE', 'sector': 'Agriculture', 'industry': 'Softs', 'currency': 'USD'},
            {'symbol': 'SB=F', 'name': 'Sugar Futures', 'exchange': 'ICE', 'sector': 'Agriculture', 'industry': 'Softs', 'currency': 'USD'},
            {'symbol': 'CT=F', 'name': 'Cotton Futures', 'exchange': 'ICE', 'sector': 'Agriculture', 'industry': 'Softs', 'currency': 'USD'},
            {'symbol': 'CC=F', 'name': 'Cocoa Futures', 'exchange': 'ICE', 'sector': 'Agriculture', 'industry': 'Softs', 'currency': 'USD'},

            # Livestock
            {'symbol': 'LE=F', 'name': 'Live Cattle Futures', 'exchange': 'CME', 'sector': 'Agriculture', 'industry': 'Livestock', 'currency': 'USD'},
            {'symbol': 'HE=F', 'name': 'Lean Hogs Futures', 'exchange': 'CME', 'sector': 'Agriculture', 'industry': 'Livestock', 'currency': 'USD'},
        ]

    def sync_bonds_from_config(self) -> List[Dict]:
        """주요 채권 목록 (US Treasury)"""
        return [
            {'symbol': '^TNX', 'name': 'US 10-Year Treasury Yield', 'exchange': 'CBOE', 'bond_type': 'Treasury', 'maturity': '10Y', 'currency': 'USD'},
            {'symbol': '^TYX', 'name': 'US 30-Year Treasury Yield', 'exchange': 'CBOE', 'bond_type': 'Treasury', 'maturity': '30Y', 'currency': 'USD'},
            {'symbol': '^FVX', 'name': 'US 5-Year Treasury Yield', 'exchange': 'CBOE', 'bond_type': 'Treasury', 'maturity': '5Y', 'currency': 'USD'},
            {'symbol': '^IRX', 'name': 'US 13-Week Treasury Bill', 'exchange': 'CBOE', 'bond_type': 'Treasury', 'maturity': '3M', 'currency': 'USD'},
            {'symbol': 'TLT', 'name': 'iShares 20+ Year Treasury Bond ETF', 'exchange': 'NASDAQ', 'bond_type': 'Treasury ETF', 'maturity': '20Y+', 'currency': 'USD'},
            {'symbol': 'IEF', 'name': 'iShares 7-10 Year Treasury Bond ETF', 'exchange': 'NASDAQ', 'bond_type': 'Treasury ETF', 'maturity': '7-10Y', 'currency': 'USD'},
            {'symbol': 'SHY', 'name': 'iShares 1-3 Year Treasury Bond ETF', 'exchange': 'NASDAQ', 'bond_type': 'Treasury ETF', 'maturity': '1-3Y', 'currency': 'USD'},
        ]

    def sync_etfs_from_config(self) -> List[Dict]:
        """주요 ETF 목록"""
        return [
            {'symbol': 'SPY', 'name': 'SPDR S&P 500 ETF Trust', 'exchange': 'NYSE', 'sector': 'ETF', 'industry': 'Large Cap', 'asset_type': 'etf', 'country': 'USA', 'currency': 'USD'},
            {'symbol': 'QQQ', 'name': 'Invesco QQQ Trust', 'exchange': 'NASDAQ', 'sector': 'ETF', 'industry': 'Technology', 'asset_type': 'etf', 'country': 'USA', 'currency': 'USD'},
            {'symbol': 'DIA', 'name': 'SPDR Dow Jones Industrial Average ETF', 'exchange': 'NYSE', 'sector': 'ETF', 'industry': 'Large Cap', 'asset_type': 'etf', 'country': 'USA', 'currency': 'USD'},
            {'symbol': 'IWM', 'name': 'iShares Russell 2000 ETF', 'exchange': 'NYSE', 'sector': 'ETF', 'industry': 'Small Cap', 'asset_type': 'etf', 'country': 'USA', 'currency': 'USD'},
            {'symbol': 'VTI', 'name': 'Vanguard Total Stock Market ETF', 'exchange': 'NYSE', 'sector': 'ETF', 'industry': 'Total Market', 'asset_type': 'etf', 'country': 'USA', 'currency': 'USD'},
            {'symbol': 'GLD', 'name': 'SPDR Gold Shares', 'exchange': 'NYSE', 'sector': 'ETF', 'industry': 'Commodities', 'asset_type': 'etf', 'country': 'USA', 'currency': 'USD'},
            {'symbol': 'SLV', 'name': 'iShares Silver Trust', 'exchange': 'NYSE', 'sector': 'ETF', 'industry': 'Commodities', 'asset_type': 'etf', 'country': 'USA', 'currency': 'USD'},
            {'symbol': 'USO', 'name': 'United States Oil Fund', 'exchange': 'NYSE', 'sector': 'ETF', 'industry': 'Energy', 'asset_type': 'etf', 'country': 'USA', 'currency': 'USD'},
            {'symbol': 'TLT', 'name': 'iShares 20+ Year Treasury Bond ETF', 'exchange': 'NASDAQ', 'sector': 'ETF', 'industry': 'Bonds', 'asset_type': 'etf', 'country': 'USA', 'currency': 'USD'},
            {'symbol': 'EEM', 'name': 'iShares MSCI Emerging Markets ETF', 'exchange': 'NYSE', 'sector': 'ETF', 'industry': 'International', 'asset_type': 'etf', 'country': 'USA', 'currency': 'USD'},
        ]

    def enrich_with_yfinance(self, ticker_info: Dict) -> Optional[Dict]:
        """
        yfinance API로 ticker 상세 정보 보강
        SSL 또는 네트워크 오류 발생 시 기존 정보 반환
        """
        symbol = ticker_info['symbol']

        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info

            # yfinance에서 추가 정보 가져오기
            if info and len(info) > 1:
                ticker_info.update({
                    'currency': info.get('currency', ticker_info.get('currency', 'USD')),
                    'country': info.get('country', ticker_info.get('country')),
                    'data_source': 'yfinance',
                    'is_active': True
                })

                # sector/industry가 없으면 yfinance에서 채우기
                if not ticker_info.get('sector'):
                    ticker_info['sector'] = info.get('sector', 'Unknown')
                if not ticker_info.get('industry'):
                    ticker_info['industry'] = info.get('industry', 'Unknown')

                log.debug(f"Enriched {symbol} with yfinance data")
                return ticker_info
            else:
                log.debug(f"No yfinance data for {symbol}, using provided data")
                # 정보가 없어도 기존 정보는 유효함
                ticker_info['data_source'] = 'config'
                ticker_info['is_active'] = True
                return ticker_info

        except Exception as e:
            # SSL, 네트워크, 타임아웃 등의 오류는 로그만 하고 기존 정보 반환
            log.debug(f"Could not enrich {symbol} from yfinance: {e}")
            log.info(f"Using provided data for {symbol} (skipping yfinance enrichment)")

            # 기존 정보 유지
            ticker_info['data_source'] = ticker_info.get('data_source', 'config')
            ticker_info['is_active'] = True
            return ticker_info

    def sync_tickers_to_db(self, tickers: List[Dict], asset_type: str = 'stock',
                           batch_id: Optional[str] = None, enrich: bool = True) -> int:
        """
        티커 목록을 MBS_IN_STBD_MST 마스터 테이블에 동기화

        Args:
            tickers: 티커 정보 리스트
            asset_type: 자산 유형 ('stock', 'etf', 'bond', 'commodity')
            batch_id: 입수 배치 ID
            enrich: yfinance로 정보 보강 여부

        Returns:
            저장된 티커 수
        """
        from app.models.database import MBS_IN_STBD_MST

        saved_count = 0

        for ticker_info in tickers:
            symbol = ticker_info['symbol']

            try:
                # yfinance로 정보 보강
                if enrich:
                    enriched = self.enrich_with_yfinance(ticker_info)
                    if not enriched:
                        self.sync_results['skipped'] += 1
                        continue
                    ticker_info = enriched
                else:
                    ticker_info.update({
                        'data_source': ticker_info.get('data_source', 'manual'),
                        'is_active': True
                    })

                # MBS_IN_STBD_MST 마스터 테이블에 저장
                from datetime import date
                today = date.today()

                existing = self.session.query(MBS_IN_STBD_MST).filter_by(
                    ticker_cd=symbol
                ).first()

                if existing:
                    # 업데이트
                    existing.ticker_nm = ticker_info.get('name', symbol)
                    existing.asset_type = asset_type
                    existing.sector = ticker_info.get('sector', 'Unknown')
                    existing.industry = ticker_info.get('industry')
                    existing.exchange = ticker_info.get('exchange')
                    existing.country = ticker_info.get('country')
                    existing.curr = ticker_info.get('currency', 'USD')
                    existing.bond_type = ticker_info.get('bond_type')
                    existing.maturity = ticker_info.get('maturity')
                    existing.data_source = ticker_info.get('data_source', 'manual')
                    existing.is_active = True
                    existing.end_date = None  # 재활성화 시 종료일 제거
                    existing.updated_at = datetime.utcnow()
                    log.debug(f"Updated {asset_type}: {symbol}")
                else:
                    # 신규 추가
                    new_ticker = MBS_IN_STBD_MST(
                        ticker_cd=symbol,
                        ticker_nm=ticker_info.get('name', symbol),
                        asset_type=asset_type,
                        sector=ticker_info.get('sector', 'Unknown'),
                        industry=ticker_info.get('industry'),
                        exchange=ticker_info.get('exchange'),
                        country=ticker_info.get('country'),
                        curr=ticker_info.get('currency', 'USD'),
                        bond_type=ticker_info.get('bond_type'),
                        maturity=ticker_info.get('maturity'),
                        data_source=ticker_info.get('data_source', 'manual'),
                        is_active=True,
                        start_date=today  # 수집 시작일 설정
                    )
                    self.session.add(new_ticker)
                    log.debug(f"Added {asset_type}: {symbol}")

                saved_count += 1
                self.sync_results['success'] += 1

            except Exception as e:
                log.error(f"Error saving {symbol}: {e}")
                self.sync_results['errors'] += 1
                continue

        # 커밋
        try:
            self.session.commit()
            log.info(f"Saved {saved_count} {asset_type} records to MBS_IN_STBD_MST")
        except Exception as e:
            log.error(f"Error committing to database: {e}")
            self.session.rollback()
            raise

        return saved_count

    def sync_all(self, enrich: bool = True) -> Dict:
        """
        모든 마켓 데이터 동기화
        - S&P 500 주식 → MBS_IN_STBD_MST
        - ETF → MBS_IN_STBD_MST
        - Commodity → MBS_IN_STBD_MST
        - Bonds → MBS_IN_STBD_MST

        Args:
            enrich: yfinance로 정보 보강 여부

        Returns:
            동기화 결과 딕셔너리
        """
        from app.models.database import generate_batch_id

        log.info("="*60)
        log.info("Starting market data synchronization to MBS_IN_STBD_MST...")
        log.info("="*60)

        batch_id = generate_batch_id()
        log.info(f"Batch ID: {batch_id}")

        results = {
            'sp500': 0,
            'etfs': 0,
            'commodities': 0,
            'bonds': 0,
            'total': 0
        }

        # 1. S&P 500 주식 동기화
        log.info("\n[1/4] Syncing S&P 500 stocks to MBS_IN_STBD_MST...")
        sp500_tickers = self.sync_sp500_from_wikipedia()

        if sp500_tickers:
            count = self.sync_tickers_to_db(
                sp500_tickers,
                asset_type='stock',
                batch_id=batch_id,
                enrich=enrich
            )
            results['sp500'] = count
            log.info(f"Synced {count} S&P 500 stocks")
        else:
            log.error("[ERROR] Failed to fetch S&P 500 data from Wikipedia - network or parsing issue")

        # 2. ETF 동기화
        log.info("\n[2/4] Syncing ETFs to MBS_IN_STBD_MST...")
        etf_tickers = self.sync_etfs_from_config()
        if etf_tickers:
            count = self.sync_tickers_to_db(
                etf_tickers,
                asset_type='etf',
                batch_id=batch_id,
                enrich=enrich
            )
            results['etfs'] = count
            log.info(f"Synced {count} ETFs")

        # 3. Commodity Futures 동기화
        log.info("\n[3/4] Syncing commodity futures to MBS_IN_STBD_MST...")
        commodity_tickers = self.sync_commodity_futures_from_config()
        if commodity_tickers:
            count = self.sync_tickers_to_db(
                commodity_tickers,
                asset_type='commodity',
                batch_id=batch_id,
                enrich=enrich
            )
            results['commodities'] = count
            log.info(f"Synced {count} commodity futures")

        # 4. Bonds 동기화
        log.info("\n[4/4] Syncing bonds to MBS_IN_STBD_MST...")
        bond_tickers = self.sync_bonds_from_config()
        if bond_tickers:
            count = self.sync_tickers_to_db(
                bond_tickers,
                asset_type='bond',
                batch_id=batch_id,
                enrich=enrich
            )
            results['bonds'] = count
            log.info(f"Synced {count} bonds")

        results['total'] = results['sp500'] + results['etfs'] + results['commodities'] + results['bonds']

        log.info("\n" + "="*60)
        log.info("Synchronization Summary (MBS_IN_STBD_MST):")
        log.info(f"  S&P 500 stocks:      {results['sp500']:4d}")
        log.info(f"  ETFs:                {results['etfs']:4d}")
        log.info(f"  Commodity futures:   {results['commodities']:4d}")
        log.info(f"  Bonds:               {results['bonds']:4d}")
        log.info(f"  Total synced:        {results['total']:4d}")
        log.info(f"\n  Success: {self.sync_results['success']}")
        log.info(f"  Errors:  {self.sync_results['errors']}")
        log.info(f"  Skipped: {self.sync_results['skipped']}")
        log.info(f"\n  Batch ID: {batch_id}")
        log.info("="*60)

        return results

    def add_custom_ticker(self, symbol: str, asset_type: str = 'stock', enrich: bool = True) -> bool:
        """
        커스텀 티커 추가
        - stock: MBS_IN_STK_STBD에 저장
        - etf: MBS_IN_ETF_STBD에 저장
        - 기타: Ticker (레거시)에 저장

        Args:
            symbol: 티커 심볼
            asset_type: 자산 유형 ('stock', 'etf', 'commodity', 'index')
            enrich: yfinance로 정보 가져오기

        Returns:
            성공 여부
        """
        from app.models.database import generate_batch_id

        ticker_info = {
            'symbol': symbol,
            'name': symbol,
            'asset_type': asset_type,
        }

        if enrich:
            enriched = self.enrich_with_yfinance(ticker_info)
            if not enriched:
                log.error(f"Failed to enrich {symbol} from yfinance")
                return False
            ticker_info = enriched

        batch_id = generate_batch_id()
        count = self.sync_tickers_to_db(
            [ticker_info],
            asset_type=asset_type,
            batch_id=batch_id,
            enrich=False
        )
        return count > 0

    def sync_prices_from_mst(self) -> Dict:
        """
        MBS_IN_STBD_MST 마스터 테이블을 참조하여 각 IN 테이블에 가격 데이터 저장
        - stock → MBS_IN_STK_STBD
        - etf → MBS_IN_ETF_STBD
        - bond → MBS_IN_BOND_STBD
        - commodity → MBS_IN_CMDTY_STBD

        Returns:
            동기화 결과 딕셔너리
        """
        from app.models.database import (
            MBS_IN_STBD_MST, MBS_IN_STK_STBD, MBS_IN_ETF_STBD,
            MBS_IN_BOND_STBD, MBS_IN_CMDTY_STBD, generate_batch_id
        )
        from datetime import date

        log.info("="*60)
        log.info("Starting price data sync from MBS_IN_STBD_MST...")
        log.info("="*60)

        batch_id = generate_batch_id()
        today = date.today()

        results = {
            'stocks': {'success': 0, 'failed': 0},
            'etfs': {'success': 0, 'failed': 0},
            'bonds': {'success': 0, 'failed': 0},
            'commodities': {'success': 0, 'failed': 0},
            'total': 0
        }

        # MST에서 활성 종목 조회
        active_tickers = self.session.query(MBS_IN_STBD_MST).filter(
            MBS_IN_STBD_MST.is_active == True
        ).all()

        log.info(f"Found {len(active_tickers)} active tickers in MST")

        for ticker in active_tickers:
            try:
                # yfinance로 가격 데이터 가져오기
                yf_ticker = yf.Ticker(ticker.ticker_cd)
                info = yf_ticker.info

                if not info or len(info) <= 1:
                    log.debug(f"No price data available for {ticker.ticker_cd}")
                    continue

                # 현재가 정보 추출
                current_price = info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose')
                previous_close = info.get('previousClose')

                if not current_price:
                    log.debug(f"No price data for {ticker.ticker_cd}")
                    continue

                # 변동률 계산
                change_rate = None
                if previous_close and previous_close != 0:
                    change_rate = ((current_price - previous_close) / previous_close) * 100

                # asset_type에 따라 적절한 테이블에 저장
                if ticker.asset_type == 'stock':
                    # MBS_IN_STK_STBD에 저장
                    existing = self.session.query(MBS_IN_STK_STBD).filter_by(
                        stk_cd=ticker.ticker_cd,
                        base_ymd=today
                    ).first()

                    if existing:
                        existing.close_price = current_price
                        existing.change_rate = change_rate
                        existing.updated_at = datetime.utcnow()
                    else:
                        stock_price = MBS_IN_STK_STBD(
                            stk_cd=ticker.ticker_cd,
                            stk_nm=ticker.ticker_nm,
                            sector=ticker.sector,
                            curr=ticker.curr,
                            close_price=current_price,
                            change_rate=change_rate,
                            base_ymd=today,
                            ingest_batch_id=batch_id
                        )
                        self.session.add(stock_price)
                    results['stocks']['success'] += 1

                elif ticker.asset_type == 'etf':
                    # MBS_IN_ETF_STBD에 저장
                    existing = self.session.query(MBS_IN_ETF_STBD).filter_by(
                        etf_cd=ticker.ticker_cd,
                        base_ymd=today
                    ).first()

                    if existing:
                        existing.close_price = current_price
                        existing.change_rate = change_rate
                        existing.updated_at = datetime.utcnow()
                    else:
                        etf_price = MBS_IN_ETF_STBD(
                            etf_cd=ticker.ticker_cd,
                            etf_nm=ticker.ticker_nm,
                            sector=ticker.sector,
                            curr=ticker.curr,
                            close_price=current_price,
                            change_rate=change_rate,
                            base_ymd=today,
                            ingest_batch_id=batch_id
                        )
                        self.session.add(etf_price)
                    results['etfs']['success'] += 1

                elif ticker.asset_type == 'bond':
                    # MBS_IN_BOND_STBD에 저장
                    existing = self.session.query(MBS_IN_BOND_STBD).filter_by(
                        bond_cd=ticker.ticker_cd,
                        base_ymd=today
                    ).first()

                    # 채권은 수익률 정보도 저장
                    yield_rate = info.get('yield')

                    if existing:
                        existing.close_price = current_price
                        existing.yield_rate = yield_rate
                        existing.change_rate = change_rate
                        existing.updated_at = datetime.utcnow()
                    else:
                        bond_price = MBS_IN_BOND_STBD(
                            bond_cd=ticker.ticker_cd,
                            bond_nm=ticker.ticker_nm,
                            bond_type=ticker.bond_type,
                            maturity=ticker.maturity,
                            curr=ticker.curr,
                            close_price=current_price,
                            yield_rate=yield_rate,
                            change_rate=change_rate,
                            base_ymd=today,
                            ingest_batch_id=batch_id
                        )
                        self.session.add(bond_price)
                    results['bonds']['success'] += 1

                elif ticker.asset_type == 'commodity':
                    # MBS_IN_CMDTY_STBD에 저장
                    existing = self.session.query(MBS_IN_CMDTY_STBD).filter_by(
                        cmdty_cd=ticker.ticker_cd,
                        base_ymd=today
                    ).first()

                    if existing:
                        existing.close_price = current_price
                        existing.change_rate = change_rate
                        existing.updated_at = datetime.utcnow()
                    else:
                        cmdty_price = MBS_IN_CMDTY_STBD(
                            cmdty_cd=ticker.ticker_cd,
                            cmdty_nm=ticker.ticker_nm,
                            sector=ticker.sector,
                            exchange=ticker.exchange,
                            curr=ticker.curr,
                            close_price=current_price,
                            change_rate=change_rate,
                            base_ymd=today,
                            ingest_batch_id=batch_id
                        )
                        self.session.add(cmdty_price)
                    results['commodities']['success'] += 1

                log.debug(f"Synced price for {ticker.ticker_cd}: ${current_price}")

            except Exception as e:
                log.error(f"Failed to sync price for {ticker.ticker_cd}: {e}")
                if ticker.asset_type == 'stock':
                    results['stocks']['failed'] += 1
                elif ticker.asset_type == 'etf':
                    results['etfs']['failed'] += 1
                elif ticker.asset_type == 'bond':
                    results['bonds']['failed'] += 1
                elif ticker.asset_type == 'commodity':
                    results['commodities']['failed'] += 1
                continue

        # 커밋
        try:
            self.session.commit()
            results['total'] = (
                results['stocks']['success'] +
                results['etfs']['success'] +
                results['bonds']['success'] +
                results['commodities']['success']
            )

            log.info("\n" + "="*60)
            log.info("Price Sync Summary:")
            log.info(f"  Stocks:       {results['stocks']['success']:3d} success, {results['stocks']['failed']:3d} failed")
            log.info(f"  ETFs:         {results['etfs']['success']:3d} success, {results['etfs']['failed']:3d} failed")
            log.info(f"  Bonds:        {results['bonds']['success']:3d} success, {results['bonds']['failed']:3d} failed")
            log.info(f"  Commodities:  {results['commodities']['success']:3d} success, {results['commodities']['failed']:3d} failed")
            log.info(f"  Total synced: {results['total']:3d}")
            log.info(f"\n  Batch ID: {batch_id}")
            log.info("="*60)

        except Exception as e:
            log.error(f"Error committing price data: {e}")
            self.session.rollback()
            raise

        return results


# ===== 스케줄러에서 호출할 전역 함수 =====

def sync_market_data():
    """
    마켓 데이터 동기화 (스케줄러 작업)

    APScheduler에서 호출:
        scheduler.add_job(sync_market_data, 'interval', hours=6)
    """
    try:
        log.info("Scheduled task: sync_market_data started")

        from app.models.database import get_sqlite_db
        from app.core.config import settings

        # 데이터베이스 세션 생성
        db = get_sqlite_db(settings.SQLITE_PATH)
        session = db.get_session()

        # MarketDataSync 인스턴스 생성
        sync_service = MarketDataSync(session)

        # 티커 동기화 (enrichment 비활성화로 빠르게)
        log.info("Syncing ticker data...")
        results = sync_service.sync_all(enrich=False)

        session.close()

        log.info("Scheduled task: sync_market_data completed")
        log.info(f"   Tickers synced: {results.get('total_synced', 0)}")
        return results

    except Exception as e:
        log.error(f"Scheduled task: sync_market_data failed - {e}", exc_info=True)
        return {"error": str(e)}
