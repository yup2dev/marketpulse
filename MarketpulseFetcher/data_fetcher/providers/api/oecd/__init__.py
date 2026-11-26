"""OpenBB 이식 패키지."""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.api.oecd.models.composite_leading_indicator import OECDCompositeLeadingIndicatorFetcher
from data_fetcher.providers.api.oecd.models.consumer_price_index import OECDCPIFetcher
from data_fetcher.providers.api.oecd.models.country_interest_rates import OecdCountryInterestRatesFetcher
from data_fetcher.providers.api.oecd.models.gdp_forecast import OECDGdpForecastFetcher
from data_fetcher.providers.api.oecd.models.gdp_nominal import OECDGdpNominalFetcher
from data_fetcher.providers.api.oecd.models.gdp_real import OECDGdpRealFetcher
from data_fetcher.providers.api.oecd.models.house_price_index import OECDHousePriceIndexFetcher
from data_fetcher.providers.api.oecd.models.share_price_index import OECDSharePriceIndexFetcher
from data_fetcher.providers.api.oecd.models.unemployment import OECDUnemploymentFetcher


oecd_provider = Provider(
    name="oecd",
    description="OECD — 거시 경제 지표 (GDP/CPI/실업률/금리 등)",
    website="https://data-explorer.oecd.org",
    credentials=[],
    fetcher_dict={
        "composite_leading_indicator": OECDCompositeLeadingIndicatorFetcher,
        "consumer_price_index": OECDCPIFetcher,
        "country_interest_rates": OecdCountryInterestRatesFetcher,
        "gdp_forecast": OECDGdpForecastFetcher,
        "gdp_nominal": OECDGdpNominalFetcher,
        "gdp_real": OECDGdpRealFetcher,
        "house_price_index": OECDHousePriceIndexFetcher,
        "share_price_index": OECDSharePriceIndexFetcher,
        "unemployment": OECDUnemploymentFetcher,
    },
    metadata={"group": "macro", "data_coverage": "OECD member economies"},
)
