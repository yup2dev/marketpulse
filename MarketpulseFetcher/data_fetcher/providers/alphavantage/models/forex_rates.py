"""Alpha Vantage 주요 환율 — 주요 통화쌍 다섯의 최신 일봉 + 전일 대비 (forex fetcher 를 쌍마다 부른다)."""
import asyncio
import logging
from datetime import date as dateType
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams
from data_fetcher.providers.alphavantage.models.forex import AlphaVantageForexFetcher

log = logging.getLogger(__name__)

PAIRS = [
    ("EUR", "USD", "Euro to US Dollar"),
    ("USD", "JPY", "US Dollar to Japanese Yen"),
    ("GBP", "USD", "British Pound to US Dollar"),
    ("USD", "CNY", "US Dollar to Chinese Yuan"),
    ("AUD", "USD", "Australian Dollar to US Dollar"),
]


class ForexRatesQueryParams(BaseQueryParams):
    pass


class ForexRatesData(BaseData):
    pair: str = Field(description="통화쌍 (EUR/USD)")
    name: str = Field(description="이름")
    rate: Optional[float] = Field(default=None, description="최신 종가")
    date: Optional[dateType] = Field(default=None, description="기준일")
    change: Optional[float] = Field(default=None, description="전일 대비 (%)")
    high: Optional[float] = Field(default=None, description="고가")
    low: Optional[float] = Field(default=None, description="저가")


class AlphaVantageForexRatesFetcher(ApiFetcher[ForexRatesQueryParams, List[ForexRatesData]]):

    api_name = "AlphaVantage"
    api_key_env = "ALPHAVANTAGE_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> ForexRatesQueryParams:
        return ForexRatesQueryParams(**params)

    @staticmethod
    async def aextract_data(query: ForexRatesQueryParams, credentials: Optional[Dict[str, str]] = None,
                            **kwargs: Any) -> List[Dict[str, Any]]:
        async def one(base: str, quote: str, name: str) -> Optional[Dict[str, Any]]:
            rows = await AlphaVantageForexFetcher.fetch_data(
                {"from_currency": base, "to_currency": quote, "interval": "daily"}, credentials)
            if not rows:
                return None
            # forex fetcher 는 날짜 오름차순 — 마지막이 최신
            latest, prev = rows[-1], (rows[-2] if len(rows) > 1 else None)
            change = (latest.close - prev.close) / prev.close * 100 if prev and prev.close else None
            return {"pair": f"{base}/{quote}", "name": name, "rate": latest.close, "date": latest.date,
                    "change": change, "high": latest.high, "low": latest.low}

        found = await asyncio.gather(*[one(*p) for p in PAIRS], return_exceptions=True)
        errors = [e for e in found if isinstance(e, Exception)]
        rows = [r for r in found if isinstance(r, dict)]
        if errors and not rows:
            raise errors[0]          # 키 없음 · 한도 초과 등 — 전부 실패면 그대로 알린다
        for e in errors:
            log.warning("[forex_rates] %s", e)
        return rows

    @staticmethod
    def transform_data(query: ForexRatesQueryParams, data: List[Dict[str, Any]],
                       **kwargs: Any) -> List[ForexRatesData]:
        return [ForexRatesData.model_validate(r) for r in data]
