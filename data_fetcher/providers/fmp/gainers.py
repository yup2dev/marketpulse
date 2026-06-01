"""FMP Gainers / Losers / Most Actives — QueryParams + Data + Fetchers"""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.abstract_provider.standard_models import MarketMoversQueryParams, MarketMoverData
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.async_http_client import amake_request

log = logging.getLogger(__name__)

FMP_STABLE_BASE = "https://financialmodelingprep.com/stable"


# ── QueryParams ───────────────────────────────────────────────────────────────

class FMPMoversQueryParams(MarketMoversQueryParams):
    """FMP 시장 무버 공용 쿼리 파라미터 (MarketMoversQueryParams 상속)."""
    pass


# ── Data ──────────────────────────────────────────────────────────────────────

class FMPActiveStockData(MarketMoverData):
    """FMP 시장 무버 응답 데이터 (most-actives/gainers/losers 공용 스키마).

    Standard fields covered:
        symbol, name, price, change, change_percent, volume, market_cap, exchange

    FMP raw API field mapping:
        changesPercentage → change_percent
    """
    __alias_dict__ = {
        "change_percent": "changesPercentage",
    }


# ── Fetcher ───────────────────────────────────────────────────────────────────

class FMPGainersFetcher(Fetcher[FMPMoversQueryParams, FMPActiveStockData]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FMPMoversQueryParams:
        return FMPMoversQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: FMPMoversQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(credentials=credentials, api_name="FMP", env_var="FMP_API_KEY")
        data = await amake_request(f"{FMP_STABLE_BASE}/biggest-gainers", params={"apikey": api_key})
        return data if isinstance(data, list) else []

    @staticmethod
    def transform_data(
        query: FMPMoversQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[FMPActiveStockData]:
        return [FMPActiveStockData.model_validate(item) for item in data]


class FMPLosersFetcher(Fetcher[FMPMoversQueryParams, FMPActiveStockData]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FMPMoversQueryParams:
        return FMPMoversQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: FMPMoversQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(credentials=credentials, api_name="FMP", env_var="FMP_API_KEY")
        data = await amake_request(f"{FMP_STABLE_BASE}/biggest-losers", params={"apikey": api_key})
        return data if isinstance(data, list) else []

    @staticmethod
    def transform_data(
        query: FMPMoversQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[FMPActiveStockData]:
        return [FMPActiveStockData.model_validate(item) for item in data]


class FMPMostActivesFetcher(Fetcher[FMPMoversQueryParams, FMPActiveStockData]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FMPMoversQueryParams:
        return FMPMoversQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: FMPMoversQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(credentials=credentials, api_name="FMP", env_var="FMP_API_KEY")
        data = await amake_request(f"{FMP_STABLE_BASE}/most-actives", params={"apikey": api_key})
        return data if isinstance(data, list) else []

    @staticmethod
    def transform_data(
        query: FMPMoversQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[FMPActiveStockData]:
        return [FMPActiveStockData.model_validate(item) for item in data]
