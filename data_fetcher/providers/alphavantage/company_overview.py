"""Alpha Vantage Company Overview — QueryParams + Data + Fetcher"""
import logging
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.company_profile import (
    CompanyProfileQueryParams,
    CompanyProfileData,
)
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.async_http_client import amake_request
from data_fetcher.providers.alphavantage.utils.helpers import (
    ALPHA_VANTAGE_BASE_URL, check_av_errors,
)

log = logging.getLogger(__name__)


# ── QueryParams ───────────────────────────────────────────────────────────────

class CompanyOverviewQueryParams(CompanyProfileQueryParams):
    """기업 개요 조회 파라미터 (standard CompanyProfile 경유)"""
    symbol: str = Field(description="종목 코드 (예: AAPL, MSFT)")


# ── Data ──────────────────────────────────────────────────────────────────────

class CompanyOverviewData(CompanyProfileData):
    """기업 개요 데이터 (standard CompanyProfile 경유, AlphaVantage 전용 지표 추가)

    symbol/company_name/description/exchange/currency/country/sector/industry/market_cap
    는 standard CompanyProfile 에서 상속한다.
    """

    ebitda: Optional[int] = Field(default=None, description="EBITDA")
    pe_ratio: Optional[float] = Field(default=None, description="PER")
    peg_ratio: Optional[float] = Field(default=None, description="PEG")
    book_value: Optional[float] = Field(default=None, description="주당 장부가치")
    dividend_per_share: Optional[float] = Field(default=None, description="주당 배당금")
    dividend_yield: Optional[float] = Field(default=None, description="배당 수익률")
    eps: Optional[float] = Field(default=None, description="주당 순이익 (EPS)")
    revenue_per_share: Optional[float] = Field(default=None, description="주당 매출")
    profit_margin: Optional[float] = Field(default=None, description="순이익률")
    operating_margin: Optional[float] = Field(default=None, description="영업이익률")
    roe: Optional[float] = Field(default=None, description="자기자본이익률 (ROE)")
    roa: Optional[float] = Field(default=None, description="총자산이익률 (ROA)")
    revenue_growth_yoy: Optional[float] = Field(default=None, description="연간 매출 성장률")
    earnings_growth_yoy: Optional[float] = Field(default=None, description="연간 이익 성장률")
    revenue_growth_quarterly: Optional[float] = Field(default=None, description="분기 매출 성장률")
    earnings_growth_quarterly: Optional[float] = Field(default=None, description="분기 이익 성장률")
    week_52_high: Optional[float] = Field(default=None, description="52주 최고가")
    week_52_low: Optional[float] = Field(default=None, description="52주 최저가")
    day_50_ma: Optional[float] = Field(default=None, description="50일 이동평균")
    day_200_ma: Optional[float] = Field(default=None, description="200일 이동평균")
    shares_outstanding: Optional[int] = Field(default=None, description="발행 주식 수")
    dividend_date: Optional[str] = Field(default=None, description="배당 지급일")
    ex_dividend_date: Optional[str] = Field(default=None, description="배당락일")
    analyst_target_price: Optional[float] = Field(default=None, description="애널리스트 목표가")

    __alias_dict__ = {
        "symbol": "Symbol",
        "company_name": "Name",
        "description": "Description",
        "exchange": "Exchange",
        "currency": "Currency",
        "country": "Country",
        "sector": "Sector",
        "industry": "Industry",
        "market_cap": "MarketCapitalization",
        "ebitda": "EBITDA",
        "pe_ratio": "PERatio",
        "peg_ratio": "PEGRatio",
        "book_value": "BookValue",
        "dividend_per_share": "DividendPerShare",
        "dividend_yield": "DividendYield",
        "eps": "EPS",
        "revenue_per_share": "RevenuePerShareTTM",
        "profit_margin": "ProfitMargin",
        "operating_margin": "OperatingMarginTTM",
        "roe": "ReturnOnEquityTTM",
        "roa": "ReturnOnAssetsTTM",
        "revenue_growth_yoy": "QuarterlyRevenueGrowthYOY",
        "earnings_growth_yoy": "QuarterlyEarningsGrowthYOY",
        "revenue_growth_quarterly": "QuarterlyRevenueGrowthYOY",
        "earnings_growth_quarterly": "QuarterlyEarningsGrowthYOY",
        "week_52_high": "52WeekHigh",
        "week_52_low": "52WeekLow",
        "day_50_ma": "50DayMovingAverage",
        "day_200_ma": "200DayMovingAverage",
        "shares_outstanding": "SharesOutstanding",
        "dividend_date": "DividendDate",
        "ex_dividend_date": "ExDividendDate",
        "analyst_target_price": "AnalystTargetPrice",
    }


# ── Fetcher ───────────────────────────────────────────────────────────────────

class AlphaVantageCompanyOverviewFetcher(
    ApiFetcher[CompanyOverviewQueryParams, CompanyOverviewData]
):
    """AlphaVantage 기업 개요 Fetcher"""

    api_name = "AlphaVantage"
    api_key_env = "ALPHAVANTAGE_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> CompanyOverviewQueryParams:
        return CompanyOverviewQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: CompanyOverviewQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        api_key = get_api_key(
            credentials=credentials,
            api_name="AlphaVantage",
            env_var="ALPHAVANTAGE_API_KEY"
        )
        data = await amake_request(
            ALPHA_VANTAGE_BASE_URL,
            params={'function': 'OVERVIEW', 'symbol': query.symbol.upper(), 'apikey': api_key},
            timeout=30,
        )
        check_av_errors(data)
        return data

    @staticmethod
    def transform_data(
        query: CompanyOverviewQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[CompanyOverviewData]:
        return [CompanyOverviewData.model_validate(data)]
