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

log = logging.getLogger(__name__)


class MarketDataSync:
    """외부 API를 통한 시장 데이터 동기화"""

    def __init__(self, db_session: Session):
        self.session = db_session
        self.sync_results = {
            'success': 0,
            'errors': 0,
            'skipped': 0
        }

    def sync_sp500_from_wikipedia(self) -> List[Dict]:
        """
        Wikipedia에서 S&P 500 편입 종목 실시간 가져오기
        Returns: List of ticker dicts
        """
        log.info("Fetching S&P 500 constituents from Wikipedia...")

        try:
            url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }

            tables = pd.read_html(url, storage_options=headers)
            sp500_table = tables[0]

            log.info(f"Found {len(sp500_table)} S&P 500 companies from Wikipedia")

            tickers = []
            for _, row in sp500_table.iterrows():
                ticker_info = {
                    'symbol': row['Symbol'].replace('.', '-'),
                    'name': row['Security'],
                    'sector': row['GICS Sector'],
                    'industry': row['GICS Sub-Industry'],
                    'exchange': 'NYSE' if 'NYSE' in str(row.get('Exchange', 'NYSE')) else 'NASDAQ',
                    'asset_type': 'stock',
                    'country': 'USA',
                    'currency': 'USD',
                    'data_source': 'wikipedia'
                }
                tickers.append(ticker_info)

            return tickers

        except Exception as e:
            log.error(f"Error fetching S&P 500 from Wikipedia: {e}")
            return []

    def sync_commodity_futures_from_config(self) -> List[Dict]:
        """
        주요 원자재 선물 심볼 목록 (표준화된 심볼)
        향후 외부 API로 확장 가능
        """
        return [
            # Energy
            {'symbol': 'CL=F', 'name': 'Crude Oil WTI Futures', 'exchange': 'NYMEX', 'sector': 'Energy', 'industry': 'Crude Oil', 'asset_type': 'commodity', 'currency': 'USD'},
            {'symbol': 'BZ=F', 'name': 'Brent Crude Oil Futures', 'exchange': 'ICE', 'sector': 'Energy', 'industry': 'Crude Oil', 'asset_type': 'commodity', 'currency': 'USD'},
            {'symbol': 'NG=F', 'name': 'Natural Gas Futures', 'exchange': 'NYMEX', 'sector': 'Energy', 'industry': 'Natural Gas', 'asset_type': 'commodity', 'currency': 'USD'},
            {'symbol': 'HO=F', 'name': 'Heating Oil Futures', 'exchange': 'NYMEX', 'sector': 'Energy', 'industry': 'Heating Oil', 'asset_type': 'commodity', 'currency': 'USD'},
            {'symbol': 'RB=F', 'name': 'RBOB Gasoline Futures', 'exchange': 'NYMEX', 'sector': 'Energy', 'industry': 'Gasoline', 'asset_type': 'commodity', 'currency': 'USD'},

            # Precious Metals
            {'symbol': 'GC=F', 'name': 'Gold Futures', 'exchange': 'COMEX', 'sector': 'Metals', 'industry': 'Precious Metals', 'asset_type': 'commodity', 'currency': 'USD'},
            {'symbol': 'SI=F', 'name': 'Silver Futures', 'exchange': 'COMEX', 'sector': 'Metals', 'industry': 'Precious Metals', 'asset_type': 'commodity', 'currency': 'USD'},
            {'symbol': 'PL=F', 'name': 'Platinum Futures', 'exchange': 'NYMEX', 'sector': 'Metals', 'industry': 'Precious Metals', 'asset_type': 'commodity', 'currency': 'USD'},
            {'symbol': 'PA=F', 'name': 'Palladium Futures', 'exchange': 'NYMEX', 'sector': 'Metals', 'industry': 'Precious Metals', 'asset_type': 'commodity', 'currency': 'USD'},

            # Industrial Metals
            {'symbol': 'HG=F', 'name': 'Copper Futures', 'exchange': 'COMEX', 'sector': 'Metals', 'industry': 'Industrial Metals', 'asset_type': 'commodity', 'currency': 'USD'},

            # Agricultural
            {'symbol': 'ZC=F', 'name': 'Corn Futures', 'exchange': 'CBOT', 'sector': 'Agriculture', 'industry': 'Grains', 'asset_type': 'commodity', 'currency': 'USD'},
            {'symbol': 'ZW=F', 'name': 'Wheat Futures', 'exchange': 'CBOT', 'sector': 'Agriculture', 'industry': 'Grains', 'asset_type': 'commodity', 'currency': 'USD'},
            {'symbol': 'ZS=F', 'name': 'Soybean Futures', 'exchange': 'CBOT', 'sector': 'Agriculture', 'industry': 'Grains', 'asset_type': 'commodity', 'currency': 'USD'},
            {'symbol': 'KC=F', 'name': 'Coffee Futures', 'exchange': 'ICE', 'sector': 'Agriculture', 'industry': 'Softs', 'asset_type': 'commodity', 'currency': 'USD'},
            {'symbol': 'SB=F', 'name': 'Sugar Futures', 'exchange': 'ICE', 'sector': 'Agriculture', 'industry': 'Softs', 'asset_type': 'commodity', 'currency': 'USD'},
            {'symbol': 'CT=F', 'name': 'Cotton Futures', 'exchange': 'ICE', 'sector': 'Agriculture', 'industry': 'Softs', 'asset_type': 'commodity', 'currency': 'USD'},
            {'symbol': 'CC=F', 'name': 'Cocoa Futures', 'exchange': 'ICE', 'sector': 'Agriculture', 'industry': 'Softs', 'asset_type': 'commodity', 'currency': 'USD'},

            # Livestock
            {'symbol': 'LE=F', 'name': 'Live Cattle Futures', 'exchange': 'CME', 'sector': 'Agriculture', 'industry': 'Livestock', 'asset_type': 'commodity', 'currency': 'USD'},
            {'symbol': 'HE=F', 'name': 'Lean Hogs Futures', 'exchange': 'CME', 'sector': 'Agriculture', 'industry': 'Livestock', 'asset_type': 'commodity', 'currency': 'USD'},

            # Index Futures
            {'symbol': 'ES=F', 'name': 'E-mini S&P 500 Futures', 'exchange': 'CME', 'sector': 'Index', 'industry': 'Equity Index', 'asset_type': 'index', 'currency': 'USD'},
            {'symbol': 'NQ=F', 'name': 'E-mini NASDAQ-100 Futures', 'exchange': 'CME', 'sector': 'Index', 'industry': 'Equity Index', 'asset_type': 'index', 'currency': 'USD'},
            {'symbol': 'YM=F', 'name': 'E-mini Dow Futures', 'exchange': 'CBOT', 'sector': 'Index', 'industry': 'Equity Index', 'asset_type': 'index', 'currency': 'USD'},
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
                log.warning(f"No yfinance data for {symbol}")
                return None

        except Exception as e:
            log.error(f"Error enriching {symbol}: {e}")
            return None

    def sync_tickers_to_db(self, tickers: List[Dict], asset_type: str = 'stock',
                           batch_id: Optional[str] = None, enrich: bool = True) -> int:
        """
        티커 목록을 DB에 동기화
        - 주식(stock): MBS_IN_STK_STBD에 저장
        - ETF(etf): MBS_IN_ETF_STBD에 저장
        - 기타: Ticker 테이블에 저장 (레거시)

        Args:
            tickers: 티커 정보 리스트
            asset_type: 자산 유형 ('stock', 'etf', 'commodity', 'index')
            batch_id: 입수 배치 ID
            enrich: yfinance로 정보 보강 여부

        Returns:
            저장된 티커 수
        """
        from app.models.database import Ticker, MBS_IN_STK_STBD, MBS_IN_ETF_STBD
        from datetime import date

        saved_count = 0
        today = date.today()

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

                # ===== MBS 테이블에 저장 (새로운 방식) =====
                if asset_type == 'stock':
                    # MBS_IN_STK_STBD에 저장
                    existing = self.session.query(MBS_IN_STK_STBD).filter_by(
                        stk_cd=symbol,
                        base_ymd=today
                    ).first()

                    if existing:
                        # 업데이트
                        existing.stk_nm = ticker_info.get('name', symbol)
                        existing.sector = ticker_info.get('sector', 'Unknown')
                        existing.curr = ticker_info.get('currency', 'USD')
                        existing.updated_at = datetime.utcnow()
                        log.debug(f"Updated stock: {symbol}")
                    else:
                        # 신규 추가
                        stock_record = MBS_IN_STK_STBD(
                            stk_cd=symbol,
                            stk_nm=ticker_info.get('name', symbol),
                            sector=ticker_info.get('sector', 'Unknown'),
                            curr=ticker_info.get('currency', 'USD'),
                            close_price=None,  # 가격은 별도로 동기화
                            change_rate=None,
                            base_ymd=today,
                            ingest_batch_id=batch_id
                        )
                        self.session.add(stock_record)
                        log.debug(f"Added stock: {symbol}")

                    saved_count += 1
                    self.sync_results['success'] += 1

                elif asset_type == 'etf':
                    # MBS_IN_ETF_STBD에 저장
                    existing = self.session.query(MBS_IN_ETF_STBD).filter_by(
                        etf_cd=symbol,
                        base_ymd=today
                    ).first()

                    if existing:
                        # 업데이트
                        existing.etf_nm = ticker_info.get('name', symbol)
                        existing.sector = ticker_info.get('sector', 'ETF')
                        existing.curr = ticker_info.get('currency', 'USD')
                        existing.updated_at = datetime.utcnow()
                        log.debug(f"Updated ETF: {symbol}")
                    else:
                        # 신규 추가
                        etf_record = MBS_IN_ETF_STBD(
                            etf_cd=symbol,
                            etf_nm=ticker_info.get('name', symbol),
                            sector=ticker_info.get('sector', 'ETF'),
                            curr=ticker_info.get('currency', 'USD'),
                            close_price=None,  # 가격은 별도로 동기화
                            change_rate=None,
                            base_ymd=today,
                            ingest_batch_id=batch_id
                        )
                        self.session.add(etf_record)
                        log.debug(f"Added ETF: {symbol}")

                    saved_count += 1
                    self.sync_results['success'] += 1

                else:
                    # 기타 자산 유형: 레거시 Ticker 테이블에 저장
                    existing = self.session.query(Ticker).filter_by(symbol=symbol).first()

                    if existing:
                        # 업데이트
                        for key, value in ticker_info.items():
                            if hasattr(existing, key):
                                setattr(existing, key, value)
                        existing.updated_at = datetime.utcnow()
                        log.debug(f"Updated ticker (legacy): {symbol}")
                    else:
                        # 신규 추가
                        new_ticker = Ticker(**ticker_info)
                        self.session.add(new_ticker)
                        log.debug(f"Added ticker (legacy): {symbol}")

                    saved_count += 1
                    self.sync_results['success'] += 1

            except Exception as e:
                log.error(f"Error saving {symbol}: {e}")
                self.sync_results['errors'] += 1
                continue

        # 커밋
        try:
            self.session.commit()
            log.info(f"Saved {saved_count} {asset_type} records to database")
        except Exception as e:
            log.error(f"Error committing to database: {e}")
            self.session.rollback()
            raise

        return saved_count

    def sync_all(self, enrich: bool = True) -> Dict:
        """
        모든 마켓 데이터 동기화
        - S&P 500 주식 → MBS_IN_STK_STBD
        - Commodity → Ticker (레거시)
        - ETF → MBS_IN_ETF_STBD

        Args:
            enrich: yfinance로 정보 보강 여부

        Returns:
            동기화 결과 딕셔너리
        """
        from app.models.database import generate_batch_id

        log.info("="*60)
        log.info("Starting market data synchronization...")
        log.info("="*60)

        batch_id = generate_batch_id()
        log.info(f"Batch ID: {batch_id}")

        results = {
            'sp500': 0,
            'commodities': 0,
            'etfs': 0,
            'total': 0
        }

        # 1. S&P 500 주식 동기화 → MBS_IN_STK_STBD
        log.info("\n[1/3] Syncing S&P 500 stocks to MBS_IN_STK_STBD...")
        sp500_tickers = self.sync_sp500_from_wikipedia()
        if sp500_tickers:
            count = self.sync_tickers_to_db(
                sp500_tickers,
                asset_type='stock',
                batch_id=batch_id,
                enrich=enrich
            )
            results['sp500'] = count
            log.info(f"Synced {count} S&P 500 stocks → MBS_IN_STK_STBD")

        # 2. Commodity Futures 동기화 → Ticker (레거시)
        log.info("\n[2/3] Syncing commodity futures to Ticker (legacy)...")
        commodity_tickers = self.sync_commodity_futures_from_config()
        if commodity_tickers:
            count = self.sync_tickers_to_db(
                commodity_tickers,
                asset_type='commodity',  # 레거시 Ticker로 저장
                batch_id=batch_id,
                enrich=enrich
            )
            results['commodities'] = count
            log.info(f"Synced {count} commodity futures → Ticker")

        # 3. ETF 동기화 → MBS_IN_ETF_STBD
        log.info("\n[3/3] Syncing ETFs to MBS_IN_ETF_STBD...")
        etf_tickers = self.sync_etfs_from_config()
        if etf_tickers:
            count = self.sync_tickers_to_db(
                etf_tickers,
                asset_type='etf',
                batch_id=batch_id,
                enrich=enrich
            )
            results['etfs'] = count
            log.info(f"Synced {count} ETFs → MBS_IN_ETF_STBD")

        results['total'] = results['sp500'] + results['commodities'] + results['etfs']

        log.info("\n" + "="*60)
        log.info("Synchronization Summary:")
        log.info(f"  S&P 500 stocks (MBS_IN_STK_STBD):  {results['sp500']:4d}")
        log.info(f"  Commodity futures (Ticker):        {results['commodities']:4d}")
        log.info(f"  ETFs (MBS_IN_ETF_STBD):            {results['etfs']:4d}")
        log.info(f"  Total synced:                      {results['total']:4d}")
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

    def remove_ticker(self, symbol: str) -> bool:
        """
        티커 비활성화 (삭제하지 않고 is_active = False)

        Args:
            symbol: 티커 심볼

        Returns:
            성공 여부
        """
        from app.models.database import Ticker

        try:
            ticker = self.session.query(Ticker).filter_by(symbol=symbol).first()
            if ticker:
                ticker.is_active = False
                ticker.updated_at = datetime.utcnow()
                self.session.commit()
                log.info(f"Deactivated ticker: {symbol}")
                return True
            else:
                log.warning(f"Ticker not found: {symbol}")
                return False
        except Exception as e:
            log.error(f"Error deactivating {symbol}: {e}")
            self.session.rollback()
            return False

    def get_outdated_tickers(self, days: int = 7) -> List[str]:
        """
        오래된 티커 목록 조회 (재동기화 필요)

        Args:
            days: 마지막 업데이트 후 경과 일수

        Returns:
            티커 심볼 리스트
        """
        from app.models.database import Ticker

        cutoff_date = datetime.utcnow() - timedelta(days=days)

        outdated = self.session.query(Ticker).filter(
            Ticker.is_active == True,
            Ticker.updated_at < cutoff_date
        ).all()

        return [t.symbol for t in outdated]

    # =============================================================================
    # Price Data Synchronization Methods
    # =============================================================================

    def sync_price_history(
        self,
        symbol: str,
        period: str = '1y',
        interval: str = '1d'
    ) -> int:
        """
        단일 티커의 가격 이력 동기화 (base_ymd 기준)

        Args:
            symbol: 티커 심볼
            period: 기간 ('1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'max')
            interval: 간격 ('1m', '5m', '15m', '30m', '60m', '1d')

        Returns:
            저장된 가격 레코드 수
        """
        from app.models.database import TickerPrice, Ticker

        log.info(f"Fetching price history for {symbol} (period={period})...")

        try:
            # 티커 존재 여부 확인
            ticker = self.session.query(Ticker).filter_by(symbol=symbol).first()
            if not ticker:
                log.warning(f"Ticker not found: {symbol}")
                return 0

            # yfinance에서 가격 데이터 다운로드
            ticker_obj = yf.Ticker(symbol)
            df = ticker_obj.history(period=period, interval=interval)

            if df.empty:
                log.warning(f"No price data available for {symbol}")
                return 0

            log.debug(f"Downloaded {len(df)} rows for {symbol}")

            # DataFrame 처리
            df = df.reset_index()
            df.columns = df.columns.str.lower()

            saved_count = 0

            for _, row in df.iterrows():
                try:
                    # base_ymd 설정 (Date 타입)
                    if 'date' in row.index:
                        base_ymd = row['date'].date() if hasattr(row['date'], 'date') else row['date']
                    else:
                        # index가 datetime인 경우
                        base_ymd = row.name.date() if hasattr(row.name, 'date') else row.name

                    # 중복 확인
                    existing = self.session.query(TickerPrice).filter_by(
                        symbol=symbol,
                        base_ymd=base_ymd
                    ).first()

                    if existing:
                        # 업데이트
                        existing.open = float(row.get('open', 0)) if pd.notna(row.get('open')) else None
                        existing.high = float(row.get('high', 0)) if pd.notna(row.get('high')) else None
                        existing.low = float(row.get('low', 0)) if pd.notna(row.get('low')) else None
                        existing.close = float(row.get('close', 0)) if pd.notna(row.get('close')) else None
                        existing.volume = float(row.get('volume', 0)) if pd.notna(row.get('volume')) else None
                        existing.data_source = 'yfinance'
                        existing.updated_at = datetime.utcnow()

                        log.debug(f"Updated {symbol} {base_ymd}")
                    else:
                        # 신규 추가
                        price_record = TickerPrice(
                            symbol=symbol,
                            base_ymd=base_ymd,
                            open=float(row.get('open', 0)) if pd.notna(row.get('open')) else None,
                            high=float(row.get('high', 0)) if pd.notna(row.get('high')) else None,
                            low=float(row.get('low', 0)) if pd.notna(row.get('low')) else None,
                            close=float(row.get('close', 0)) if pd.notna(row.get('close')) else None,
                            volume=float(row.get('volume', 0)) if pd.notna(row.get('volume')) else None,
                            data_source='yfinance'
                        )
                        self.session.add(price_record)
                        log.debug(f"Added {symbol} {base_ymd}")

                    saved_count += 1

                except Exception as e:
                    log.error(f"Error processing {symbol} {base_ymd}: {e}")
                    continue

            # prev_close 계산 및 변동률 계산
            self._calculate_price_changes(symbol)

            # 커밋
            self.session.commit()
            log.info(f"Saved {saved_count} price records for {symbol}")

            return saved_count

        except Exception as e:
            log.error(f"Error syncing price history for {symbol}: {e}")
            self.session.rollback()
            return 0

    def _calculate_price_changes(self, symbol: str):
        """
        특정 심볼의 변동률 계산 및 전일 종가 설정

        Args:
            symbol: 티커 심볼
        """
        from app.models.database import TickerPrice

        try:
            # base_ymd 기준으로 정렬된 데이터 조회
            prices = self.session.query(TickerPrice).filter_by(
                symbol=symbol
            ).order_by(TickerPrice.base_ymd).all()

            for i, price in enumerate(prices):
                if i == 0:
                    # 첫 번째 레코드는 전일 종가 없음
                    price.prev_close = None
                    price.change = None
                    price.change_pct = None
                else:
                    # 전일 종가 설정
                    prev_price = prices[i - 1]
                    price.prev_close = prev_price.close

                    # 변동률 계산
                    if price.close is not None and price.prev_close is not None and price.prev_close != 0:
                        price.change = price.close - price.prev_close
                        price.change_pct = (price.change / price.prev_close) * 100

                price.updated_at = datetime.utcnow()

            self.session.commit()
            log.debug(f"Calculated price changes for {symbol} ({len(prices)} records)")

        except Exception as e:
            log.error(f"Error calculating price changes for {symbol}: {e}")
            self.session.rollback()

    def sync_all_price_history(
        self,
        symbols: Optional[List[str]] = None,
        period: str = '1y',
        interval: str = '1d'
    ) -> Dict:
        """
        여러 티커의 가격 이력 일괄 동기화

        Args:
            symbols: 동기화할 심볼 리스트 (None이면 모든 활성 티커)
            period: 기간
            interval: 간격

        Returns:
            동기화 결과 딕셔너리
        """
        from app.models.database import Ticker

        log.info("="*60)
        log.info("Starting price history synchronization...")
        log.info("="*60)

        # symbols이 없으면 모든 활성 티커 조회
        if symbols is None:
            tickers = self.session.query(Ticker).filter_by(is_active=True).all()
            symbols = [t.symbol for t in tickers]
            log.info(f"Found {len(symbols)} active tickers")

        results = {
            'total': len(symbols),
            'success': 0,
            'failed': 0,
            'details': {}
        }

        for i, symbol in enumerate(symbols, 1):
            log.info(f"\n[{i}/{len(symbols)}] Syncing {symbol}...")
            try:
                count = self.sync_price_history(symbol, period=period, interval=interval)
                results['success'] += 1
                results['details'][symbol] = {'status': 'success', 'records': count}
            except Exception as e:
                log.error(f"Failed to sync {symbol}: {e}")
                results['failed'] += 1
                results['details'][symbol] = {'status': 'error', 'error': str(e)}

        log.info("\n" + "="*60)
        log.info("Price History Synchronization Summary:")
        log.info(f"  Total tickers:  {results['total']}")
        log.info(f"  Success:        {results['success']}")
        log.info(f"  Failed:         {results['failed']}")
        log.info("="*60)

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
