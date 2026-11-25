"""Yahoo 종목 비교 — 종목 2~4개의 시세(quote) + 주요 지표(key_metrics)를 한 행씩.

종목 하나가 실패하면 그 행만 error 를 단다 (다른 종목은 그대로).
"""
import asyncio
from typing import Any, Dict, List, Optional

from pydantic import Field, field_validator

from data_fetcher.abstract_provider.abstract.base_fetchers import YFinanceFetcher
from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams
from data_fetcher.providers.yahoo.models.key_metrics import YFinanceKeyMetricsFetcher
from data_fetcher.providers.yahoo.models.stock_quote import YFinanceQuoteFetcher


class CompareQueryParams(BaseQueryParams):
    symbols: str = Field(description="종목 코드 2~4개 (쉼표)")

    @field_validator("symbols", mode="before")
    @classmethod
    def _check(cls, v):
        codes = [s.strip().upper() for s in str(v).split(",") if s.strip()]
        if not 2 <= len(codes) <= 4:
            raise ValueError("종목은 2~4개")
        return ",".join(codes)


class CompareData(BaseData):
    symbol: str
    name: Optional[str] = None
    price: Optional[float] = None
    change: Optional[float] = None
    change_percent: Optional[float] = None
    market_cap: Optional[float] = None
    volume: Optional[float] = None
    pe_ratio: Optional[float] = None
    eps: Optional[float] = None
    beta: Optional[float] = None
    dividend_yield: Optional[float] = None
    roe: Optional[float] = None
    roa: Optional[float] = None
    debt_to_equity: Optional[float] = None
    profit_margin: Optional[float] = None
    revenue_growth: Optional[float] = None
    week_52_high: Optional[float] = None
    week_52_low: Optional[float] = None
    error: Optional[str] = Field(default=None, description="이 종목을 못 불렀을 때")


def _first(rows) -> Dict[str, Any]:
    rows = list(rows or [])
    return rows[0].model_dump() if rows and hasattr(rows[0], "model_dump") else (rows[0] if rows else {})


class YFinanceCompareFetcher(YFinanceFetcher[CompareQueryParams, List[CompareData]]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> CompareQueryParams:
        return CompareQueryParams(**params)

    @staticmethod
    async def aextract_data(query: CompareQueryParams, credentials: Optional[Dict[str, str]] = None,
                            **kwargs: Any) -> List[Dict[str, Any]]:
        async def one(sym: str) -> Dict[str, Any]:
            try:
                q = _first(await YFinanceQuoteFetcher.fetch_data({"symbol": sym}, credentials))
                m = _first(await YFinanceKeyMetricsFetcher.fetch_data({"symbol": sym}, credentials))
            except Exception:  # noqa: BLE001 — 한 종목 실패는 그 행만
                return {"symbol": sym, "error": "Failed to fetch data"}
            return {
                "symbol": sym, "name": m.get("symbol", sym), "price": q.get("price"), "change": q.get("change"),
                "change_percent": q.get("change_percent"), "market_cap": m.get("market_cap"),
                "volume": q.get("volume"), "pe_ratio": m.get("pe_ratio"), "eps": m.get("eps_trailing"),
                "beta": m.get("beta"), "dividend_yield": m.get("dividend_yield"), "roe": m.get("roe"),
                "roa": m.get("roa"), "debt_to_equity": m.get("debt_to_equity"),
                "profit_margin": m.get("net_margin"), "revenue_growth": m.get("revenue_growth"),
                "week_52_high": m.get("week_52_high"), "week_52_low": m.get("week_52_low"),
            }

        return list(await asyncio.gather(*[one(s) for s in query.symbols.split(",")]))

    @staticmethod
    def transform_data(query: CompareQueryParams, data: List[Dict[str, Any]], **kwargs: Any) -> List[CompareData]:
        return [CompareData.model_validate(r) for r in data]
