"""FRED 거시경제 지표 서비스."""
from typing import Any, Dict, List

from data_fetcher.query_executor import QueryExecutor
from data_fetcher.fetchers.base import AnnotatedResult
from data_fetcher.utils.helpers import parse_period_to_dates


def _unwrap(raw):
    return raw.result if isinstance(raw, AnnotatedResult) else raw


def _first(raw):
    result = _unwrap(raw)
    return result[0] if result else None


_INDICATOR_MAP: Dict[str, tuple] = {
    'GDP':                   ('gdp',                  {}),
    'UNEMPLOYMENT':          ('unemployment',          {}),
    'CPI':                   ('cpi',                  {}),
    'FED_FUNDS_RATE':        ('interest_rate',         {'rate_type': 'federal_funds'}),
    'INTEREST_RATE':         ('interest_rate',         {'rate_type': 'federal_funds'}),
    'RETAIL_SALES':          ('retail_sales',          {}),
    'CONSUMER_SENTIMENT':    ('consumer_sentiment',    {}),
    'NONFARM_PAYROLL':       ('nonfarm_payroll',       {}),
    'HOUSING_STARTS':        ('housing_starts',        {}),
    'INDUSTRIAL_PRODUCTION': ('industrial_production', {}),
}


async def get_economic_indicators() -> Dict[str, Any]:
    """주요 경제지표 최신값 조회."""
    indicators: Dict[str, Any] = {}
    for key, (model, extra) in [
        ('gdp',           ('gdp', {})),
        ('unemployment',  ('unemployment', {})),
        ('cpi',           ('cpi', {})),
        ('interest_rate', ('interest_rate', {'rate_type': 'DFF'})),
    ]:
        item = _first(await QueryExecutor.fetch("fred", model, extra))
        if item is not None:
            indicators[key] = item
    return indicators


async def get_indicator_history(indicator: str, period: str = "5y") -> List:
    """경제지표 이력 조회."""
    entry = _INDICATOR_MAP.get(indicator)
    if not entry:
        return []
    model, base_params = entry
    start_date, end_date = parse_period_to_dates(period)
    params = {**base_params, "start_date": start_date, "end_date": end_date}
    raw = await QueryExecutor.fetch("fred", model, params)
    return _unwrap(raw)
