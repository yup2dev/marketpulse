"""Quantitative Analysis Service — thin wrappers over QueryExecutor."""
from typing import Any, Dict, Optional

from data_fetcher.fetchers.base import AnnotatedResult
from data_fetcher.models.quantitative.analysis import (
    CAPMData,
    NormalityData,
    RollingData,
    SummaryData,
    UnitRootData,
)
from data_fetcher.query_executor import QueryExecutor


def _first(raw):
    result = raw.result if isinstance(raw, AnnotatedResult) else raw
    return result[0] if result else None


async def get_summary(params: Dict[str, Any]) -> Optional[SummaryData]:
    raw = await QueryExecutor.fetch("quantitative", "summary", params)
    return _first(raw)


async def get_normality(params: Dict[str, Any]) -> Optional[NormalityData]:
    raw = await QueryExecutor.fetch("quantitative", "normality", params)
    return _first(raw)


async def get_capm(params: Dict[str, Any]) -> Optional[CAPMData]:
    raw = await QueryExecutor.fetch("quantitative", "capm", params)
    return _first(raw)


async def get_rolling(params: Dict[str, Any]) -> Optional[RollingData]:
    raw = await QueryExecutor.fetch("quantitative", "rolling", params)
    return _first(raw)


async def get_unitroot(params: Dict[str, Any]) -> Optional[UnitRootData]:
    raw = await QueryExecutor.fetch("quantitative", "unitroot", params)
    return _first(raw)
