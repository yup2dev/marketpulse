"""
Equity Fundamental Routes  (/api/v1/equity/fundamental/...)

@router.command() 패턴을 사용하는 신규 스타일 라우터.
각 엔드포인트는 provider 파라미터로 데이터 소스를 선택할 수 있습니다.

등록된 엔드포인트:
    GET /income-statement   → model="IncomeStatement"  (fmp | yahoo)
    GET /analyst-estimates  → model="AnalystEstimates" (fmp)
    GET /quote              → model="Quote"            (fmp | yahoo | alphavantage)
    GET /company-profile    → model="CompanyProfile"   (fmp | yahoo)
"""
import logging
from typing import Optional

from data_fetcher.core import OBBject, Query, CommandRouter

log = logging.getLogger(__name__)

router = CommandRouter(
    prefix="/equity/fundamental",
    tags=["equity-fundamental"],
)


@router.command(model="IncomeStatement")
async def income_statement(
    symbol: str,
    provider: str = "fmp",
    period: str = "annual",
    limit: int = 5,
) -> OBBject:
    """
    손익계산서 조회

    - **symbol**: 종목 코드 (예: AAPL)
    - **provider**: fmp | yahoo
    - **period**: annual | quarterly
    - **limit**: 반환할 기간 수
    """
    return await OBBject.from_query(Query(**locals()))


@router.command(model="AnalystEstimates")
async def analyst_estimates(
    symbol: str,
    provider: str = "fmp",
    period: str = "annual",
    limit: int = 5,
) -> OBBject:
    """
    애널리스트 추정치 조회

    - **symbol**: 종목 코드
    - **provider**: fmp
    - **period**: annual | quarterly
    - **limit**: 반환할 기간 수
    """
    return await OBBject.from_query(Query(**locals()))


@router.command(model="AnalystRecommendations")
async def analyst_recommendations(
    symbol: str,
    provider: str = "fmp",
    limit: int = 10,
) -> OBBject:
    """
    애널리스트 투자의견 조회

    - **symbol**: 종목 코드
    - **provider**: fmp
    - **limit**: 반환할 항목 수
    """
    return await OBBject.from_query(Query(**locals()))


@router.command(model="Quote")
async def quote(
    symbol: str,
    provider: str = "fmp",
) -> OBBject:
    """
    실시간 시세 조회

    - **symbol**: 종목 코드
    - **provider**: fmp | alphavantage
    """
    return await OBBject.from_query(Query(**locals()))


@router.command(model="CompanyProfile")
async def company_profile(
    symbol: str,
    provider: str = "fmp",
) -> OBBject:
    """
    기업 프로필 조회

    - **symbol**: 종목 코드
    - **provider**: fmp | yahoo
    """
    return await OBBject.from_query(Query(**locals()))
