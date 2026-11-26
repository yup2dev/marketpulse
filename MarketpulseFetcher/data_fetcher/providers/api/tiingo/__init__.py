"""Tiingo provider — OpenBB(openbb_tiingo) 이식본.

data_fetcher abstract_provider 패턴(transform_query/aextract_data/transform_data)에 맞춰
OpenBB tiingo 모델을 이식한다. 키: TIINGO_API_KEY (또는 사용자 등록 키 credentials.api_key).
"""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.api.tiingo.models.equity_historical import TiingoEquityHistoricalFetcher


tiingo_provider = Provider(
    name="tiingo",
    description="Tiingo Market Data API (EOD/intraday OHLCV)",
    website="https://www.tiingo.com",
    credentials=["api_key"],
    fetcher_dict={
        # yahoo와 같은 model 키 — standard EquityHistorical 공유 (yahoo stock_price 대체용)
        "stock_price": TiingoEquityHistoricalFetcher,
    },
    metadata={
        "data_coverage": "US/global equity OHLCV (EOD + IEX intraday)",
    },
)
