"""FMP Helpers Module."""

from datetime import date
from functools import lru_cache
from typing import Any

FMP_BASE_URL = "https://financialmodelingprep.com/stable"


async def response_callback(response, _):
    """Use callback for make_request."""
    if response.status != 200:
        msg = await response.text()
        code = response.status
        raise ValueError(f"Unauthorized FMP request -> {code} -> {msg}")

    data = await response.json()

    if isinstance(data, dict):
        error_message = data.get("Error Message", data.get("error"))
        if error_message is not None:
            conditions = (
                "upgrade" in error_message.lower()
                or "exclusive endpoint" in error_message.lower()
                or "special endpoint" in error_message.lower()
                or "premium query parameter" in error_message.lower()
                or "subscription" in error_message.lower()
                or "unauthorized" in error_message.lower()
                or "premium" in error_message.lower()
            )
            if conditions:
                raise ValueError(f"Unauthorized FMP request -> {error_message}")
            raise ValueError(
                f"FMP Error Message -> Status code: {response.status} -> {error_message}"
            )
    return data


async def get_data(url: str, **kwargs: Any) -> list | dict:
    """Get data from FMP endpoint."""
    # NOTE: aiohttp 기반 amake_request 사용 — httpx 버전(async_http_client)은
    # response_callback 파라미터를 받지 않는다.
    from data_fetcher.utils.provider_helpers import amake_request
    return await amake_request(url, response_callback=response_callback, **kwargs)


async def get_data_many(
    url: str, sub_dict: str | None = None, **kwargs: Any
) -> list[dict]:
    """Get data from FMP endpoint and convert to list of schemas."""
    data = await get_data(url, **kwargs)
    if sub_dict and isinstance(data, dict):
        data = data.get(sub_dict, [])
    if isinstance(data, dict):
        raise ValueError("Expected list of dicts, got dict")
    if len(data) == 0:
        raise ValueError("No data returned from FMP")
    return data


async def get_data_one(url: str, **kwargs: Any) -> dict:
    """Get data from FMP endpoint and convert to schema."""
    data = await get_data(url, **kwargs)
    if isinstance(data, list):
        if len(data) == 0:
            raise ValueError("Expected dict, got empty list")
        try:
            data = {i: data[i] for i in range(len(data))} if len(data) > 1 else data[0]
        except TypeError as e:
            raise ValueError("Expected dict, got list of dicts") from e
    return data


def create_url(
    version: int,
    endpoint: str,
    api_key: str | None,
    query: Any | None = None,
    exclude: list[str] | None = None,
) -> str:
    """Return a URL for the FMP API."""
    from pydantic import BaseModel
    the_dict = {}
    if query:
        the_dict = query.model_dump() if isinstance(query, BaseModel) else query
    exclude = exclude or []
    qs = "&".join(f"{k}={v}" for k, v in the_dict.items() if k not in exclude and v is not None)
    return f"https://financialmodelingprep.com/api/v{version}/{endpoint}?{qs}&apikey={api_key}"


def most_recent_quarter(base: date | None = None) -> date:
    """Get the most recent quarter date."""
    if base is None:
        base = date.today()
    base = min(base, date.today())
    exacts = [(3, 31), (6, 30), (9, 30), (12, 31)]
    for exact in exacts:
        if base.month == exact[0] and base.day == exact[1]:
            return base
    if base.month < 4:
        return date(base.year - 1, 12, 31)
    if base.month < 7:
        return date(base.year, 3, 31)
    if base.month < 10:
        return date(base.year, 6, 30)
    return date(base.year, 9, 30)


def get_interval(value: str) -> str:
    """Get the intervals for the FMP API."""
    intervals = {"m": "min", "h": "hour", "d": "day"}
    return f"{value[:-1]}{intervals[value[-1]]}"
