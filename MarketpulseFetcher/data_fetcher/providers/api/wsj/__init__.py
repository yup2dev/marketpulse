"""OpenBB 이식 패키지."""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.api.wsj.models.active import WSJActiveFetcher
from data_fetcher.providers.api.wsj.models.gainers import WSJGainersFetcher
from data_fetcher.providers.api.wsj.models.losers import WSJLosersFetcher


wsj_provider = Provider(
    name="wsj",
    description="Wall Street Journal — ETF movers (most active / gainers / losers)",
    website="https://www.wsj.com/market-data",
    credentials=[],
    fetcher_dict={
        "etf_active": WSJActiveFetcher,
        "etf_gainers": WSJGainersFetcher,
        "etf_losers": WSJLosersFetcher,
    },
    metadata={"group": "stock", "data_coverage": "US ETF performance movers"},
)
