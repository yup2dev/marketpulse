"""Alpha Vantage Forex — QueryParams + Data + Fetcher"""
import logging
from datetime import date as date_type, datetime
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.abstract_provider.abstract import BaseQueryParams, BaseData
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.async_http_client import amake_request
from data_fetcher.providers.alphavantage.utils.helpers import (
    ALPHA_VANTAGE_BASE_URL, FOREX_FUNCTION_MAP, check_av_errors,
)

log = logging.getLogger(__name__)


# ── QueryParams ───────────────────────────────────────────────────────────────

class ForexQueryParams(BaseQueryParams):
    """외환 데이터 조회 파라미터"""
    from_currency: str = Field(description="기준 통화 (예: USD, EUR, KRW)")
    to_currency: str = Field(description="대상 통화 (예: USD, EUR, KRW)")
    start_date: Optional[str] = Field(default=None, description="조회 시작일 (YYYY-MM-DD)")
    end_date: Optional[str] = Field(default=None, description="조회 종료일 (YYYY-MM-DD)")
    interval: str = Field(default="daily", description="데이터 간격 (daily, weekly, monthly)")


# ── Data ──────────────────────────────────────────────────────────────────────

class ForexData(BaseData):
    """외환 데이터"""
    from_currency: str = Field(description="기준 통화")
    to_currency: str = Field(description="대상 통화")
    date: date_type = Field(description="날짜")
    open: float = Field(description="시가")
    high: float = Field(description="고가")
    low: float = Field(description="저가")
    close: float = Field(description="종가")
    daily_change: Optional[float] = Field(default=None, description="일일 변동 (종가 - 시가)")
    daily_change_pct: Optional[float] = Field(default=None, description="일일 변동률 (%)")
    volatility: Optional[float] = Field(default=None, description="변동성 (고가 - 저가)")


# ── Fetcher ───────────────────────────────────────────────────────────────────

class AlphaVantageForexFetcher(Fetcher[ForexQueryParams, ForexData]):
    """AlphaVantage 외환 데이터 Fetcher"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> ForexQueryParams:
        return ForexQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: ForexQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        api_key = get_api_key(
            credentials=credentials,
            api_name="AlphaVantage",
            env_var="ALPHAVANTAGE_API_KEY"
        )
        function = FOREX_FUNCTION_MAP.get(query.interval.lower(), 'FX_DAILY')
        try:
            params = {
                'function': function,
                'from_symbol': query.from_currency.upper(),
                'to_symbol': query.to_currency.upper(),
                'apikey': api_key,
                'outputsize': 'full',
            }
            data = await amake_request(ALPHA_VANTAGE_BASE_URL, params=params, timeout=30)
            check_av_errors(data)
            return data
        except Exception as e:
            log.error(f"Error fetching forex data: {e}")
            raise

    @staticmethod
    def transform_data(
        query: ForexQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[ForexData]:
        time_series_key = next((k for k in data if 'Time Series' in k), None)
        if not time_series_key:
            log.warning("No time series data found")
            return []

        time_series = data[time_series_key]
        result = []

        start_date = datetime.strptime(query.start_date, '%Y-%m-%d').date() if query.start_date else None
        end_date = datetime.strptime(query.end_date, '%Y-%m-%d').date() if query.end_date else None

        for date_str, values in time_series.items():
            try:
                fx_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                if start_date and fx_date < start_date:
                    continue
                if end_date and fx_date > end_date:
                    continue

                open_price = float(values['1. open'])
                high_price = float(values['2. high'])
                low_price = float(values['3. low'])
                close_price = float(values['4. close'])
                daily_change = close_price - open_price
                daily_change_pct = (daily_change / open_price * 100) if open_price > 0 else None
                volatility = high_price - low_price

                result.append(ForexData(
                    from_currency=query.from_currency.upper(),
                    to_currency=query.to_currency.upper(),
                    date=fx_date,
                    open=open_price, high=high_price, low=low_price, close=close_price,
                    daily_change=daily_change, daily_change_pct=daily_change_pct,
                    volatility=volatility,
                ))
            except (ValueError, KeyError) as e:
                log.warning(f"Error parsing forex data for {date_str}: {e}")
                continue

        result.sort(key=lambda x: x.date)
        log.info(f"Fetched {len(result)} forex records for {query.from_currency}/{query.to_currency}")
        return result
