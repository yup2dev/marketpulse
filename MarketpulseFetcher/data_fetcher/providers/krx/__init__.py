"""KRX Provider — KOSPI/KOSDAQ 전 종목·ETF·국고채 (무료, pykrx)"""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.krx.models.listing import (
    KRXListingQueryParams,
    KRXListingData,
    KRXListingFetcher,
)
from data_fetcher.providers.krx.models.bond import (
    KRXBondQueryParams,
    KRXBondData,
    KRXBondFetcher,
)


krx_provider = Provider(
    name="krx",
    description="KRX (pykrx) — KOSPI/KOSDAQ 전 종목 (무료)",
    website="http://data.krx.co.kr",
    credentials=[],
    fetcher_dict={
        "listing": KRXListingFetcher,
        "bond": KRXBondFetcher,
    },
    metadata={
        "rate_limit": "none (pykrx)",
        "data_coverage": "KR KOSPI/KOSDAQ 상장 전 종목·ETF·국고채",
    },
)
