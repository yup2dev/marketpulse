"""FMP Company Profile — QueryParams + Data + Fetcher"""
import logging
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.abstract_provider.standard_models import CompanyProfileQueryParams, CompanyProfileData
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.async_http_client import amake_request

log = logging.getLogger(__name__)

FMP_STABLE_BASE = "https://financialmodelingprep.com/stable"


# ── QueryParams ───────────────────────────────────────────────────────────────

class FMPCompanyProfileQueryParams(CompanyProfileQueryParams):
    """FMP 회사 프로필 조회 파라미터 (CompanyProfileQueryParams 상속)"""
    pass


# ── Data ──────────────────────────────────────────────────────────────────────

class FMPCompanyProfileData(CompanyProfileData):
    """FMP 회사 프로필 데이터

    Standard fields covered:
        symbol, company_name, exchange, industry, sector, country, currency,
        market_cap, beta, price, description, ceo, full_time_employees,
        website, image, cik, isin, cusip, ipo_date,
        is_etf, is_actively_trading, is_adr, is_fund
    """
    volume_avg: Optional[int] = Field(default=None, description="평균 거래량")
    last_div: Optional[float] = Field(default=None, description="마지막 배당금")
    range: Optional[str] = Field(default=None, description="52주 가격 범위")
    changes: Optional[float] = Field(default=None, description="가격 변동")
    exchange_short_name: Optional[str] = Field(default=None, description="거래소 약칭")
    phone: Optional[str] = Field(default=None, description="전화번호")
    address: Optional[str] = Field(default=None, description="주소")
    city: Optional[str] = Field(default=None, description="도시")
    state: Optional[str] = Field(default=None, description="주/도")
    zip: Optional[str] = Field(default=None, description="우편번호")
    dcf_diff: Optional[float] = Field(default=None, description="DCF 차이")
    dcf: Optional[float] = Field(default=None, description="DCF 가치평가")

    __alias_dict__ = {
        "company_name": "companyName",
        "market_cap": "mktCap",
        "full_time_employees": "fullTimeEmployees",
        "ipo_date": "ipoDate",
        "is_etf": "isEtf",
        "is_actively_trading": "isActivelyTrading",
        "is_adr": "isAdr",
        "is_fund": "isFund",
        "volume_avg": "volAvg",
        "last_div": "lastDiv",
        "exchange_short_name": "exchangeShortName",
        "dcf_diff": "dcfDiff",
    }


# ── Fetcher ───────────────────────────────────────────────────────────────────

class FMPCompanyProfileFetcher(Fetcher[FMPCompanyProfileQueryParams, FMPCompanyProfileData]):
    """FMP 회사 프로필 Fetcher"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FMPCompanyProfileQueryParams:
        return FMPCompanyProfileQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: FMPCompanyProfileQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(credentials=credentials, api_name="FMP", env_var="FMP_API_KEY")
        data = await amake_request(
            f"{FMP_STABLE_BASE}/profile",
            params={"symbol": query.symbol, "apikey": api_key},
            timeout=30,
        )
        if not isinstance(data, list):
            log.warning(f"Unexpected response format for {query.symbol}")
            return []
        return data

    @staticmethod
    def transform_data(
        query: FMPCompanyProfileQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[FMPCompanyProfileData]:
        return [FMPCompanyProfileData.model_validate(d) for d in data]
