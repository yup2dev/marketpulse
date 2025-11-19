"""SEC EDGAR Form 4 Insider Trading Fetcher"""
import logging
import requests
from datetime import datetime
from typing import Any, Dict, List, Optional
import time

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.sec.insider_trading import (
    SECInsiderTradingQueryParams,
    SECInsiderTradingData
)

log = logging.getLogger(__name__)


class SECInsiderTradingFetcher(
    Fetcher[SECInsiderTradingQueryParams, SECInsiderTradingData]
):
    """SEC EDGAR Form 4 Insider Trading Fetcher"""

    BASE_URL = "https://data.sec.gov"

    # Common ticker to CIK mappings (can be expanded)
    TICKER_TO_CIK = {
        "AAPL": "0000320193",
        "MSFT": "0000789019",
        "GOOGL": "0001652044",
        "GOOG": "0001652044",
        "AMZN": "0001018724",
        "TSLA": "0001318605",
        "META": "0001326801",
        "NVDA": "0001045810",
        "BRK.B": "0001067983",
        "BRK.A": "0001067983",
    }

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> SECInsiderTradingQueryParams:
        """쿼리 파라미터 변환"""
        return SECInsiderTradingQueryParams(**params)

    @staticmethod
    def _get_cik(ticker: str, cik: Optional[str] = None) -> Optional[str]:
        """Ticker symbol에서 CIK 번호 조회"""
        if cik:
            # CIK가 10자리가 되도록 앞에 0 채우기
            return cik.zfill(10)

        # 미리 정의된 매핑에서 조회
        ticker_upper = ticker.upper()
        if ticker_upper in SECInsiderTradingFetcher.TICKER_TO_CIK:
            return SECInsiderTradingFetcher.TICKER_TO_CIK[ticker_upper]

        log.warning(f"CIK not found for ticker {ticker}. Please provide CIK manually.")
        return None

    @staticmethod
    def extract_data(
        query: SECInsiderTradingQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        SEC EDGAR에서 Form 4 insider trading 데이터 추출

        Args:
            query: 쿼리 파라미터
            credentials: 사용 안함 (SEC는 무료)
            **kwargs: 추가 파라미터

        Returns:
            원시 데이터 딕셔너리
        """
        try:
            # CIK 조회
            cik = SECInsiderTradingFetcher._get_cik(query.ticker, query.cik)
            if not cik:
                raise ValueError(f"Cannot find CIK for ticker {query.ticker}. Please provide CIK manually.")

            # SEC requires User-Agent header
            headers = {
                "User-Agent": "MarketPulse App contact@example.com",
                "Accept-Encoding": "gzip, deflate",
                "Host": "data.sec.gov"
            }

            # Company submissions 조회
            url = f"{SECInsiderTradingFetcher.BASE_URL}/submissions/CIK{cik}.json"

            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()

            data = response.json()

            # Rate limiting (SEC recommends max 10 requests per second)
            time.sleep(0.1)

            return {
                "submissions": data,
                "cik": cik,
                "ticker": query.ticker
            }

        except requests.exceptions.RequestException as e:
            log.error(f"Error fetching SEC data for {query.ticker}: {e}")
            raise
        except Exception as e:
            log.error(f"Unexpected error: {e}")
            raise

    @staticmethod
    def transform_data(
        query: SECInsiderTradingQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[SECInsiderTradingData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            SECInsiderTradingData 리스트
        """
        submissions = data["submissions"]
        ticker = data["ticker"]
        cik = data["cik"]

        # Recent filings 추출
        recent_filings = submissions.get("filings", {}).get("recent", {})

        if not recent_filings:
            log.info(f"No recent filings for {ticker}")
            return []

        # Form 4 filings만 필터링
        form_types = recent_filings.get("form", [])
        filing_dates = recent_filings.get("filingDate", [])
        accession_numbers = recent_filings.get("accessionNumber", [])

        result = []
        count = 0

        # 날짜 필터링 준비
        start_date = None
        end_date = None
        if query.start_date:
            start_date = datetime.strptime(query.start_date, '%Y-%m-%d').date()
        if query.end_date:
            end_date = datetime.strptime(query.end_date, '%Y-%m-%d').date()

        for i, form_type in enumerate(form_types):
            # Form 4만 처리
            if form_type != "4":
                continue

            try:
                filing_date = datetime.strptime(filing_dates[i], '%Y-%m-%d').date()

                # 날짜 필터링
                if start_date and filing_date < start_date:
                    continue
                if end_date and filing_date > end_date:
                    continue

                accession_number = accession_numbers[i]

                # SEC filing URL 생성
                accession_clean = accession_number.replace("-", "")
                filing_url = f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=4&dateb=&owner=include&count=100"

                insider_data = SECInsiderTradingData(
                    ticker=ticker,
                    filing_date=filing_date,
                    transaction_date=filing_date,  # 실제로는 XML 파싱 필요
                    accession_number=accession_number,
                    form_type=form_type,
                    insider_name=None,  # XML 파싱 필요
                    insider_title=None,  # XML 파싱 필요
                    transaction_type=None,  # XML 파싱 필요
                    shares=None,  # XML 파싱 필요
                    price_per_share=None,  # XML 파싱 필요
                    transaction_value=None,  # XML 파싱 필요
                    shares_owned_after=None,  # XML 파싱 필요
                    filing_url=filing_url
                )

                result.append(insider_data)
                count += 1

                # Limit 적용
                if query.limit and count >= query.limit:
                    break

            except (ValueError, KeyError, IndexError) as e:
                log.warning(f"Error parsing filing data: {e}")
                continue

        log.info(f"Fetched {len(result)} Form 4 filings for {ticker}")
        return result
