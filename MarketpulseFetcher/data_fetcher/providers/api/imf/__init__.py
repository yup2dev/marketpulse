"""OpenBB 이식 패키지."""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.api.imf.models.available_indicators import ImfAvailableIndicatorsFetcher
from data_fetcher.providers.api.imf.models.consumer_price_index import ImfConsumerPriceIndexFetcher
from data_fetcher.providers.api.imf.models.direction_of_trade import ImfDirectionOfTradeFetcher
from data_fetcher.providers.api.imf.models.economic_indicators import ImfEconomicIndicatorsFetcher
from data_fetcher.providers.api.imf.models.maritime_chokepoint_info import ImfMaritimeChokePointInfoFetcher
from data_fetcher.providers.api.imf.models.maritime_chokepoint_volume import ImfMaritimeChokePointVolumeFetcher
from data_fetcher.providers.api.imf.models.port_info import ImfPortInfoFetcher
from data_fetcher.providers.api.imf.models.port_volume import ImfPortVolumeFetcher


imf_provider = Provider(
    name="imf",
    description="International Monetary Fund — 경제 지표/무역/항만(SDMX)",
    website="https://data.imf.org",
    credentials=[],
    fetcher_dict={
        "available_indicators": ImfAvailableIndicatorsFetcher,
        "consumer_price_index": ImfConsumerPriceIndexFetcher,
        "direction_of_trade": ImfDirectionOfTradeFetcher,
        "economic_indicators": ImfEconomicIndicatorsFetcher,
        "maritime_chokepoint_info": ImfMaritimeChokePointInfoFetcher,
        "maritime_chokepoint_volume": ImfMaritimeChokePointVolumeFetcher,
        "port_info": ImfPortInfoFetcher,
        "port_volume": ImfPortVolumeFetcher,
    },
    metadata={"group": "macro", "data_coverage": "IMF global economic data"},
)
