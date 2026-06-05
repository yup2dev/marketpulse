"""Polygon.io Earnings Model"""
from datetime import date as date_type, datetime
from typing import Optional
from pydantic import Field
from data_fetcher.abstract_provider.standard_models import EarningsQueryParams as _StdEarningsQueryParams
from data_fetcher.abstract_provider.standard_models import EarningsData


class EarningsQueryParams(_StdEarningsQueryParams):
    """실적 발표 조회 파라미터"""

    ticker: str = Field(
        description="종목 티커 (예: AAPL, TSLA)"
    )
    fiscal_year: Optional[int] = Field(
        default=None,
        description="회계연도"
    )
    fiscal_quarter: Optional[int] = Field(
        default=None,
        description="회계분기 (1-4)"
    )
    limit: Optional[int] = Field(
        default=100,
        description="최대 결과 수"
    )


class PolygonEarningsData(EarningsData):
    """Polygon 실적 — 표준 EarningsData 상속, Polygon 전용 필드 추가"""
    shares_outstanding: Optional[float] = Field(default=None, description="발행주식 수")
    weighted_average_shares: Optional[float] = Field(default=None, description="가중평균 발행주식 수")


"""Polygon.io Earnings Fetcher"""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.async_http_client import amake_request, HTTPClientError

log = logging.getLogger(__name__)


class PolygonEarningsFetcher(
    Fetcher[EarningsQueryParams, EarningsData]
):
    """Polygon.io 실적 발표 데이터 Fetcher"""

    BASE_URL = "https://api.polygon.io"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> EarningsQueryParams:
        """쿼리 파라미터 변환"""
        return EarningsQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: EarningsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Polygon.io에서 실적 발표 데이터 추출

        Args:
            query: 쿼리 파라미터
            credentials: API 키 딕셔너리
            **kwargs: 추가 파라미터

        Returns:
            원시 데이터 딕셔너리
        """
        try:
            # API 키 조회
            api_key = get_api_key(
                credentials=credentials,
                api_name="Polygon.io",
                env_var="POLYGON_API_KEY"
            )

            # API 엔드포인트
            url = f"{PolygonEarningsFetcher.BASE_URL}/vX/reference/financials"

            # 파라미터 설정
            params = {
                "apiKey": api_key,
                "ticker": query.ticker,
                "limit": query.limit or 100
            }

            if query.fiscal_year:
                params["fiscal_year"] = query.fiscal_year
            if query.fiscal_quarter:
                params["fiscal_period"] = f"Q{query.fiscal_quarter}"

            # API 호출
            data = await amake_request(url, params=params, timeout=30)

            if data.get("status") != "OK":
                log.warning(f"Polygon API returned status: {data.get('status')}")

            return data

        except HTTPClientError as e:
            log.error(f"Error fetching earnings from Polygon for {query.ticker}: {e}")
            raise
        except Exception as e:
            log.error(f"Unexpected error: {e}")
            raise

    @staticmethod
    def transform_data(
        query: EarningsQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[EarningsData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            EarningsData 리스트
        """
        results = data.get("results", [])

        if not results:
            log.info(f"No earnings data for {query.ticker}")
            return []

        earnings_list = []

        for item in results:
            try:
                # 재무 데이터 추출
                financials = item.get("financials", {})
                income_statement = financials.get("income_statement", {})
                balance_sheet = financials.get("balance_sheet", {})

                # 날짜 파싱
                report_date = None
                period_end_date = None

                if item.get("filing_date"):
                    report_date = datetime.strptime(
                        item["filing_date"], "%Y-%m-%d"
                    ).date()

                if item.get("end_date"):
                    period_end_date = datetime.strptime(
                        item["end_date"], "%Y-%m-%d"
                    ).date()

                # EPS 계산
                eps_actual = income_statement.get("basic_earnings_per_share", {}).get("value")
                net_income = income_statement.get("net_income_loss", {}).get("value")
                revenue_actual = income_statement.get("revenues", {}).get("value")
                operating_income = income_statement.get("operating_income_loss", {}).get("value")
                gross_profit = income_statement.get("gross_profit", {}).get("value")

                # 발행주식 수
                shares_outstanding = balance_sheet.get("equity", {}).get("value")

                # 회계분기 파싱
                fiscal_period = item.get("fiscal_period", "")
                fiscal_quarter = None
                if fiscal_period.startswith("Q"):
                    try:
                        fiscal_quarter = int(fiscal_period[1])
                    except (ValueError, IndexError):
                        pass

                # 회계연도 파싱 (빈 문자열 처리)
                fiscal_year_raw = item.get("fiscal_year")
                fiscal_year = None
                if fiscal_year_raw not in (None, '', 0):
                    try:
                        fiscal_year = int(fiscal_year_raw)
                    except (ValueError, TypeError):
                        fiscal_year = None

                earnings_data = EarningsData(
                    ticker=query.ticker,
                    fiscal_period=fiscal_period,
                    fiscal_year=fiscal_year,
                    fiscal_quarter=fiscal_quarter,
                    report_date=report_date,
                    period_end_date=period_end_date,
                    eps_actual=eps_actual,
                    eps_estimated=None,  # Polygon에서 제공하지 않음
                    eps_surprise=None,
                    eps_surprise_percent=None,
                    revenue_actual=revenue_actual,
                    revenue_estimated=None,
                    revenue_surprise=None,
                    revenue_surprise_percent=None,
                    net_income=net_income,
                    operating_income=operating_income,
                    gross_profit=gross_profit,
                    ebitda=None,
                    revenue_growth_yoy=None,
                    earnings_growth_yoy=None,
                    shares_outstanding=shares_outstanding,
                    weighted_average_shares=None,
                    conference_call_datetime=None
                )

                earnings_list.append(earnings_data)

            except (KeyError, ValueError) as e:
                log.warning(f"Error parsing earnings data: {e}")
                continue

        log.info(f"Fetched {len(earnings_list)} earnings records for {query.ticker}")
        return earnings_list
