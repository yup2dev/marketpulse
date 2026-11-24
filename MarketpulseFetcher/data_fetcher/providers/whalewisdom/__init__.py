"""WhaleWisdom Provider"""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.whalewisdom.models.institutional_holdings import WhaleWisdomFetcher
from data_fetcher.providers.whalewisdom.models.institutions_list import InstitutionsListFetcher


whalewisdom_provider = Provider(
    name="whalewisdom",
    description="WhaleWisdom Institutional Holdings (SEC EDGAR 13F)",
    credentials=[],
    fetcher_dict={
        "institutional_holdings": WhaleWisdomFetcher,
        "institutions_list": InstitutionsListFetcher,
    },
)
