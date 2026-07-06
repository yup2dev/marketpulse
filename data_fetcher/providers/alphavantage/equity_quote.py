"""Alpha Vantage Equity Quote — QueryParams + Data + Fetcher"""
import logging
from datetime import datetime, date as date_type, timedelta
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models import EquityQuoteQueryParams, EquityQuoteData
from data_fetcher.utils.api_keys import CredentialsError, get_api_key
from data_fetcher.utils.async_http_client import amake_request
from data_fetcher.providers.alphavantage.utils.helpers import (
    ALPHA_VANTAGE_BASE_URL, check_av_errors,
)

log = logging.getLogger(__name__)


# ── QueryParams ───────────────────────────────────────────────────────────────

class AlphaVantageEquityQuoteQueryParams(EquityQuoteQueryParams):
    """Alpha Vantage 주식 시세 조회 파라미터 (EquityQuoteQueryParams 상속)"""

    start_date: Optional[date_type] = Field(
        default_factory=lambda: datetime.now().date() - timedelta(days=365),
        description="시작일 (기본값: 1년 전)"
    )
    end_date: Optional[date_type] = Field(
        default_factory=lambda: datetime.now().date(),
        description="종료일 (기본값: 오늘)"
    )


# ── Data ──────────────────────────────────────────────────────────────────────

class AlphaVantageEquityQuoteData(EquityQuoteData):
    """Alpha Vantage 주식 시세 데이터

    Standard fields covered:
        symbol, name, last_price, open, high, low, previous_close,
        change, change_percent, volume, average_volume,
        week_52_high, week_52_low, market_cap, exchange, currency, last_updated

    Alpha Vantage raw API field mapping (Global Quote format):
        "01. symbol"         → symbol
        "02. open"           → open
        "03. high"           → high
        "04. low"            → low
        "05. price"          → last_price
        "06. volume"         → volume
        "08. previous close" → previous_close
        "09. change"         → change
    """

    close: Optional[float] = Field(default=None, description="종가 (전일)")
    is_market_open: Optional[bool] = Field(default=None, description="시장 개장 여부")

    __alias_dict__ = {
        "symbol": "01. symbol",
        "open": "02. open",
        "high": "03. high",
        "low": "04. low",
        "last_price": "05. price",
        "volume": "06. volume",
        "previous_close": "08. previous close",
        "change": "09. change",
    }


# ── Fetcher ───────────────────────────────────────────────────────────────────

class AlphaVantageQuoteFetcher(
    ApiFetcher[AlphaVantageEquityQuoteQueryParams, AlphaVantageEquityQuoteData]
):
    """Alpha Vantage API를 사용한 주가 시세 데이터 Fetcher"""

    api_name = "AlphaVantage"
    api_key_env = "ALPHAVANTAGE_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> AlphaVantageEquityQuoteQueryParams:
        return AlphaVantageEquityQuoteQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: AlphaVantageEquityQuoteQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        api_key = get_api_key(
            credentials=credentials,
            api_name="Alpha Vantage",
            env_var="ALPHA_VANTAGE_API_KEY"
        )
        try:
            params = {
                'function': 'GLOBAL_QUOTE',
                'symbol': query.symbol,
                'apikey': api_key,
            }
            data = await amake_request(ALPHA_VANTAGE_BASE_URL, params=params, timeout=10)
            check_av_errors(data)
            return {
                'quote': data.get('Global Quote', {}),
                'symbol': query.symbol,
            }
        except Exception as e:
            log.error(f"Error fetching quote data from Alpha Vantage for {query.symbol}: {e}")
            raise

    @staticmethod
    def transform_data(
        query: AlphaVantageEquityQuoteQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[AlphaVantageEquityQuoteData]:
        quote = data.get('quote', {})
        symbol = data.get('symbol', query.symbol)
        if not quote:
            log.warning(f"No quote data available for {symbol}")
            return []
        try:
            quote_data = AlphaVantageEquityQuoteData.model_validate({
                **quote,
                "currency": "USD",
                "last_updated": datetime.now(),
            })
            if quote_data.last_price and quote_data.previous_close:
                quote_data.change_percent = (
                    (quote_data.last_price - quote_data.previous_close)
                    / quote_data.previous_close * 100
                )
            return [quote_data]
        except Exception as e:
            log.error(f"Error transforming quote data for {symbol}: {e}")
            raise


# ── Timeseries Fetcher ────────────────────────────────────────────────────────

class AlphaVantageTimeseriesFetcher(
    ApiFetcher[AlphaVantageEquityQuoteQueryParams, AlphaVantageEquityQuoteData]
):
    """Alpha Vantage API를 사용한 일간 주가 시계열 데이터 Fetcher"""

    api_name = "AlphaVantage"
    api_key_env = "ALPHAVANTAGE_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> AlphaVantageEquityQuoteQueryParams:
        return AlphaVantageEquityQuoteQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: AlphaVantageEquityQuoteQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        api_key = get_api_key(
            credentials=credentials,
            api_name="Alpha Vantage",
            env_var="ALPHA_VANTAGE_API_KEY"
        )
        try:
            interval = kwargs.get('interval', 'compact')
            params = {
                'function': 'TIME_SERIES_DAILY',
                'symbol': query.symbol,
                'outputsize': interval,
                'apikey': api_key,
            }
            data = await amake_request(ALPHA_VANTAGE_BASE_URL, params=params, timeout=10)
            check_av_errors(data)
            meta_data = data.get('Meta Data', {})
            time_series = data.get('Time Series (Daily)', {})
            return {
                'meta_data': meta_data,
                'time_series': time_series,
                'symbol': query.symbol,
            }
        except Exception as e:
            log.error(f"Error fetching timeseries data from Alpha Vantage for {query.symbol}: {e}")
            raise

    @staticmethod
    def transform_data(
        query: AlphaVantageEquityQuoteQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[AlphaVantageEquityQuoteData]:
        from datetime import datetime as dt

        meta_data = data.get('meta_data', {})
        time_series = data.get('time_series', {})
        symbol = data.get('symbol', query.symbol)

        if not time_series:
            log.warning(f"No timeseries data available for {symbol}")
            return []

        quote_data_list = []
        previous_close = None
        sorted_dates = sorted(time_series.keys(), reverse=True)

        for date_str in sorted_dates:
            try:
                obs_date = dt.strptime(date_str, '%Y-%m-%d').date()
                if query.start_date and obs_date < query.start_date:
                    continue
                if query.end_date and obs_date > query.end_date:
                    continue

                ts_data = time_series[date_str]
                open_price = float(ts_data.get('1. open', 0))
                high = float(ts_data.get('2. high', 0))
                low = float(ts_data.get('3. low', 0))
                close = float(ts_data.get('4. close', 0))
                volume = int(ts_data.get('5. volume', 0))

                change = None
                change_percent = None
                if previous_close:
                    change = close - previous_close
                    change_percent = (change / previous_close * 100) if previous_close > 0 else None
                previous_close = close

                quote_obj = AlphaVantageEquityQuoteData(
                    symbol=symbol,
                    name=meta_data.get('2. Symbol', symbol),
                    last_price=close,
                    open=open_price,
                    high=high,
                    low=low,
                    previous_close=previous_close,
                    change=change,
                    change_percent=change_percent,
                    volume=volume,
                    currency='USD',
                    last_updated=dt.strptime(date_str, '%Y-%m-%d'),
                )
                quote_data_list.append(quote_obj)
            except (ValueError, KeyError) as e:
                log.warning(f"Error parsing timeseries data for {date_str}: {e}")
                continue

        return quote_data_list
