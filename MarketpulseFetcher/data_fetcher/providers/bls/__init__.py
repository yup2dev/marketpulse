"""OpenBB 이식 패키지."""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.bls.models.search import BlsSearchFetcher
from data_fetcher.providers.bls.models.series import BlsSeriesFetcher


bls_provider = Provider(
    name="bls",
    description="U.S. Bureau of Labor Statistics — 시계열(고용·물가·임금 등)",
    website="https://www.bls.gov",
    credentials=[],  # 키 없이도 공개 API 동작(키 등록 시 일일 한도 상향)
    fetcher_dict={
        "series": BlsSeriesFetcher,
        "search": BlsSearchFetcher,
    },
    metadata={"group": "macro", "data_coverage": "US labor/price statistics"},
)
