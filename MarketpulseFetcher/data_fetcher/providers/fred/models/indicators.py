"""FRED 거시 지표 묶음 — 개요(최신값 · 직전 대비) · 지표 하나의 이력 · 추가 시리즈 목록.

    indicator_overview        주요 지표 6개의 최신값 + 직전 관측 대비 변화율(%)
    indicator_history         주요 지표 하나의 시계열 (indicator=gdp | unemployment | …)
    macro_series_overview     추가 시리즈(통화량 · 신용 · 금리 · 무역 · 부동산 · 원자재)의 최신값 + 변화율
    macro_series_history      추가 시리즈 하나의 시계열 (series=money_supply_m2 | …)

주요 지표는 지표별 fred fetcher(gdp · cpi …)를, 추가 시리즈는 generic series 를 부른다.
"""
import asyncio
from datetime import date as dateType
from typing import Any, Dict, List, Literal, Optional

from pydantic import ConfigDict, Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams
from data_fetcher.providers.fred.models.consumer_sentiment import FREDConsumerSentimentFetcher
from data_fetcher.providers.fred.models.cpi import FREDCPIFetcher
from data_fetcher.providers.fred.models.gdp import FREDGDPFetcher
from data_fetcher.providers.fred.models.generic_series import FREDGenericSeriesFetcher
from data_fetcher.providers.fred.models.interest_rate import FREDInterestRateFetcher
from data_fetcher.providers.fred.models.retail_sales import FREDRetailSalesFetcher
from data_fetcher.providers.fred.models.unemployment import FREDUnemploymentFetcher

# 주요 지표 — (fetcher, 이름, 단위, 고정 파라미터, 최신이 마지막인지)
INDICATORS: Dict[str, tuple] = {
    "gdp": (FREDGDPFetcher, "Gross Domestic Product", "Billions of Chained 2012 Dollars", {}, True),
    "unemployment": (FREDUnemploymentFetcher, "Unemployment Rate", "Percent", {}, True),
    "cpi": (FREDCPIFetcher, "Consumer Price Index", "Index", {}, True),
    "fed_funds_rate": (FREDInterestRateFetcher, "Federal Funds Effective Rate", "Percent",
                       {"rate_type": "federal_funds"}, False),
    "retail_sales": (FREDRetailSalesFetcher, "Advance Retail Sales", "Millions of Dollars", {}, True),
    "consumer_sentiment": (FREDConsumerSentimentFetcher, "University of Michigan Consumer Sentiment", "Index",
                           {}, True),
}
IndicatorKey = Literal["gdp", "unemployment", "cpi", "fed_funds_rate", "retail_sales", "consumer_sentiment"]

# 추가 시리즈 — 키 → (FRED id, 이름, 분류, 단위)
MACRO_SERIES: Dict[str, tuple] = {
    "bank_loans": ("TOTLL", "Total Loans and Leases at Commercial Banks", "Banking", "Billions of Dollars"),
    "consumer_credit": ("TOTALSL", "Consumer Credit Outstanding", "Credit", "Billions of Dollars"),
    "money_supply_m1": ("M1SL", "M1 Money Supply", "Money Supply", "Billions of Dollars"),
    "money_supply_m2": ("M2SL", "M2 Money Supply", "Money Supply", "Billions of Dollars"),
    "treasury_10y": ("DGS10", "10-Year Treasury Constant Maturity Rate", "Interest Rates", "Percent"),
    "treasury_2y": ("DGS2", "2-Year Treasury Constant Maturity Rate", "Interest Rates", "Percent"),
    "trade_balance": ("BOPGSTB", "Trade Balance: Goods and Services", "Trade", "Millions of Dollars"),
    "case_shiller": ("CSUSHPISA", "S&P/Case-Shiller U.S. National Home Price Index", "Real Estate",
                     "Index Jan 2000=100"),
    "crude_oil_wti": ("DCOILWTICO", "Crude Oil Prices: West Texas Intermediate (WTI)", "Commodities",
                      "USD per Barrel"),
    "natural_gas": ("DHHNGSP", "Henry Hub Natural Gas Spot Price", "Commodities", "USD per Million Btu"),
    "copper": ("PCOPPUSDM", "Global Price of Copper", "Commodities", "USD per Metric Ton"),
}
MacroSeriesKey = Literal[
    "bank_loans", "consumer_credit", "money_supply_m1", "money_supply_m2", "treasury_10y", "treasury_2y",
    "trade_balance", "case_shiller", "crude_oil_wti", "natural_gas", "copper",
]


def pct_change(cur: Optional[float], prev: Optional[float]) -> Optional[float]:
    if cur is None or prev is None or prev == 0:
        return None
    return (cur - prev) / prev * 100


class DatedValue(BaseData):
    date: dateType = Field(description="관측일")
    value: Optional[float] = Field(default=None, description="값")


class _Empty(BaseQueryParams):
    pass


# ── 주요 지표 개요 ────────────────────────────────────────────────────────────

class IndicatorOverviewData(BaseData):
    """지표 fetcher 의 최신 행 칸을 그대로 두고 indicator · unit · change 를 붙인다."""

    model_config = ConfigDict(extra="allow")
    indicator: str = Field(description="지표 키")
    unit: str = Field(description="단위")
    change: Optional[float] = Field(default=None, description="직전 관측 대비 (%)")


class FREDIndicatorOverviewFetcher(ApiFetcher[_Empty, List[IndicatorOverviewData]]):
    """주요 지표 6개 — 최신값과 직전 관측 대비 변화율."""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> _Empty:
        return _Empty(**params)

    @staticmethod
    async def aextract_data(query: _Empty, credentials: Optional[Dict[str, str]] = None,
                            **kwargs: Any) -> List[Dict[str, Any]]:
        async def one(key: str, spec: tuple) -> Optional[Dict[str, Any]]:
            fetcher, _name, unit, params, latest_last = spec
            rows = [r.model_dump(mode="json") for r in await fetcher.fetch_data(dict(params), credentials)]
            if not rows:
                return None
            latest = rows[-1] if latest_last else rows[0]
            prev = (rows[-2] if len(rows) > 1 else None) if latest_last else (rows[1] if len(rows) > 1 else None)
            change = pct_change(latest.get("value"), prev.get("value")) if prev else None
            return {"indicator": key, **latest, "unit": unit, "change": change}

        found = await asyncio.gather(*[one(k, s) for k, s in INDICATORS.items()], return_exceptions=True)
        return [r for r in found if isinstance(r, dict)]

    @staticmethod
    def transform_data(query: _Empty, data: List[Dict[str, Any]], **kwargs: Any) -> List[IndicatorOverviewData]:
        return [IndicatorOverviewData.model_validate(r) for r in data]


# ── 주요 지표 이력 ────────────────────────────────────────────────────────────

class IndicatorHistoryQueryParams(BaseQueryParams):
    indicator: IndicatorKey = Field(description="지표")
    start_date: Optional[dateType] = Field(default=None, description="시작일")
    end_date: Optional[dateType] = Field(default=None, description="종료일")


class FREDIndicatorHistoryFetcher(ApiFetcher[IndicatorHistoryQueryParams, List[DatedValue]]):
    """주요 지표 하나의 시계열 — 값은 소수 둘째 자리까지."""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> IndicatorHistoryQueryParams:
        return IndicatorHistoryQueryParams(**params)

    @staticmethod
    async def aextract_data(query: IndicatorHistoryQueryParams, credentials: Optional[Dict[str, str]] = None,
                            **kwargs: Any) -> List[Dict[str, Any]]:
        fetcher, _name, _unit, params, _ = INDICATORS[query.indicator]
        params = {**params, "start_date": query.start_date, "end_date": query.end_date}
        return [r.model_dump() for r in await fetcher.fetch_data(params, credentials)]

    @staticmethod
    def transform_data(query: IndicatorHistoryQueryParams, data: List[Dict[str, Any]],
                       **kwargs: Any) -> List[DatedValue]:
        return [DatedValue(date=r["date"], value=round(r["value"], 2))
                for r in data if r.get("date") and r.get("value") is not None]


# ── 추가 시리즈 개요 ──────────────────────────────────────────────────────────

class MacroSeriesOverviewQueryParams(BaseQueryParams):
    as_of: Optional[dateType] = Field(default=None, description="이 날짜 이전 마지막 관측 (기본: 최신)")


class MacroSeriesOverviewData(BaseData):
    key: str = Field(description="시리즈 키")
    name: str = Field(description="이름")
    category: str = Field(description="분류")
    value: Optional[float] = Field(default=None, description="최신값")
    unit: str = Field(description="단위")
    date: Optional[dateType] = Field(default=None, description="관측일")
    change: Optional[float] = Field(default=None, description="직전 관측 대비 (%)")


class FREDMacroSeriesOverviewFetcher(ApiFetcher[MacroSeriesOverviewQueryParams, List[MacroSeriesOverviewData]]):
    """추가 시리즈 전부의 최신값 — 시리즈마다 최근 관측 두 개 (한 번에 여러 시리즈)."""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> MacroSeriesOverviewQueryParams:
        return MacroSeriesOverviewQueryParams(**params)

    @staticmethod
    async def aextract_data(query: MacroSeriesOverviewQueryParams, credentials: Optional[Dict[str, str]] = None,
                            **kwargs: Any) -> List[Dict[str, Any]]:
        params = {"series_id": ",".join(s[0] for s in MACRO_SERIES.values()), "limit": 2, "sort_order": "desc"}
        if query.as_of:
            params["end_date"] = query.as_of
        return [r.model_dump() for r in await FREDGenericSeriesFetcher.fetch_data(params, credentials)]

    @staticmethod
    def transform_data(query: MacroSeriesOverviewQueryParams, data: List[Dict[str, Any]],
                       **kwargs: Any) -> List[MacroSeriesOverviewData]:
        by_id: Dict[str, List[Dict[str, Any]]] = {}
        for r in data:
            by_id.setdefault(r.get("series_id"), []).append(r)
        out = []
        for key, (sid, name, category, unit) in MACRO_SERIES.items():
            obs = sorted(by_id.get(sid, []), key=lambda r: r["date"], reverse=True)
            if not obs:
                continue
            latest, prev = obs[0], (obs[1] if len(obs) > 1 else None)
            out.append(MacroSeriesOverviewData(
                key=key, name=name, category=category, unit=unit, value=latest.get("value"),
                date=latest["date"], change=pct_change(latest.get("value"), prev.get("value") if prev else None),
            ))
        return out


# ── 추가 시리즈 이력 ──────────────────────────────────────────────────────────

class MacroSeriesHistoryQueryParams(BaseQueryParams):
    series: MacroSeriesKey = Field(description="시리즈 키")
    start_date: Optional[dateType] = Field(default=None, description="시작일")
    end_date: Optional[dateType] = Field(default=None, description="종료일")


class FREDMacroSeriesHistoryFetcher(ApiFetcher[MacroSeriesHistoryQueryParams, List[DatedValue]]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> MacroSeriesHistoryQueryParams:
        return MacroSeriesHistoryQueryParams(**params)

    @staticmethod
    async def aextract_data(query: MacroSeriesHistoryQueryParams, credentials: Optional[Dict[str, str]] = None,
                            **kwargs: Any) -> List[Dict[str, Any]]:
        params = {"series_id": MACRO_SERIES[query.series][0], "sort_order": "asc",
                  "start_date": query.start_date, "end_date": query.end_date}
        return [r.model_dump() for r in await FREDGenericSeriesFetcher.fetch_data(
            {k: v for k, v in params.items() if v is not None}, credentials)]

    @staticmethod
    def transform_data(query: MacroSeriesHistoryQueryParams, data: List[Dict[str, Any]],
                       **kwargs: Any) -> List[DatedValue]:
        return [DatedValue(date=r["date"], value=r.get("value")) for r in data if r.get("date")]
