"""한국투자증권(KIS) Open API provider."""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.kis.models.ranking import KISRankingFetcher


kis_provider = Provider(
    name="kis",
    description="한국투자증권(KIS) Open API — 국내주식 실시간 순위",
    website="https://apiportal.koreainvestment.com",
    credentials=["appkey", "appsecret"],
    fetcher_dict={
        "ranking": KISRankingFetcher,
    },
    metadata={
        "rate_limit": "초당 약 20건 (실전)",
        "data_coverage": "KR KOSPI/KOSDAQ 등락률·거래량·거래대금 순위",
    },
)
