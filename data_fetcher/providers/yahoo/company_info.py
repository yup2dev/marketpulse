"""Yahoo Finance Company Info Model (회사 정보)"""
from typing import Optional
from pydantic import Field
from data_fetcher.abstract_provider.abstract import BaseQueryParams, BaseData


class YFinanceCompanyInfoQueryParams(BaseQueryParams):
    """회사 정보 조회 파라미터"""

    symbol: str = Field(
        description="종목 코드 (예: AAPL, MSFT)"
    )


class YFinanceCompanyInfoData(BaseData):
    """회사 정보 데이터"""

    # 기본 정보
    symbol: str = Field(description="종목 코드")
    company_name: Optional[str] = Field(default=None, description="회사명")
    sector: Optional[str] = Field(default=None, description="섹터")
    industry: Optional[str] = Field(default=None, description="산업")
    country: Optional[str] = Field(default=None, description="국가")
    website: Optional[str] = Field(default=None, description="웹사이트")
    description: Optional[str] = Field(default=None, description="회사 설명")

    # 시가총액 및 규모
    market_cap: Optional[int] = Field(default=None, description="시가총액 (USD)")
    enterprise_value: Optional[int] = Field(default=None, description="기업 가치")
    shares_outstanding: Optional[int] = Field(default=None, description="발행 주식 수")
    float_shares: Optional[int] = Field(default=None, description="유통 주식 수")

    # 재무 비율
    pe_ratio: Optional[float] = Field(default=None, description="PER (주가수익비율)")
    pb_ratio: Optional[float] = Field(default=None, description="PBR (주가순자산비율)")
    ps_ratio: Optional[float] = Field(default=None, description="PSR (주가매출비율)")
    peg_ratio: Optional[float] = Field(default=None, description="PEG 비율")

    # 수익성
    profit_margin: Optional[float] = Field(default=None, description="순이익률 (%)")
    operating_margin: Optional[float] = Field(default=None, description="영업이익률 (%)")
    roe: Optional[float] = Field(default=None, description="ROE (자기자본이익률)")
    roa: Optional[float] = Field(default=None, description="ROA (총자산이익률)")

    # 배당
    dividend_rate: Optional[float] = Field(default=None, description="연간 배당금")
    dividend_yield: Optional[float] = Field(default=None, description="배당 수익률 (%)")
    payout_ratio: Optional[float] = Field(default=None, description="배당 성향 (%)")

    # 가격 정보
    current_price: Optional[float] = Field(default=None, description="현재가")
    day_high: Optional[float] = Field(default=None, description="당일 고가")
    day_low: Optional[float] = Field(default=None, description="당일 저가")
    week_52_high: Optional[float] = Field(default=None, description="52주 최고가")
    week_52_low: Optional[float] = Field(default=None, description="52주 최저가")

    # 거래량
    volume: Optional[int] = Field(default=None, description="거래량")
    average_volume: Optional[int] = Field(default=None, description="평균 거래량")

    # 재무 건전성
    debt_to_equity: Optional[float] = Field(default=None, description="부채비율")
    current_ratio: Optional[float] = Field(default=None, description="유동비율")
    quick_ratio: Optional[float] = Field(default=None, description="당좌비율")

    # 성장성
    revenue_growth: Optional[float] = Field(default=None, description="매출 성장률 (%)")
    earnings_growth: Optional[float] = Field(default=None, description="이익 성장률 (%)")

    # 애널리스트 의견
    target_price: Optional[float] = Field(default=None, description="목표주가")
    recommendation: Optional[str] = Field(default=None, description="추천 의견")
    num_analysts: Optional[int] = Field(default=None, description="애널리스트 수")

    __alias_dict__ = {
        "company_name": "longName",
        "description": "longBusinessSummary",
        "market_cap": "marketCap",
        "enterprise_value": "enterpriseValue",
        "shares_outstanding": "sharesOutstanding",
        "float_shares": "floatShares",
        "pe_ratio": "trailingPE",
        "pb_ratio": "priceToBook",
        "ps_ratio": "priceToSalesTrailing12Months",
        "peg_ratio": "pegRatio",
        "profit_margin": "profitMargins",
        "operating_margin": "operatingMargins",
        "roe": "returnOnEquity",
        "roa": "returnOnAssets",
        "dividend_rate": "dividendRate",
        "dividend_yield": "dividendYield",
        "payout_ratio": "payoutRatio",
        "current_price": "currentPrice",
        "day_high": "dayHigh",
        "day_low": "dayLow",
        "week_52_high": "fiftyTwoWeekHigh",
        "week_52_low": "fiftyTwoWeekLow",
        "average_volume": "averageVolume",
        "debt_to_equity": "debtToEquity",
        "current_ratio": "currentRatio",
        "quick_ratio": "quickRatio",
        "revenue_growth": "revenueGrowth",
        "earnings_growth": "earningsGrowth",
        "target_price": "targetMeanPrice",
        "recommendation": "recommendationKey",
        "num_analysts": "numberOfAnalystOpinions",
    }


"""Yahoo Finance Company Info Fetcher"""
import logging
from typing import Any, Dict, List, Optional
import yfinance as yf

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher

log = logging.getLogger(__name__)


class YFinanceCompanyInfoFetcher(Fetcher[YFinanceCompanyInfoQueryParams, YFinanceCompanyInfoData]):
    """Yahoo Finance 회사 정보 Fetcher"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceCompanyInfoQueryParams:
        """쿼리 파라미터 변환"""
        return YFinanceCompanyInfoQueryParams(**params)

    @staticmethod
    def extract_data(
        query: YFinanceCompanyInfoQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """Yahoo Finance에서 회사 정보 추출"""
        try:
            ticker = yf.Ticker(query.symbol)
            return ticker.info
        except Exception as e:
            log.error(f"Error fetching company info for {query.symbol}: {e}")
            raise

    @staticmethod
    def transform_data(
        query: YFinanceCompanyInfoQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[YFinanceCompanyInfoData]:
        """원시 데이터를 표준 모델로 변환 (alias_dict로 매핑)"""
        payload = {**(data or {}), "symbol": query.symbol}
        company_info = YFinanceCompanyInfoData.model_validate(payload)
        log.info(f"Fetched company info for {query.symbol}")
        return [company_info]
