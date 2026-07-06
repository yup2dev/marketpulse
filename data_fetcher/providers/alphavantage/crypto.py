"""Alpha Vantage Cryptocurrency — QueryParams + Data + Fetcher"""
import logging
from datetime import date as date_type, datetime
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.equity_historical import (
    EquityHistoricalQueryParams,
    EquityHistoricalData,
)
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.async_http_client import amake_request
from data_fetcher.providers.alphavantage.utils.helpers import (
    ALPHA_VANTAGE_BASE_URL, CRYPTO_FUNCTION_MAP, check_av_errors,
)

log = logging.getLogger(__name__)


# ── QueryParams ───────────────────────────────────────────────────────────────

class CryptoQueryParams(EquityHistoricalQueryParams):
    """암호화폐 데이터 조회 파라미터 (standard EquityHistorical 경유)"""
    market: str = Field(default="USD", description="거래 시장 (예: USD, EUR, KRW)")
    interval: str = Field(default="daily", description="데이터 간격 (daily, weekly, monthly)")


# ── Data ──────────────────────────────────────────────────────────────────────

class CryptoData(EquityHistoricalData):
    """암호화폐 데이터 (standard EquityHistorical 경유, 코인 전용 필드 추가)"""
    market: str = Field(description="거래 시장")
    volume: Optional[float] = Field(default=None, description="거래량")  # 코인은 소수 거래량 → float override
    market_cap: Optional[float] = Field(default=None, description="시가총액 (USD)")
    volatility: Optional[float] = Field(default=None, description="변동성 (고가 - 저가)")


# ── Fetcher ───────────────────────────────────────────────────────────────────

class AlphaVantageCryptoFetcher(ApiFetcher[CryptoQueryParams, CryptoData]):
    """AlphaVantage 암호화폐 데이터 Fetcher"""

    api_name = "AlphaVantage"
    api_key_env = "ALPHAVANTAGE_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> CryptoQueryParams:
        return CryptoQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: CryptoQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        api_key = get_api_key(
            credentials=credentials,
            api_name="AlphaVantage",
            env_var="ALPHAVANTAGE_API_KEY"
        )
        function = CRYPTO_FUNCTION_MAP.get(query.interval.lower(), 'DIGITAL_CURRENCY_DAILY')
        try:
            params = {
                'function': function,
                'symbol': query.symbol.upper(),
                'market': query.market.upper(),
                'apikey': api_key,
            }
            data = await amake_request(ALPHA_VANTAGE_BASE_URL, params=params, timeout=30)
            check_av_errors(data)
            return data
        except Exception as e:
            log.error(f"Error fetching crypto data: {e}")
            raise

    @staticmethod
    def transform_data(
        query: CryptoQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[CryptoData]:
        time_series_key = next((k for k in data if 'Time Series' in k), None)
        if not time_series_key:
            log.warning("No time series data found")
            return []

        time_series = data[time_series_key]
        result = []
        prev_close = None

        start_date = datetime.strptime(query.start_date, '%Y-%m-%d').date() if query.start_date else None
        end_date = datetime.strptime(query.end_date, '%Y-%m-%d').date() if query.end_date else None

        for date_str, values in time_series.items():
            try:
                crypto_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                if start_date and crypto_date < start_date:
                    continue
                if end_date and crypto_date > end_date:
                    continue

                open_price = float(values.get('1. open', 0))
                high_price = float(values.get('2. high', 0))
                low_price = float(values.get('3. low', 0))
                close_price = float(values.get('4. close', 0))
                volume = float(values.get('5. volume', 0))
                market_cap = float(values['6. market cap (USD)']) if '6. market cap (USD)' in values else None

                price_change = close_price - open_price
                price_change_pct = (price_change / open_price * 100) if open_price > 0 else None
                volatility = high_price - low_price
                daily_return = ((close_price - prev_close) / prev_close * 100) if prev_close and prev_close > 0 else None

                result.append(CryptoData(
                    symbol=query.symbol.upper(),
                    market=query.market.upper(),
                    date=crypto_date,
                    open=open_price, high=high_price, low=low_price, close=close_price,
                    volume=volume, market_cap=market_cap, daily_return=daily_return,
                    price_change=price_change, price_change_pct=price_change_pct,
                    volatility=volatility,
                ))
                prev_close = close_price
            except (ValueError, KeyError) as e:
                log.warning(f"Error parsing crypto data for {date_str}: {e}")
                continue

        result.sort(key=lambda x: x.date)
        log.info(f"Fetched {len(result)} crypto records for {query.symbol}/{query.market}")
        return result
