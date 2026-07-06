"""FMP Stock Quote — QueryParams + Data + Fetcher"""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models import EquityQuoteQueryParams, EquityQuoteData
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.async_http_client import amake_request

log = logging.getLogger(__name__)

FMP_STABLE_BASE = "https://financialmodelingprep.com/stable"


# ── QueryParams ───────────────────────────────────────────────────────────────

class QuoteQueryParams(EquityQuoteQueryParams):
    """FMP 주식 시세 조회 파라미터 (EquityQuoteQueryParams 상속)"""
    pass


# ── Data ──────────────────────────────────────────────────────────────────────

class QuoteData(EquityQuoteData):
    """FMP 주식 시세 데이터

    FMP raw API 응답:
        price → last_price
        changesPercentage → change_percent
        yearHigh → week_52_high
        yearLow → week_52_low
        avgVolume → average_volume
        dayLow → low
        dayHigh → high
    """
    price_avg_50: Optional[float] = Field(default=None, description="50일 이동평균")
    price_avg_200: Optional[float] = Field(default=None, description="200일 이동평균")
    eps: Optional[float] = Field(default=None, description="주당순이익 (EPS)")
    pe: Optional[float] = Field(default=None, description="주가수익비율 (P/E)")
    earnings_announcement: Optional[datetime] = Field(default=None, description="실적 발표 예정일")
    shares_outstanding: Optional[int] = Field(default=None, description="발행주식수")
    timestamp: Optional[int] = Field(default=None, description="타임스탬프")

    __alias_dict__ = {
        "last_price": "price",
        "change_percent": "changesPercentage",
        "week_52_high": "yearHigh",
        "week_52_low": "yearLow",
        "average_volume": "avgVolume",
        "low": "dayLow",
        "high": "dayHigh",
        "previous_close": "previousClose",
        "market_cap": "marketCap",
        "price_avg_50": "priceAvg50",
        "price_avg_200": "priceAvg200",
        "earnings_announcement": "earningsAnnouncement",
        "shares_outstanding": "sharesOutstanding",
    }


# ── Fetcher ───────────────────────────────────────────────────────────────────

class FMPQuoteFetcher(ApiFetcher[QuoteQueryParams, QuoteData]):
    """FMP 주식 시세 Fetcher"""

    api_name = "FMP"
    api_key_env = "FMP_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> QuoteQueryParams:
        return QuoteQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: QuoteQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(credentials=credentials, api_name="FMP", env_var="FMP_API_KEY")
        url = f"{FMP_STABLE_BASE}/quote"
        params = {"symbol": query.symbol, "apikey": api_key}
        data = await amake_request(url, params=params)
        if not isinstance(data, list):
            log.warning(f"Unexpected response format for {query.symbol}")
            return []
        return data

    @staticmethod
    def transform_data(
        query: QuoteQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[QuoteData]:
        return [QuoteData.model_validate(d) for d in data]
