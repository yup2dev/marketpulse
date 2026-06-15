"""Tiingo Equity Historical (OHLCV) — OpenBB openbb_tiingo 이식본.

일/주/월: GET /tiingo/daily/{symbol}/prices
분/시간(인트라데이): GET /iex/{symbol}/prices  (resampleFreq)
인증: token 쿼리 파라미터. 키 미설정 시 CredentialsError.
"""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.abstract_provider.standard_models.equity_historical import (
    EquityHistoricalData,
    EquityHistoricalQueryParams,
)
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.async_http_client import amake_request

log = logging.getLogger(__name__)

BASE = "https://api.tiingo.com"

# interval → tiingo resampleFreq
_DAILY = {"1d": "daily", "1wk": "weekly", "1W": "weekly", "1mo": "monthly", "1M": "monthly"}
_INTRADAY = {
    "1m": "1min", "5m": "5min", "15m": "15min", "30m": "30min",
    "1h": "1hour", "4h": "4hour",
}


class TiingoEquityHistoricalQueryParams(EquityHistoricalQueryParams):
    """Tiingo OHLCV 조회 파라미터 (표준 모델 그대로)."""


class TiingoEquityHistoricalData(EquityHistoricalData):
    """Tiingo OHLCV 데이터 (표준 모델 그대로)."""


class TiingoEquityHistoricalFetcher(
    Fetcher[TiingoEquityHistoricalQueryParams, TiingoEquityHistoricalData]
):
    @staticmethod
    def transform_query(params: Dict[str, Any]) -> TiingoEquityHistoricalQueryParams:
        return TiingoEquityHistoricalQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: TiingoEquityHistoricalQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        token = get_api_key(credentials, api_name="Tiingo", env_var="TIINGO_API_KEY")
        interval = (query.interval or "1d").lower()

        req: Dict[str, Any] = {"token": token, "format": "json"}
        if query.start_date:
            req["startDate"] = query.start_date
        if query.end_date:
            req["endDate"] = query.end_date

        if interval in _INTRADAY:
            url = f"{BASE}/iex/{query.symbol}/prices"
            req["resampleFreq"] = _INTRADAY[interval]
        else:
            url = f"{BASE}/tiingo/daily/{query.symbol}/prices"
            req["resampleFreq"] = _DAILY.get(interval, "daily")

        data = await amake_request(url, params=req, headers={"Content-Type": "application/json"})
        if isinstance(data, dict):  # 에러 응답({"detail": ...})은 dict
            log.warning("[tiingo] %s: %s", query.symbol, data.get("detail") or data)
            return []
        return data if isinstance(data, list) else []

    @staticmethod
    def transform_data(
        query: TiingoEquityHistoricalQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[TiingoEquityHistoricalData]:
        out: List[TiingoEquityHistoricalData] = []
        for row in data or []:
            d = row.get("date")
            if not d:
                continue
            # 수정(adj) 값이 있으면 우선, 없으면 원본 OHLCV
            out.append(
                TiingoEquityHistoricalData(
                    symbol=query.symbol,
                    date=d,
                    open=row.get("adjOpen", row.get("open")),
                    high=row.get("adjHigh", row.get("high")),
                    low=row.get("adjLow", row.get("low")),
                    close=row.get("adjClose", row.get("close")),
                    adj_close=row.get("adjClose"),
                    volume=row.get("adjVolume", row.get("volume")),
                )
            )
        return out
