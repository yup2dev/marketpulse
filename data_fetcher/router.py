"""
Data Router

OpenBB 스타일 통합 데이터 조회 라우터
카테고리별로 적합한 Fetcher를 자동 선택하여 데이터 조회
"""
import logging
from typing import Any, Dict, List, Optional
from enum import Enum

from data_fetcher.fetchers.yahoo.short_interest import YahooShortInterestFetcher
from data_fetcher.models.short_interest import ShortInterestQueryParams, ShortInterestData

log = logging.getLogger(__name__)


class DataCategory(str, Enum):
    """데이터 카테고리"""
    SHORT_INTEREST = "short_interest"
    FINANCIAL_RATIOS = "financial_ratios"
    INCOME_STATEMENT = "income_statement"
    BALANCE_SHEET = "balance_sheet"
    CASH_FLOW = "cash_flow"
    EQUITY_QUOTE = "equity_quote"
    GDP = "gdp"
    CPI = "cpi"
    UNEMPLOYMENT = "unemployment"


class DataRouter:
    """
    통합 데이터 라우터

    카테고리별로 적합한 Fetcher를 선택하고 데이터를 조회합니다.
    OpenBB Platform의 Router 패턴을 따릅니다.
    """

    def __init__(self):
        """DataRouter 초기화"""
        self.fetcher_map = {
            DataCategory.SHORT_INTEREST: YahooShortInterestFetcher,
            # 추가 Fetcher는 여기에 등록
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
