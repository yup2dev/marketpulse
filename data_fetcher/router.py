"""
Data Router

OpenBB 스타일 통합 데이터 조회 라우터
카테고리별로 적합한 Fetcher를 자동 선택하여 데이터 조회
"""
import logging
from typing import Any, Dict, List, Optional
from enum import Enum

from data_fetcher.fetchers.yahoo.short_interest import YahooShortInterestFetcher
from data_fetcher.fetchers.fred.gdp import FREDGDPFetcher
from data_fetcher.fetchers.fred.cpi import FREDCPIFetcher
from data_fetcher.fetchers.fred.unemployment import FREDUnemploymentFetcher
from data_fetcher.fetchers.fred.interest_rate import FREDInterestRateFetcher
from data_fetcher.fetchers.fred.employment import FREDEmploymentFetcher
from data_fetcher.fetchers.fred.industrial_production import FREDIndustrialProductionFetcher
from data_fetcher.fetchers.fred.consumer_sentiment import FREDConsumerSentimentFetcher
from data_fetcher.fetchers.fred.housing_starts import FREDHousingStartsFetcher
from data_fetcher.fetchers.fred.retail_sales import FREDRetailSalesFetcher
from data_fetcher.fetchers.fred.nonfarm_payroll import FREDNonfarmPayrollFetcher
from data_fetcher.fetchers.alphavantage.quote import AlphaVantageQuoteFetcher
from data_fetcher.fetchers.alphavantage.timeseries import AlphaVantageTimeseriesFetcher
from data_fetcher.models.short_interest import ShortInterestQueryParams, ShortInterestData
from data_fetcher.models.gdp import GDPQueryParams, GDPData
from data_fetcher.models.cpi import CPIQueryParams, CPIData
from data_fetcher.models.unemployment import UnemploymentQueryParams, UnemploymentData
from data_fetcher.models.interest_rate import InterestRateQueryParams, InterestRateData
from data_fetcher.models.employment import EmploymentQueryParams, EmploymentData
from data_fetcher.models.industrial_production import IndustrialProductionQueryParams, IndustrialProductionData
from data_fetcher.models.consumer_sentiment import ConsumerSentimentQueryParams, ConsumerSentimentData
from data_fetcher.models.housing_starts import HousingStartsQueryParams, HousingStartsData
from data_fetcher.models.retail_sales import RetailSalesQueryParams, RetailSalesData
from data_fetcher.models.nonfarm_payroll import NonfarmPayrollQueryParams, NonfarmPayrollData
from data_fetcher.models.equity_quote import EquityQuoteQueryParams, EquityQuoteData

log = logging.getLogger(__name__)


class DataCategory(str, Enum):
    """데이터 카테고리"""
    # Yahoo Finance
    SHORT_INTEREST = "short_interest"

    # Alpha Vantage
    EQUITY_QUOTE = "equity_quote"
    EQUITY_QUOTE_TIMESERIES = "equity_quote_timeseries"

    # FRED (경제 지표)
    GDP = "gdp"
    CPI = "cpi"
    UNEMPLOYMENT = "unemployment"
    INTEREST_RATE = "interest_rate"
    EMPLOYMENT = "employment"
    INDUSTRIAL_PRODUCTION = "industrial_production"
    CONSUMER_SENTIMENT = "consumer_sentiment"
    HOUSING_STARTS = "housing_starts"
    RETAIL_SALES = "retail_sales"
    NONFARM_PAYROLL = "nonfarm_payroll"


class DataRouter:
    """
    통합 데이터 라우터

    카테고리별로 적합한 Fetcher를 선택하고 데이터를 조회합니다.
    OpenBB Platform의 Router 패턴을 따릅니다.
    """

    def __init__(self):
        """DataRouter 초기화"""
        self.fetcher_map = {
            # Yahoo Finance
            DataCategory.SHORT_INTEREST: YahooShortInterestFetcher,

            # Alpha Vantage
            DataCategory.EQUITY_QUOTE: AlphaVantageQuoteFetcher,
            DataCategory.EQUITY_QUOTE_TIMESERIES: AlphaVantageTimeseriesFetcher,

            # FRED - 경제 지표
            DataCategory.GDP: FREDGDPFetcher,
            DataCategory.CPI: FREDCPIFetcher,
            DataCategory.UNEMPLOYMENT: FREDUnemploymentFetcher,
            DataCategory.INTEREST_RATE: FREDInterestRateFetcher,
            DataCategory.EMPLOYMENT: FREDEmploymentFetcher,
            DataCategory.INDUSTRIAL_PRODUCTION: FREDIndustrialProductionFetcher,
            DataCategory.CONSUMER_SENTIMENT: FREDConsumerSentimentFetcher,
            DataCategory.HOUSING_STARTS: FREDHousingStartsFetcher,
            DataCategory.RETAIL_SALES: FREDRetailSalesFetcher,
            DataCategory.NONFARM_PAYROLL: FREDNonfarmPayrollFetcher,
        }

    def fetch(
        self,
        category: DataCategory,
        params: Dict[str, Any],
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Any]:
        """
        데이터 조회

        Args:
            category: 데이터 카테고리
            params: 쿼리 파라미터
            credentials: API 자격증명
            **kwargs: 추가 파라미터

        Returns:
            표준 모델 데이터 리스트

        Raises:
            ValueError: 지원하지 않는 카테고리인 경우
        """
        if category not in self.fetcher_map:
            raise ValueError(f"Unsupported data category: {category}")

        fetcher_class = self.fetcher_map[category]

        try:
            data = fetcher_class.fetch_data(params, credentials, **kwargs)
            log.info(f"Successfully fetched {len(data)} records for category: {category}")
            return data

        except Exception as e:
            log.error(f"Error fetching data for category {category}: {e}")
            raise

    def get_short_interest(
        self,
        symbol: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 10
    ) -> List[ShortInterestData]:
        """
        공매도 데이터 조회 (편의 메서드)

        Args:
            symbol: 종목 코드
            start_date: 시작일
            end_date: 종료일
            limit: 조회 개수

        Returns:
            ShortInterestData 리스트
        """
        params = {
            'symbol': symbol,
            'start_date': 2,
            'end_date': end_date,
            'limit': limit
        }

        return self.fetch(DataCategory.SHORT_INTEREST, params)


# Singleton instance
_router_instance = None


def get_data_router() -> DataRouter:
    """
    DataRouter 싱글톤 인스턴스 반환

    Returns:
        DataRouter 인스턴스
    """
    global _router_instance

    if _router_instance is None:
        _router_instance = DataRouter()

    return _router_instance


# 사용 예시
if __name__ == "__main__":
    router = DataRouter()

    print("=== Data Router Test ===\n")

    # 1. 공매도 데이터 조회
    print("1. TSLA Short Interest:")
    short_data = router.get_short_interest('TSLA')

    if short_data:
        data = short_data[0]
        print(f"   Symbol: {data.symbol}")
        print(f"   Company: {data.company_name}")
        print(f"   Shares Short: {data.shares_short:,} shares")
        print(f"   Short % of Float: {data.short_percent_of_float * 100:.2f}%")
        print(f"   Short Ratio: {data.short_ratio:.2f} days")
        print(f"   Month over Month Change: {data.month_over_month_change_percent:+.2f}%")
