"""Alpha Vantage Helpers Module."""

from datetime import datetime
from typing import Any

ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query"

CRYPTO_FUNCTION_MAP = {
    "daily": "DIGITAL_CURRENCY_DAILY",
    "weekly": "DIGITAL_CURRENCY_WEEKLY",
    "monthly": "DIGITAL_CURRENCY_MONTHLY",
}

FOREX_FUNCTION_MAP = {
    "daily": "FX_DAILY",
    "weekly": "FX_WEEKLY",
    "monthly": "FX_MONTHLY",
}

INTERVALS_DICT = {
    "m": "TIME_SERIES_INTRADAY",
    "d": "TIME_SERIES_DAILY",
    "W": "TIME_SERIES_WEEKLY",
    "M": "TIME_SERIES_MONTHLY",
}


def get_interval(value: str) -> str:
    """Get the intervals for the Alpha Vantage API."""
    intervals = {
        "m": "min",
        "d": "day",
        "W": "week",
        "M": "month",
    }
    return f"{value[:-1]}{intervals[value[-1]]}"


def extract_key_name(key):
    """Extract the alphabetical part of the key using regex."""
    import re
    match = re.search(r"\d+\.\s+([a-z]+)", key, re.I)
    return match.group(1) if match else key


def filter_by_dates(
    data: list[dict[str, Any]], start_date: datetime, end_date: datetime
) -> list[dict[str, Any]]:
    """Filter the data by start and end dates."""
    return list(
        filter(
            lambda x: start_date
            <= datetime.strptime(x["date"], "%Y-%m-%d").date()
            <= end_date,
            data,
        )
    )


def check_av_errors(data: dict) -> None:
    """Check for Alpha Vantage API errors and raise ValueError if found."""
    if "Error Message" in data:
        raise ValueError(data["Error Message"])
    if "Note" in data:
        raise ValueError(f"Rate limit: {data['Note']}")
    if "Information" in data:
        raise ValueError(f"API info: {data['Information']}")
