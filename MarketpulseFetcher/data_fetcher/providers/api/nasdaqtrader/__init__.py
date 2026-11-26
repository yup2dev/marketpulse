"""NASDAQ Trader Provider — NYSE/NASDAQ 전 종목 (무료·공개)"""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.api.nasdaqtrader.models.listing import (
    NasdaqTraderListingQueryParams,
    NasdaqTraderListingData,
    NasdaqTraderListingFetcher,
)


nasdaqtrader_provider = Provider(
    name="nasdaqtrader",
    description="NASDAQ Trader Symbol Directory — NYSE/NASDAQ 전 종목 (무료·공개)",
    website="https://www.nasdaqtrader.com/Trader.aspx?id=symboldirdefs",
    credentials=[],
    fetcher_dict={
        "listing": NasdaqTraderListingFetcher,
    },
    metadata={
        "rate_limit": "none (정적 공개 파일)",
        "data_coverage": "US NYSE/NASDAQ 상장 전 종목, 일 갱신",
    },
)
