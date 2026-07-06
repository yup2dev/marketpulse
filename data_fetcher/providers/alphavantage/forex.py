"""Alpha Vantage Forex — QueryParams + Data + Fetcher"""
import logging
from datetime import date as date_type, datetime
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.forex_historical import (
    ForexHistoricalQueryParams,
    ForexHistoricalData,
)
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.provider_helpers import amake_json_request as amake_request
from data_fetcher.providers.alphavantage.utils.helpers import (
    ALPHA_VANTAGE_BASE_URL, FOREX_FUNCTION_MAP, check_av_errors,
)

log = logging.getLogger(__name__)


# ── QueryParams ───────────────────────────────────────────────────────────────

class ForexQueryParams(ForexHistoricalQueryParams):
    """외환 데이터 조회 파라미터 (standard ForexHistorical 경유)"""


# ── Data ──────────────────────────────────────────────────────────────────────

class ForexData(ForexHistoricalData):
    """외환 데이터 (standard ForexHistorical 경유)"""


# ── Fetcher ───────────────────────────────────────────────────────────────────

class AlphaVantageForexFetcher(ApiFetcher[ForexQueryParams, ForexData]):
    """AlphaVantage 외환 데이터 Fetcher"""

    api_name = "AlphaVantage"
    api_key_env = "ALPHAVANTAGE_API_KEY"

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
